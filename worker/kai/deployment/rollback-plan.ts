/**
 * KAI Production Rollback Plan
 * Emergency recovery procedures and automatic rollback triggers
 */

export interface RollbackTrigger {
	name: string;
	metric: string;
	condition: "greater_than" | "less_than";
	threshold: number;
	duration: number; // seconds to wait before triggering
	critical: boolean;
}

export interface RollbackAction {
	sequence: number;
	action: string;
	target: "traffic" | "configuration" | "deployment" | "data";
	rollback: boolean;
	timeout: number; // seconds
	description: string;
}

export interface RollbackStep {
	step: number;
	action: string;
	status: "pending" | "in_progress" | "completed" | "failed";
	duration: number;
	error?: string;
	timestamp: number;
}

/**
 * Rollback Trigger Manager
 */
export class RollbackTriggerManager {
	private triggers: RollbackTrigger[] = [];
	private triggeredAlerts: Set<string> = new Set();
	private lastAlertTime: Map<string, number> = new Map();

	constructor() {
		this.defineDefaultTriggers();
	}

	/**
	 * Define default rollback triggers
	 */
	private defineDefaultTriggers(): void {
		// Critical error rate threshold
		this.defineTrigger({
			name: "High Error Rate",
			metric: "error_rate",
			condition: "greater_than",
			threshold: 0.05, // 5% error rate
			duration: 60, // Sustained for 1 minute
			critical: true,
		});

		// Latency degradation
		this.defineTrigger({
			name: "High Latency P99",
			metric: "latency_p99",
			condition: "greater_than",
			threshold: 1000, // 1 second
			duration: 120, // Sustained for 2 minutes
			critical: true,
		});

		// Memory exhaustion
		this.defineTrigger({
			name: "Memory Exhaustion",
			metric: "memory_usage",
			condition: "greater_than",
			threshold: 900, // 900MB of 1GB
			duration: 30,
			critical: true,
		});

		// Database unavailability
		this.defineTrigger({
			name: "Database Connection Failures",
			metric: "db_connection_errors",
			condition: "greater_than",
			threshold: 10, // 10 failures per minute
			duration: 30,
			critical: true,
		});

		// Cache unavailability
		this.defineTrigger({
			name: "Cache Service Degradation",
			metric: "cache_hit_rate",
			condition: "less_than",
			threshold: 0.5, // Less than 50% hit rate
			duration: 60,
			critical: false,
		});

		// Failed circuit breaker
		this.defineTrigger({
			name: "Circuit Breaker Open",
			metric: "circuit_breaker_open",
			condition: "greater_than",
			threshold: 1, // Any open circuit breaker
			duration: 30,
			critical: true,
		});
	}

	/**
	 * Define rollback trigger
	 */
	private defineTrigger(trigger: RollbackTrigger): void {
		this.triggers.push(trigger);
	}

	/**
	 * Check if rollback should be triggered
	 */
	checkTriggers(metrics: Record<string, number>): {
		shouldRollback: boolean;
		trigger?: RollbackTrigger;
		message: string;
	} {
		for (const trigger of this.triggers) {
			const metricValue = metrics[trigger.metric];

			if (metricValue === undefined) {
				continue;
			}

			const conditionMet =
				(trigger.condition === "greater_than" &&
					metricValue > trigger.threshold) ||
				(trigger.condition === "less_than" && metricValue < trigger.threshold);

			if (conditionMet) {
				const lastTime = this.lastAlertTime.get(trigger.name) || 0;
				const timeSinceLastAlert = Date.now() - lastTime;

				if (timeSinceLastAlert > trigger.duration * 1000) {
					// Condition sustained long enough
					if (trigger.critical) {
						this.triggeredAlerts.add(trigger.name);

						return {
							shouldRollback: true,
							trigger,
							message: `Critical threshold exceeded: ${trigger.name} (${metricValue} > ${trigger.threshold})`,
						};
					}
				}

				this.lastAlertTime.set(trigger.name, Date.now());
			} else {
				// Condition cleared
				this.lastAlertTime.delete(trigger.name);
				this.triggeredAlerts.delete(trigger.name);
			}
		}

		return {
			shouldRollback: false,
			message: "All metrics within acceptable ranges",
		};
	}

