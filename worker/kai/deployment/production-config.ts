/**
 * KAI Production Deployment Configuration
 * Week 4 Tuesday-Friday: Gradual production rollout with automated traffic migration
 */

export interface ProductionEnvironment {
	name: "production";
	database: {
		name: string;
		region: string;
		replica: string;
	};
	kvNamespace: {
		binding: string;
		id: string;
		ttl: number; // 24 hours
	};
	r2Bucket: {
		binding: string;
		name: string;
		retention: number; // 7 days
	};
	rateLimit: {
		requestsPerMinute: number;
		requestsPerSecond: number;
	};
	monitoring: {
		enabled: boolean;
		sampleRate: number;
		alertThresholds: AlertThresholds;
	};
}

export interface AlertThresholds {
	errorRate: number; // 1% for production
	latencyP99: number; // 500ms for production
	memoryUsage: number; // 256MB
	failedRetries: number; // 5%
	circuitBreakerThreshold: number; // 10 failures
}

export interface RolloutStage {
	name: string;
	trafficPercentage: number;
	duration: number; // minutes
	validationMetrics: ValidationMetric[];
	rollbackThreshold: number; // % error rate to trigger rollback
}

export interface ValidationMetric {
	name: string;
	type: "latency" | "error_rate" | "throughput" | "memory";
	threshold: number;
	duration: number; // seconds to validate
}

export interface RolloutSchedule {
	startTime: Date;
	stages: RolloutStage[];
	totalDuration: number; // minutes
}

/**
 * Production Configuration Manager
 */
export class ProductionConfig {
	private config: ProductionEnvironment;
	private rolloutSchedule: RolloutSchedule;
	private currentStage: number = 0;
	private stageStartTime: number = 0;

	constructor() {
		this.config = {
			name: "production",
			database: {
				name: "kai-production",
				region: "us-east-1",
				replica: "eu-west-1",
			},
			kvNamespace: {
				binding: "KV_PRODUCTION",
				id: "production-kv-id",
				ttl: 86400, // 24 hours
			},
			r2Bucket: {
				binding: "R2_PRODUCTION",
				name: "kai-production-archives",
				retention: 604800, // 7 days in seconds
			},
			rateLimit: {
				requestsPerMinute: 10000, // Production capacity
				requestsPerSecond: 1000,
			},
			monitoring: {
				enabled: true,
				sampleRate: 0.1, // 10% sampling for production
				alertThresholds: {
					errorRate: 0.01, // 1% error threshold
					latencyP99: 500, // 500ms
					memoryUsage: 256, // MB
					failedRetries: 0.05, // 5%
					circuitBreakerThreshold: 10,
				},
			},
		};

		this.rolloutSchedule = this.buildRolloutSchedule();
	}

	/**
	 * Build the gradual rollout schedule (Tuesday - Friday)
	 */
	private buildRolloutSchedule(): RolloutSchedule {
		return {
			startTime: this.getTuesdayDeploymentTime(),
			stages: [
				{
					name: "Canary Deployment (5%)",
					trafficPercentage: 5,
					duration: 30, // 30 minutes
					validationMetrics: [
						{
							name: "Error Rate",
							type: "error_rate",
							threshold: 0.02, // Allow 2% error rate for canary
							duration: 600,
						},
						{
							name: "Latency P99",
							type: "latency",
							threshold: 1000, // Allow 1s for canary
							duration: 600,
						},
						{
							name: "Throughput",
							type: "throughput",
							threshold: 500, // req/s
							duration: 600,
						},
					],
					rollbackThreshold: 0.03, // Rollback if >3% errors
				},
				{
					name: "Early Adoption (25%)",
					trafficPercentage: 25,
					duration: 60, // 60 minutes (Wednesday)
					validationMetrics: [
						{
							name: "Error Rate",
							type: "error_rate",
							threshold: 0.015, // 1.5% for early adoption
							duration: 1800,
						},
						{
							name: "Latency P99",
							type: "latency",
							threshold: 750, // 750ms
							duration: 1800,
						},
						{
							name: "Memory Usage",
							type: "memory",
							threshold: 512, // MB
							duration: 1800,
						},
					],
					rollbackThreshold: 0.025, // Rollback if >2.5% errors
				},
				{
					name: "Majority Rollout (50%)",
					trafficPercentage: 50,
					duration: 120, // 120 minutes (Thursday)
					validationMetrics: [
						{
							name: "Error Rate",
							type: "error_rate",
							threshold: 0.012, // 1.2%
							duration: 3600,
						},
						{
							name: "Latency P99",
							type: "latency",
							threshold: 600, // 600ms
							duration: 3600,
						},
					],
					rollbackThreshold: 0.02, // Rollback if >2% errors
				},
				{
					name: "Full Production (100%)",
					trafficPercentage: 100,
					duration: 480, // 480 minutes = 8 hours (Friday + weekend monitoring)
					validationMetrics: [
						{
							name: "Error Rate",
							type: "error_rate",
							threshold: 0.01, // 1% production SLA
							duration: 7200,
						},
						{
							name: "Latency P99",
							type: "latency",
							threshold: 500, // 500ms production SLA
							duration: 7200,
						},
					],
					rollbackThreshold: 0.015, // Rollback if >1.5% errors
				},
			],
			totalDuration: 30 + 60 + 120 + 480, // Total: ~690 minutes (~11.5 hours)
		};
	}

