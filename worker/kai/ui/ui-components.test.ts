/**
 * KAI UI Components Tests - Week 3
 * Drag-drop builder, connector library, test runner
 */

import { describe, it, expect, beforeEach } from "vitest";
import { WorkflowBuilder, DragDropManager } from "./workflow-builder";
import { ConnectorLibrary } from "./connector-library";
import { WorkflowTestRunner, TestScenarioBuilder } from "./test-runner";
import { WorkflowDefinition } from "../types";

describe("KAI Workflow Designer UI - Week 3", () => {
	describe("Workflow Builder", () => {
		let builder: WorkflowBuilder;

		beforeEach(() => {
			builder = new WorkflowBuilder("test_workflow");
		});

		it("should create new workflow builder", () => {
			const state = builder.getState();
			expect(state.workflowId).toBeDefined();
			expect(state.name).toBe("New Workflow");
			expect(state.steps).toHaveLength(0);
		});

		it("should add steps to canvas", () => {
			const stepId1 = builder.addStep(
				"connector",
				{ x: 100, y: 100 },
				{
					id: "step1",
					type: "connector",
				},
			);

			const stepId2 = builder.addStep(
				"transform",
				{ x: 300, y: 100 },
				{
					id: "step2",
					type: "transform",
				},
			);

			expect(builder.getSteps()).toHaveLength(2);
			expect(stepId1).toBeDefined();
			expect(stepId2).toBeDefined();
		});

		it("should connect steps", () => {
			const step1 = builder.addStep("connector", { x: 100, y: 100 });
			const step2 = builder.addStep("connector", { x: 300, y: 100 });

			const connected = builder.connectSteps(step1, step2, "success");
			expect(connected).toBe(true);

			const connections = builder.getConnections();
			expect(connections).toHaveLength(1);
			expect(connections[0].from).toBe(step1);
			expect(connections[0].to).toBe(step2);
		});

		it("should disconnect steps", () => {
			const step1 = builder.addStep("connector", { x: 100, y: 100 });
			const step2 = builder.addStep("connector", { x: 300, y: 100 });

			builder.connectSteps(step1, step2);
			expect(builder.getConnections()).toHaveLength(1);

			const disconnected = builder.disconnectSteps(step1, step2);
			expect(disconnected).toBe(true);
			expect(builder.getConnections()).toHaveLength(0);
		});

		it("should move steps on canvas", () => {
			const stepId = builder.addStep("connector", { x: 100, y: 100 });
			builder.moveStep(stepId, 200, 150);

			const node = builder.getStepNode(stepId);
			expect(node?.position.x).toBe(200);
			expect(node?.position.y).toBe(150);
		});

		it("should set canvas zoom level", () => {
			builder.setZoom(2);
			expect(builder.getState().canvasScale).toBe(2);

			builder.setZoom(0.5);
			expect(builder.getState().canvasScale).toBe(0.5);

			// Should clamp to valid range
			builder.setZoom(5);
			expect(builder.getState().canvasScale).toBe(3);

			builder.setZoom(0.05);
			expect(builder.getState().canvasScale).toBe(0.1);
		});

		it("should select steps", () => {
			const stepId = builder.addStep("connector", { x: 100, y: 100 });

			builder.selectStep(stepId);
			expect(builder.getState().selectedStep).toBe(stepId);

			builder.selectStep(null);
			expect(builder.getState().selectedStep).toBeNull();
		});

		it("should validate workflow", () => {
			let validation = builder.validate();
			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain("Workflow name is required");

			builder.setState({ name: "Valid Workflow" });
			validation = builder.validate();
			expect(validation.valid).toBe(false);
			expect(validation.errors.some((e) => e.includes("at least one step")));

			builder.addStep("connector", { x: 100, y: 100 });
			validation = builder.validate();
			expect(validation.valid).toBe(true);
		});

		it("should export workflow definition", () => {
			builder.setState({ name: "Export Test" });

			const step1 = builder.addStep(
				"connector",
				{ x: 100, y: 100 },
				{
					id: "fetch_data",
					type: "connector",
				},
			);

			const step2 = builder.addStep(
				"transform",
				{ x: 300, y: 100 },
				{
					id: "transform_data",
					type: "transform",
				},
			);

			builder.connectSteps(step1, step2);

			const exported = builder.exportWorkflow();

			expect(exported.name).toBe("Export Test");
			expect(exported.steps.length).toBeGreaterThan(0);
			expect(exported.status).toBe("draft");
		});

		it("should load workflow definition", () => {
			const workflow: WorkflowDefinition = {
				id: "load_test",
				name: "Load Test Workflow",
				version: 1,
				status: "draft",
				steps: [
					{
						id: "step1",
						type: "connector",
						connector: { type: "http", action: "get", params: {} },
					},
				],
				triggers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			builder.loadWorkflow(workflow);

			const state = builder.getState();
			expect(state.name).toBe("Load Test Workflow");
			expect(state.steps).toHaveLength(1);
		});

		it("should track workflow changes", () => {
			const initialState = builder.getState().isDirty;
			expect(initialState).toBe(false);

			builder.addStep("connector", { x: 100, y: 100 });
			expect(builder.getState().isDirty).toBe(true);
		});

		it("should remove steps", () => {
			const stepId = builder.addStep("connector", { x: 100, y: 100 });
			expect(builder.getSteps()).toHaveLength(1);

			const removed = builder.removeStep(stepId);
			expect(removed).toBe(true);
			expect(builder.getSteps()).toHaveLength(0);
		});

		it("should handle multiple parallel connections", () => {
			const step1 = builder.addStep("connector", { x: 100, y: 100 });
			const step2 = builder.addStep("connector", { x: 300, y: 100 });
			const step3 = builder.addStep("connector", { x: 300, y: 300 });

			builder.connectSteps(step1, step2, "success");
			builder.connectSteps(step1, step3, "error");

			const connections = builder.getConnections();
			expect(connections).toHaveLength(2);
		});
	});

	describe("Drag-Drop Manager", () => {
		let dragManager: DragDropManager;

		beforeEach(() => {
			dragManager = new DragDropManager();
		});

		it("should start drag operation", () => {
			dragManager.startDrag("step1", 100, 100);

			expect(dragManager.isDraggingStep("step1")).toBe(true);
			expect(dragManager.isDraggingStep("step2")).toBe(false);
		});

		it("should handle drag movement", () => {
			let lastPosition = { x: 0, y: 0 };

			dragManager.setDragCallback((stepId, x, y) => {
				lastPosition = { x, y };
			});

			dragManager.startDrag("step1", 100, 100);
			dragManager.drag(150, 150);

			expect(lastPosition.x).toBe(50); // Delta: 150-100
			expect(lastPosition.y).toBe(50); // Delta: 150-100
		});

		it("should end drag operation", () => {
			dragManager.startDrag("step1", 100, 100);
			expect(dragManager.isDraggingStep("step1")).toBe(true);

			dragManager.endDrag();
			expect(dragManager.isDraggingStep("step1")).toBe(false);
		});
	});

	describe("Connector Library", () => {
		let library: ConnectorLibrary;

		beforeEach(() => {
			library = new ConnectorLibrary();
		});

		it("should initialize with default connectors", () => {
			const allConnectors = library.getAllConnectors();
			expect(allConnectors.length).toBeGreaterThan(0);

			expect(library.getConnector("http")).toBeDefined();
			expect(library.getConnector("slack")).toBeDefined();
		});

		it("should get installed connectors", () => {
			const installed = library.getInstalledConnectors();
			expect(installed.length).toBeGreaterThan(0);
			expect(installed.every((c) => c.installed)).toBe(true);
		});

		it("should filter connectors by category", () => {
			const apiConnectors = library.getConnectorsByCategory("API & Webhooks");
			expect(apiConnectors.length).toBeGreaterThan(0);

			const commConnectors = library.getConnectorsByCategory("Communication");
			expect(commConnectors.length).toBeGreaterThan(0);
		});

		it("should search connectors", () => {
			const results = library.searchConnectors("http");
			expect(results.length).toBeGreaterThan(0);
			expect(results.some((c) => c.id === "http")).toBe(true);

			const slackResults = library.searchConnectors("slack");
			expect(slackResults.some((c) => c.id === "slack")).toBe(true);
		});

		it("should manage favorites", () => {
			let favorites = library.getFavorites();
			expect(favorites).toHaveLength(0);

			library.toggleFavorite("http");
			favorites = library.getFavorites();
			expect(favorites).toHaveLength(1);
			expect(favorites[0].id).toBe("http");

			library.toggleFavorite("http");
			favorites = library.getFavorites();
			expect(favorites).toHaveLength(0);
		});

		it("should get popular connectors", () => {
			const popular = library.getPopularConnectors(3);
			expect(popular.length).toBeLessThanOrEqual(3);
			expect(popular[0].popularity).toBeGreaterThanOrEqual(
				popular[popular.length - 1]?.popularity || 0,
			);
		});

		it("should install/uninstall connectors", () => {
			expect(library.isInstalled("database")).toBe(false);

			library.installConnector("database");
			expect(library.isInstalled("database")).toBe(true);

			library.uninstallConnector("database");
			expect(library.isInstalled("database")).toBe(false);
		});

		it("should get connector recommendations", () => {
			const recommendations = library.getRecommendations({
				tags: ["api", "integration"],
			});

			expect(recommendations).toHaveLength(5);
			expect(recommendations[0].installed).toBe(true);
		});

		it("should get connector actions", () => {
			const actions = library.getConnectorActions("http");
			expect(actions.length).toBeGreaterThan(0);
			expect(actions.some((a) => a.id === "get")).toBe(true);
			expect(actions.some((a) => a.id === "post")).toBe(true);
		});
	});

	describe("Workflow Test Runner", () => {
		let runner: WorkflowTestRunner;
		let workflow: WorkflowDefinition;

		beforeEach(() => {
			workflow = {
				id: "test_workflow",
				name: "Test Workflow",
				version: 1,
				status: "published",
				steps: [
					{ id: "step1", type: "connector" as const },
					{ id: "step2", type: "transform" as const },
				],
				triggers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			runner = new WorkflowTestRunner(workflow);
		});

		it("should create test runner", () => {
			expect(runner).toBeDefined();
		});

		it("should add test suites", () => {
			const suite = {
				id: "suite1",
				name: "Basic Tests",
				description: "Basic workflow tests",
				testCases: [],
			};

			runner.addTestSuite(suite);
			const suites = runner.getTestSuites();
			expect(suites).toHaveLength(1);
		});

		it("should add test cases to suite", () => {
			const suite = {
				id: "suite1",
				name: "Basic Tests",
				description: "Basic workflow tests",
				testCases: [],
			};

			runner.addTestSuite(suite);

			const testCase = {
				id: "test1",
				name: "Test Case 1",
				description: "First test",
				input: { userId: "123" },
				tags: ["basic"],
			};

			const added = runner.addTestCase("suite1", testCase);
			expect(added).toBe(true);
		});

		it("should run single test", async () => {
			const suite = {
				id: "suite1",
				name: "Basic Tests",
				description: "Basic workflow tests",
				testCases: [
					{
						id: "test1",
						name: "Happy Path",
						description: "Happy path test",
						input: { userId: "123" },
						expectedOutput: { lastStep: "step2" },
						tags: ["happy-path"],
					},
				],
			};

			runner.addTestSuite(suite);
			const result = await runner.runTest("test1");

			expect(result.testName).toBe("Happy Path");
			expect(result.status).toBe("passed");
			expect(result.duration).toBeGreaterThan(0);
		});

		it("should track test statistics", async () => {
			const suite = {
				id: "suite1",
				name: "Basic Tests",
				description: "Basic workflow tests",
				testCases: [
					{
						id: "test1",
						name: "Test 1",
						description: "Test",
						input: {},
						tags: [],
					},
					{
						id: "test2",
						name: "Test 2",
						description: "Test",
						input: {},
						tags: [],
					},
				],
			};

			runner.addTestSuite(suite);
			await runner.runTest("test1");
			await runner.runTest("test2");

			const stats = runner.getStatistics();
			expect(stats.total).toBe(2);
			expect(stats.passed).toBeGreaterThan(0);
			expect(stats.successRate).toBeGreaterThan(0);
		});

		it("should generate test report", async () => {
			const suite = {
				id: "suite1",
				name: "Basic Tests",
				description: "Basic workflow tests",
				testCases: [
					{
						id: "test1",
						name: "Test 1",
						description: "Test",
						input: {},
						tags: [],
					},
				],
			};

			runner.addTestSuite(suite);
			await runner.runTest("test1");

			const report = runner.generateReport();
			expect(report).toContain("Test Report");
			expect(report).toContain("Test 1");
			expect(report).toContain("Summary");
		});

		it("should export test results as JSON", async () => {
			const suite = {
				id: "suite1",
				name: "Basic Tests",
				description: "Basic workflow tests",
				testCases: [
					{
						id: "test1",
						name: "Test 1",
						description: "Test",
						input: {},
						tags: [],
					},
				],
			};

			runner.addTestSuite(suite);
			await runner.runTest("test1");

			const exported = runner.exportResults();
			const data = JSON.parse(exported);

			expect(data.workflow.name).toBe("Test Workflow");
			expect(data.results).toHaveLength(1);
			expect(data.statistics).toBeDefined();
		});

		it("should clear results", async () => {
			const suite = {
				id: "suite1",
				name: "Basic Tests",
				description: "Basic workflow tests",
				testCases: [
					{
						id: "test1",
						name: "Test 1",
						description: "Test",
						input: {},
						tags: [],
					},
				],
			};

			runner.addTestSuite(suite);
			await runner.runTest("test1");

			expect(runner.getResults()).toHaveLength(1);

			runner.clearResults();
			expect(runner.getResults()).toHaveLength(0);
		});
	});

	describe("Test Scenario Builder", () => {
		it("should build happy path test", () => {
			const builder = new TestScenarioBuilder();
			builder
				.addHappyPath("Valid input", { userId: "123" })
				.addHappyPath("Another valid input", { userId: "456" });

			const testCases = builder.build();
			expect(testCases).toHaveLength(2);
			expect(testCases.every((t) => t.tags.includes("happy-path"))).toBe(true);
		});

		it("should build edge case tests", () => {
			const builder = new TestScenarioBuilder();
			builder
				.addEdgeCase("Empty input", {})
				.addEdgeCase("Large input", { data: "x".repeat(10000) });

			const testCases = builder.build();
			expect(testCases).toHaveLength(2);
			expect(testCases.every((t) => t.tags.includes("edge-case"))).toBe(true);
		});

		it("should build error scenario tests", () => {
			const builder = new TestScenarioBuilder();
			builder
				.addErrorScenario("Missing field", { userId: undefined })
				.addErrorScenario("Invalid type", { userId: 123 });

			const testCases = builder.build();
			expect(testCases).toHaveLength(2);
			expect(testCases.every((t) => t.tags.includes("error-scenario"))).toBe(
				true,
			);
		});

		it("should chain multiple test types", () => {
			const builder = new TestScenarioBuilder();
			builder
				.addHappyPath("Valid", { userId: "123" })
				.addEdgeCase("Empty", {})
				.addErrorScenario("Invalid", { userId: null });

			const testCases = builder.build();
			expect(testCases).toHaveLength(3);
		});
	});
});