	/**
	 * Get all triggers
	 */
	getTriggers(): RollbackTrigger[] {
		return [...this.triggers];
	}
}

/**
 * Rollback Executor
 */
export class RollbackExecutor {
	private rollbackSteps: RollbackStep[] = [];
	private isRollingBack: boolean = false;
	private rollbackStartTime: number = 0;
	private stepCounter: number = 0;

	/**
	 * Get rollback plan for current deployment stage
	 */
	private getRollbackPlan(stage: string): RollbackAction[] {
		const commonActions: RollbackAction[] = [
			{
				sequence: 1,
				action: "Stop Traffic Migration",
				target: "traffic",
				rollback: true,
				timeout: 30,
				description: "Immediately stop gradual traffic migration",
			},
			{
				sequence: 2,
				action: "Route Traffic to Previous Version",
				target: "traffic",
				rollback: true,
				timeout: 60,
				description: "Route all traffic back to stable version",
			},
			{
				sequence: 3,
				action: "Disable New Deployment",
				target: "deployment",
				rollback: true,
				timeout: 30,
				description: "Disable the problematic deployment",
			},
			{
				sequence: 4,
				action: "Restore Database State",
				target: "data",
				rollback: true,
				timeout: 120,
				description: "Restore database from backup if needed",
			},
			{
				sequence: 5,
				action: "Clear Cache",
				target: "configuration",
				rollback: true,
				timeout: 30,
				description: "Clear KV cache to force fresh loads",
			},
			{
				sequence: 6,
				action: "Verify Stability",
				target: "configuration",
				rollback: false,
				timeout: 300,
				description: "Run smoke tests to verify system stability",
			},
		];

		const stageSpecificActions: Record<string, RollbackAction[]> = {
			"Canary Deployment (5%)": [
				{
					sequence: 0,
					action: "Alert On-Call Engineer",
					target: "configuration",
					rollback: false,
					timeout: 60,
					description: "Notify incident commander immediately",
				},
			],
			"Early Adoption (25%)": [
				{
					sequence: 0,
					action: "Declare Major Incident",
					target: "configuration",
					rollback: false,
					timeout: 60,
					description: "Escalate to incident response team",
				},
				{
					sequence: 1.5,
					action: "Notify Stakeholders",
					target: "configuration",
					rollback: false,
					timeout: 30,
					description: "Notify product, sales, and customer success",
				},
			],
			"Majority Rollout (50%)": [
				{
					sequence: 0,
					action: "Declare SEV-1 Incident",
					target: "configuration",
					rollback: false,
					timeout: 60,
					description: "Activate SEV-1 incident response",
				},
				{
					sequence: 1.5,
					action: "Notify All Stakeholders",
					target: "configuration",
					rollback: false,
					timeout: 30,
					description: "Notify all impacted teams and customers",
				},
				{
					sequence: 7,
					action: "Post-Incident Review",
					target: "configuration",
					rollback: false,
					timeout: 3600,
					description: "Schedule post-incident review",
				},
			],
			"Full Production (100%)": [
				{
					sequence: 0,
					action: "Declare SEV-0 Incident",
					target: "configuration",
					rollback: false,
					timeout: 60,
					description: "Activate SEV-0 incident response - all hands on deck",
				},
				{
					sequence: 1.5,
					action: "Notify All Stakeholders",
					target: "configuration",
					rollback: false,
					timeout: 30,
					description: "Notify all impacted teams, customers, and executives",
				},
				{
					sequence: 7,
					action: "Comprehensive Post-Incident Review",
					target: "configuration",
					rollback: false,
					timeout: 7200,
					description: "Comprehensive PIR and prevention planning",
				},
			],
		};

		const allActions = [
			...(stageSpecificActions[stage] || []),
			...commonActions,
		];

		return allActions.sort((a, b) => a.sequence - b.sequence);
	}