	/**
	 * Get Tuesday deployment start time (9 AM UTC)
	 */
	private getTuesdayDeploymentTime(): Date {
		const today = new Date();
		const dayOfWeek = today.getDay();

		// Calculate days until Tuesday
		let daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
		if (daysUntilTuesday === 0) {
			daysUntilTuesday = 7; // If today is Tuesday, deploy next week
		}

		const deployDate = new Date(today);
		deployDate.setDate(today.getDate() + daysUntilTuesday);
		deployDate.setHours(9, 0, 0, 0); // 9 AM UTC

		return deployDate;
	}

	/**
	 * Get current rollout stage
	 */
	getCurrentStage(): RolloutStage {
		return this.rolloutSchedule.stages[this.currentStage];
	}

	/**
	 * Get current traffic percentage
	 */
	getCurrentTrafficPercentage(): number {
		return this.getCurrentStage().trafficPercentage;
	}

	/**
	 * Check if stage duration has passed
	 */
	isStageDurationComplete(): boolean {
		if (this.stageStartTime === 0) return false;

		const elapsedMinutes = (Date.now() - this.stageStartTime) / 60000;
		return elapsedMinutes >= this.getCurrentStage().duration;
	}

	/**
	 * Advance to next stage
	 */
	advanceToNextStage(): boolean {
		if (this.currentStage < this.rolloutSchedule.stages.length - 1) {
			this.currentStage++;
			this.stageStartTime = Date.now();
			return true;
		}
		return false; // Already at final stage
	}

	/**
	 * Get rollout progress
	 */
	getProgress(): {
		currentStage: number;
		totalStages: number;
		trafficPercentage: number;
		timeRemaining: number; // minutes
		isComplete: boolean;
	} {
		const stage = this.getCurrentStage();
		const elapsedMinutes = (Date.now() - this.stageStartTime) / 60000;
		const timeRemaining = Math.max(0, stage.duration - elapsedMinutes);

		return {
			currentStage: this.currentStage + 1,
			totalStages: this.rolloutSchedule.stages.length,
			trafficPercentage: stage.trafficPercentage,
			timeRemaining,
			isComplete:
				this.currentStage === this.rolloutSchedule.stages.length - 1 &&
				timeRemaining === 0,
		};
	}

	/**
	 * Validate metrics for current stage
	 */
	validateStageMetrics(metrics: Record<string, number>): {
		valid: boolean;
		violations: string[];
	} {
		const stage = this.getCurrentStage();
		const violations: string[] = [];

		for (const validationMetric of stage.validationMetrics) {
			const metricValue = metrics[validationMetric.name];

			if (metricValue === undefined) {
				violations.push(`Missing metric: ${validationMetric.name}`);
				continue;
			}

			if (metricValue > validationMetric.threshold) {
				violations.push(
					`${validationMetric.name} exceeded threshold: ${metricValue} > ${validationMetric.threshold}`,
				);
			}
		}

		return {
			valid: violations.length === 0,
			violations,
		};
	}

	/**
	 * Check if rollback is needed
	 */
	shouldRollback(currentErrorRate: number): boolean {
		return currentErrorRate > this.getCurrentStage().rollbackThreshold;
	}

	/**
	 * Get all stages
	 */
	getStages(): RolloutStage[] {
		return this.rolloutSchedule.stages;
	}

	/**
	 * Get production configuration
	 */
	getConfig(): ProductionEnvironment {
		return { ...this.config };
	}

