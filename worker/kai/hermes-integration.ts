/**
 * HERMES + KAI Integration
 * Hybrid routing, bidirectional learning, and cross-system communication
 */

import {
	HermesRoutingDecision,
	CrossSystemLearning,
	ExecutionStatus,
} from "./types";
import { jsonToText, textToJson } from "./db";

export interface HermesRequest {
	query: string;
	context?: Record<string, any>;
	userId?: string;
	timestamp: number;
	correlationId: string;
}

export interface RoutingResult {
	system: "hermes" | "kai" | "hybrid";
	confidence: number;
	decision: HermesRoutingDecision;
	workflowId?: string;
	reasoning: string;
}

/**
 * Hybrid Router - decides between HERMES and KAI
 */
export class HybridRouter {
	private db: D1Database;
	private kv: KVNamespace;

	// Confidence thresholds
	private hermesThreshold = 0.8; // >= 0.8 use HERMES
	private kaiThreshold = 0.65; // < 0.65 use KAI
	// 0.65-0.8: HYBRID mode

	constructor(db: D1Database, kv: KVNamespace) {
		this.db = db;
		this.kv = kv;
	}

	/**
	 * Route incoming request to HERMES, KAI, or HYBRID
	 */
	async routeRequest(request: HermesRequest): Promise<RoutingResult> {
		// Get HERMES confidence score (would come from HERMES Conductor)
		const hermesConfidence = await this.getHermesConfidence(request);

		let system: "hermes" | "kai" | "hybrid";
		let reasoning: string;

		if (hermesConfidence >= this.hermesThreshold) {
			system = "hermes";
			reasoning = `High confidence (${hermesConfidence.toFixed(2)}) - route to HERMES agents`;
		} else if (hermesConfidence < this.kaiThreshold) {
			system = "kai";
			reasoning = `Low confidence (${hermesConfidence.toFixed(2)}) - use KAI deterministic workflow`;
		} else {
			system = "hybrid";
			reasoning = `Medium confidence (${hermesConfidence.toFixed(2)}) - use hybrid approach`;
		}

		// Find matching workflow for KAI routing
		let workflowId: string | undefined;
		if (system !== "hermes") {
			workflowId = await this.findMatchingWorkflow(request);
		}

		const decision: HermesRoutingDecision = {
			agent: system,
			confidence: hermesConfidence,
			reasoning,
			task: request.query,
			timestamp: Date.now(),
		};

		return {
			system,
			confidence: hermesConfidence,
			decision,
			workflowId,
			reasoning,
		};
	}

	/**
	 * Get HERMES confidence score from memory
	 */
	private async getHermesConfidence(request: HermesRequest): Promise<number> {
		// Query unified_patterns to find matching patterns
		const patterns = await this.db
			.prepare(
				`SELECT confidence, best_system FROM unified_patterns
         WHERE triggers LIKE ? OR pattern_name LIKE ?
         ORDER BY confidence DESC
         LIMIT 1`,
			)
			.bind(
				`%${request.query.substring(0, 20)}%`,
				`%${request.query.substring(0, 10)}%`,
			)
			.first();

		if (patterns && patterns.best_system === "hermes") {
			return Math.min(patterns.confidence, 0.95);
		}

		// Default confidence (would be computed by HERMES Conductor in production)
		return 0.7;
	}

	/**
	 * Find matching workflow for request
	 */
	private async findMatchingWorkflow(
		request: HermesRequest,
	): Promise<string | undefined> {
		// Search for workflows that might handle this request
		const result = await this.db
			.prepare(
				`SELECT id FROM workflows
         WHERE status = 'published' AND (name LIKE ? OR description LIKE ?)
         LIMIT 1`,
			)
			.bind(
				`%${request.query.substring(0, 20)}%`,
				`%${request.query.substring(0, 20)}%`,
			)
			.first();

		return result?.id;
	}