	/**
	 * Execute rollback
	 */
	async executeRollback(
		stage: string,
		reason: string,
	): Promise<{
		success: boolean;
		duration: number;
		failedSteps: RollbackStep[];
		report: string;
	}> {
		if (this.isRollingBack) {
			return {
				success: false,
				duration: 0,
				failedSteps: [],
				report: "Rollback already in progress",
			};
		}

		this.isRollingBack = true;
		this.rollbackStartTime = Date.now();
		this.rollbackSteps = [];
		this.stepCounter = 0;

		const plan = this.getRollbackPlan(stage);
		const failedSteps: RollbackStep[] = [];

		console.log(`🚨 ROLLBACK INITIATED - Stage: ${stage}`);
		console.log(`   Reason: ${reason}`);
		console.log(`   Plan: ${plan.length} steps`);

		for (const action of plan) {
			const step = await this.executeStep(action);
			this.rollbackSteps.push(step);

			if (!step.status.includes("completed")) {
				failedSteps.push(step);

				// Continue with remaining steps even if some fail
				if (action.rollback) {
					console.warn(`   ⚠ Failed: ${action.action}`);
				}
			}
		}

		this.isRollingBack = false;
		const duration = Date.now() - this.rollbackStartTime;

		return {
			success: failedSteps.length === 0,
			duration,
			failedSteps,
			report: this.generateRollbackReport(stage, reason),
		};
	}

	/**
	 * Execute individual rollback step
	 */
	private async executeStep(action: RollbackAction): Promise<RollbackStep> {
		this.stepCounter++;
		const step: RollbackStep = {
			step: this.stepCounter,
			action: action.action,
			status: "in_progress",
			duration: 0,
			timestamp: Date.now(),
		};

		const startTime = Date.now();

		try {
			// Simulate step execution
			await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));

			step.status = "completed";
			step.duration = Date.now() - startTime;
		} catch (error) {
			step.status = "failed";
			step.error = (error as Error).message;
			step.duration = Date.now() - startTime;
		}

		return step;
	}

	/**
	 * Generate rollback report
	 */
	private generateRollbackReport(stage: string, reason: string): string {
		let report = `# 🚨 Rollback Report\n\n`;

		report += `## Incident Details\n`;
		report += `- **Stage**: ${stage}\n`;
		report += `- **Reason**: ${reason}\n`;
		report += `- **Rollback Time**: ${new Date(this.rollbackStartTime).toISOString()}\n`;
		report += `- **Duration**: ${((Date.now() - this.rollbackStartTime) / 1000).toFixed(1)}s\n\n`;

		report += `## Rollback Steps\n`;
		for (const step of this.rollbackSteps) {
			const icon =
				step.status === "completed"
					? "✓"
					: step.status === "failed"
						? "✗"
						: "⏳";
			report += `${icon} ${step.step}. ${step.action} (${step.duration}ms)\n`;

			if (step.error) {
				report += `   Error: ${step.error}\n`;
			}
		}

		report += `\n## Summary\n`;
		const completed = this.rollbackSteps.filter(
			(s) => s.status === "completed",
		).length;
		const failed = this.rollbackSteps.filter(
			(s) => s.status === "failed",
		).length;

		report += `- **Completed**: ${completed}/${this.rollbackSteps.length}\n`;
		report += `- **Failed**: ${failed}/${this.rollbackSteps.length}\n`;
		report += `- **Status**: ${failed === 0 ? "✓ Successful" : "⚠ Partial Failure"}\n\n`;

		report += `## Recommended Actions\n`;
		report += `1. Verify system stability with smoke tests\n`;
		report += `2. Investigate root cause of deployment issue\n`;
		report += `3. Schedule post-incident review\n`;
		report += `4. Fix issues before re-attempting deployment\n`;

		return report;
	}

	/**
	 * Get rollback status
	 */
	getStatus(): {
		isRollingBack: boolean;
		completedSteps: number;
		totalSteps: number;
		duration: number;
	} {
		return {
			isRollingBack: this.isRollingBack,
			completedSteps: this.rollbackSteps.filter((s) => s.status === "completed")
				.length,
			totalSteps: this.rollbackSteps.length,
			duration: Date.now() - this.rollbackStartTime,
		};
	}
}