	/**
	 * Get environment variables for production
	 */
	getEnvironmentVariables(): Record<string, string> {
		return {
			ENVIRONMENT: "production",
			KAI_DB_NAME: this.config.database.name,
			KAI_DB_REGION: this.config.database.region,
			KAI_DB_REPLICA: this.config.database.replica,
			KAI_KV_BINDING: this.config.kvNamespace.binding,
			KAI_KV_TTL: this.config.kvNamespace.ttl.toString(),
			KAI_R2_BINDING: this.config.r2Bucket.binding,
			KAI_R2_RETENTION: this.config.r2Bucket.retention.toString(),
			KAI_RATE_LIMIT_RPM: this.config.rateLimit.requestsPerMinute.toString(),
			KAI_RATE_LIMIT_RPS: this.config.rateLimit.requestsPerSecond.toString(),
			MONITORING_ENABLED: this.config.monitoring.enabled.toString(),
			MONITORING_SAMPLE_RATE: this.config.monitoring.sampleRate.toString(),
			ALERT_ERROR_RATE:
				this.config.monitoring.alertThresholds.errorRate.toString(),
			ALERT_LATENCY_P99:
				this.config.monitoring.alertThresholds.latencyP99.toString(),
			ALERT_MEMORY:
				this.config.monitoring.alertThresholds.memoryUsage.toString(),
		};
	}

	/**
	 * Get wrangler.toml configuration snippet
	 */
	getWranglerConfig(): string {
		return `
[env.production]
d1_databases = [{ binding = "DB", database_name = "${this.config.database.name}" }]
kv_namespaces = [{ binding = "${this.config.kvNamespace.binding}", id = "${this.config.kvNamespace.id}" }]
r2_buckets = [{ binding = "${this.config.r2Bucket.binding}", bucket_name = "${this.config.r2Bucket.name}" }]

[env.production.triggers.crons]
crons = ["0 */6 * * *", "*/5 * * * *"]

[env.production.vars]
ENVIRONMENT = "production"
TRAFFIC_PERCENTAGE = "100"
ENABLE_REPLICATION = "true"
ENABLE_MONITORING = "true"
MONITORING_SAMPLE_RATE = "0.1"
CIRCUIT_BREAKER_ENABLED = "true"
CIRCUIT_BREAKER_THRESHOLD = "10"
`;
	}

	/**
	 * Validate production configuration
	 */
	validate(): {
		valid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (!this.config.database.name) {
			errors.push("Production database name not configured");
		}

		if (!this.config.database.replica) {
			errors.push("Production database replica not configured");
		}

		if (!this.config.kvNamespace.id) {
			errors.push("Production KV namespace ID not configured");
		}

		if (!this.config.r2Bucket.name) {
			errors.push("Production R2 bucket name not configured");
		}

		if (this.rolloutSchedule.stages.length === 0) {
			errors.push("No rollout stages configured");
		}

		// Verify stages are sequential and valid
		let previousPercentage = 0;
		for (const stage of this.rolloutSchedule.stages) {
			if (stage.trafficPercentage <= previousPercentage) {
				errors.push(
					`Stage ${stage.name}: traffic percentage must increase sequentially`,
				);
			}
			previousPercentage = stage.trafficPercentage;
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}
}

/**
 * Rollout Automation Engine
 */
export class RolloutAutomation {
	private productionConfig: ProductionConfig;
	private currentMetrics: Record<string, number> = {};
	private metricsHistory: Array<{
		timestamp: number;
		metrics: Record<string, number>;
	}> = [];
	private isRolledBack = false;

	constructor() {
		this.productionConfig = new ProductionConfig();
	}

	/**
	 * Record metrics at current stage
	 */
	recordMetrics(metrics: Record<string, number>): void {
		this.currentMetrics = metrics;
		this.metricsHistory.push({
			timestamp: Date.now(),
			metrics: { ...metrics },
		});

		// Keep only last 1 hour of metrics
		const oneHourAgo = Date.now() - 3600000;
		this.metricsHistory = this.metricsHistory.filter(
			(m) => m.timestamp > oneHourAgo,
		);
	}

	/**
	 * Get average metric over time period
	 */
	getAverageMetric(metricName: string, durationSeconds: number): number | null {
		const cutoffTime = Date.now() - durationSeconds * 1000;
		const relevantMetrics = this.metricsHistory.filter(
			(m) => m.timestamp > cutoffTime && metricName in m.metrics,
		);

		if (relevantMetrics.length === 0) return null;

		const sum = relevantMetrics.reduce(
			(acc, m) => acc + m.metrics[metricName],
			0,
		);
		return sum / relevantMetrics.length;
	}

