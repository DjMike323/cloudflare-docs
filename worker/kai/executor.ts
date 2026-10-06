/**
 * KAI Workflow Executor
 * Executes workflow steps sequentially or in parallel
 */

import {
	WorkflowExecution,
	WorkflowDefinition,
	WorkflowStep,
	StepExecution,
	ExecutionStatus,
	WorkflowExecutionResult,
} from "./types";
import { jsonToText, textToJson } from "./db";
import { BaseConnector, Env } from "./connectors/base";

export class WorkflowExecutor {
	private db: D1Database;
	private kv: KVNamespace;
	private connectors: Map<string, BaseConnector>;
	private maxConcurrentSteps: number = 10;

	constructor(
		db: D1Database,
		kv: KVNamespace,
		connectors: Map<string, BaseConnector> = new Map(),
	) {
		this.db = db;
		this.kv = kv;
		this.connectors = connectors;
	}

	/**
	 * Execute a workflow
	 */
	async executeWorkflow(
		workflow: WorkflowDefinition,
		execution: WorkflowExecution,
		env: Env,
	): Promise<WorkflowExecutionResult> {
		const startTime = Date.now();

		try {
			// Update execution status to running
			execution.status = "running";
			execution.startTime = startTime;
			await this.updateExecution(execution);

			// Execute workflow steps
			let currentStep = workflow.steps.find((s) => !s.retryPolicy); // Find first step
			let stepsExecuted = 0;
			let stepsFailed = 0;

			while (currentStep && execution.status === "running") {
				try {
					const result = await this.executeStep(
						currentStep,
						execution,
						workflow,
						env,
					);
					stepsExecuted++;

					if (!result) {
						stepsFailed++;
						// Handle step failure
						if (currentStep.errorHandler) {
							const errorStep =
								workflow.errorHandlers?.[currentStep.errorHandler];
							if (errorStep) {
								currentStep = errorStep;
								continue;
							}
						}
						execution.status = "failed";
						execution.error = `Step ${currentStep.id} failed`;
						execution.errorStep = currentStep.id;
						break;
					}

					// Move to next step
					currentStep = currentStep.nextStep
						? workflow.steps.find((s) => s.id === currentStep!.nextStep)
						: undefined;
				} catch (error) {
					stepsFailed++;
					execution.status = "failed";
					execution.error = (error as Error).message;
					execution.errorStep = currentStep.id;
					break;
				}
			}

			// Finalize execution
			execution.status =
				execution.status === "running" ? "success" : execution.status;
			execution.endTime = Date.now();
			await this.updateExecution(execution);

			return {
				executionId: execution.id,
				status: execution.status as ExecutionStatus,
				output: execution.context,
				error: execution.error,
				duration: execution.endTime - startTime,
				stepsExecuted,
				stepsFailed,
			};
		} catch (error) {
			execution.status = "failed";
			execution.error = (error as Error).message;
			execution.endTime = Date.now();
			await this.updateExecution(execution);

			return {
				executionId: execution.id,
				status: "failed",
				output: execution.context,
				error: (error as Error).message,
				duration: execution.endTime - startTime,
				stepsExecuted: 0,
				stepsFailed: 1,
			};
		}
	}

	/**
	 * Execute a single workflow step
	 */
	private async executeStep(
		step: WorkflowStep,
		execution: WorkflowExecution,
		workflow: WorkflowDefinition,
		env: Env,
	): Promise<boolean> {
		const stepExecution: StepExecution = {
			stepId: step.id,
			status: "running",
			input: {},
			startTime: Date.now(),
			retries: 0,
		};

		try {
			// Evaluate conditions
			if (step.condition) {
				const conditionMet = this.evaluateCondition(
					step.condition,
					execution.context,
				);
				if (!conditionMet) {
					stepExecution.status = "skipped";
					stepExecution.endTime = Date.now();
					execution.steps[step.id] = stepExecution;
					return true;
				}
			}

			// Execute step based on type
			let result: any;

			switch (step.type) {
				case "connector":
					result = await this.executeConnectorStep(step, execution, env);
					break;
				case "transform":
					result = await this.executeTransformStep(step, execution);
					break;
				case "condition":
					result = this.evaluateCondition(
						step.condition || "",
						execution.context,
					);
					break;
				case "parallel":
					result = await this.executeParallelSteps(
						step,
						execution,
						workflow,
						env,
					);
					break;
				case "loop":
					result = await this.executeLoopStep(step, execution, workflow, env);
					break;
				default:
					throw new Error(`Unknown step type: ${step.type}`);
			}

			stepExecution.output = result;
			stepExecution.status = "success";
			stepExecution.endTime = Date.now();
			execution.steps[step.id] = stepExecution;
			execution.context[step.id] = result;

			return true;
		} catch (error) {
			const errorMsg = (error as Error).message;

			// Retry logic
			if (
				step.retryPolicy &&
				stepExecution.retries < step.retryPolicy.maxRetries
			) {
				stepExecution.retries++;
				const backoff =
					step.retryPolicy.backoffMs * Math.pow(2, stepExecution.retries - 1);
				await new Promise((resolve) => setTimeout(resolve, backoff));
				return this.executeStep(step, execution, workflow, env);
			}

			stepExecution.error = errorMsg;
			stepExecution.status = "failed";
			stepExecution.endTime = Date.now();
			execution.steps[step.id] = stepExecution;

			throw error;
		}
	}

