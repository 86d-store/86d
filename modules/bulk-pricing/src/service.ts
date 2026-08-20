import type { ModuleController } from "@86d-app/core/types/module";

// ── Entities ───────────────────────────────────────────────────────

export type PricingScope = "product" | "variant" | "collection" | "global";
export type DiscountType = "percentage" | "fixed_amount" | "fixed_price";

export type PricingRule = {
	id: string;
	name: string;
	description?: string;
	scope: PricingScope;
	targetId?: string;
	priority: number;
	active: boolean;
	startsAt?: Date;
	endsAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type PricingTier = {
	id: string;
	ruleId: string;
	minQuantity: number;
	maxQuantity?: number;
	discountType: DiscountType;
	discountValue: number;
	label?: string;
	createdAt: Date;
	updatedAt: Date;
};

// ── Input params ───────────────────────────────────────────────────

export type CreateRuleParams = {
	name: string;
	description?: string;
	scope: PricingScope;
	targetId?: string;
	priority?: number;
	active?: boolean;
	startsAt?: Date;
	endsAt?: Date;
};

export type UpdateRuleParams = {
	name?: string;
	description?: string | null;
	scope?: PricingScope;
	targetId?: string | null;
	priority?: number;
	active?: boolean;
	startsAt?: Date | null;
	endsAt?: Date | null;
};

export type ListRulesParams = {
	scope?: PricingScope;
	targetId?: string;
	active?: boolean;
	take?: number;
	skip?: number;
};

export type CreateTierParams = {
	ruleId: string;
	minQuantity: number;
	maxQuantity?: number;
	discountType: DiscountType;
	discountValue: number;
	label?: string;
};

export type UpdateTierParams = {
	minQuantity?: number;
	maxQuantity?: number | null;
	discountType?: DiscountType;
	discountValue?: number;
	label?: string | null;
};

export type ListTiersParams = {
	ruleId: string;
	take?: number;
	skip?: number;
};

export type ResolvePriceParams = {
	productId: string;
	variantId?: string;
	collectionIds?: string[];
	quantity: number;
	basePrice: number;
};

// ── Results ────────────────────────────────────────────────────────

export type ResolvedBulkPrice = {
	/** Original price per unit */
	basePrice: number;
	/** Price per unit after bulk discount */
	unitPrice: number;
	/** Total discount amount per unit */
	discountPerUnit: number;
	/** Total price for the full quantity */
	totalPrice: number;
	/** The tier that was matched */
	matchedTier: PricingTier | null;
	/** The rule that was matched */
	matchedRule: PricingRule | null;
	/** Whether a bulk discount was applied */
	hasDiscount: boolean;
};

export type TierPreview = {
	tier: PricingTier;
	/** Example unit price at minQuantity given a base price */
	unitPrice: number;
	/** Savings percentage compared to base price */
	savingsPercent: number;
};

export type BulkPricingSummary = {
	totalRules: number;
	activeRules: number;
	totalTiers: number;
	rulesByScope: Record<PricingScope, number>;
};

// ── Controller ─────────────────────────────────────────────────────

export type BulkPricingController = ModuleController & {
	// Rule CRUD
	createRule(params: CreateRuleParams): Promise<PricingRule>;
	updateRule(id: string, params: UpdateRuleParams): Promise<PricingRule | null>;
	getRule(id: string): Promise<PricingRule | null>;
	listRules(params?: ListRulesParams): Promise<PricingRule[]>;
	deleteRule(id: string): Promise<boolean>;

	// Tier CRUD
	createTier(params: CreateTierParams): Promise<PricingTier>;
	updateTier(id: string, params: UpdateTierParams): Promise<PricingTier | null>;
	getTier(id: string): Promise<PricingTier | null>;
	listTiers(params: ListTiersParams): Promise<PricingTier[]>;
	deleteTier(id: string): Promise<boolean>;

	// Price resolution
	resolvePrice(params: ResolvePriceParams): Promise<ResolvedBulkPrice>;
	previewTiers(ruleId: string, basePrice: number): Promise<TierPreview[]>;

	// Analytics
	getSummary(): Promise<BulkPricingSummary>;
};
