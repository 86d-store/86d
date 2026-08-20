import type { ModuleController } from "@86d-app/core/types/module";

export type BackorderStatus =
	| "pending"
	| "confirmed"
	| "allocated"
	| "shipped"
	| "delivered"
	| "cancelled";

export type Backorder = {
	id: string;
	productId: string;
	productName: string;
	variantId?: string | undefined;
	variantLabel?: string | undefined;
	customerId: string;
	customerEmail: string;
	orderId?: string | undefined;
	quantity: number;
	status: BackorderStatus;
	estimatedAvailableAt?: Date | undefined;
	allocatedAt?: Date | undefined;
	shippedAt?: Date | undefined;
	cancelledAt?: Date | undefined;
	cancelReason?: string | undefined;
	notes?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type BackorderPolicy = {
	id: string;
	productId: string;
	enabled: boolean;
	maxQuantityPerOrder?: number | undefined;
	maxTotalBackorders?: number | undefined;
	estimatedLeadDays?: number | undefined;
	autoConfirm: boolean;
	message?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type BackorderSummary = {
	totalPending: number;
	totalConfirmed: number;
	totalAllocated: number;
	totalShipped: number;
	totalDelivered: number;
	totalCancelled: number;
	topProducts: Array<{
		productId: string;
		productName: string;
		count: number;
	}>;
};

export type BackordersController = ModuleController & {
	createBackorder(params: {
		productId: string;
		productName: string;
		variantId?: string | undefined;
		variantLabel?: string | undefined;
		customerId: string;
		customerEmail: string;
		orderId?: string | undefined;
		quantity: number;
		estimatedAvailableAt?: Date | undefined;
		notes?: string | undefined;
	}): Promise<Backorder | null>;

	getBackorder(id: string): Promise<Backorder | null>;

	listBackorders(params?: {
		productId?: string | undefined;
		customerId?: string | undefined;
		status?: BackorderStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Backorder[]>;

	countByProduct(productId: string): Promise<number>;

	updateStatus(
		id: string,
		status: BackorderStatus,
		reason?: string | undefined,
	): Promise<Backorder | null>;

	bulkUpdateStatus(
		ids: string[],
		status: BackorderStatus,
	): Promise<{ updated: number }>;

	allocateStock(
		productId: string,
		quantity: number,
	): Promise<{ allocated: number; backorderIds: string[] }>;

	cancelBackorder(
		id: string,
		reason?: string | undefined,
	): Promise<Backorder | null>;

	getCustomerBackorders(
		customerId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<Backorder[]>;

	setPolicy(params: {
		productId: string;
		enabled: boolean;
		maxQuantityPerOrder?: number | undefined;
		maxTotalBackorders?: number | undefined;
		estimatedLeadDays?: number | undefined;
		autoConfirm?: boolean | undefined;
		message?: string | undefined;
	}): Promise<BackorderPolicy>;

	getPolicy(productId: string): Promise<BackorderPolicy | null>;

	listPolicies(params?: {
		enabled?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<BackorderPolicy[]>;

	deletePolicy(productId: string): Promise<boolean>;

	checkEligibility(
		productId: string,
		quantity: number,
	): Promise<{
		eligible: boolean;
		reason?: string | undefined;
		estimatedLeadDays?: number | undefined;
		message?: string | undefined;
	}>;

	getSummary(): Promise<BackorderSummary>;
};