	/**
	 * Execute a connector step
	 */
	private async executeConnectorStep(
		step: WorkflowStep,
		execution: WorkflowExecution,
		env: Env,
	): Promise<any> {
		if (!step.connector) {
			throw new Error("Connector step missing connector configuration");
		}

		const connector = this.connectors.get(step.connector.type);
		if (!connector) {
			throw new Error(`Connector not found: ${step.connector.type}`);
		}

		// Interpolate parameters
		const params = this.interpolateParams(
			step.connector.params,
			execution.context,
		);

		// Apply timeout if configured
		if (step.timeoutMs) {
			return await connector.withTimeout(
				connector.execute(step.connector.action, params, env),
				step.timeoutMs,
			);
		}

		return await connector.execute(step.connector.action, params, env);
	}

	/**
	 * Execute a transform (JavaScript) step
	 */
	private async executeTransformStep(
		step: WorkflowStep,
		execution: ExecutionContext,
	): Promise<any> {
		if (!step.transform) {
			throw new Error("Transform step missing code");
		}

		// Create isolated execution context
		const ctx = {
			input: execution.context,
			prev: execution.steps,
			_: require("lodash"), // Optional utility library
		};

		try {
			// Execute transformation code
			const fn = new Function("context", step.transform.code);
			return await fn(ctx);
		} catch (error) {
			throw new Error(
				`Transform execution failed: ${(error as Error).message}`,
			);
		}
	}

	/**
	 * Execute parallel steps
	 */
	private async executeParallelSteps(
		step: WorkflowStep,
		execution: WorkflowExecution,
		workflow: WorkflowDefinition,
		env: Env,
	): Promise<Record<string, any>> {
		if (!step.parallel || step.parallel.length === 0) {
			return {};
		}

		const results: Record<string, any> = {};
		const promises: Promise<void>[] = [];

		// Limit concurrency
		for (let i = 0; i < step.parallel.length; i += this.maxConcurrentSteps) {
			const batch = step.parallel.slice(i, i + this.maxConcurrentSteps);

			for (const stepId of batch) {
				const parallelStep = workflow.steps.find((s) => s.id === stepId);
				if (!parallelStep) continue;

				promises.push(
					(async () => {
						try {
							const success = await this.executeStep(
								parallelStep,
								execution,
								workflow,
								env,
							);
							if (success) {
								results[stepId] = execution.context[stepId];
							}
						} catch (error) {
							results[stepId] = { error: (error as Error).message };
						}
					})(),
				);
			}

			await Promise.all(promises);
			promises.length = 0;
		}

		return results;
	}

	/**
	 * Execute a loop step
	 */
	private async executeLoopStep(
		step: WorkflowStep,
		execution: WorkflowExecution,
		workflow: WorkflowDefinition,
		env: Env,
	): Promise<any[]> {
		// Placeholder for loop implementation
		// Would iterate over array, executing step for each item
		return [];
	}

	/**
	 * Evaluate a condition expression
	 */
	private evaluateCondition(
		condition: string,
		context: Record<string, any>,
	): boolean {
		try {
			const fn = new Function("context", `return ${condition}`);
			return fn(context);
		} catch {
			return false;
		}
	}

	/**
	 * Interpolate template variables in parameters
	 */
	private interpolateParams(
		params: Record<string, any>,
		context: Record<string, any>,
	): Record<string, any> {
		const interpolated: Record<string, any> = {};

		for (const [key, value] of Object.entries(params)) {
			if (
				typeof value === "string" &&
				value.startsWith("{{") &&
				value.endsWith("}}")
			) {
				const varName = value.slice(2, -2);
				interpolated[key] = context[varName];
			} else if (typeof value === "object") {
				interpolated[key] = this.interpolateParams(value, context);
			} else {
				interpolated[key] = value;
			}
		}

		return interpolated;
	}

	/**
	 * Update execution in database and cache
	 */
	private async updateExecution(execution: WorkflowExecution): Promise<void> {
		await this.db
			.prepare(
				`UPDATE workflow_executions
         SET status = ?, context_json = ?, error_message = ?
         WHERE id = ?`,
			)
			.bind(
				execution.status,
				jsonToText(execution),
				execution.error,
				execution.id,
			)
			.run();

		await this.kv.put(`execution:${execution.id}`, JSON.stringify(execution), {
			expirationTtl: 86400,
		});
	}

	/**
	 * Pause workflow execution
	 */
	async pauseExecution(executionId: string): Promise<void> {
		const execution = await this.getExecution(executionId);
		if (execution) {
			execution.status = "paused";
			await this.updateExecution(execution);
		}
	}

	/**
	 * Resume paused execution
	 */
	async resumeExecution(
		executionId: string,
		workflow: WorkflowDefinition,
		env: Env,
	): Promise<WorkflowExecutionResult> {
		const execution = await this.getExecution(executionId);
		if (!execution) {
			throw new Error("Execution not found");
		}

		return this.executeWorkflow(workflow, execution, env);
	}

	/**
	 * Get execution from cache or database
	 */
	private async getExecution(
		executionId: string,
	): Promise<WorkflowExecution | null> {
		// Try KV cache first
		const cached = await this.kv.get(`execution:${executionId}`);
		if (cached) {
			return JSON.parse(cached);
		}

		// Fall back to database
		const result = await this.db
			.prepare(`SELECT context_json FROM workflow_executions WHERE id = ?`)
			.bind(executionId)
			.first();

		return result ? textToJson(result.context_json) : null;
	}
}

interface ExecutionContext {
	context: Record<string, any>;
	steps: Record<string, StepExecution>;
}
