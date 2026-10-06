/**
 * KAI Workflow Test Runner UI
 * Interactive testing interface for workflows
 */

import { WorkflowDefinition, WorkflowExecution } from "../types";

export interface TestCase {
	id: string;
	name: string;
	description: string;
	input: Record<string, any>;
	expectedOutput?: Record<string, any>;
	timeout?: number;
	tags: string[];
}

export interface TestResult {
	testId: string;
	testName: string;
	status: "pending" | "running" | "passed" | "failed" | "error";
	duration: number;
	executionId?: string;
	input: Record<string, any>;
	output?: Record<string, any>;
	error?: string;
	assertions?: AssertionResult[];
	timestamp: number;
}

export interface AssertionResult {
	name: string;
	passed: boolean;
	expected?: any;
	actual?: any;
	message?: string;
}

export interface TestSuite {
	id: string;
	name: string;
	description: string;
	testCases: TestCase[];
	setupSteps?: string;
	teardownSteps?: string;
}

/**
 * Test Runner for Workflows
 */
export class WorkflowTestRunner {
	private workflow: WorkflowDefinition;
	private testSuites: Map<string, TestSuite> = new Map();
	private testResults: TestResult[] = [];
	private isRunning = false;
	private currentTestId: string | null = null;

	constructor(workflow: WorkflowDefinition) {
		this.workflow = workflow;
	}

	/**
	 * Add a test suite
	 */
	addTestSuite(suite: TestSuite): void {
		this.testSuites.set(suite.id, suite);
	}

	/**
	 * Add a test case to a suite
	 */
	addTestCase(suiteId: string, testCase: TestCase): boolean {
		const suite = this.testSuites.get(suiteId);
		if (!suite) {
			return false;
		}

		suite.testCases.push(testCase);
		return true;
	}

	/**
	 * Run a single test case
	 */
	async runTest(testId: string, executor?: any): Promise<TestResult> {
		// Find the test
		let testCase: TestCase | undefined;
		let suiteId: string | undefined;

		for (const [sid, suite] of this.testSuites.entries()) {
			const found = suite.testCases.find((t) => t.id === testId);
			if (found) {
				testCase = found;
				suiteId = sid;
				break;
			}
		}

		if (!testCase) {
			return {
				testId,
				testName: "Unknown",
				status: "error",
				duration: 0,
				error: "Test not found",
				input: {},
				timestamp: Date.now(),
			};
		}

		const result: TestResult = {
			testId,
			testName: testCase.name,
			status: "running",
			duration: 0,
			input: testCase.input,
			timestamp: Date.now(),
		};

		this.currentTestId = testId;
		const startTime = performance.now();

		try {
			// Simulate workflow execution
			const mockExecution: WorkflowExecution = {
				id: `test_exec_${testId}`,
				workflowId: this.workflow.id,
				status: "running",
				startTime: Date.now(),
				steps: {},
				context: testCase.input,
				correlationId: `test_corr_${Date.now()}`,
			};

			// Simulate step execution
			await this._simulateExecution(mockExecution, testCase.timeout || 30000);

			result.executionId = mockExecution.id;
			result.output = mockExecution.context;
			result.status = "passed";

			// Run assertions if expected output defined
			if (testCase.expectedOutput) {
				result.assertions = this._runAssertions(
					testCase.expectedOutput,
					mockExecution.context,
				);

				const allPassed = result.assertions.every((a) => a.passed);
				result.status = allPassed ? "passed" : "failed";
			}
		} catch (error) {
			result.status = "failed";
			result.error = (error as Error).message;
		} finally {
			result.duration = performance.now() - startTime;
			this.currentTestId = null;
		}

		this.testResults.push(result);
		return result;
	}

	/**
	 * Run all tests in a suite
	 */
	async runTestSuite(suiteId: string, executor?: any): Promise<TestResult[]> {
		const suite = this.testSuites.get(suiteId);
		if (!suite) {
			return [];
		}

		this.isRunning = true;
		const results: TestResult[] = [];

		for (const testCase of suite.testCases) {
			const result = await this.runTest(testCase.id, executor);
			results.push(result);
		}

		this.isRunning = false;
		return results;
	}

	/**
	 * Run all test suites
	 */
	async runAllTests(executor?: any): Promise<TestResult[]> {
		this.isRunning = true;
		const results: TestResult[] = [];

		for (const suiteId of this.testSuites.keys()) {
			const suiteResults = await this.runTestSuite(suiteId, executor);
			results.push(...suiteResults);
		}

		this.isRunning = false;
		return results;
	}

