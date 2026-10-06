/**
 * KAI State Manager
 * Dual-storage strategy: D1 (persistent) + KV (cache)
 */

import { WorkflowExecution, WorkflowDefinition } from "./types";
import { jsonToText, textToJson } from "./db";

export interface StateSnapshot {
	executionId: string;
	workflowId: string;
	status: string;
	timestamp: number;
	context: Record<string, any>;
	steps: Record<string, any>;
}

export class StateManager {
	private db: D1Database;
	private kv: KVNamespace;
	private r2: R2Bucket;
	private kvTtl: number = 86400; // 24 hours
	private archiveAfterDays: number = 7;

	constructor(db: D1Database, kv: KVNamespace, r2: R2Bucket) {
		this.db = db;
		this.kv = kv;
		this.r2 = r2;
	}

	/**
	 * Get execution state (try KV first, fall back to D1)
	 */
	async getExecutionState(
		executionId: string,
	): Promise<WorkflowExecution | null> {
		// Try KV cache first (fast)
		try {
			const cached = await this.kv.get(`execution:${executionId}`);
			if (cached) {
				return JSON.parse(cached);
			}
		} catch (error) {
			console.error("KV get failed:", error);
		}

		// Fall back to D1 (slow but reliable)
		try {
			const result = await this.db
				.prepare(`SELECT context_json FROM workflow_executions WHERE id = ?`)
				.bind(executionId)
				.first();

			if (result) {
				const execution = textToJson(result.context_json);
				// Restore to KV cache
				await this.kv.put(
					`execution:${executionId}`,
					JSON.stringify(execution),
					{
						expirationTtl: this.kvTtl,
					},
				);
				return execution;
			}
		} catch (error) {
			console.error("D1 get failed:", error);
		}

		return null;
	}

	/**
	 * Update execution state (write to both D1 and KV)
	 */
	async updateExecutionState(execution: WorkflowExecution): Promise<void> {
		// Write to D1 (persistent)
		try {
			await this.db
				.prepare(
					`UPDATE workflow_executions
           SET status = ?, context_json = ?, error_message = ?, ended_at = ?
           WHERE id = ?`,
				)
				.bind(
					execution.status,
					jsonToText(execution),
					execution.error || null,
					execution.endTime ? new Date(execution.endTime).toISOString() : null,
					execution.id,
				)
				.run();
		} catch (error) {
			console.error("D1 update failed:", error);
		}

		// Write to KV (cache)
		try {
			await this.kv.put(
				`execution:${execution.id}`,
				JSON.stringify(execution),
				{
					expirationTtl: this.kvTtl,
				},
			);
		} catch (error) {
			console.error("KV put failed:", error);
		}
	}

	/**
	 * Store workflow variable
	 */
	async setVariable(
		executionId: string,
		name: string,
		value: any,
		type: string,
	): Promise<void> {
		const varId = `var_${executionId}_${name}`;

		// Store in D1
		await this.db
			.prepare(
				`INSERT INTO workflow_variables (id, execution_id, name, value_type, value_json, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET value_json = ?, updated_at = datetime('now')`,
			)
			.bind(
				varId,
				executionId,
				name,
				type,
				jsonToText(value),
				jsonToText(value),
			)
			.run();

		// Cache in KV
		await this.kv.put(`var:${varId}`, JSON.stringify({ type, value }), {
			expirationTtl: this.kvTtl,
		});
	}

	/**
	 * Get workflow variable
	 */
	async getVariable(executionId: string, name: string): Promise<any> {
		const varId = `var_${executionId}_${name}`;

		// Try KV first
		try {
			const cached = await this.kv.get(`var:${varId}`);
			if (cached) {
				const data = JSON.parse(cached);
				return data.value;
			}
		} catch {
			// Continue to D1
		}

		// Fall back to D1
		const result = await this.db
			.prepare(
				`SELECT value_json FROM workflow_variables
         WHERE execution_id = ? AND name = ?`,
			)
			.bind(executionId, name)
			.first();

		return result ? textToJson(result.value_json) : null;
	}

