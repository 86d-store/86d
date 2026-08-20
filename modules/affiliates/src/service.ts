import type { ModuleController } from "@86d-app/core/types/module";

export type AffiliateStatus = "pending" | "approved" | "suspended" | "rejected";

export type ConversionStatus = "pending" | "approved" | "rejected";

export type PayoutStatus = "pending" | "processing" | "completed" | "failed";

export type PayoutMethod =
	| "bank_transfer"
	| "paypal"
	| "store_credit"
	| "check";

export type Affiliate = {
	id: string;
	name: string;
	email: string;
	website?: string | undefined;
	code: string;
	commissionRate: number;
	status: AffiliateStatus;
	totalClicks: number;
	totalConversions: number;
	totalRevenue: number;
	totalCommission: number;
	totalPaid: number;
	customerId?: string | undefined;
	notes?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type AffiliateLink = {
	id: string;
	affiliateId: string;
	targetUrl: string;
	slug: string;
	clicks: number;
	conversions: number;
	revenue: number;
	active: boolean;
	createdAt: Date;
};

export type AffiliateConversion = {
	id: string;
	affiliateId: string;
	linkId?: string | undefined;
	orderId: string;
	orderAmount: number;
	commissionRate: number;
	commissionAmount: number;
	status: ConversionStatus;
	createdAt: Date;
};

export type AffiliatePayout = {
	id: string;
	affiliateId: string;
	amount: number;
	method: PayoutMethod;
	reference?: string | undefined;
	notes?: string | undefined;
	status: PayoutStatus;
	paidAt?: Date | undefined;
	createdAt: Date;
};

export type AffiliateStats = {
	totalAffiliates: number;
	activeAffiliates: number;
	pendingApplications: number;
	totalClicks: number;
	totalConversions: number;
	totalRevenue: number;
	totalCommission: number;
	totalPaid: number;
	conversionRate: number;
};

export type AffiliateController = ModuleController & {
	// ── Affiliates ─────────────────────────────────────────
	apply(params: {
		name: string;
		email: string;
		website?: string | undefined;
		customerId?: string | undefined;
		notes?: string | undefined;
	}): Promise<Affiliate>;

	getAffiliate(id: string): Promise<Affiliate | null>;

	getAffiliateByCode(code: string): Promise<Affiliate | null>;

	getAffiliateByEmail(email: string): Promise<Affiliate | null>;

	listAffiliates(params?: {
		status?: AffiliateStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Affiliate[]>;

	approveAffiliate(
		id: string,
		commissionRate?: number | undefined,
	): Promise<Affiliate | null>;

	suspendAffiliate(id: string): Promise<Affiliate | null>;

	rejectAffiliate(id: string): Promise<Affiliate | null>;

	updateAffiliate(
		id: string,
		params: {
			name?: string | undefined;
			email?: string | undefined;
			website?: string | undefined;
			commissionRate?: number | undefined;
			notes?: string | undefined;
		},
	): Promise<Affiliate | null>;

	// ── Links ──────────────────────────────────────────────
	createLink(params: {
		affiliateId: string;
		targetUrl: string;
	}): Promise<AffiliateLink | null>;

	getLink(id: string): Promise<AffiliateLink | null>;

	getLinkBySlug(slug: string): Promise<AffiliateLink | null>;

	listLinks(params?: {
		affiliateId?: string | undefined;
		active?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<AffiliateLink[]>;

	recordClick(linkId: string): Promise<AffiliateLink | null>;

	deactivateLink(id: string): Promise<AffiliateLink | null>;

	// ── Conversions ────────────────────────────────────────
	recordConversion(params: {
		affiliateId: string;
		linkId?: string | undefined;
		orderId: string;
		orderAmount: number;
	}): Promise<AffiliateConversion | null>;

	getConversion(id: string): Promise<AffiliateConversion | null>;

	listConversions(params?: {
		affiliateId?: string | undefined;
		status?: ConversionStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<AffiliateConversion[]>;

	approveConversion(id: string): Promise<AffiliateConversion | null>;

	rejectConversion(id: string): Promise<AffiliateConversion | null>;

	// ── Payouts ────────────────────────────────────────────
	createPayout(params: {
		affiliateId: string;
		amount: number;
		method: PayoutMethod;
		reference?: string | undefined;
		notes?: string | undefined;
	}): Promise<AffiliatePayout | null>;

	getPayout(id: string): Promise<AffiliatePayout | null>;

	listPayouts(params?: {
		affiliateId?: string | undefined;
		status?: PayoutStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<AffiliatePayout[]>;

	completePayout(id: string): Promise<AffiliatePayout | null>;

	failPayout(id: string): Promise<AffiliatePayout | null>;

	// ── Stats ──────────────────────────────────────────────
	getStats(): Promise<AffiliateStats>;

	getAffiliateBalance(affiliateId: string): Promise<{
		totalCommission: number;
		totalPaid: number;
		balance: number;
	}>;
};
