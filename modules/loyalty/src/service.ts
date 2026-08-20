import type { ModuleController } from "@86d-app/core/types/module";

export type LoyaltyTierSlug = "bronze" | "silver" | "gold" | "platinum";
export type TransactionType = "earn" | "redeem" | "adjust" | "expire";
export type AccountStatus = "active" | "suspended" | "closed";

export type LoyaltyAccount = {
	id: string;
	customerId: string;
	balance: number;
	lifetimeEarned: number;
	lifetimeRedeemed: number;
	tier: LoyaltyTierSlug;
	status: AccountStatus;
	createdAt: Date;
	updatedAt: Date;
};

export type LoyaltyTransaction = {
	id: string;
	accountId: string;
	type: TransactionType;
	points: number;
	description: string;
	orderId?: string | undefined;
	ledgerKey?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
};

export type LoyaltyRule = {
	id: string;
	name: string;
	type: "per_dollar" | "fixed_bonus" | "multiplier" | "signup";
	points: number;
	minOrderAmount?: number | undefined;
	active: boolean;
	createdAt: Date;
};

export type LoyaltyTier = {
	id: string;
	name: string;
	slug: string;
	minPoints: number;
	multiplier: number;
	perks?: Record<string, unknown> | undefined;
	sortOrder: number;
};

export type LoyaltySummary = {
	totalAccounts: number;
	totalPointsOutstanding: number;
	totalLifetimeEarned: number;
	tierBreakdown: Array<{ tier: LoyaltyTierSlug; count: number }>;
};

export type LoyaltyController = ModuleController & {
	// ── Account operations ────────────────────────────────────────────
	getOrCreateAccount(customerId: string): Promise<LoyaltyAccount>;
	getAccount(customerId: string): Promise<LoyaltyAccount | null>;
	getAccountById(id: string): Promise<LoyaltyAccount | null>;
	suspendAccount(customerId: string): Promise<LoyaltyAccount>;
	reactivateAccount(customerId: string): Promise<LoyaltyAccount>;

	// ── Points operations ─────────────────────────────────────────────
	earnPoints(params: {
		customerId: string;
		points: number;
		description: string;
		orderId?: string | undefined;
	}): Promise<LoyaltyTransaction>;

	redeemPoints(params: {
		customerId: string;
		points: number;
		description: string;
		orderId?: string | undefined;
	}): Promise<LoyaltyTransaction>;

	adjustPoints(params: {
		customerId: string;
		points: number;
		description: string;
	}): Promise<LoyaltyTransaction>;

	// ── Transaction history ───────────────────────────────────────────
	listTransactions(
		accountId: string,
		params?: {
			type?: TransactionType | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<LoyaltyTransaction[]>;

	// ── Rules ─────────────────────────────────────────────────────────
	createRule(params: {
		name: string;
		type: LoyaltyRule["type"];
		points: number;
		minOrderAmount?: number | undefined;
	}): Promise<LoyaltyRule>;

	updateRule(
		id: string,
		params: {
			name?: string | undefined;
			points?: number | undefined;
			minOrderAmount?: number | undefined;
			active?: boolean | undefined;
		},
	): Promise<LoyaltyRule | null>;

	deleteRule(id: string): Promise<boolean>;
	listRules(activeOnly?: boolean): Promise<LoyaltyRule[]>;

	calculateOrderPoints(orderAmount: number): Promise<number>;

	// ── Tiers ─────────────────────────────────────────────────────────
	listTiers(): Promise<LoyaltyTier[]>;
	getTier(slug: string): Promise<LoyaltyTier | null>;
	createTier(params: {
		name: string;
		slug: string;
		minPoints: number;
		multiplier?: number | undefined;
		perks?: Record<string, unknown> | undefined;
	}): Promise<LoyaltyTier>;
	updateTier(
		id: string,
		params: {
			name?: string | undefined;
			minPoints?: number | undefined;
			multiplier?: number | undefined;
			perks?: Record<string, unknown> | undefined;
		},
	): Promise<LoyaltyTier | null>;
	deleteTier(id: string): Promise<boolean>;

	// ── Admin ─────────────────────────────────────────────────────────
	listAccounts(params?: {
		tier?: LoyaltyTierSlug | undefined;
		status?: AccountStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<LoyaltyAccount[]>;

	getSummary(): Promise<LoyaltySummary>;
};