	/**
	 * Create state snapshot for recovery
	 */
	async createSnapshot(
		execution: WorkflowExecution,
		workflow: WorkflowDefinition,
	): Promise<string> {
		const snapshot: StateSnapshot = {
			executionId: execution.id,
			workflowId: execution.workflowId,
			status: execution.status,
			timestamp: Date.now(),
			context: execution.context,
			steps: execution.steps,
		};

		const snapshotId = `snap_${execution.id}_${Date.now()}`;

		// Store in R2 for long-term archival
		try {
			await this.r2.put(
				`snapshots/${new Date().toISOString().split("T")[0]}/${snapshotId}.json`,
				JSON.stringify(snapshot),
				{
					customMetadata: {
						executionId: execution.id,
						workflowId: execution.workflowId,
					},
				},
			);
		} catch (error) {
			console.error("R2 snapshot failed:", error);
		}

		// Also cache in KV
		await this.kv.put(`snapshot:${snapshotId}`, JSON.stringify(snapshot), {
			expirationTtl: 86400,
		});

		return snapshotId;
	}

	/**
	 * Restore from snapshot
	 */
	async restoreFromSnapshot(snapshotId: string): Promise<StateSnapshot | null> {
		// Try KV first
		try {
			const cached = await this.kv.get(`snapshot:${snapshotId}`);
			if (cached) {
				return JSON.parse(cached);
			}
		} catch {
			// Continue to R2
		}

		// Try R2
		try {
			// List all snapshots matching this ID pattern
			const list = await this.r2.list({ prefix: `snapshots/` });
			for (const object of list.objects) {
				if (object.key.includes(snapshotId)) {
					const obj = await this.r2.get(object.key);
					if (obj) {
						const text = await obj.text();
						return JSON.parse(text);
					}
				}
			}
		} catch (error) {
			console.error("R2 restore failed:", error);
		}

		return null;
	}

	/**
	 * Clean up old executions (archival)
	 */
	async archiveOldExecutions(): Promise<number> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - this.archiveAfterDays);

		try {
			// Get executions older than cutoff
			const results = await this.db
				.prepare(
					`SELECT id, context_json FROM workflow_executions
           WHERE created_at < datetime(?)
           LIMIT 1000`,
				)
				.bind(cutoffDate.toISOString())
				.all();

			let archived = 0;

			// Archive each execution to R2
			for (const row of results.results || []) {
				const execution = textToJson(row.context_json);
				await this.r2.put(
					`archives/${new Date(row.created_at).toISOString().split("T")[0]}/${row.id}.json`,
					JSON.stringify(execution),
				);
				archived++;
			}

			// Delete from D1 after archiving
			if (archived > 0) {
				await this.db
					.prepare(
						`DELETE FROM workflow_executions
             WHERE created_at < datetime(?)
             AND status IN ('success', 'failed')`,
					)
					.bind(cutoffDate.toISOString())
					.run();
			}

			return archived;
		} catch (error) {
			console.error("Archive failed:", error);
			return 0;
		}
	}

	/**
	 * Get execution metrics
	 */
	async getExecutionMetrics(
		workflowId: string,
		days: number = 7,
	): Promise<Record<string, any>> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);

		const results = await this.db
			.prepare(
				`SELECT
           COUNT(*) as total_executions,
           SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
           SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
           AVG(total_duration_ms) as avg_duration_ms,
           MAX(total_duration_ms) as max_duration_ms,
           MIN(total_duration_ms) as min_duration_ms
         FROM execution_metrics
         WHERE workflow_id = ? AND created_at > datetime(?)`,
			)
			.bind(workflowId, cutoffDate.toISOString())
			.first();

		return {
			totalExecutions: results?.total_executions || 0,
			successCount: results?.successful || 0,
			failureCount: results?.failed || 0,
			successRate: results?.total_executions
				? ((results.successful / results.total_executions) * 100).toFixed(2)
				: 0,
			avgDurationMs: results?.avg_duration_ms || 0,
			maxDurationMs: results?.max_duration_ms || 0,
			minDurationMs: results?.min_duration_ms || 0,
		};
	}

	/**
	 * Clear KV cache for testing/recovery
	 */
	async clearKvCache(pattern?: string): Promise<void> {
		// KV doesn't support bulk delete, so this is a placeholder
		// In production, you'd need to track keys in a secondary store
		console.log(`KV cache clear requested for pattern: ${pattern || "all"}`);
	}

	/**
	 * Get state storage statistics
	 */
	async getStorageStats(): Promise<Record<string, any>> {
		const executions = await this.db
			.prepare(`SELECT COUNT(*) as count FROM workflow_executions`)
			.first();

		const metrics = await this.db
			.prepare(`SELECT COUNT(*) as count FROM execution_metrics`)
			.first();

		const variables = await this.db
			.prepare(`SELECT COUNT(*) as count FROM workflow_variables`)
			.first();

		return {
			executionsStored: executions?.count || 0,
			metricsStored: metrics?.count || 0,
			variablesStored: variables?.count || 0,
			lastArchiveDate: new Date().toISOString(),
		};
	}
}
