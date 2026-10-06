/**
 * KAI Workflow Engine - Core Type Definitions
 * Fully typed TypeScript interfaces for workflow execution
 */

export interface WorkflowStep {
	id: string;
	type: "connector" | "transform" | "condition" | "loop" | "parallel";
	connector?: {
		type: string; // "http", "database", "slack", etc.
		action: string;
		params: Record<string, any>;
	};
	transform?: {
		language: "javascript" | "jsonata";
		code: string;
	};
	condition?: string; // JavaScript expression
	retryPolicy?: {
		maxRetries: number;
		backoffMs: number;
	};
	timeoutMs?: number;
	nextStep?: string;
	errorHandler?: string;
	parallel?: string[]; // For parallel step groups
}

export interface WorkflowDefinition {
	id: string;
	name: string;
	description?: string;
	version: number;
	status: "draft" | "published" | "archived";
	steps: WorkflowStep[];
	triggers: TriggerConfig[];
	errorHandlers?: Record<string, WorkflowStep>;
	variables?: Record<string, VariableDefinition>;
	createdAt: Date;
	updatedAt: Date;
	publishedAt?: Date;
}

export interface TriggerConfig {
	id: string;
	type: "webhook" | "schedule" | "event" | "manual";
	config: Record<string, any>;
	enabled: boolean;
	conditions?: string[];
}

export interface VariableDefinition {
	name: string;
	type: "string" | "number" | "boolean" | "object" | "array";
	default?: any;
	required?: boolean;
}

export interface WorkflowExecution {
	id: string;
	workflowId: string;
	triggerId?: string;
	status: "pending" | "running" | "success" | "failed" | "paused";
	startTime: number;
	endTime?: number;
	steps: Record<string, StepExecution>;
	context: Record<string, any>;
	error?: string;
	errorStep?: string;
	retryCount?: number;
	correlationId?: string;
}

export interface StepExecution {
	stepId: string;
	status: "pending" | "running" | "success" | "failed" | "skipped";
	input: Record<string, any>;
	output?: Record<string, any>;
	error?: string;
	startTime: number;
	endTime?: number;
	retries: number;
}

export interface ConnectorAction {
	id: string;
	name: string;
	description?: string;
	inputSchema?: Record<string, any>;
	outputSchema?: Record<string, any>;
}

export interface ConnectorConfig {
	id: string;
	name: string;
	type: "http" | "database" | "messaging" | "storage" | "service";
	auth?: "apikey" | "oauth" | "basic" | "none";
	baseUrl?: string;
	timeout?: number;
	config?: Record<string, any>;
}

export interface HermesRoutingDecision {
	agent: "hermes" | "kai" | "hybrid";
	confidence: number;
	reasoning?: string;
	task?: string;
	timestamp: number;
}

export interface CrossSystemLearning {
	correlationId: string;
	hermesCorrelationId?: string;
	workflowId: string;
	executionId: string;
	success: boolean;
	duration: number;
	result?: any;
	patterns?: string[];
	recommendedUpdate?: {
		type: string;
		description: string;
	};
}

export interface ExecutionContext {
	workflowId: string;
	executionId: string;
	triggerId?: string;
	input: Record<string, any>;
	variables: Record<string, any>;
	correlationId: string;
	startTime: number;
	stepResults: Record<string, any>;
}

export enum ExecutionStatus {
	PENDING = "pending",
	RUNNING = "running",
	SUCCESS = "success",
	FAILED = "failed",
	PAUSED = "paused",
}

export interface WorkflowExecutionResult {
	executionId: string;
	status: ExecutionStatus;
	output: Record<string, any>;
	error?: string;
	duration: number;
	stepsExecuted: number;
	stepsFailed: number;
}
