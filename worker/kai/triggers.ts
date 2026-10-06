/**
 * KAI Trigger System
 * Handles webhook, schedule, event, and manual triggers
 */

import { TriggerConfig, WorkflowExecution, ExecutionStatus } from "./types";
import { jsonToText, textToJson } from "./db";

export interface TriggerPayload {
	workflowId: string;
	triggerId?: string;
	input: Record<string, any>;
	metadata?: Record<string, any>;
}

export interface WebhookTriggerConfig extends TriggerConfig {
	config: {
		path: string;
		method: "POST" | "PUT" | "PATCH";
		auth?: "bearer" | "apikey" | "none";
	};
}

export interface ScheduleTriggerConfig extends TriggerConfig {
	config: {
		cron: string; // Cron pattern
		timezone?: string;
	};
}

export interface EventTriggerConfig extends TriggerConfig {
	config: {
		topic: string;
		eventType: string;
		conditions?: Record<string, any>;
	};
}

export interface ManualTriggerConfig extends TriggerConfig {
	config: {
		requiresApproval?: boolean;
		inputSchema?: Record<string, any>;
	};
}

/**
 * Trigger Manager - handles all trigger types
 */
export class TriggerManager {
	private db: D1Database;
	private kv: KVNamespace;
	private webhookHandlers: Map<string, Function> = new Map();

	constructor(db: D1Database, kv: KVNamespace) {
		this.db = db;
		this.kv = kv;
	}

	/**
	 * Register a webhook trigger
	 */
	async registerWebhookTrigger(
		workflowId: string,
		config: WebhookTriggerConfig,
	): Promise<string> {
		const triggerId = `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		await this.db
			.prepare(
				`INSERT INTO triggers (id, workflow_id, type, config, enabled)
         VALUES (?, ?, ?, ?, 1)`,
			)
			.bind(triggerId, workflowId, "webhook", jsonToText(config.config))
			.run();

		// Cache webhook path for fast lookup
		await this.kv.put(
			`webhook:${config.config.path}`,
			JSON.stringify({ triggerId, workflowId, config }),
			{ expirationTtl: 2592000 }, // 30 days
		);

		return triggerId;
	}

	/**
	 * Register a scheduled (cron) trigger
	 */
	async registerScheduleTrigger(
		workflowId: string,
		config: ScheduleTriggerConfig,
	): Promise<string> {
		const triggerId = `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		await this.db
			.prepare(
				`INSERT INTO triggers (id, workflow_id, type, config, enabled)
         VALUES (?, ?, ?, ?, 1)`,
			)
			.bind(triggerId, workflowId, "schedule", jsonToText(config.config))
			.run();

		// Schedule with Workers Cron (requires wrangler.toml config)
		// This is a placeholder for actual cron registration
		console.log(
			`Scheduled trigger ${triggerId} with cron: ${config.config.cron}`,
		);

		return triggerId;
	}

	/**
	 * Register an event-based trigger
	 */
	async registerEventTrigger(
		workflowId: string,
		config: EventTriggerConfig,
	): Promise<string> {
		const triggerId = `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		await this.db
			.prepare(
				`INSERT INTO triggers (id, workflow_id, type, config, enabled)
         VALUES (?, ?, ?, ?, 1)`,
			)
			.bind(triggerId, workflowId, "event", jsonToText(config.config))
			.run();

		// Subscribe to event topic
		const topicKey = `event:${config.config.topic}`;
		const subscribers = JSON.parse((await this.kv.get(topicKey)) || "[]");
		subscribers.push(triggerId);
		await this.kv.put(topicKey, JSON.stringify(subscribers));

		return triggerId;
	}

	/**
	 * Register a manual trigger (no automatic firing)
	 */
	async registerManualTrigger(
		workflowId: string,
		config: ManualTriggerConfig,
	): Promise<string> {
		const triggerId = `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		await this.db
			.prepare(
				`INSERT INTO triggers (id, workflow_id, type, config, enabled)
         VALUES (?, ?, ?, ?, 1)`,
			)
			.bind(triggerId, workflowId, "manual", jsonToText(config.config))
			.run();

		return triggerId;
	}