/**
 * Backup & Recovery Manager
 */
export class BackupRecoveryManager {
	private backups: Map<
		string,
		{
			timestamp: number;
			data: Record<string, any>;
			stage: string;
		}
	> = new Map();

	/**
	 * Create backup before deployment stage
	 */
	createBackup(
		stage: string,
		data: Record<string, any>,
	): {
		backupId: string;
		timestamp: number;
	} {
		const backupId = `backup_${stage}_${Date.now()}`;

		this.backups.set(backupId, {
			timestamp: Date.now(),
			data,
			stage,
		});

		console.log(`✓ Backup created: ${backupId}`);

		return {
			backupId,
			timestamp: Date.now(),
		};
	}

	/**
	 * Restore from backup
	 */
	restore(backupId: string): {
		success: boolean;
		data?: Record<string, any>;
		error?: string;
	} {
		const backup = this.backups.get(backupId);

		if (!backup) {
			return {
				success: false,
				error: `Backup not found: ${backupId}`,
			};
		}

		console.log(`↩ Restoring from backup: ${backupId}`);

		return {
			success: true,
			data: backup.data,
		};
	}

	/**
	 * List available backups
	 */
	listBackups(): Array<{
		backupId: string;
		timestamp: number;
		stage: string;
	}> {
		return Array.from(this.backups.entries()).map(([id, backup]) => ({
			backupId: id,
			timestamp: backup.timestamp,
			stage: backup.stage,
		}));
	}

	/**
	 * Clean up old backups
	 */
	cleanupOldBackups(retentionHours: number = 24): number {
		const cutoffTime = Date.now() - retentionHours * 60 * 60 * 1000;
		let cleaned = 0;

		for (const [id, backup] of this.backups.entries()) {
			if (backup.timestamp < cutoffTime) {
				this.backups.delete(id);
				cleaned++;
			}
		}

		return cleaned;
	}
}

/**
 * Incident Response Coordinator
 */
export class IncidentResponseCoordinator {
	private rollbackExecutor: RollbackExecutor;
	private backupRecoveryManager: BackupRecoveryManager;
	private incidentId: string | null = null;

	constructor() {
		this.rollbackExecutor = new RollbackExecutor();
		this.backupRecoveryManager = new BackupRecoveryManager();
	}

	/**
	 * Respond to detected issue
	 */
	async respondToIssue(
		stage: string,
		issue: string,
		metrics: Record<string, number>,
	): Promise<{
		success: boolean;
		incidentId: string;
		actions: string[];
		report: string;
	}> {
		this.incidentId = `incident_${Date.now()}`;

		const actions: string[] = [];

		// Step 1: Alert stakeholders
		actions.push("Notifying stakeholders...");

		// Step 2: Execute rollback
		actions.push("Initiating rollback...");
		const rollbackResult = await this.rollbackExecutor.executeRollback(
			stage,
			issue,
		);

		// Step 3: Verify recovery
		actions.push("Verifying system stability...");

		// Step 4: Document incident
		actions.push("Creating incident report...");

		return {
			success: rollbackResult.success,
			incidentId: this.incidentId,
			actions,
			report: rollbackResult.report,
		};
	}

	/**
	 * Get incident status
	 */
	getIncidentStatus(): {
		incidentId: string | null;
		rollbackStatus: ReturnType<typeof this.rollbackExecutor.getStatus>;
		backups: ReturnType<typeof this.backupRecoveryManager.listBackups>;
	} {
		return {
			incidentId: this.incidentId,
			rollbackStatus: this.rollbackExecutor.getStatus(),
			backups: this.backupRecoveryManager.listBackups(),
		};
	}
}
