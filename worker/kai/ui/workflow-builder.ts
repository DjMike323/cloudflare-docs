/**
 * KAI Workflow Designer UI - Visual Workflow Builder
 * Drag-drop interface for creating and editing workflows
 */

import { WorkflowDefinition, WorkflowStep, ConnectorAction } from "../types";

export interface WorkflowBuilderState {
	workflowId: string;
	name: string;
	description: string;
	steps: WorkflowStep[];
	triggers: any[];
	errorHandlers: Record<string, WorkflowStep>;
	canvasScale: number;
	selectedStep: string | null;
	isDirty: boolean;
	version: number;
}

export interface StepNode {
	id: string;
	type: "connector" | "transform" | "condition" | "loop" | "parallel";
	position: { x: number; y: number };
	data: WorkflowStep;
	connections: {
		next?: string;
		errorHandler?: string;
	};
}

export interface CanvasConnection {
	from: string;
	to: string;
	type: "success" | "error" | "condition";
	label?: string;
}

/**
 * Workflow Builder Engine
 * Manages visual workflow construction and state
 */
export class WorkflowBuilder {
	private state: WorkflowBuilderState;
	private stepNodes: Map<string, StepNode> = new Map();
	private connections: CanvasConnection[] = [];
	private connectorLibrary: Map<string, ConnectorAction[]> = new Map();

	constructor(workflowId: string = `workflow_${Date.now()}`) {
		this.state = {
			workflowId,
			name: "New Workflow",
			description: "",
			steps: [],
			triggers: [],
			errorHandlers: {},
			canvasScale: 1,
			selectedStep: null,
			isDirty: false,
			version: 1,
		};
	}

	/**
	 * Add a step to the workflow canvas
	 */
	addStep(
		type: WorkflowStep["type"],
		position: { x: number; y: number },
		config?: Partial<WorkflowStep>,
	): string {
		const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const step: WorkflowStep = {
			id: stepId,
			type,
			...config,
		} as WorkflowStep;

		const node: StepNode = {
			id: stepId,
			type,
			position,
			data: step,
			connections: {},
		};

		this.stepNodes.set(stepId, node);
		this.state.steps.push(step);
		this.state.isDirty = true;

		return stepId;
	}

	/**
	 * Remove a step from the workflow
	 */
	removeStep(stepId: string): boolean {
		if (!this.stepNodes.has(stepId)) {
			return false;
		}

		this.stepNodes.delete(stepId);
		this.state.steps = this.state.steps.filter((s) => s.id !== stepId);

		// Remove all connections involving this step
		this.connections = this.connections.filter(
			(c) => c.from !== stepId && c.to !== stepId,
		);

		this.state.isDirty = true;
		return true;
	}

	/**
	 * Update a step's configuration
	 */
	updateStep(stepId: string, updates: Partial<WorkflowStep>): boolean {
		const node = this.stepNodes.get(stepId);
		if (!node) {
			return false;
		}

		Object.assign(node.data, updates);

		const stepIndex = this.state.steps.findIndex((s) => s.id === stepId);
		if (stepIndex !== -1) {
			this.state.steps[stepIndex] = node.data;
		}

		this.state.isDirty = true;
		return true;
	}

	/**
	 * Connect two steps
	 */
	connectSteps(
		fromId: string,
		toId: string,
		type: "success" | "error" | "condition" = "success",
	): boolean {
		if (!this.stepNodes.has(fromId) || !this.stepNodes.has(toId)) {
			return false;
		}

		const connection: CanvasConnection = {
			from: fromId,
			to: toId,
			type,
		};

		this.connections.push(connection);

		const fromNode = this.stepNodes.get(fromId)!;
		if (type === "success") {
			fromNode.connections.next = toId;
		} else if (type === "error") {
			fromNode.connections.errorHandler = toId;
		}

		this.state.isDirty = true;
		return true;
	}

	/**
	 * Disconnect two steps
	 */
	disconnectSteps(fromId: string, toId: string): boolean {
		this.connections = this.connections.filter(
			(c) => !(c.from === fromId && c.to === toId),
		);

		const fromNode = this.stepNodes.get(fromId);
		if (fromNode) {
			if (fromNode.connections.next === toId) {
				delete fromNode.connections.next;
			} else if (fromNode.connections.errorHandler === toId) {
				delete fromNode.connections.errorHandler;
			}
		}

		this.state.isDirty = true;
		return true;
	}

	/**
	 * Move a step on the canvas
	 */
	moveStep(stepId: string, x: number, y: number): boolean {
		const node = this.stepNodes.get(stepId);
		if (!node) {
			return false;
		}

		node.position = { x, y };
		this.state.isDirty = true;
		return true;
	}

	/**
	 * Set canvas zoom level
	 */
	setZoom(scale: number): void {
		this.state.canvasScale = Math.max(0.1, Math.min(3, scale));
	}

	/**
	 * Select a step (highlight on canvas)
	 */
	selectStep(stepId: string | null): void {
		this.state.selectedStep = stepId;
	}

	/**
	 * Get all steps
	 */
	getSteps(): WorkflowStep[] {
		return this.state.steps;
	}

	/**
	 * Get all connections
	 */
	getConnections(): CanvasConnection[] {
		return this.connections;
	}

	/**
	 * Get step node for visual rendering
	 */
	getStepNode(stepId: string): StepNode | undefined {
		return this.stepNodes.get(stepId);
	}

