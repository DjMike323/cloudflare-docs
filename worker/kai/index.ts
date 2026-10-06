/**
 * KAI Workflow Engine - Main Entry Point
 * Complete workflow automation system with HERMES integration
 */

// Types
export * from "./types";

// Database
export { initializeKaiDatabase, jsonToText, textToJson } from "./db";

// Trigger System
export { TriggerManager } from "./triggers";
export type {
	TriggerPayload,
	WebhookTriggerConfig,
	ScheduleTriggerConfig,
	EventTriggerConfig,
	ManualTriggerConfig,
} from "./triggers";

// Workflow Executor
export { WorkflowExecutor } from "./executor";

// State Manager
export { StateManager } from "./state";
export type { StateSnapshot } from "./state";

// Connectors
export { BaseConnector, type Env } from "./connectors/base";
export { HttpConnector } from "./connectors/http";
export { SlackConnector } from "./connectors/slack";

// HERMES Integration
export { HybridRouter, LearningCoordinator } from "./hermes-integration";
export type { HermesRequest, RoutingResult } from "./hermes-integration";

/**
 * Initialize complete KAI system
 */
export async function initializeKai(env: {
	DB: D1Database;
	KV: KVNamespace;
	R2?: R2Bucket;
}): Promise<{
	triggerManager: any;
	executor: any;
	stateManager: any;
	hybridRouter: any;
	connectors: Map<string, any>;
}> {
	const { DB, KV, R2 } = env;

	// Initialize database schema
	if (!process.env.KAI_DB_INITIALIZED) {
		const { initializeKaiDatabase } = await import("./db");
		await initializeKaiDatabase(DB);
		process.env.KAI_DB_INITIALIZED = "true";
	}

	// Initialize connectors
	const { HttpConnector } = await import("./connectors/http");
	const { SlackConnector } = await import("./connectors/slack");

	const connectors = new Map();
	connectors.set("http", new HttpConnector());
	connectors.set("slack", new SlackConnector());

	// Initialize managers
	const { TriggerManager } = await import("./triggers");
	const { WorkflowExecutor } = await import("./executor");
	const { StateManager } = await import("./state");
	const { HybridRouter } = await import("./hermes-integration");

	const triggerManager = new TriggerManager(DB, KV);
	const executor = new WorkflowExecutor(DB, KV, connectors);
	const stateManager = new StateManager(DB, KV, R2!);
	const hybridRouter = new HybridRouter(DB, KV);

	return {
		triggerManager,
		executor,
		stateManager,
		hybridRouter,
		connectors,
	};
}
