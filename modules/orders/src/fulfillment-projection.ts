import type {
	FulfillmentWithItems,
	OrderFulfillmentStatus,
	OrderItem,
} from "./service";

export type OwnerFulfillment = Readonly<{
	id: string;
	orderId: string;
	status: string;
	items: ReadonlyArray<{ lineItemId: string; quantity: number }>;
	carrier?: string | undefined;
	trackingNumber?: string | undefined;
	trackingUrl?: string | undefined;
	notes?: string | undefined;
	shippedAt?: Date | undefined;
	deliveredAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
}>;

export type OwnerFulfillmentController = Readonly<{
	listByOrder(orderId: string): Promise<OwnerFulfillment[]>;
}>;

/**
 * Project Fulfillment-owned obligations into the Order Admin read shape.
 * lineItemId is the Order line identity Fulfillment already validated.
 */
export function projectOwnerFulfillments(
	fulfillments: readonly OwnerFulfillment[],
): FulfillmentWithItems[] {
	return fulfillments.map((fulfillment) => ({
		id: fulfillment.id,
		orderId: fulfillment.orderId,
		status: fulfillment.status as FulfillmentWithItems["status"],
		trackingNumber: fulfillment.trackingNumber,
		trackingUrl: fulfillment.trackingUrl,
		carrier: fulfillment.carrier,
		notes: fulfillment.notes,
		shippedAt: fulfillment.shippedAt,
		deliveredAt: fulfillment.deliveredAt,
		createdAt: fulfillment.createdAt,
		updatedAt: fulfillment.updatedAt,
		items: fulfillment.items.map((item, index) => ({
			id: `${fulfillment.id}:${item.lineItemId}:${index}`,
			fulfillmentId: fulfillment.id,
			orderItemId: item.lineItemId,
			quantity: item.quantity,
		})),
	}));
}

export function projectOrderFulfillmentStatus(
	orderItems: readonly OrderItem[],
	fulfillments: readonly OwnerFulfillment[],
): OrderFulfillmentStatus {
	if (orderItems.length === 0) return "unfulfilled";

	const fulfilledQty: Record<string, number> = {};
	for (const fulfillment of fulfillments) {
		if (fulfillment.status === "cancelled") continue;
		for (const item of fulfillment.items) {
			fulfilledQty[item.lineItemId] =
				(fulfilledQty[item.lineItemId] ?? 0) + item.quantity;
		}
	}

	let allFulfilled = true;
	let anyFulfilled = false;
	for (const item of orderItems) {
		const qty = fulfilledQty[item.id] ?? 0;
		if (qty > 0) anyFulfilled = true;
		if (qty < item.quantity) allFulfilled = false;
	}

	if (!anyFulfilled) return "unfulfilled";
	if (allFulfilled) return "fulfilled";
	return "partially_fulfilled";
}
