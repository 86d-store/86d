import type { ModuleController } from "@86d-app/core/types/module";

export type AutomationStatus = "active" | "paused" | "draft";

export type ExecutionStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "skipped";

export type ConditionOperator =
	| "equals"
	| "not_equals"
	| "contains"
	| "not_contains"
	| "greater_than"
	| "less_than"
	| "exists"
	| "not_exists";

export type AutomationCondition = {
	field: string;
	operator: ConditionOperator;
	value?: string | number | boolean | undefined;
};

export type ActionType =
	| "send_notification"
	| "send_email"
	| "update_field"
	| "create_record"
	| "webhook"
	| "log";

export type AutomationAction = {
	type: ActionType;
	config: Record<string, unknown>;
};

export type Automation = {
	id: string;
	name: string;
	description?: string | undefined;
	status: AutomationStatus;
	triggerEvent: string;
	conditions: AutomationCondition[];
	actions: AutomationAction[];
	priority: number;
	runCount: number;
	lastRunAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type AutomationExecution = {
	id: string;
	automationId: string;
	triggerEvent: string;
	triggerPayload: Record<string, unknown>;
	status: ExecutionStatus;
	results: AutomationActionResult[];
	error?: string | undefined;
	startedAt: Date;
	completedAt?: Date | undefined;
};

export type AutomationActionResult = {
	actionIndex: number;
	type: ActionType;
	status: "success" | "failed" | "skipped";
	output?: Record<string, unknown> | undefined;
	error?: string | undefined;
};

export type CreateAutomationParams = {
	name: string;
	description?: string | undefined;
	triggerEvent: string;
	conditions?: AutomationCondition[] | undefined;
	actions: AutomationAction[];
	priority?: number | undefined;
	status?: AutomationStatus | undefined;
};

export type UpdateAutomationParams = {
	name?: string | undefined;
	description?: string | undefined;
	triggerEvent?: string | undefined;
	conditions?: AutomationCondition[] | undefined;
	actions?: AutomationAction[] | undefined;
	priority?: number | undefined;
	status?: AutomationStatus | undefined;
};

export type AutomationListParams = {
	status?: AutomationStatus | undefined;
	triggerEvent?: string | undefined;
	take?: number | undefined;
	skip?: number | undefined;
};

export type ExecutionListParams = {
	automationId?: string | undefined;
	status?: ExecutionStatus | undefined;
	take?: number | undefined;
	skip?: number | undefined;
};

export type AutomationStats = {
	totalAutomations: number;
	activeAutomations: number;
	totalExecutions: number;
	executionsByStatus: Record<string, number>;
	topAutomations: Array<{
		id: string;
		name: string;
		runCount: number;
	}>;
};

export type AutomationsController = ModuleController & {
	create(params: CreateAutomationParams): Promise<Automation>;
	getById(id: string): Promise<Automation | null>;
	list(
		params?: AutomationListParams,
	): Promise<{ automations: Automation[]; total: number }>;
	update(id: string, params: UpdateAutomationParams): Promise<Automation>;
	delete(id: string): Promise<void>;
	activate(id: string): Promise<Automation>;
	pause(id: string): Promise<Automation>;
	duplicate(id: string): Promise<Automation>;
	execute(
		id: string,
		triggerPayload: Record<string, unknown>,
	): Promise<AutomationExecution>;
	evaluateEvent(
		eventType: string,
		payload: Record<string, unknown>,
	): Promise<AutomationExecution[]>;
	getExecution(id: string): Promise<AutomationExecution | null>;
	listExecutions(
		params?: ExecutionListParams,
	): Promise<{ executions: AutomationExecution[]; total: number }>;
	getStats(): Promise<AutomationStats>;
	purgeExecutions(olderThan: Date): Promise<number>;
};
