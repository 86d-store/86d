import type { ModuleController } from "@86d-app/core/types/module";

export type BillingInterval = "monthly" | "yearly" | "lifetime";
export type MembershipStatus =
	| "active"
	| "trial"
	| "expired"
	| "cancelled"
	| "paused";
export type BenefitType =
	| "discount_percentage"
	| "free_shipping"
	| "early_access"
	| "exclusive_products"
	| "priority_support";

export type MembershipPlan = {
	id: string;
	name: string;
	slug: string;
	description?: string;
	price: number;
	billingInterval: BillingInterval;
	trialDays: number;
	features?: string[];
	isActive: boolean;
	maxMembers?: number;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
};

export type Membership = {
	id: string;
	customerId: string;
	planId: string;
	status: MembershipStatus;
	startDate: Date;
	endDate?: Date;
	trialEndDate?: Date;
	cancelledAt?: Date;
	pausedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type MembershipBenefit = {
	id: string;
	planId: string;
	type: BenefitType;
	value: string;
	description?: string;
	isActive: boolean;
	createdAt: Date;
};

export type MembershipProduct = {
	id: string;
	planId: string;
	productId: string;
	assignedAt: Date;
};

export type MembershipWithPlan = Membership & {
	plan: MembershipPlan;
};

export type MembershipStats = {
	totalPlans: number;
	activePlans: number;
	totalMembers: number;
	activeMembers: number;
	trialMembers: number;
	cancelledMembers: number;
	gatedProducts: number;
};

export type MembershipController = ModuleController & {
	// --- Plans ---
	createPlan(params: {
		name: string;
		slug: string;
		description?: string;
		price: number;
		billingInterval: BillingInterval;
		trialDays?: number;
		features?: string[];
		isActive?: boolean;
		maxMembers?: number;
		sortOrder?: number;
	}): Promise<MembershipPlan>;

	getPlan(id: string): Promise<MembershipPlan | null>;

	getPlanBySlug(slug: string): Promise<MembershipPlan | null>;

	updatePlan(
		id: string,
		params: {
			name?: string;
			slug?: string;
			description?: string | null;
			price?: number;
			billingInterval?: BillingInterval;
			trialDays?: number;
			features?: string[] | null;
			isActive?: boolean;
			maxMembers?: number | null;
			sortOrder?: number;
		},
	): Promise<MembershipPlan | null>;

	deletePlan(id: string): Promise<boolean>;

	listPlans(params?: {
		isActive?: boolean;
		take?: number;
		skip?: number;
	}): Promise<MembershipPlan[]>;

	countPlans(params?: { isActive?: boolean }): Promise<number>;

	// --- Memberships ---
	subscribe(params: {
		customerId: string;
		planId: string;
	}): Promise<Membership>;

	cancelMembership(id: string): Promise<Membership | null>;

	pauseMembership(id: string): Promise<Membership | null>;

	resumeMembership(id: string): Promise<Membership | null>;

	getMembership(id: string): Promise<Membership | null>;

	getCustomerMembership(customerId: string): Promise<MembershipWithPlan | null>;

	listMemberships(params?: {
		planId?: string;
		status?: MembershipStatus;
		take?: number;
		skip?: number;
	}): Promise<Membership[]>;

	countMemberships(params?: {
		planId?: string;
		status?: MembershipStatus;
	}): Promise<number>;

	// --- Benefits ---
	addBenefit(params: {
		planId: string;
		type: BenefitType;
		value: string;
		description?: string;
		isActive?: boolean;
	}): Promise<MembershipBenefit>;

	removeBenefit(id: string): Promise<boolean>;

	listBenefits(planId: string): Promise<MembershipBenefit[]>;

	getCustomerBenefits(customerId: string): Promise<MembershipBenefit[]>;

	// --- Product gating ---
	gateProduct(params: {
		planId: string;
		productId: string;
	}): Promise<MembershipProduct>;

	ungateProduct(params: {
		planId: string;
		productId: string;
	}): Promise<boolean>;

	listGatedProducts(params: {
		planId: string;
		take?: number;
		skip?: number;
	}): Promise<MembershipProduct[]>;

	countGatedProducts(planId: string): Promise<number>;

	canAccessProduct(params: {
		customerId: string;
		productId: string;
	}): Promise<boolean>;

	// --- Admin ---
	getStats(): Promise<MembershipStats>;
};
