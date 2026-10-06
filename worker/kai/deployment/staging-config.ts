/**
 * KAI Staging Deployment Configuration
 * Week 4 Monday: Deploy to staging, smoke tests
 */

export interface StagingEnvironment {
	name: "staging";
	database: {
		name: string;
		region: string;
	};
	kvNamespace: {
		binding: string;
		id: string;
	};
	r2Bucket: {
		binding: string;
		name: string;
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
	errorRate: number; // 5%
	latencyP99: number; // 1000ms
	memoryUsage: number; // 512MB
	failedRetries: number; // 10%
}

export interface SmokeTest {
	id: string;
	name: string;
	description: string;
	endpoint: string;
	method: "GET" | "POST" | "PUT" | "DELETE";
	payload?: Record<string, any>;
	expectedStatus: number;
	expectedFields?: string[];
	timeout: number;
	retries: number;
}

/**
 * Staging Configuration Manager
 */
export class StagingConfig {
	private config: StagingEnvironment;
	private smokeTests: Map<string, SmokeTest> = new Map();

	constructor() {
		this.config = {
			name: "staging",
			database: {
				name: "kai-staging",
				region: "us-east-1",
			},
			kvNamespace: {
				binding: "KV_STAGING",
				id: "staging-kv-id",
			},
			r2Bucket: {
				binding: "R2_STAGING",
				name: "kai-staging-archives",
			},
			rateLimit: {
				requestsPerMinute: 1000, // More permissive for testing
				requestsPerSecond: 100,
			},
			monitoring: {
				enabled: true,
				sampleRate: 1.0, // 100% for staging
				alertThresholds: {
					errorRate: 0.05, // 5%
					latencyP99: 1000, // 1s
					memoryUsage: 512, // MB
					failedRetries: 0.1, // 10%
				},
			},
		};

		this.initializeSmokeTests();
	}

	/**
	 * Initialize smoke test suite
	 */
	private initializeSmokeTests(): void {
		// Health check test
		this.addSmokeTest({
			id: "health_check",
			name: "Health Check",
			description: "Verify API is responding",
			endpoint: "/health",
			method: "GET",
			expectedStatus: 200,
			timeout: 5000,
			retries: 3,
		});

		// Workflow creation test
		this.addSmokeTest({
			id: "create_workflow",
			name: "Create Workflow",
			description: "Test workflow creation",
			endpoint: "/api/workflows",
			method: "POST",
			payload: {
				name: "Smoke Test Workflow",
				steps: [
					{
						id: "step1",
						type: "connector",
						connector: { type: "http", action: "get", params: {} },
					},
				],
			},
			expectedStatus: 201,
			expectedFields: ["id", "name", "version"],
			timeout: 5000,
			retries: 2,
		});

		// Trigger webhook test
		this.addSmokeTest({
			id: "trigger_webhook",
			name: "Trigger Webhook",
			description: "Test webhook execution",
			endpoint: "/api/workflows/test/execute",
			method: "POST",
			payload: { userId: "test-user" },
			expectedStatus: 200,
			expectedFields: ["executionId", "status"],
			timeout: 10000,
			retries: 2,
		});

		// State management test
		this.addSmokeTest({
			id: "state_management",
			name: "State Management",
			description: "Test state storage and retrieval",
			endpoint: "/api/executions/latest",
			method: "GET",
			expectedStatus: 200,
			timeout: 5000,
			retries: 2,
		});

		// Connector test
		this.addSmokeTest({
			id: "connector_http",
			name: "HTTP Connector",
			description: "Test HTTP connector",
			endpoint: "/api/connectors/http/validate",
			method: "POST",
			payload: { url: "https://api.example.com/test" },
			expectedStatus: 200,
			timeout: 5000,
			retries: 2,
		});
	}

	/**
	 * Add smoke test
	 */
	addSmokeTest(test: SmokeTest): void {
		this.smokeTests.set(test.id, test);
	}

	/**
	 * Get all smoke tests
	 */
	getSmokeTests(): SmokeTest[] {
		return Array.from(this.smokeTests.values());
	}

	/**
	 * Get smoke test by ID
	 */
	getSmokeTest(id: string): SmokeTest | undefined {
		return this.smokeTests.get(id);
	}

	/**
	 * Get staging configuration
	 */
	getConfig(): StagingEnvironment {
		return { ...this.config };
	}

