import type { ModuleController } from "@86d-app/core/types/module";

export type FulfillmentStatus =
	| "pending"
	| "processing"
	| "shipped"
	| "delivered"
	| "cancelled";

export type FulfillmentItem = {
	lineItemId: string;
	quantity: number;
};

export type Fulfillment = {
	id: string;
	orderId: string;
	status: FulfillmentStatus;
	items: FulfillmentItem[];
	carrier?: string | undefined;
	trackingNumber?: string | undefined;
	trackingUrl?: string | undefined;
	notes?: string | undefined;
	shippedAt?: Date | undefined;
	deliveredAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type FulfillmentController = ModuleController & {
	createFulfillment(params: {
		orderId: string;
		items: FulfillmentItem[];
		notes?: string | undefined;
	}): Promise<Fulfillment>;

	getFulfillment(id: string): Promise<Fulfillment | null>;

	listByOrder(orderId: string): Promise<Fulfillment[]>;

	listFulfillments(params?: {
		status?: FulfillmentStatus | undefined;
		limit?: number | undefined;
		offset?: number | undefined;
	}): Promise<Fulfillment[]>;

	updateStatus(
		id: string,
		status: FulfillmentStatus,
	): Promise<Fulfillment | null>;

	addTracking(
		id: string,
		params: {
			carrier: string;
			trackingNumber: string;
			trackingUrl?: string | undefined;
		},
	): Promise<Fulfillment | null>;

	cancelFulfillment(id: string): Promise<Fulfillment | null>;
};
