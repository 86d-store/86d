import type { ModuleController } from "@86d-app/core/types/module";

/** Subset of the inventory controller used for restocking returned items. */
export type InventoryRestockController = {
	adjustStock(params: {
		productId: string;
		variantId?: string | undefined;
		locationId?: string | undefined;
		delta: number;
	}): Promise<unknown>;
};

export type ReturnStatus =
	| "requested"
	| "approved"
	| "rejected"
	| "received"
	| "completed"
	| "cancelled";

export type RefundMethod = "original_payment" | "store_credit" | "exchange";

export type ItemReturnReason =
	| "damaged"
	| "defective"
	| "wrong_item"
	| "not_as_described"
	| "changed_mind"
	| "too_small"
	| "too_large"
	| "other";

export type ItemCondition = "unopened" | "opened" | "used" | "damaged";

export type ReturnRequest = {
	id: string;
	orderId: string;
	customerId: string;
	customerEmail?: string | undefined;
	status: ReturnStatus;
	refundMethod: RefundMethod;
	refundAmount: number;
	currency: string;
	reason: string;
	customerNotes?: string | undefined;
	adminNotes?: string | undefined;
	trackingNumber?: string | undefined;
	trackingCarrier?: string | undefined;
	requestedAt: Date;
	resolvedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type ReturnItem = {
	id: string;
	returnRequestId: string;
	orderItemId: string;
	productName: string;
	sku?: string | undefined;
	productId?: string | undefined;
	variantId?: string | undefined;
	quantity: number;
	unitPrice: number;
	reason: ItemReturnReason;
	condition: ItemCondition;
	notes?: string | undefined;
	createdAt: Date;
};

export type CreateReturnParams = {
	orderId: string;
	customerId: string;
	customerEmail?: string | undefined;
	reason: string;
	refundMethod?: RefundMethod | undefined;
	customerNotes?: string | undefined;
	currency?: string | undefined;
	items: CreateReturnItemParams[];
};

export type CreateReturnItemParams = {
	orderItemId: string;
	productName: string;
	sku?: string | undefined;
	productId?: string | undefined;
	variantId?: string | undefined;
	quantity: number;
	unitPrice: number;
	reason: ItemReturnReason;
	condition?: ItemCondition | undefined;
	notes?: string | undefined;
};

export type ReturnRequestWithItems = ReturnRequest & {
	items: ReturnItem[];
};

export type ReturnSummary = {
	totalRequests: number;
	requested: number;
	approved: number;
	completed: number;
	rejected: number;
	totalRefundAmount: number;
};

export type ReturnController = ModuleController & {
	// ── Return request operations ────────────────────────────────────
	create(params: CreateReturnParams): Promise<ReturnRequestWithItems>;
	getById(id: string): Promise<ReturnRequestWithItems | null>;
	getByOrderId(orderId: string): Promise<ReturnRequest[]>;
	getByCustomerId(
		customerId: string,
		params?: {
			status?: ReturnStatus | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<ReturnRequest[]>;

	// ── Status transitions ───────────────────────────────────────────
	approve(
		id: string,
		adminNotes?: string | undefined,
	): Promise<ReturnRequest | null>;
	reject(
		id: string,
		adminNotes?: string | undefined,
	): Promise<ReturnRequest | null>;
	markReceived(id: string): Promise<ReturnRequest | null>;
	complete(id: string, refundAmount: number): Promise<ReturnRequest | null>;
	cancel(id: string): Promise<ReturnRequest | null>;

	// ── Tracking ─────────────────────────────────────────────────────
	updateTracking(
		id: string,
		trackingNumber: string,
		carrier?: string | undefined,
	): Promise<ReturnRequest | null>;

	// ── Admin operations ─────────────────────────────────────────────
	list(params?: {
		status?: ReturnStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ReturnRequest[]>;
	getSummary(): Promise<ReturnSummary>;
};
