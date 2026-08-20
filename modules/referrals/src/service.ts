import type { ModuleController } from "@86d-app/core/types/module";

export type ReferralStatus = "pending" | "completed" | "expired" | "revoked";

export type RewardType =
	| "percentage_discount"
	| "fixed_discount"
	| "store_credit";

export type ReferralCode = {
	id: string;
	customerId: string;
	customerEmail?: string | undefined;
	code: string;
	active: boolean;
	usageCount: number;
	maxUses: number;
	expiresAt?: Date | undefined;
	createdAt: Date;
};

export type Referral = {
	id: string;
	referrerCodeId: string;
	referrerCustomerId: string;
	referrerEmail?: string | undefined;
	refereeCustomerId: string;
	refereeEmail: string;
	status: ReferralStatus;
	referrerRewarded: boolean;
	refereeRewarded: boolean;
	completedAt?: Date | undefined;
	createdAt: Date;
};

export type ReferralRewardRule = {
	id: string;
	name: string;
	referrerRewardType: RewardType;
	referrerRewardValue: number;
	refereeRewardType: RewardType;
	refereeRewardValue: number;
	minOrderAmount: number;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type ReferralStats = {
	totalCodes: number;
	totalReferrals: number;
	completedReferrals: number;
	pendingReferrals: number;
	conversionRate: number;
};

export type ReferralController = ModuleController & {
	// ── Codes ──────────────────────────────────────────────
	createCode(params: {
		customerId: string;
		customerEmail?: string | undefined;
		maxUses?: number | undefined;
		expiresAt?: Date | undefined;
	}): Promise<ReferralCode>;

	getCode(id: string): Promise<ReferralCode | null>;

	getCodeByCode(code: string): Promise<ReferralCode | null>;

	getCodeForCustomer(customerId: string): Promise<ReferralCode | null>;

	listCodes(params?: {
		active?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ReferralCode[]>;

	deactivateCode(id: string): Promise<ReferralCode | null>;

	// ── Referrals ──────────────────────────────────────────
	createReferral(params: {
		referralCodeId: string;
		refereeCustomerId: string;
		refereeEmail: string;
	}): Promise<Referral | null>;

	getReferral(id: string): Promise<Referral | null>;

	listReferrals(params?: {
		referrerCustomerId?: string | undefined;
		refereeCustomerId?: string | undefined;
		status?: ReferralStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Referral[]>;

	completeReferral(id: string): Promise<Referral | null>;

	revokeReferral(id: string): Promise<Referral | null>;

	markReferrerRewarded(id: string): Promise<Referral | null>;

	markRefereeRewarded(id: string): Promise<Referral | null>;

	// ── Reward Rules ───────────────────────────────────────
	createRewardRule(params: {
		name: string;
		referrerRewardType: RewardType;
		referrerRewardValue: number;
		refereeRewardType: RewardType;
		refereeRewardValue: number;
		minOrderAmount?: number | undefined;
	}): Promise<ReferralRewardRule>;

	getRewardRule(id: string): Promise<ReferralRewardRule | null>;

	listRewardRules(params?: {
		active?: boolean | undefined;
	}): Promise<ReferralRewardRule[]>;

	updateRewardRule(
		id: string,
		params: {
			name?: string | undefined;
			referrerRewardType?: RewardType | undefined;
			referrerRewardValue?: number | undefined;
			refereeRewardType?: RewardType | undefined;
			refereeRewardValue?: number | undefined;
			minOrderAmount?: number | undefined;
			active?: boolean | undefined;
		},
	): Promise<ReferralRewardRule | null>;

	deleteRewardRule(id: string): Promise<boolean>;

	// ── Stats ──────────────────────────────────────────────
	getStats(): Promise<ReferralStats>;

	getStatsForCustomer(customerId: string): Promise<{
		code: ReferralCode | null;
		totalReferrals: number;
		completedReferrals: number;
		pendingReferrals: number;
	}>;
};
