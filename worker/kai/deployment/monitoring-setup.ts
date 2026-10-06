/**
 * KAI Production Monitoring & Alerting Setup
 * Real-time metrics collection, health checks, and alert routing
 */

export interface MetricPoint {
	timestamp: number;
	value: number;
	tags: Record<string, string>;
}

export interface Alert {
	id: string;
	timestamp: number;
	severity: "info" | "warning" | "critical";
	metric: string;
	threshold: number;
	current: number;
	message: string;
	resolved: boolean;
}

export interface HealthCheck {
	name: string;
	endpoint: string;
	method: "GET" | "POST";
	expectedStatus: number;
	timeout: number;
	interval: number; // seconds
}

export interface AlertRoute {
	severity: "info" | "warning" | "critical";
	destination: "slack" | "pagerduty" | "email" | "dashboard";
	channel?: string;
	email?: string;
	escalationDelay?: number; // minutes
}

/**
 * Metrics Collector
 */
export class MetricsCollector {
	private metrics: Map<string, MetricPoint[]> = new Map();
	private aggregationWindows: Map<string, number> = new Map();
	private retentionMs: number = 7 * 24 * 60 * 60 * 1000; // 7 days

	constructor(
		private metricsRetentionHours: number = 24,
		private aggregationIntervalSeconds: number = 60,
	) {
		this.retentionMs = metricsRetentionHours * 60 * 60 * 1000;
		this.startCleanupTimer();
	}

	/**
	 * Record a metric
	 */
	recordMetric(
		name: string,
		value: number,
		tags: Record<string, string> = {},
	): void {
		if (!this.metrics.has(name)) {
			this.metrics.set(name, []);
		}

		const points = this.metrics.get(name)!;
		points.push({
			timestamp: Date.now(),
			value,
			tags,
		});
	}

	/**
	 * Record multiple metrics at once
	 */
	recordMetrics(
		data: Array<{ name: string; value: number; tags?: Record<string, string> }>,
	): void {
		for (const { name, value, tags } of data) {
			this.recordMetric(name, value, tags || {});
		}
	}

	/**
	 * Get metric statistics over time window
	 */
	getMetricStats(
		name: string,
		windowSeconds: number = 300,
	): {
		count: number;
		sum: number;
		avg: number;
		min: number;
		max: number;
		p50: number;
		p99: number;
	} | null {
		const points = this.metrics.get(name);
		if (!points || points.length === 0) return null;

		const cutoffTime = Date.now() - windowSeconds * 1000;
		const recentPoints = points.filter((p) => p.timestamp > cutoffTime);

		if (recentPoints.length === 0) return null;

		const values = recentPoints.map((p) => p.value).sort((a, b) => a - b);
		const sum = values.reduce((a, b) => a + b, 0);

		return {
			count: values.length,
			sum,
			avg: sum / values.length,
			min: values[0],
			max: values[values.length - 1],
			p50: values[Math.floor(values.length * 0.5)],
			p99: values[Math.floor(values.length * 0.99)],
		};
	}

	/**
	 * Get all available metrics
	 */
	getAllMetrics(): string[] {
		return Array.from(this.metrics.keys());
	}

	/**
	 * Clean up old metrics
	 */
	private startCleanupTimer(): void {
		setInterval(
			() => {
				const cutoffTime = Date.now() - this.retentionMs;

				for (const [name, points] of this.metrics.entries()) {
					const retained = points.filter((p) => p.timestamp > cutoffTime);
					if (retained.length === 0) {
						this.metrics.delete(name);
					} else {
						this.metrics.set(name, retained);
					}
				}
			},
			60 * 60 * 1000,
		); // Cleanup every hour
	}

	/**
	 * Export metrics snapshot
	 */
	exportMetrics(): Record<string, MetricPoint[]> {
		const snapshot: Record<string, MetricPoint[]> = {};
		for (const [name, points] of this.metrics.entries()) {
			snapshot[name] = [...points];
		}
		return snapshot;
	}
}

/**
 * Alert Manager
 */
export class AlertManager {
	private alerts: Map<string, Alert> = new Map();
	private alertRules: Map<string, AlertRule> = new Map();
	private routes: AlertRoute[] = [];
	private alertCounter: number = 0;

	constructor() {
		this.setupDefaultRoutes();
	}

	/**
	 * Define alert rule
	 */
	defineRule(
		metricName: string,
		condition: "greater_than" | "less_than" | "equal_to",
		threshold: number,
		duration: number, // seconds the condition must be true
	): void {
		this.alertRules.set(metricName, {
			metricName,
			condition,
			threshold,
			duration,
			lastTriggered: 0,
			consecutive: 0,
		});
	}

