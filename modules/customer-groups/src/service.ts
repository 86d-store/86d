import type { ModuleController } from "@86d-app/core/types/module";

export type GroupType = "manual" | "automatic";

export type RuleOperator =
	| "equals"
	| "not_equals"
	| "contains"
	| "not_contains"
	| "greater_than"
	| "less_than"
	| "in"
	| "not_in";

export type AdjustmentType = "percentage" | "fixed";

export type AdjustmentScope = "all" | "category" | "product";

export type CustomerGroup = {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	type: GroupType;
	isActive: boolean;
	priority: number;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type GroupMembership = {
	id: string;
	groupId: string;
	customerId: string;
	joinedAt: Date;
	expiresAt?: Date | undefined;
	metadata?: Record<string, unknown> | undefined;
};

export type GroupRule = {
	id: string;
	groupId: string;
	field: string;
	operator: RuleOperator;
	value: string;
	createdAt: Date;
};

export type GroupPriceAdjustment = {
	id: string;
	groupId: string;
	adjustmentType: AdjustmentType;
	value: number;
	scope: AdjustmentScope;
	scopeId?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type CustomerGroupController = ModuleController & {
	/** Create a new customer group */
	createGroup(params: {
		name: string;
		slug: string;
		description?: string | undefined;
		type?: GroupType | undefined;
		priority?: number | undefined;
	}): Promise<CustomerGroup>;

	/** Get a group by ID */
	getGroup(id: string): Promise<CustomerGroup | null>;

	/** Get a group by slug */
	getGroupBySlug(slug: string): Promise<CustomerGroup | null>;

	/** List all groups */
	listGroups(opts?: {
		type?: GroupType | undefined;
		activeOnly?: boolean | undefined;
	}): Promise<CustomerGroup[]>;

	/** Update a group */
	updateGroup(
		id: string,
		data: {
			name?: string | undefined;
			slug?: string | undefined;
			description?: string | undefined;
			type?: GroupType | undefined;
			isActive?: boolean | undefined;
			priority?: number | undefined;
		},
	): Promise<CustomerGroup>;

	/** Delete a group and all associated memberships, rules, and pricing */
	deleteGroup(id: string): Promise<void>;

	/** Add a customer to a group */
	addMember(params: {
		groupId: string;
		customerId: string;
		expiresAt?: Date | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<GroupMembership>;

	/** Remove a customer from a group */
	removeMember(groupId: string, customerId: string): Promise<void>;

	/** List members of a group */
	listMembers(
		groupId: string,
		opts?: {
			includeExpired?: boolean | undefined;
		},
	): Promise<GroupMembership[]>;

	/** Get all groups a customer belongs to */
	getCustomerGroups(
		customerId: string,
		opts?: {
			activeOnly?: boolean | undefined;
		},
	): Promise<CustomerGroup[]>;

	/** Check if a customer belongs to a specific group */
	isMember(groupId: string, customerId: string): Promise<boolean>;

	/** Add multiple customers to a group at once. Returns count added. */
	bulkAddMembers(
		groupId: string,
		customerIds: string[],
		opts?: { expiresAt?: Date | undefined },
	): Promise<number>;

	/** Remove multiple customers from a group at once. Returns count removed. */
	bulkRemoveMembers(groupId: string, customerIds: string[]): Promise<number>;

	/** Add a segmentation rule to an automatic group */
	addRule(params: {
		groupId: string;
		field: string;
		operator: RuleOperator;
		value: string;
	}): Promise<GroupRule>;

	/** Remove a rule */
	removeRule(ruleId: string): Promise<void>;

	/** List rules for a group */
	listRules(groupId: string): Promise<GroupRule[]>;

	/** Evaluate rules against a customer data object, returns matching group IDs */
	evaluateRules(customerData: Record<string, unknown>): Promise<string[]>;

	/** Set a price adjustment for a group */
	setPriceAdjustment(params: {
		groupId: string;
		adjustmentType: AdjustmentType;
		value: number;
		scope?: AdjustmentScope | undefined;
		scopeId?: string | undefined;
	}): Promise<GroupPriceAdjustment>;

	/** Remove a price adjustment */
	removePriceAdjustment(id: string): Promise<void>;

	/** List price adjustments for a group */
	listPriceAdjustments(groupId: string): Promise<GroupPriceAdjustment[]>;

	/** Get effective price adjustments for a customer (across all their groups) */
	getCustomerPricing(
		customerId: string,
		opts?: {
			scope?: AdjustmentScope | undefined;
			scopeId?: string | undefined;
		},
	): Promise<GroupPriceAdjustment[]>;

	/** Get statistics about customer groups */
	getStats(): Promise<{
		totalGroups: number;
		activeGroups: number;
		manualGroups: number;
		automaticGroups: number;
		totalMemberships: number;
		totalRules: number;
		totalPriceAdjustments: number;
	}>;
};