	/**
	 * Get all step nodes
	 */
	getAllStepNodes(): StepNode[] {
		return Array.from(this.stepNodes.values());
	}

	/**
	 * Register connector types with actions
	 */
	registerConnector(connectorType: string, actions: ConnectorAction[]): void {
		this.connectorLibrary.set(connectorType, actions);
	}

	/**
	 * Get available connectors
	 */
	getAvailableConnectors(): string[] {
		return Array.from(this.connectorLibrary.keys());
	}

	/**
	 * Get actions for a connector
	 */
	getConnectorActions(connectorType: string): ConnectorAction[] {
		return this.connectorLibrary.get(connectorType) || [];
	}

	/**
	 * Validate workflow structure
	 */
	validate(): {
		valid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (!this.state.name || this.state.name.trim() === "") {
			errors.push("Workflow name is required");
		}

		if (this.state.steps.length === 0) {
			errors.push("Workflow must have at least one step");
		}

		// Check for orphaned steps
		const connectedSteps = new Set<string>();
		this.connections.forEach((c) => {
			connectedSteps.add(c.from);
			connectedSteps.add(c.to);
		});

		for (const step of this.state.steps) {
			if (!connectedSteps.has(step.id) && this.state.steps.length > 1) {
				errors.push(`Step ${step.id} is not connected to the workflow`);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Export to workflow definition
	 */
	exportWorkflow(): WorkflowDefinition {
		// Build step execution order from connections
		const orderedSteps = this.buildExecutionOrder();

		return {
			id: this.state.workflowId,
			name: this.state.name,
			description: this.state.description,
			version: this.state.version,
			status: "draft",
			steps: orderedSteps,
			triggers: this.state.triggers,
			errorHandlers: this.state.errorHandlers,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
	}

	/**
	 * Build execution order from visual connections
	 */
	private buildExecutionOrder(): WorkflowStep[] {
		const ordered: WorkflowStep[] = [];
		const visited = new Set<string>();

		// Start with steps that have no incoming connections
		const incoming = new Map<string, number>();
		for (const step of this.state.steps) {
			incoming.set(step.id, 0);
		}

		for (const conn of this.connections) {
			incoming.set(conn.to, (incoming.get(conn.to) || 0) + 1);
		}

		// Topological sort
		const queue: string[] = [];
		for (const [stepId, count] of incoming.entries()) {
			if (count === 0) {
				queue.push(stepId);
			}
		}

		while (queue.length > 0) {
			const stepId = queue.shift()!;
			const step = this.state.steps.find((s) => s.id === stepId);

			if (step) {
				ordered.push(step);
				visited.add(stepId);
			}

			// Find steps connected to this one
			for (const conn of this.connections) {
				if (conn.from === stepId && !visited.has(conn.to)) {
					const outgoing = this.connections.filter(
						(c) => c.to === conn.to && !visited.has(c.from),
					).length;

					if (outgoing === 0) {
						queue.push(conn.to);
					}
				}
			}
		}

		return ordered.length > 0 ? ordered : this.state.steps;
	}

	/**
	 * Load from workflow definition
	 */
	loadWorkflow(workflow: WorkflowDefinition): void {
		this.state.workflowId = workflow.id;
		this.state.name = workflow.name;
		this.state.description = workflow.description || "";
		this.state.version = workflow.version;
		this.state.steps = [...workflow.steps];
		this.state.triggers = workflow.triggers || [];
		this.state.errorHandlers = workflow.errorHandlers || {};

		// Reconstruct nodes with default positions
		let x = 100;
		for (const step of this.state.steps) {
			this.stepNodes.set(step.id, {
				id: step.id,
				type: step.type,
				position: { x, y: 100 },
				data: step,
				connections: {
					next: (step as any).nextStep,
					errorHandler: (step as any).errorHandler,
				},
			});
			x += 300;
		}

		this.state.isDirty = false;
	}

	/**
	 * Get builder state
	 */
	getState(): WorkflowBuilderState {
		return { ...this.state };
	}

	/**
	 * Set builder state
	 */
	setState(state: Partial<WorkflowBuilderState>): void {
		Object.assign(this.state, state);
		this.state.isDirty = true;
	}
}

/**
 * Drag-drop helper for canvas interactions
 */
export class DragDropManager {
	private isDragging = false;
	private draggedStepId: string | null = null;
	private dragStartPos = { x: 0, y: 0 };
	private dragCallback:
		| ((stepId: string, x: number, y: number) => void)
		| null = null;

	startDrag(stepId: string, startX: number, startY: number): void {
		this.isDragging = true;
		this.draggedStepId = stepId;
		this.dragStartPos = { x: startX, y: startY };
	}

	drag(currentX: number, currentY: number): void {
		if (!this.isDragging || !this.draggedStepId) {
			return;
		}

		const deltaX = currentX - this.dragStartPos.x;
		const deltaY = currentY - this.dragStartPos.y;

		if (this.dragCallback) {
			this.dragCallback(this.draggedStepId, deltaX, deltaY);
		}
	}

	endDrag(): void {
		this.isDragging = false;
		this.draggedStepId = null;
	}

	setDragCallback(
		callback: (stepId: string, x: number, y: number) => void,
	): void {
		this.dragCallback = callback;
	}

	isDraggingStep(stepId: string): boolean {
		return this.isDragging && this.draggedStepId === stepId;
	}
}