	/**
	 * Check if alert should be triggered
	 */
	checkAlertCondition(
		metricName: string,
		currentValue: number,
	): {
		triggered: boolean;
		severity: "info" | "warning" | "critical";
	} {
		const rule = this.alertRules.get(metricName);
		if (!rule) {
			return { triggered: false, severity: "info" };
		}

		const conditionMet =
			(rule.condition === "greater_than" && currentValue > rule.threshold) ||
			(rule.condition === "less_than" && currentValue < rule.threshold) ||
			(rule.condition === "equal_to" && currentValue === rule.threshold);

		if (conditionMet) {
			rule.consecutive++;
		} else {
			rule.consecutive = 0;
		}

		// Determine severity based on how far the value is from threshold
		const deviation = Math.abs(currentValue - rule.threshold);
		const severity =
			deviation > rule.threshold * 0.5
				? "critical"
				: deviation > rule.threshold * 0.25
					? "warning"
					: "info";

		return {
			triggered: rule.consecutive * this.getDurationPerCheck() >= rule.duration,
			severity,
		};
	}

	/**
	 * Get estimated check duration
	 */
	private getDurationPerCheck(): number {
		return 10; // Assume checks every 10 seconds
	}

	/**
	 * Create alert
	 */
	createAlert(
		metric: string,
		threshold: number,
		current: number,
		severity: "info" | "warning" | "critical",
	): Alert {
		const alert: Alert = {
			id: `alert_${++this.alertCounter}`,
			timestamp: Date.now(),
			severity,
			metric,
			threshold,
			current,
			message: `${metric} is ${current} (threshold: ${threshold})`,
			resolved: false,
		};

		this.alerts.set(alert.id, alert);
		this.routeAlert(alert);

		return alert;
	}

	/**
	 * Resolve alert
	 */
	resolveAlert(alertId: string): boolean {
		const alert = this.alerts.get(alertId);
		if (!alert) return false;

		alert.resolved = true;
		return true;
	}

	/**
	 * Route alert to appropriate destination
	 */
	private routeAlert(alert: Alert): void {
		const matchedRoutes = this.routes.filter(
			(r) => r.severity === alert.severity,
		);

		for (const route of matchedRoutes) {
			this.sendAlert(alert, route);
		}
	}

	/**
	 * Send alert to destination (mock implementation)
	 */
	private sendAlert(alert: Alert, route: AlertRoute): void {
		// Mock implementation - in production, this would send to real endpoints
		switch (route.destination) {
			case "slack":
				console.log(`[SLACK] Sending to ${route.channel}: ${alert.message}`);
				break;
			case "pagerduty":
				console.log(`[PAGERDUTY] Incident created for ${alert.metric}`);
				break;
			case "email":
				console.log(`[EMAIL] Sending to ${route.email}: ${alert.message}`);
				break;
			case "dashboard":
				console.log(`[DASHBOARD] Alert displayed: ${alert.message}`);
				break;
		}
	}

	/**
	 * Setup default alert routes
	 */
	private setupDefaultRoutes(): void {
		this.routes = [
			{
				severity: "critical",
				destination: "pagerduty",
				escalationDelay: 5,
			},
			{
				severity: "critical",
				destination: "slack",
				channel: "#kai-incidents",
			},
			{
				severity: "warning",
				destination: "slack",
				channel: "#kai-alerts",
			},
			{
				severity: "info",
				destination: "dashboard",
			},
		];
	}

	/**
	 * Add custom alert route
	 */
	addRoute(route: AlertRoute): void {
		this.routes.push(route);
	}

	/**
	 * Get active alerts
	 */
	getActiveAlerts(): Alert[] {
		return Array.from(this.alerts.values()).filter((a) => !a.resolved);
	}

	/**
	 * Get alert history
	 */
	getAlertHistory(limit: number = 100): Alert[] {
		return Array.from(this.alerts.values()).slice(-limit);
	}
}

interface AlertRule {
	metricName: string;
	condition: "greater_than" | "less_than" | "equal_to";
	threshold: number;
	duration: number;
	lastTriggered: number;
	consecutive: number;
}

/**
 * Health Check Manager
 */
export class HealthCheckManager {
	private checks: Map<string, HealthCheck> = new Map();
	private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
	private lastCheckResults: Map<
		string,
		{
			healthy: boolean;
			responseTime: number;
			statusCode?: number;
			lastCheck: number;
		}
	> = new Map();

	/**
	 * Register health check
	 */
	registerHealthCheck(check: HealthCheck): void {
		this.checks.set(check.name, check);
	}

	/**
	 * Start all health checks
	 */
	startChecks(
		onCheckComplete?: (name: string, healthy: boolean) => void,
	): void {
		for (const [name, check] of this.checks.entries()) {
			this.startIndividualCheck(name, check, onCheckComplete);
		}
	}

	/**
	 * Start individual health check
	 */
	private startIndividualCheck(
		name: string,
		check: HealthCheck,
		onCheckComplete?: (name: string, healthy: boolean) => void,
	): void {
		// Initial check
		this.performCheck(name, check).then((result) => {
			this.lastCheckResults.set(name, result);
			if (onCheckComplete) {
				onCheckComplete(name, result.healthy);
			}
		});

		// Schedule recurring checks
		const interval = setInterval(() => {
			this.performCheck(name, check).then((result) => {
				this.lastCheckResults.set(name, result);
				if (onCheckComplete) {
					onCheckComplete(name, result.healthy);
				}
			});
		}, check.interval * 1000);

		this.checkIntervals.set(name, interval);
	}

