import type { ModuleController } from "@86d-app/core/types/module";

// --- Enums ---

export type WarrantyPlanType =
	| "manufacturer"
	| "extended"
	| "accidental_damage";

export type RegistrationStatus = "active" | "expired" | "voided" | "claimed";

export type ClaimIssueType =
	| "defect"
	| "malfunction"
	| "accidental_damage"
	| "wear_and_tear"
	| "missing_parts"
	| "other";

export type ClaimStatus =
	| "submitted"
	| "under_review"
	| "approved"
	| "denied"
	| "in_repair"
	| "resolved"
	| "closed";

export type ClaimResolution = "repair" | "replace" | "refund" | "credit";

// --- Entities ---

export type WarrantyPlan = {
	id: string;
	name: string;
	description?: string | undefined;
	type: WarrantyPlanType;
	durationMonths: number;
	price: number;
	coverageDetails?: string | undefined;
	exclusions?: string | undefined;
	isActive: boolean;
	productId?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type WarrantyRegistration = {
	id: string;
	warrantyPlanId: string;
	orderId: string;
	customerId: string;
	productId: string;
	productName: string;
	serialNumber?: string | undefined;
	purchaseDate: Date;
	expiresAt: Date;
	status: RegistrationStatus;
	voidReason?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type WarrantyClaim = {
	id: string;
	warrantyRegistrationId: string;
	customerId: string;
	customerEmail?: string | undefined;
	issueType: ClaimIssueType;
	issueDescription: string;
	status: ClaimStatus;
	resolution?: ClaimResolution | undefined;
	resolutionNotes?: string | undefined;
	adminNotes?: string | undefined;
	submittedAt: Date;
	resolvedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

// --- Params ---

export type CreateWarrantyPlanParams = {
	name: string;
	description?: string | undefined;
	type: WarrantyPlanType;
	durationMonths: number;
	price?: number | undefined;
	coverageDetails?: string | undefined;
	exclusions?: string | undefined;
	productId?: string | undefined;
};

export type UpdateWarrantyPlanParams = {
	name?: string | undefined;
	description?: string | undefined;
	durationMonths?: number | undefined;
	price?: number | undefined;
	coverageDetails?: string | undefined;
	exclusions?: string | undefined;
	isActive?: boolean | undefined;
};

export type RegisterWarrantyParams = {
	warrantyPlanId: string;
	orderId: string;
	customerId: string;
	productId: string;
	productName: string;
	serialNumber?: string | undefined;
	purchaseDate?: Date | undefined;
};

export type SubmitClaimParams = {
	warrantyRegistrationId: string;
	customerId: string;
	customerEmail?: string | undefined;
	issueType: ClaimIssueType;
	issueDescription: string;
};

// --- Summary ---

export type ClaimSummary = {
	totalClaims: number;
	submitted: number;
	underReview: number;
	approved: number;
	denied: number;
	inRepair: number;
	resolved: number;
	closed: number;
};

// --- Controller ---

export type WarrantyController = ModuleController & {
	// Plans
	createPlan(params: CreateWarrantyPlanParams): Promise<WarrantyPlan>;
	updatePlan(
		id: string,
		params: UpdateWarrantyPlanParams,
	): Promise<WarrantyPlan | null>;
	getPlan(id: string): Promise<WarrantyPlan | null>;
	listPlans(params?: {
		type?: WarrantyPlanType | undefined;
		productId?: string | undefined;
		activeOnly?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<WarrantyPlan[]>;
	deletePlan(id: string): Promise<boolean>;

	// Registrations
	register(params: RegisterWarrantyParams): Promise<WarrantyRegistration>;
	getRegistration(id: string): Promise<WarrantyRegistration | null>;
	getRegistrationsByCustomer(
		customerId: string,
		params?: {
			status?: RegistrationStatus | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<WarrantyRegistration[]>;
	listRegistrations(params?: {
		status?: RegistrationStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<WarrantyRegistration[]>;
	voidRegistration(
		id: string,
		reason: string,
	): Promise<WarrantyRegistration | null>;

	// Claims
	submitClaim(params: SubmitClaimParams): Promise<WarrantyClaim>;
	getClaim(id: string): Promise<WarrantyClaim | null>;
	getClaimsByRegistration(
		warrantyRegistrationId: string,
	): Promise<WarrantyClaim[]>;
	getClaimsByCustomer(
		customerId: string,
		params?: {
			status?: ClaimStatus | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<WarrantyClaim[]>;
	listClaims(params?: {
		status?: ClaimStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<WarrantyClaim[]>;
	reviewClaim(
		id: string,
		adminNotes?: string | undefined,
	): Promise<WarrantyClaim | null>;
	approveClaim(
		id: string,
		resolution: ClaimResolution,
		adminNotes?: string | undefined,
	): Promise<WarrantyClaim | null>;
	denyClaim(
		id: string,
		adminNotes?: string | undefined,
	): Promise<WarrantyClaim | null>;
	startRepair(
		id: string,
		adminNotes?: string | undefined,
	): Promise<WarrantyClaim | null>;
	resolveClaim(
		id: string,
		resolutionNotes?: string | undefined,
	): Promise<WarrantyClaim | null>;
	closeClaim(id: string): Promise<WarrantyClaim | null>;
	getClaimSummary(): Promise<ClaimSummary>;
};