	/**
	 * Simulate workflow execution
	 */
	private async _simulateExecution(
		execution: WorkflowExecution,
		timeout: number,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(
				() => reject(new Error(`Execution timeout after ${timeout}ms`)),
				timeout,
			);

			// Simulate step execution
			const executeSteps = async () => {
				try {
					for (const step of this.workflow.steps) {
						execution.steps[step.id] = {
							stepId: step.id,
							status: "running",
							input: execution.context,
							startTime: Date.now(),
							retries: 0,
						};

						// Simulate step processing
						await new Promise((r) => setTimeout(r, Math.random() * 100));

						execution.steps[step.id].status = "success";
						execution.steps[step.id].endTime = Date.now();
						execution.steps[step.id].output = {
							...execution.context,
							lastStep: step.id,
						};

						execution.context = {
							...execution.context,
							[step.id]: execution.steps[step.id].output,
						};
					}

					execution.status = "success";
					clearTimeout(timeoutId);
					resolve();
				} catch (error) {
					clearTimeout(timeoutId);
					reject(error);
				}
			};

			executeSteps();
		});
	}

	/**
	 * Run assertions against output
	 */
	private _runAssertions(
		expected: Record<string, any>,
		actual: Record<string, any>,
	): AssertionResult[] {
		const assertions: AssertionResult[] = [];

		for (const [key, expectedValue] of Object.entries(expected)) {
			const actualValue = actual[key];
			const passed =
				JSON.stringify(actualValue) === JSON.stringify(expectedValue);

			assertions.push({
				name: `Assert ${key} equals ${JSON.stringify(expectedValue)}`,
				passed,
				expected: expectedValue,
				actual: actualValue,
				message: passed
					? `✓ Assertion passed`
					: `✗ Expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
			});
		}

		return assertions;
	}

	/**
	 * Get test results
	 */
	getResults(): TestResult[] {
		return [...this.testResults];
	}

	/**
	 * Get results by status
	 */
	getResultsByStatus(status: TestResult["status"]): TestResult[] {
		return this.testResults.filter((r) => r.status === status);
	}

	/**
	 * Get test statistics
	 */
	getStatistics(): {
		total: number;
		passed: number;
		failed: number;
		errors: number;
		duration: number;
		successRate: number;
	} {
		const total = this.testResults.length;
		const passed = this.testResults.filter((r) => r.status === "passed").length;
		const failed = this.testResults.filter((r) => r.status === "failed").length;
		const errors = this.testResults.filter((r) => r.status === "error").length;
		const duration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

		return {
			total,
			passed,
			failed,
			errors,
			duration,
			successRate: total > 0 ? (passed / total) * 100 : 0,
		};
	}

	/**
	 * Clear results
	 */
	clearResults(): void {
		this.testResults = [];
	}

	/**
	 * Generate test report
	 */
	generateReport(): string {
		const stats = this.getStatistics();
		let report = `# Test Report for ${this.workflow.name}\n\n`;

		report += `## Summary\n`;
		report += `- Total Tests: ${stats.total}\n`;
		report += `- Passed: ${stats.passed}\n`;
		report += `- Failed: ${stats.failed}\n`;
		report += `- Errors: ${stats.errors}\n`;
		report += `- Success Rate: ${stats.successRate.toFixed(1)}%\n`;
		report += `- Total Duration: ${stats.duration.toFixed(0)}ms\n\n`;

		report += `## Test Results\n`;
		for (const result of this.testResults) {
			const icon = result.status === "passed" ? "✓" : "✗";
			report += `${icon} ${result.testName} (${result.status})\n`;

			if (result.error) {
				report += `  Error: ${result.error}\n`;
			}

			if (result.assertions) {
				for (const assertion of result.assertions) {
					const icon2 = assertion.passed ? "✓" : "✗";
					report += `  ${icon2} ${assertion.name}\n`;
				}
			}

			report += `  Duration: ${result.duration.toFixed(0)}ms\n\n`;
		}

		return report;
	}

	/**
	 * Export test results as JSON
	 */
	exportResults(): string {
		return JSON.stringify(
			{
				workflow: {
					id: this.workflow.id,
					name: this.workflow.name,
					version: this.workflow.version,
				},
				statistics: this.getStatistics(),
				results: this.testResults,
				timestamp: new Date().toISOString(),
			},
			null,
			2,
		);
	}

	/**
	 * Check if tests are running
	 */
	isTestsRunning(): boolean {
		return this.isRunning;
	}

	/**
	 * Get current test being run
	 */
	getCurrentTest(): string | null {
		return this.currentTestId;
	}

	/**
	 * Get all test suites
	 */
	getTestSuites(): TestSuite[] {
		return Array.from(this.testSuites.values());
	}
}

/**
 * Helper to create common test scenarios
 */
export class TestScenarioBuilder {
	private testCases: TestCase[] = [];

	/**
	 * Add happy path test
	 */
	addHappyPath(name: string, input: Record<string, any>): this {
		this.testCases.push({
			id: `happy_${Date.now()}`,
			name,
			description: "Happy path test with valid input",
			input,
			tags: ["happy-path"],
		});
		return this;
	}

	/**
	 * Add edge case test
	 */
	addEdgeCase(name: string, input: Record<string, any>): this {
		this.testCases.push({
			id: `edge_${Date.now()}`,
			name,
			description: "Edge case test",
			input,
			tags: ["edge-case"],
		});
		return this;
	}

	/**
	 * Add error scenario test
	 */
	addErrorScenario(name: string, input: Record<string, any>): this {
		this.testCases.push({
			id: `error_${Date.now()}`,
			name,
			description: "Error scenario test",
			input,
			tags: ["error-scenario"],
		});
		return this;
	}

	/**
	 * Build and return test cases
	 */
	build(): TestCase[] {
		return this.testCases;
	}
}
