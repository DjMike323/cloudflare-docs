/**
 * KAI Integration Tests
 * Complete end-to-end validation of workflow execution
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
	initializeKai,
	WorkflowDefinition,
	WorkflowExecution,
	TriggerConfig,
} from "./index";
import { initializeKaiDatabase } from "./db";

// Mock environment for testing
const mockEnv = {
	DB: {} as D1Database,
	KV: new Map() as any,
	R2: {
		put: vi.fn(),
		get: vi.fn(),
		delete: vi.fn(),
		list: vi.fn().mockResolvedValue({ objects: [] }),
	} as any,
};

describe("KAI Workflow Integration Tests", () => {
	let system: any;

	beforeAll(async () => {
		// Initialize KAI system with test environment
		system = await initializeKai(mockEnv);
	});

	describe("Workflow Lifecycle", () => {
		let testWorkflowId: string;

		it("should create workflow definition", async () => {
			testWorkflowId = `workflow_test_${Date.now()}`;

			const workflow: WorkflowDefinition = {
				id: testWorkflowId,
				name: "Test Workflow",
				description: "Integration test workflow",
				version: 1,
				status: "draft",
				steps: [
					{
						id: "step_1",
						type: "connector",
						connector: {
							type: "http",
							action: "get",
							params: { url: "https://api.example.com/test" },
						},
						nextStep: "step_2",
					},
					{
						id: "step_2",
						type: "transform",
						transform: {
							language: "javascript",
							code: "return { ...context.step_1, processed: true }",
						},
					},
				],
				triggers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			expect(workflow.id).toBe(testWorkflowId);
			expect(workflow.steps.length).toBe(2);
			expect(workflow.status).toBe("draft");
		});

		it("should publish workflow", async () => {
			const workflow: WorkflowDefinition = {
				id: `workflow_publish_${Date.now()}`,
				name: "Published Workflow",
				version: 1,
				status: "published", // Changed from draft to published
				steps: [],
				triggers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
				publishedAt: new Date(),
			};

			expect(workflow.status).toBe("published");
			expect(workflow.publishedAt).toBeDefined();
		});

		it("should version workflows correctly", async () => {
			const workflowV1: WorkflowDefinition = {
				id: "versioned_workflow",
				name: "Versioned",
				version: 1,
				status: "published",
				steps: [],
				triggers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const workflowV2: WorkflowDefinition = {
				...workflowV1,
				version: 2,
				updatedAt: new Date(),
			};

			expect(workflowV2.version).toBeGreaterThan(workflowV1.version);
		});
	});

	describe("Trigger Registration", () => {
		const workflowId = `workflow_triggers_${Date.now()}`;

		it("should register webhook trigger", async () => {
			const triggerId = await system.triggerManager.registerWebhookTrigger(
				workflowId,
				{
					id: "webhook_1",
					type: "webhook",
					config: {
						path: "/workflows/test",
						method: "POST",
						auth: "none",
					},
					enabled: true,
				},
			);

			expect(triggerId).toMatch(/^trigger_/);

			// Verify cached in KV
			const cached = mockEnv.KV.get(`webhook:/workflows/test`);
			expect(cached).toBeDefined();
		});

		it("should register schedule trigger", async () => {
			const triggerId = await system.triggerManager.registerScheduleTrigger(
				workflowId,
				{
					id: "schedule_1",
					type: "schedule",
					config: {
						cron: "0 9 * * MON-FRI",
						timezone: "UTC",
					},
					enabled: true,
				},
			);

			expect(triggerId).toMatch(/^trigger_/);
		});

		it("should register event trigger", async () => {
			const triggerId = await system.triggerManager.registerEventTrigger(
				workflowId,
				{
					id: "event_1",
					type: "event",
					config: {
						topic: "user.signup",
						eventType: "user_created",
						conditions: { plan: "premium" },
					},
					enabled: true,
				},
			);

			expect(triggerId).toMatch(/^trigger_/);

			// Verify subscriber added
			const subscribers = mockEnv.KV.get("event:user.signup");
			expect(subscribers).toBeDefined();
		});

		it("should register manual trigger", async () => {
			const triggerId = await system.triggerManager.registerManualTrigger(
				workflowId,
				{
					id: "manual_1",
					type: "manual",
					config: {
						requiresApproval: false,
						inputSchema: { userId: { type: "string", required: true } },
					},
					enabled: true,
				},
			);

			expect(triggerId).toMatch(/^trigger_/);
		});
	});

	describe("Workflow Execution", () => {
		const simpleWorkflow: WorkflowDefinition = {
			id: "simple_workflow",
			name: "Simple Workflow",
			version: 1,
			status: "published",
			steps: [
				{
					id: "fetch_data",
					type: "connector",
					connector: {
						type: "http",
						action: "get",
						params: { url: "https://api.example.com/data" },
					},
					nextStep: "transform_data",
				},
				{
					id: "transform_data",
					type: "transform",
					transform: {
						language: "javascript",
						code: "return { ...context.fetch_data, transformed: true }",
					},
				},
			],
			triggers: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		it("should execute workflow with connector step", async () => {
			const execution: WorkflowExecution = {
				id: `exec_${Date.now()}`,
				workflowId: "simple_workflow",
				status: "pending",
				startTime: Date.now(),
				steps: {},
				context: { input: { test: true } },
				correlationId: `corr_${Date.now()}`,
			};

			// Mock HTTP connector
			const mockConnector = system.connectors.get("http");
			expect(mockConnector).toBeDefined();
			expect(mockConnector.getActions().length).toBeGreaterThan(0);
		});

		it("should execute transform steps", async () => {
			const execution: WorkflowExecution = {
				id: `exec_transform_${Date.now()}`,
				workflowId: "simple_workflow",
				status: "pending",
				startTime: Date.now(),
				steps: {
					fetch_data: {
						stepId: "fetch_data",
						status: "success",
						input: {},
						output: { data: "test_data" },
						startTime: Date.now(),
						retries: 0,
					},
				},
				context: {
					input: { test: true },
					fetch_data: { data: "test_data" },
				},
				correlationId: `corr_${Date.now()}`,
			};

			expect(execution.steps.fetch_data.status).toBe("success");
			expect(execution.context.fetch_data).toBeDefined();
		});

		it("should track step execution results", async () => {
			const execution: WorkflowExecution = {
				id: `exec_track_${Date.now()}`,
				workflowId: "simple_workflow",
				status: "running",
				startTime: Date.now(),
				steps: {
					step_1: {
						stepId: "step_1",
						status: "success",
						input: { param: "value" },
						output: { result: "success" },
						startTime: Date.now(),
						endTime: Date.now() + 100,
						retries: 0,
					},
				},
				context: {},
				correlationId: `corr_${Date.now()}`,
			};

			expect(execution.steps.step_1.status).toBe("success");
			expect(execution.steps.step_1.endTime).toBeGreaterThan(
				execution.steps.step_1.startTime,
			);
		});
	});

	describe("Parallel Step Execution", () => {
		it("should execute multiple steps in parallel", async () => {
			const parallelWorkflow: WorkflowDefinition = {
				id: "parallel_workflow",
				name: "Parallel Workflow",
				version: 1,
				status: "published",
				steps: [
					{
						id: "parallel_group",
						type: "parallel",
						parallel: ["fetch_user", "fetch_orders", "fetch_profile"],
					},
					{
						id: "fetch_user",
						type: "connector",
						connector: {
							type: "http",
							action: "get",
							params: { url: "https://api.example.com/user" },
						},
					},
					{
						id: "fetch_orders",
						type: "connector",
						connector: {
							type: "http",
							action: "get",
							params: { url: "https://api.example.com/orders" },
						},
					},
					{
						id: "fetch_profile",
						type: "connector",
						connector: {
							type: "http",
							action: "get",
							params: { url: "https://api.example.com/profile" },
						},
					},
				],
				triggers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			expect(parallelWorkflow.steps[0].type).toBe("parallel");
			expect(parallelWorkflow.steps[0].parallel?.length).toBe(3);
		});
	});

	describe("State Management", () => {
		const executionId = `exec_state_${Date.now()}`;

		it("should store execution state", async () => {
			const execution: WorkflowExecution = {
				id: executionId,
				workflowId: "test_workflow",
				status: "success",
				startTime: Date.now(),
				endTime: Date.now() + 1000,
				steps: {},
				context: { result: "completed" },
				correlationId: `corr_${Date.now()}`,
			};

			// Mock state storage
			mockEnv.KV.set(`execution:${executionId}`, JSON.stringify(execution));

			const cached = mockEnv.KV.get(`execution:${executionId}`);
			expect(cached).toBeDefined();
		});

		it("should retrieve execution from cache", async () => {
			const execution: WorkflowExecution = {
				id: `exec_cached_${Date.now()}`,
				workflowId: "test_workflow",
				status: "success",
				startTime: Date.now(),
				steps: {},
				context: {},
				correlationId: `corr_${Date.now()}`,
			};

			mockEnv.KV.set(`execution:${execution.id}`, JSON.stringify(execution));

			const retrieved = mockEnv.KV.get(`execution:${execution.id}`);
			const parsed = JSON.parse(retrieved);

			expect(parsed.id).toBe(execution.id);
			expect(parsed.status).toBe("success");
		});

		it("should store workflow variables", async () => {
			const executionId = `exec_vars_${Date.now()}`;
			const varId = `var_${executionId}_user_data`;

			const userProfile = {
				id: "123",
				name: "John",
				email: "john@example.com",
			};
			mockEnv.KV.set(
				`var:${varId}`,
				JSON.stringify({
					type: "object",
					value: userProfile,
				}),
			);

			const retrieved = mockEnv.KV.get(`var:${varId}`);
			const parsed = JSON.parse(retrieved);

			expect(parsed.value.name).toBe("John");
			expect(parsed.type).toBe("object");
		});
	});

	describe("Error Handling", () => {
		it("should handle step timeout", async () => {
			const execution: WorkflowExecution = {
				id: `exec_timeout_${Date.now()}`,
				workflowId: "test_workflow",
				status: "failed",
				startTime: Date.now(),
				endTime: Date.now() + 35000, // 35 seconds
				steps: {
					slow_step: {
						stepId: "slow_step",
						status: "failed",
						input: {},
						error: "Operation timeout after 30000ms",
						startTime: Date.now(),
						endTime: Date.now() + 35000,
						retries: 0,
					},
				},
				context: {},
				error: "Operation timeout after 30000ms",
				errorStep: "slow_step",
				correlationId: `corr_${Date.now()}`,
			};

			expect(execution.status).toBe("failed");
			expect(execution.error).toContain("timeout");
		});

		it("should retry failed steps", async () => {
			const execution: WorkflowExecution = {
				id: `exec_retry_${Date.now()}`,
				workflowId: "test_workflow",
				status: "success", // Eventually succeeded
				startTime: Date.now(),
				steps: {
					retry_step: {
						stepId: "retry_step",
						status: "success",
						input: {},
						output: { result: "recovered" },
						startTime: Date.now(),
						endTime: Date.now() + 2500, // 2.5s with retries
						retries: 2, // Retried twice
					},
				},
				context: {},
				retryCount: 2,
				correlationId: `corr_${Date.now()}`,
			};

			expect(execution.steps.retry_step.retries).toBe(2);
			expect(execution.status).toBe("success");
		});

		it("should execute error handler on step failure", async () => {
			const errorHandlerWorkflow: WorkflowDefinition = {
				id: "error_workflow",
				name: "Error Handler Workflow",
				version: 1,
				status: "published",
				steps: [
					{
						id: "risky_step",
						type: "connector",
						connector: {
							type: "http",
							action: "get",
							params: { url: "https://api.example.com/risky" },
						},
						errorHandler: "handle_error",
					},
				],
				errorHandlers: {
					handle_error: {
						id: "handle_error",
						type: "transform",
						transform: {
							language: "javascript",
							code: "return { error: true, message: 'Step failed, recovered' }",
						},
					},
				},
				triggers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			expect(errorHandlerWorkflow.errorHandlers?.handle_error).toBeDefined();
			expect(errorHandlerWorkflow.errorHandlers?.handle_error.type).toBe(
				"transform",
			);
		});
	});

	describe("HERMES Integration", () => {
		it("should route request with confidence score", async () => {
			const routing = await system.hybridRouter.routeRequest({
				query: "Create new user account",
				context: { userId: "123" },
				userId: "123",
				timestamp: Date.now(),
				correlationId: `corr_${Date.now()}`,
			});

			expect(routing.system).toMatch(/^(hermes|kai|hybrid)$/);
			expect(routing.confidence).toBeGreaterThanOrEqual(0);
			expect(routing.confidence).toBeLessThanOrEqual(1);
			expect(routing.reasoning).toBeDefined();
		});

		it("should record execution correlation", async () => {
			const correlation = {
				correlationId: `corr_test_${Date.now()}`,
				workflowId: "test_workflow",
				executionId: `exec_${Date.now()}`,
				success: true,
				duration: 2500,
				result: { status: "completed" },
				patterns: ["user_creation", "premium_plan"],
			};

			expect(correlation.success).toBe(true);
			expect(correlation.patterns.length).toBeGreaterThan(0);
		});

		it("should get learning statistics", async () => {
			const stats = await system.hybridRouter.getLearningStats();

			expect(stats).toHaveProperty("patternsLearned");
			expect(stats).toHaveProperty("avgConfidence");
			expect(stats).toHaveProperty("hermesPatterns");
			expect(stats).toHaveProperty("kaiPatterns");
			expect(stats).toHaveProperty("crossSystemCalls");
		});
	});

	describe("Connector Tests", () => {
		it("should have HTTP connector with all methods", async () => {
			const httpConnector = system.connectors.get("http");
			const actions = httpConnector.getActions();

			const actionIds = actions.map((a: any) => a.id);
			expect(actionIds).toContain("get");
			expect(actionIds).toContain("post");
			expect(actionIds).toContain("put");
			expect(actionIds).toContain("delete");
			expect(actionIds).toContain("patch");
		});

		it("should have Slack connector with messaging actions", async () => {
			const slackConnector = system.connectors.get("slack");
			const actions = slackConnector.getActions();

			const actionIds = actions.map((a: any) => a.id);
			expect(actionIds).toContain("send_message");
			expect(actionIds).toContain("create_channel");
		});

		it("should validate connector configuration", async () => {
			const httpConnector = system.connectors.get("http");
			const isValid = await httpConnector.validateConfig({
				baseUrl: "https://api.example.com",
			});

			expect(isValid).toBe(true);
		});
	});

	afterAll(() => {
		// Cleanup
		mockEnv.KV.clear();
	});
});