	/**
	 * Execute HERMES → KAI handoff
	 */
	async hermesCallKai(
		hermesCorrelationId: string,
		workflowId: string,
		input: Record<string, any>,
		hermesConfidence: number,
	): Promise<string> {
		// Store correlation record
		const correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		await this.db
			.prepare(
				`INSERT INTO execution_correlations
         (id, hermes_episode_id, kai_workflow_execution_id, hermes_decision, learned_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
			)
			.bind(
				correlationId,
				hermesCorrelationId,
				workflowId,
				`hermes_handoff_${hermesConfidence}`,
			)
			.run();

		// Queue workflow execution
		const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		await this.db
			.prepare(
				`INSERT INTO workflow_executions
         (id, workflow_id, status, started_at, context_json)
         VALUES (?, ?, 'pending', datetime('now'), ?)`,
			)
			.bind(executionId, workflowId, jsonToText({ input, correlationId }))
			.run();

		return executionId;
	}

	/**
	 * Record execution correlation (after KAI completes)
	 */
	async recordExecutionOutcome(
		correlation: CrossSystemLearning,
	): Promise<void> {
		// Update correlation record with result
		await this.db
			.prepare(
				`UPDATE execution_correlations
         SET kai_result = ?, outcome_rating = ?, execution_time_ms = ?
         WHERE id = ?`,
			)
			.bind(
				jsonToText(correlation.result),
				correlation.success ? 1.0 : 0.0,
				correlation.duration,
				correlation.correlationId,
			)
			.run();

		// Learn from successful executions
		if (correlation.success && correlation.patterns) {
			for (const pattern of correlation.patterns) {
				await this.learnPattern(
					"kai_analysis",
					pattern,
					correlation.workflowId,
					0.9,
				);
			}
		}
	}

	/**
	 * Learn pattern and update routing
	 */
	private async learnPattern(
		source: string,
		patternName: string,
		workflowId: string,
		confidence: number,
	): Promise<void> {
		const id = `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Determine best system based on pattern origin
		const bestSystem = source === "kai_analysis" ? "kai" : "hermes";

		await this.db
			.prepare(
				`INSERT INTO unified_patterns
         (id, pattern_name, best_system, success_rate, confidence, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(pattern_name) DO UPDATE SET
         success_rate = (success_rate + ?) / 2,
         confidence = MAX(confidence, ?),
         use_count = use_count + 1`,
			)
			.bind(
				id,
				patternName,
				bestSystem,
				0.85,
				confidence,
				source,
				0.85,
				confidence,
			)
			.run();

		// Cache pattern in KV for fast lookup
		await this.kv.put(
			`pattern:${patternName}`,
			JSON.stringify({
				workflowId,
				system: bestSystem,
				confidence,
			}),
			{ expirationTtl: 86400 },
		);
	}

	/**
	 * Get learning statistics
	 */
	async getLearningStats(): Promise<Record<string, any>> {
		const patterns = await this.db
			.prepare(
				`SELECT
           COUNT(*) as total_patterns,
           AVG(confidence) as avg_confidence,
           COUNT(CASE WHEN best_system = 'hermes' THEN 1 END) as hermes_patterns,
           COUNT(CASE WHEN best_system = 'kai' THEN 1 END) as kai_patterns
         FROM unified_patterns`,
			)
			.first();

		const correlations = await this.db
			.prepare(
				`SELECT
           COUNT(*) as total_correlations,
           SUM(CASE WHEN outcome_rating >= 0.8 THEN 1 ELSE 0 END) as successful,
           AVG(outcome_rating) as avg_success_rate
         FROM execution_correlations`,
			)
			.first();

		return {
			patternsLearned: patterns?.total_patterns || 0,
			avgConfidence: patterns?.avg_confidence || 0,
			hermesPatterns: patterns?.hermes_patterns || 0,
			kaiPatterns: patterns?.kai_patterns || 0,
			crossSystemCalls: correlations?.total_correlations || 0,
			successfulHandoffs: correlations?.successful || 0,
			avgHandoffSuccess: correlations?.avg_success_rate || 0,
		};
	}

	/**
	 * Get routing decision history
	 */
	async getRoutingHistory(limit: number = 100): Promise<any[]> {
		const results = await this.db
			.prepare(
				`SELECT
           hermes_decision,
           outcome_rating,
           execution_time_ms,
           learned_at
         FROM execution_correlations
         ORDER BY learned_at DESC
         LIMIT ?`,
			)
			.bind(limit)
			.all();

		return (results.results || []).map((row) => ({
			decision: row.hermes_decision,
			success: row.outcome_rating >= 0.8,
			duration: row.execution_time_ms,
			timestamp: row.learned_at,
		}));
	}
}

/**
 * Cross-System Learning Coordinator
 */
export class LearningCoordinator {
	private db: D1Database;
	private kv: KVNamespace;
	private router: HybridRouter;

	constructor(db: D1Database, kv: KVNamespace, router: HybridRouter) {
		this.db = db;
		this.kv = kv;
		this.router = router;
	}

	/**
	 * Process learning from KAI execution
	 */
	async processKaiLearning(
		executionId: string,
		success: boolean,
		duration: number,
		patterns: string[],
	): Promise<void> {
		// Get execution details
		const execution = await this.db
			.prepare(
				`SELECT workflow_id, context_json FROM workflow_executions WHERE id = ?`,
			)
			.bind(executionId)
			.first();

		if (!execution) return;

		const context = textToJson(execution.context_json);
		const correlationId = context.correlationId;

		// Record learning
		const learning: CrossSystemLearning = {
			correlationId,
			workflowId: execution.workflow_id,
			executionId,
			success,
			duration,
			patterns,
			result: context.output,
		};

		await this.router.recordExecutionOutcome(learning);
	}

	/**
	 * Process learning from HERMES execution (feedback)
	 */
	async processHermesLearning(
		episodeId: string,
		agent: string,
		success: boolean,
		confidence: number,
	): Promise<void> {
		// Update confidence for this agent/pattern combination
		// This would feed back into HERMES' semantic memory
		// For now, store in unified_patterns

		const patternKey = `hermes_${agent}_success`;
		await this.router.recordExecutionOutcome({
			correlationId: episodeId,
			workflowId: agent,
			executionId: episodeId,
			success,
			duration: 0,
			result: { agentType: agent, confidence },
		});
	}

	/**
	 * Suggest new workflow based on HERMES patterns
	 */
	async suggestWorkflow(
		hermesPattern: string,
		frequency: number,
	): Promise<{ suggested: boolean; reason: string }> {
		// If HERMES is routing to KAI frequently for same pattern,
		// suggest creating a workflow to handle it

		if (frequency > 10) {
			return {
				suggested: true,
				reason: `HERMES routed to KAI ${frequency} times for pattern "${hermesPattern}" - consider creating dedicated workflow`,
			};
		}

		return {
			suggested: false,
			reason: "Insufficient frequency to justify new workflow",
		};
	}
}
