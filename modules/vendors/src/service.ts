import type { ModuleController } from "@86d-app/core/types/module";

export type VendorStatus = "pending" | "active" | "suspended" | "closed";
export type VendorProductStatus = "active" | "paused";
export type PayoutStatus = "pending" | "processing" | "completed" | "failed";

export type Vendor = {
	id: string;
	name: string;
	slug: string;
	email: string;
	phone?: string;
	description?: string;
	logo?: string;
	banner?: string;
	website?: string;
	commissionRate: number;
	status: VendorStatus;
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
	metadata?: Record<string, unknown>;
	joinedAt: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type VendorProduct = {
	id: string;
	vendorId: string;
	productId: string;
	commissionOverride?: number;
	status: VendorProductStatus;
	createdAt: Date;
};

export type VendorPayout = {
	id: string;
	vendorId: string;
	amount: number;
	currency: string;
	status: PayoutStatus;
	method?: string;
	reference?: string;
	periodStart: Date;
	periodEnd: Date;
	notes?: string;
	createdAt: Date;
	completedAt?: Date;
};

export type VendorStats = {
	totalVendors: number;
	activeVendors: number;
	pendingVendors: number;
	suspendedVendors: number;
	totalProducts: number;
	totalPayouts: number;
	pendingPayoutAmount: number;
	completedPayoutAmount: number;
};

export type PayoutStats = {
	totalPayouts: number;
	pendingAmount: number;
	processingAmount: number;
	completedAmount: number;
	failedAmount: number;
};

export type VendorController = ModuleController & {
	// --- Vendors ---
	createVendor(params: {
		name: string;
		slug: string;
		email: string;
		phone?: string;
		description?: string;
		logo?: string;
		banner?: string;
		website?: string;
		commissionRate?: number;
		status?: VendorStatus;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
		metadata?: Record<string, unknown>;
	}): Promise<Vendor>;

	getVendor(id: string): Promise<Vendor | null>;

	getVendorBySlug(slug: string): Promise<Vendor | null>;

	updateVendor(
		id: string,
		params: {
			name?: string;
			slug?: string;
			email?: string;
			phone?: string | null;
			description?: string | null;
			logo?: string | null;
			banner?: string | null;
			website?: string | null;
			commissionRate?: number;
			addressLine1?: string | null;
			addressLine2?: string | null;
			city?: string | null;
			state?: string | null;
			postalCode?: string | null;
			country?: string | null;
			metadata?: Record<string, unknown> | null;
		},
	): Promise<Vendor | null>;

	deleteVendor(id: string): Promise<boolean>;

	listVendors(params?: {
		status?: VendorStatus;
		take?: number;
		skip?: number;
	}): Promise<Vendor[]>;

	countVendors(params?: { status?: VendorStatus }): Promise<number>;

	updateVendorStatus(id: string, status: VendorStatus): Promise<Vendor | null>;

	// --- Products ---
	assignProduct(params: {
		vendorId: string;
		productId: string;
		commissionOverride?: number;
	}): Promise<VendorProduct>;

	unassignProduct(params: {
		vendorId: string;
		productId: string;
	}): Promise<boolean>;

	listVendorProducts(params: {
		vendorId: string;
		status?: VendorProductStatus;
		take?: number;
		skip?: number;
	}): Promise<VendorProduct[]>;

	countVendorProducts(params: {
		vendorId: string;
		status?: VendorProductStatus;
	}): Promise<number>;

	getProductVendor(productId: string): Promise<Vendor | null>;

	// --- Payouts ---
	createPayout(params: {
		vendorId: string;
		amount: number;
		currency: string;
		method?: string;
		reference?: string;
		periodStart: Date;
		periodEnd: Date;
		notes?: string;
	}): Promise<VendorPayout>;

	getPayout(id: string): Promise<VendorPayout | null>;

	updatePayoutStatus(
		id: string,
		status: PayoutStatus,
	): Promise<VendorPayout | null>;

	listPayouts(params?: {
		vendorId?: string;
		status?: PayoutStatus;
		take?: number;
		skip?: number;
	}): Promise<VendorPayout[]>;

	countPayouts(params?: {
		vendorId?: string;
		status?: PayoutStatus;
	}): Promise<number>;

	getPayoutStats(vendorId?: string): Promise<PayoutStats>;

	// --- Admin ---
	getStats(): Promise<VendorStats>;
};