	/**
	 * Check if stage should advance
	 */
	shouldAdvanceStage(): {
		shouldAdvance: boolean;
		reason: string;
	} {
		if (this.isRolledBack) {
			return {
				shouldAdvance: false,
				reason: "Rollback in progress",
			};
		}

		if (!this.productionConfig.isStageDurationComplete()) {
			const progress = this.productionConfig.getProgress();
			return {
				shouldAdvance: false,
				reason: `Stage ${progress.currentStage} in progress (${progress.timeRemaining.toFixed(1)} minutes remaining)`,
			};
		}

		const stage = this.productionConfig.getCurrentStage();
		const avgErrorRate = this.getAverageMetric("Error Rate", 600) || 0; // Last 10 minutes

		if (this.productionConfig.shouldRollback(avgErrorRate)) {
			return {
				shouldAdvance: false,
				reason: `Error rate ${(avgErrorRate * 100).toFixed(2)}% exceeds rollback threshold ${(stage.rollbackThreshold * 100).toFixed(2)}%`,
			};
		}

		// Validate stage metrics
		const validation = this.productionConfig.validateStageMetrics(
			this.currentMetrics,
		);
		if (!validation.valid) {
			return {
				shouldAdvance: false,
				reason: `Stage validation failed: ${validation.violations.join("; ")}`,
			};
		}

		return {
			shouldAdvance: true,
			reason: "All validations passed, ready to advance to next stage",
		};
	}

	/**
	 * Attempt to advance to next stage
	 */
	advanceStage(): {
		success: boolean;
		currentStage: number;
		nextStage?: string;
		message: string;
	} {
		const advancement = this.shouldAdvanceStage();

		if (!advancement.shouldAdvance) {
			return {
				success: false,
				currentStage: this.productionConfig.getProgress().currentStage,
				message: advancement.reason,
			};
		}

		const advanced = this.productionConfig.advanceToNextStage();

		if (advanced) {
			const progress = this.productionConfig.getProgress();
			return {
				success: true,
				currentStage: progress.currentStage,
				nextStage: this.productionConfig.getCurrentStage().name,
				message: `Advanced to stage ${progress.currentStage}: ${this.productionConfig.getCurrentStage().name}`,
			};
		}

		return {
			success: false,
			currentStage: this.productionConfig.getProgress().currentStage,
			message: "Already at final stage",
		};
	}

	/**
	 * Trigger rollback
	 */
	rollback(reason: string): {
		success: boolean;
		message: string;
		rollbackTarget: string;
	} {
		this.isRolledBack = true;

		return {
			success: true,
			message: `Rollback initiated: ${reason}`,
			rollbackTarget: "staging",
		};
	}

	/**
	 * Get rollout status
	 */
	getStatus(): {
		progress: ReturnType<typeof this.productionConfig.getProgress>;
		currentMetrics: Record<string, number>;
		isRolledBack: boolean;
		averageErrorRate: number | null;
		averageLatency: number | null;
	} {
		return {
			progress: this.productionConfig.getProgress(),
			currentMetrics: this.currentMetrics,
			isRolledBack: this.isRolledBack,
			averageErrorRate: this.getAverageMetric("Error Rate", 600),
			averageLatency: this.getAverageMetric("Latency P99", 600),
		};
	}

	/**
	 * Generate rollout report
	 */
	generateReport(): string {
		const status = this.getStatus();
		let report = `# Production Rollout Status Report\n\n`;

		report += `## Current Status\n`;
		report += `- Stage: ${status.progress.currentStage}/${status.progress.totalStages}\n`;
		report += `- Traffic: ${status.progress.trafficPercentage}%\n`;
		report += `- Time Remaining: ${status.progress.timeRemaining.toFixed(1)} minutes\n`;
		report += `- Complete: ${status.progress.isComplete ? "Yes" : "No"}\n`;
		report += `- Rolled Back: ${status.isRolledBack ? "Yes" : "No"}\n\n`;

		report += `## Metrics\n`;
		report += `- Error Rate: ${((status.averageErrorRate || 0) * 100).toFixed(2)}%\n`;
		report += `- Latency P99: ${(status.averageLatency || 0).toFixed(0)}ms\n`;
		report += `- Current Metrics: ${JSON.stringify(status.currentMetrics, null, 2)}\n\n`;

		report += `## Rollout Timeline\n`;
		for (const stage of this.productionConfig.getStages()) {
			report += `- ${stage.name}: ${stage.trafficPercentage}% traffic (${stage.duration}min)\n`;
		}

		return report;
	}
}