	/**
	 * Handle incoming webhook request
	 */
	async handleWebhook(path: string, body: any): Promise<string | null> {
		// Look up trigger by webhook path
		const triggerData = await this.kv.get(`webhook:${path}`);
		if (!triggerData) {
			return null; // Trigger not found
		}

		const { triggerId, workflowId } = JSON.parse(triggerData);

		// Update trigger metrics
		await this.db
			.prepare(
				`UPDATE triggers SET fire_count = fire_count + 1, last_fired = CURRENT_TIMESTAMP
         WHERE id = ?`,
			)
			.bind(triggerId)
			.run();

		// Queue workflow execution
		const executionId = await this.queueExecution(triggerId, workflowId, body);
		return executionId;
	}

	/**
	 * Fire event-based triggers
	 */
	async fireEvent(topic: string, eventData: any): Promise<string[]> {
		const topicKey = `event:${topic}`;
		const triggerIds = JSON.parse((await this.kv.get(topicKey)) || "[]");
		const executionIds: string[] = [];

		for (const triggerId of triggerIds) {
			const result = await this.db
				.prepare(`SELECT workflow_id, config FROM triggers WHERE id = ?`)
				.bind(triggerId)
				.first();

			if (result) {
				const config = textToJson(result.config);
				// Check event conditions if any
				if (
					!config.conditions ||
					this.evaluateConditions(config.conditions, eventData)
				) {
					const executionId = await this.queueExecution(
						triggerId,
						result.workflow_id,
						eventData,
					);
					executionIds.push(executionId);
				}
			}
		}

		return executionIds;
	}

	/**
	 * Queue workflow execution from trigger
	 */
	private async queueExecution(
		triggerId: string,
		workflowId: string,
		input: any,
	): Promise<string> {
		const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const execution: WorkflowExecution = {
			id: executionId,
			workflowId,
			triggerId,
			status: "pending",
			startTime: Date.now(),
			steps: {},
			context: { input },
			correlationId: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		};

		// Store execution in database
		await this.db
			.prepare(
				`INSERT INTO workflow_executions (id, workflow_id, trigger_id, status, started_at, context_json)
         VALUES (?, ?, ?, ?, datetime('now'), ?)`,
			)
			.bind(
				executionId,
				workflowId,
				triggerId,
				"pending",
				jsonToText(execution),
			)
			.run();

		// Cache in KV for fast access
		await this.kv.put(
			`execution:${executionId}`,
			JSON.stringify(execution),
			{ expirationTtl: 86400 }, // 24 hours
		);

		return executionId;
	}

	/**
	 * Evaluate trigger conditions
	 */
	private evaluateConditions(
		conditions: Record<string, any>,
		data: any,
	): boolean {
		try {
			for (const [key, value] of Object.entries(conditions)) {
				if (data[key] !== value) {
					return false;
				}
			}
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Disable a trigger
	 */
	async disableTrigger(triggerId: string): Promise<void> {
		await this.db
			.prepare(`UPDATE triggers SET enabled = 0 WHERE id = ?`)
			.bind(triggerId)
			.run();
	}

	/**
	 * Enable a trigger
	 */
	async enableTrigger(triggerId: string): Promise<void> {
		await this.db
			.prepare(`UPDATE triggers SET enabled = 1 WHERE id = ?`)
			.bind(triggerId)
			.run();
	}

	/**
	 * Get trigger statistics
	 */
	async getTriggerStats(triggerId: string): Promise<any> {
		const result = await this.db
			.prepare(
				`SELECT type, fire_count, error_count, last_fired FROM triggers WHERE id = ?`,
			)
			.bind(triggerId)
			.first();

		return result || null;
	}
}