	/**
	 * Get environment variables for staging
	 */
	getEnvironmentVariables(): Record<string, string> {
		return {
			ENVIRONMENT: "staging",
			KAI_DB_NAME: this.config.database.name,
			KAI_DB_REGION: this.config.database.region,
			KAI_KV_BINDING: this.config.kvNamespace.binding,
			KAI_R2_BINDING: this.config.r2Bucket.binding,
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
[env.staging]
d1_databases = [{ binding = "DB", database_name = "${this.config.database.name}" }]
kv_namespaces = [{ binding = "${this.config.kvNamespace.binding}", id = "${this.config.kvNamespace.id}" }]
r2_buckets = [{ binding = "${this.config.r2Bucket.binding}", bucket_name = "${this.config.r2Bucket.name}" }]

[env.staging.triggers.crons]
crons = ["0 2 * * *"]

[env.staging.vars]
ENVIRONMENT = "staging"
KAI_DB_INITIALIZED = "false"
MONITORING_ENABLED = "true"
`;
	}

	/**
	 * Validate staging configuration
	 */
	validate(): {
		valid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (!this.config.database.name) {
			errors.push("Database name not configured");
		}

		if (!this.config.kvNamespace.id) {
			errors.push("KV namespace ID not configured");
		}

		if (!this.config.r2Bucket.name) {
			errors.push("R2 bucket name not configured");
		}

		if (this.smokeTests.size === 0) {
			errors.push("No smoke tests configured");
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}
}

/**
 * Smoke Test Runner
 */
export class SmokeTestRunner {
	private stagingConfig: StagingConfig;
	private results: Map<string, SmokeTestResult> = new Map();
	private startTime: number = 0;

	constructor() {
		this.stagingConfig = new StagingConfig();
	}

	/**
	 * Run all smoke tests
	 */
	async runAllTests(baseUrl: string): Promise<SmokeTestResult[]> {
		const tests = this.stagingConfig.getSmokeTests();
		const results: SmokeTestResult[] = [];

		this.startTime = performance.now();

		for (const test of tests) {
			const result = await this.runTest(test, baseUrl);
			results.push(result);
			this.results.set(test.id, result);
		}

		return results;
	}

	/**
	 * Run single smoke test
	 */
	async runTest(test: SmokeTest, baseUrl: string): Promise<SmokeTestResult> {
		let lastError: Error | null = null;
		let response: any = null;

		for (let attempt = 1; attempt <= test.retries; attempt++) {
			try {
				const url = `${baseUrl}${test.endpoint}`;
				const start = performance.now();

				// Simulate HTTP request
				const fetchOptions: RequestInit = {
					method: test.method,
					headers: {
						"Content-Type": "application/json",
					},
				};

				if (test.payload) {
					fetchOptions.body = JSON.stringify(test.payload);
				}

				response = await this.simulateRequest(url, fetchOptions);
				const duration = performance.now() - start;

				// Check response
				if (response.status === test.expectedStatus) {
					// Validate expected fields
					if (test.expectedFields) {
						const hasAllFields = test.expectedFields.every(
							(field) => field in response.body,
						);

						if (!hasAllFields) {
							throw new Error(
								`Response missing expected fields. Expected: ${test.expectedFields.join(", ")}`,
							);
						}
					}

					return {
						testId: test.id,
						testName: test.name,
						status: "passed",
						duration,
						attempts: attempt,
						response: response.body,
					};
				} else {
					throw new Error(
						`Expected status ${test.expectedStatus}, got ${response.status}`,
					);
				}
			} catch (error) {
				lastError = error as Error;

				// Wait before retry
				if (attempt < test.retries) {
					await new Promise((r) =>
						setTimeout(r, Math.pow(2, attempt - 1) * 1000),
					);
				}
			}
		}

		return {
			testId: test.id,
			testName: test.name,
			status: "failed",
			duration: 0,
			attempts: test.retries,
			error: lastError?.message || "Unknown error",
		};
	}

	/**
	 * Simulate HTTP request (mock implementation)
	 */
	private async simulateRequest(
		url: string,
		options: RequestInit,
	): Promise<any> {
		// Simulate request processing
		await new Promise((r) => setTimeout(r, Math.random() * 100));

		// Mock success responses
		const path = new URL(url).pathname;

		if (path === "/health") {
			return {
				status: 200,
				body: { status: "ok", timestamp: new Date().toISOString() },
			};
		} else if (path === "/api/workflows") {
			return {
				status: 201,
				body: {
					id: "workflow_test_123",
					name: "Smoke Test Workflow",
					version: 1,
					status: "draft",
				},
			};
		} else if (path === "/api/workflows/test/execute") {
			return {
				status: 200,
				body: {
					executionId: "exec_test_123",
					status: "pending",
					workflowId: "workflow_test_123",
				},
			};
		}

		// Default mock response
		return {
			status: 200,
			body: { success: true },
		};
	}

	/**
	 * Get test results
	 */
	getResults(): SmokeTestResult[] {
		return Array.from(this.results.values());
	}

	/**
	 * Get results summary
	 */
	getSummary(): {
		total: number;
		passed: number;
		failed: number;
		duration: number;
		successRate: number;
	} {
		const results = this.getResults();
		const total = results.length;
		const passed = results.filter((r) => r.status === "passed").length;
		const failed = results.filter((r) => r.status === "failed").length;
		const duration = performance.now() - this.startTime;

		return {
			total,
			passed,
			failed,
			duration,
			successRate: total > 0 ? (passed / total) * 100 : 0,
		};
	}

	/**
	 * Generate smoke test report
	 */
	generateReport(): string {
		const summary = this.getSummary();
		let report = `# Staging Smoke Test Report\n\n`;

		report += `## Summary\n`;
		report += `- Total Tests: ${summary.total}\n`;
		report += `- Passed: ${summary.passed}\n`;
		report += `- Failed: ${summary.failed}\n`;
		report += `- Success Rate: ${summary.successRate.toFixed(1)}%\n`;
		report += `- Duration: ${summary.duration.toFixed(0)}ms\n\n`;

		report += `## Results\n`;
		for (const result of this.getResults()) {
			const icon = result.status === "passed" ? "✓" : "✗";
			report += `${icon} ${result.testName} (${result.status})\n`;

			if (result.error) {
				report += `  Error: ${result.error}\n`;
			}

			report += `  Duration: ${result.duration.toFixed(0)}ms (${result.attempts} attempt(s))\n\n`;
		}

		return report;
	}
}

export interface SmokeTestResult {
	testId: string;
	testName: string;
	status: "passed" | "failed";
	duration: number;
	attempts: number;
	response?: Record<string, any>;
	error?: string;
}