	/**
	 * Perform individual health check (mock implementation)
	 */
	private async performCheck(
		name: string,
		check: HealthCheck,
	): Promise<{
		healthy: boolean;
		responseTime: number;
		statusCode?: number;
		lastCheck: number;
	}> {
		const startTime = Date.now();

		// Simulate HTTP request
		return new Promise((resolve) => {
			const timeoutId = setTimeout(() => {
				resolve({
					healthy: false,
					responseTime: check.timeout,
					statusCode: 0,
					lastCheck: Date.now(),
				});
			}, check.timeout);

			// Simulate request completion
			setTimeout(() => {
				clearTimeout(timeoutId);
				const responseTime = Date.now() - startTime;

				// Mock success response
				const statusCode = 200;
				const healthy = statusCode === check.expectedStatus;

				resolve({
					healthy,
					responseTime,
					statusCode,
					lastCheck: Date.now(),
				});
			}, Math.random() * 100);
		});
	}

	/**
	 * Get health status for endpoint
	 */
	getHealthStatus(name: string): {
		name: string;
		healthy: boolean;
		responseTime: number;
		lastCheck: number;
	} | null {
		const result = this.lastCheckResults.get(name);
		if (!result) return null;

		return {
			name,
			healthy: result.healthy,
			responseTime: result.responseTime,
			lastCheck: result.lastCheck,
		};
	}

	/**
	 * Get all health statuses
	 */
	getAllHealthStatuses(): Array<{
		name: string;
		healthy: boolean;
		responseTime: number;
		lastCheck: number;
	}> {
		const statuses = [];

		for (const [name] of this.checks.entries()) {
			const status = this.getHealthStatus(name);
			if (status) {
				statuses.push(status);
			}
		}

		return statuses;
	}

	/**
	 * Stop all health checks
	 */
	stopChecks(): void {
		for (const interval of this.checkIntervals.values()) {
			clearInterval(interval);
		}
		this.checkIntervals.clear();
	}
}

/**
 * Monitoring Dashboard Data Provider
 */
export class MonitoringDashboard {
	private metricsCollector: MetricsCollector;
	private alertManager: AlertManager;
	private healthCheckManager: HealthCheckManager;

	constructor(
		metricsCollector: MetricsCollector,
		alertManager: AlertManager,
		healthCheckManager: HealthCheckManager,
	) {
		this.metricsCollector = metricsCollector;
		this.alertManager = alertManager;
		this.healthCheckManager = healthCheckManager;
	}

	/**
	 * Get dashboard summary
	 */
	getDashboardSummary(): {
		timestamp: number;
		metrics: Record<string, any>;
		alerts: {
			active: number;
			critical: number;
			warning: number;
		};
		health: {
			healthy: number;
			unhealthy: number;
			status: Array<{
				name: string;
				healthy: boolean;
				responseTime: number;
			}>;
		};
	} {
		const activeAlerts = this.alertManager.getActiveAlerts();
		const healthStatuses = this.healthCheckManager.getAllHealthStatuses();

		return {
			timestamp: Date.now(),
			metrics: {
				requestsPerSecond: this.metricsCollector.getMetricStats(
					"requests_per_second",
				),
				errorRate: this.metricsCollector.getMetricStats("error_rate"),
				latencyP99: this.metricsCollector.getMetricStats("latency_p99"),
				memoryUsage: this.metricsCollector.getMetricStats("memory_usage"),
			},
			alerts: {
				active: activeAlerts.length,
				critical: activeAlerts.filter((a) => a.severity === "critical").length,
				warning: activeAlerts.filter((a) => a.severity === "warning").length,
			},
			health: {
				healthy: healthStatuses.filter((s) => s.healthy).length,
				unhealthy: healthStatuses.filter((s) => !s.healthy).length,
				status: healthStatuses.map((s) => ({
					name: s.name,
					healthy: s.healthy,
					responseTime: s.responseTime,
				})),
			},
		};
	}

	/**
	 * Generate monitoring report
	 */
	generateReport(): string {
		const summary = this.getDashboardSummary();
		let report = `# Monitoring Report\n\n`;

		report += `**Timestamp**: ${new Date(summary.timestamp).toISOString()}\n\n`;

		report += `## Metrics Summary\n`;
		for (const [name, stats] of Object.entries(summary.metrics)) {
			if (stats) {
				report += `- **${name}**: avg=${(stats.avg as number).toFixed(2)}, p99=${(stats.p99 as number).toFixed(2)}\n`;
			}
		}

		report += `\n## Alert Status\n`;
		report += `- **Active Alerts**: ${summary.alerts.active}\n`;
		report += `- **Critical**: ${summary.alerts.critical}\n`;
		report += `- **Warning**: ${summary.alerts.warning}\n`;

		report += `\n## Health Check Status\n`;
		for (const health of summary.health.status) {
			const status = health.healthy ? "✓ Healthy" : "✗ Unhealthy";
			report += `- ${health.name}: ${status} (${health.responseTime.toFixed(0)}ms)\n`;
		}

		return report;
	}
}
