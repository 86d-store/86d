import type { ModuleController } from "@86d-app/core/types/module";

export type DiscountType = "percentage" | "fixed_amount" | "free_shipping";
export type DiscountAppliesTo =
	| "all"
	| "specific_products"
	| "specific_categories";

export type Discount = {
	id: string;
	name: string;
	description?: string | undefined;
	type: DiscountType;
	/** Percentage 0-100, or fixed amount in cents, or 0 for free_shipping */
	value: number;
	minimumAmount?: number | undefined;
	maximumUses?: number | undefined;
	usedCount: number;
	isActive: boolean;
	startsAt?: Date | undefined;
	endsAt?: Date | undefined;
	appliesTo: DiscountAppliesTo;
	appliesToIds: string[];
	stackable: boolean;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type DiscountCode = {
	id: string;
	discountId: string;
	code: string;
	usedCount: number;
	maximumUses?: number | undefined;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type ApplyResult = {
	valid: boolean;
	discountAmount: number;
	/** Free shipping granted */
	freeShipping: boolean;
	discount?: Discount | undefined;
	code?: DiscountCode | undefined;
	error?: string | undefined;
};

export type DiscountController = ModuleController & {
	/** Create a new discount rule */
	create(params: {
		id?: string | undefined;
		name: string;
		description?: string | undefined;
		type: DiscountType;
		value: number;
		minimumAmount?: number | undefined;
		maximumUses?: number | undefined;
		isActive?: boolean | undefined;
		startsAt?: Date | undefined;
		endsAt?: Date | undefined;
		appliesTo?: DiscountAppliesTo | undefined;
		appliesToIds?: string[] | undefined;
		stackable?: boolean | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<Discount>;

	/** Get discount by ID */
	getById(id: string): Promise<Discount | null>;

	/** Update a discount */
	update(
		id: string,
		params: {
			name?: string | undefined;
			description?: string | undefined;
			type?: DiscountType | undefined;
			value?: number | undefined;
			minimumAmount?: number | null | undefined;
			maximumUses?: number | null | undefined;
			isActive?: boolean | undefined;
			startsAt?: Date | null | undefined;
			endsAt?: Date | null | undefined;
			appliesTo?: DiscountAppliesTo | undefined;
			appliesToIds?: string[] | undefined;
			stackable?: boolean | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<Discount | null>;

	/** Delete a discount and all its codes */
	delete(id: string): Promise<void>;

	/** List discounts */
	list(params: {
		limit?: number | undefined;
		offset?: number | undefined;
		isActive?: boolean | undefined;
	}): Promise<{ discounts: Discount[]; total: number }>;

	/** Add a promo code to a discount */
	createCode(params: {
		discountId: string;
		code: string;
		maximumUses?: number | undefined;
		isActive?: boolean | undefined;
	}): Promise<DiscountCode>;

	/** Get code by its string value */
	getCodeByValue(code: string): Promise<DiscountCode | null>;

	/** Get all codes for a discount */
	listCodes(discountId: string): Promise<DiscountCode[]>;

	/** Delete a promo code */
	deleteCode(id: string): Promise<void>;

	/**
	 * Validate and calculate the discount amount for a promo code.
	 * Does NOT increment usage counters.
	 */
	validateCode(params: {
		code: string;
		/** Cart subtotal in cents */
		subtotal: number;
		productIds?: string[] | undefined;
		categoryIds?: string[] | undefined;
	}): Promise<ApplyResult>;

	/**
	 * Apply a discount code — validates and increments usage counters.
	 * Call this only when the order is confirmed.
	 */
	applyCode(params: {
		code: string;
		subtotal: number;
		productIds?: string[] | undefined;
		categoryIds?: string[] | undefined;
	}): Promise<ApplyResult>;

	/** Update a promo code (toggle active, change max uses) */
	updateCode(
		id: string,
		params: {
			isActive?: boolean | undefined;
			maximumUses?: number | null | undefined;
		},
	): Promise<DiscountCode | null>;

	/** Generate multiple unique promo codes in bulk */
	generateBulkCodes(params: {
		discountId: string;
		count: number;
		prefix?: string | undefined;
		maximumUses?: number | undefined;
	}): Promise<BulkCodeResult>;

	/** Get usage statistics for codes under a discount */
	getCodeStats(discountId: string): Promise<CodeStats>;

	/** Get analytics overview for all discounts */
	getAnalytics(): Promise<DiscountAnalytics>;

	// --- Cart Price Rules ---

	/** Create a cart price rule (auto-apply discount) */
	createPriceRule(params: {
		id?: string | undefined;
		name: string;
		description?: string | undefined;
		type: DiscountType;
		value: number;
		conditions?: CartPriceRuleCondition[] | undefined;
		appliesTo?: DiscountAppliesTo | undefined;
		appliesToIds?: string[] | undefined;
		priority?: number | undefined;
		stackable?: boolean | undefined;
		maximumUses?: number | undefined;
		isActive?: boolean | undefined;
		startsAt?: Date | undefined;
		endsAt?: Date | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<CartPriceRule>;

	/** Get a price rule by ID */
	getPriceRule(id: string): Promise<CartPriceRule | null>;

	/** Update a price rule */
	updatePriceRule(
		id: string,
		params: {
			name?: string | undefined;
			description?: string | undefined;
			type?: DiscountType | undefined;
			value?: number | undefined;
			conditions?: CartPriceRuleCondition[] | undefined;
			appliesTo?: DiscountAppliesTo | undefined;
			appliesToIds?: string[] | undefined;
			priority?: number | undefined;
			stackable?: boolean | undefined;
			maximumUses?: number | null | undefined;
			isActive?: boolean | undefined;
			startsAt?: Date | null | undefined;
			endsAt?: Date | null | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<CartPriceRule | null>;

	/** Delete a price rule */
	deletePriceRule(id: string): Promise<void>;

	/** List price rules */
	listPriceRules(params: {
		limit?: number | undefined;
		offset?: number | undefined;
		isActive?: boolean | undefined;
	}): Promise<{ rules: CartPriceRule[]; total: number }>;

	/** Evaluate all active price rules against cart context */
	evaluateCartRules(params: {
		subtotal: number;
		itemCount: number;
		productIds?: string[] | undefined;
		categoryIds?: string[] | undefined;
	}): Promise<CartAutoDiscountResult>;

	/** Increment usage counters for applied price rules (call at order confirmation) */
	applyPriceRules(ruleIds: string[]): Promise<void>;
};

export type BulkCodeResult = {
	generated: number;
	codes: DiscountCode[];
};

export type CodeStats = {
	total: number;
	active: number;
	inactive: number;
	totalRedemptions: number;
	fullyUsed: number;
	unused: number;
	redemptionRate: number;
};

export type DiscountAnalytics = {
	totalDiscounts: number;
	activeCount: number;
	expiredCount: number;
	scheduledCount: number;
	totalUsage: number;
	totalCodes: number;
	typeDistribution: Record<string, number>;
	topByUsage: DiscountSummary[];
};

export type DiscountSummary = {
	id: string;
	name: string;
	type: DiscountType;
	value: number;
	usedCount: number;
	maximumUses?: number | undefined;
	isActive: boolean;
	codesCount: number;
};

// --- Cart Price Rules (auto-apply discounts) ---

export type CartPriceRuleConditionType =
	| "minimum_subtotal"
	| "minimum_item_count"
	| "contains_product"
	| "contains_category";

export type CartPriceRuleCondition = {
	type: CartPriceRuleConditionType;
	/** For minimum_subtotal: amount in cents. For minimum_item_count: count. For contains_*: ID */
	value: string | number;
};

export type CartPriceRule = {
	id: string;
	name: string;
	description?: string | undefined;
	type: DiscountType;
	/** Percentage 0-100, or fixed amount in cents, or 0 for free_shipping */
	value: number;
	/** All conditions must be met (AND logic) */
	conditions: CartPriceRuleCondition[];
	appliesTo: DiscountAppliesTo;
	appliesToIds: string[];
	/** Lower = higher priority */
	priority: number;
	stackable: boolean;
	maximumUses?: number | undefined;
	usedCount: number;
	isActive: boolean;
	startsAt?: Date | undefined;
	endsAt?: Date | undefined;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type CartPriceRuleApplyResult = {
	ruleId: string;
	ruleName: string;
	type: DiscountType;
	discountAmount: number;
	freeShipping: boolean;
};

export type CartAutoDiscountResult = {
	rules: CartPriceRuleApplyResult[];
	totalDiscount: number;
	freeShipping: boolean;
};
