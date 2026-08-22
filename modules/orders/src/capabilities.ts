import {
	type CapabilityDecision,
	type CapabilityFailure,
	type CapabilityRejected,
	type CapabilitySuccess,
	provideCapability,
} from "@86d-app/core/capabilities";
import {
	orderCreateCapability,
	orderCustomerAuthorizeCapability,
	orderGuestProofAuthorizeCapability,
	orderLineQuantityValidateCapability,
	orderPurchaseVerifyCapability,
} from "@86d-app/core/commerce-capabilities";
import { createOrderController } from "./service-impl";

type OrderLineValidationDecision = CapabilityDecision<
	typeof orderLineQuantityValidateCapability
>;
type OrderLineValidationFailure = CapabilityFailure<
	typeof orderLineQuantityValidateCapability
>;

function rejectOrderLineValidation(
	code: OrderLineValidationFailure["code"],
): CapabilityRejected<OrderLineValidationFailure> {
	return { ok: false, failure: { code } };
}

function acceptOrderLineValidation(
	decision: OrderLineValidationDecision,
): CapabilitySuccess<OrderLineValidationDecision> {
	return { ok: true, decision };
}

export const orderCreateProvider = provideCapability(
	orderCreateCapability,
	async (ctx, request) => {
		try {
			const order = await createOrderController(ctx.data).create(request);
			return {
				ok: true,
				decision: { orderId: order.id, orderNumber: order.orderNumber },
			};
		} catch {
			return { ok: false, failure: { code: "create_failed" as const } };
		}
	},
);

export const orderCustomerAuthorizeProvider = provideCapability(
	orderCustomerAuthorizeCapability,
	async (ctx, request) => {
		try {
			const order = await createOrderController(ctx.data).getById(
				request.orderId,
			);
			if (!order) {
				return {
					ok: false,
					failure: { code: "order_not_found" as const },
				};
			}
			if (order.customerId !== request.customerId) {
				return { ok: false, failure: { code: "not_owner" as const } };
			}
			return { ok: true, decision: { authorized: true as const } };
		} catch {
			return { ok: false, failure: { code: "lookup_failed" as const } };
		}
	},
);

export const orderGuestProofAuthorizeProvider = provideCapability(
	orderGuestProofAuthorizeCapability,
	async (ctx, request) => {
		try {
			const controller = createOrderController(ctx.data);
			const order = await controller.getById(request.orderId);
			if (!order) {
				return {
					ok: false,
					failure: { code: "order_not_found" as const },
				};
			}
			if (await controller.guestProofMatches(order, request.proofs)) {
				return { ok: true, decision: { authorized: true as const } };
			}
			return { ok: false, failure: { code: "proof_invalid" as const } };
		} catch {
			return { ok: false, failure: { code: "lookup_failed" as const } };
		}
	},
);

export const orderLineQuantityValidateProvider = provideCapability(
	orderLineQuantityValidateCapability,
	async (ctx, request) => {
		try {
			const order = await createOrderController(ctx.data).getById(
				request.orderId,
			);
			if (!order) {
				return rejectOrderLineValidation("ORDER_NOT_FOUND");
			}
			if (order.status === "cancelled" || order.status === "refunded") {
				return rejectOrderLineValidation("ORDER_NOT_FULFILLABLE");
			}

			const orderedQuantities = new Map(
				order.items.map((item) => [item.id, item.quantity]),
			);
			const requestedQuantities = new Map<string, number>();
			for (const item of request.items) {
				const quantity = orderedQuantities.get(item.orderItemId);
				if (quantity === undefined) {
					return rejectOrderLineValidation("ORDER_LINE_NOT_FOUND");
				}
				if (!Number.isSafeInteger(quantity) || quantity < 1) {
					return rejectOrderLineValidation("ORDER_LINE_DATA_INVALID");
				}
				const requested =
					(requestedQuantities.get(item.orderItemId) ?? 0) + item.quantity;
				if (!Number.isSafeInteger(requested) || requested > quantity) {
					return rejectOrderLineValidation("ORDER_LINE_QUANTITY_EXCEEDED");
				}
				requestedQuantities.set(item.orderItemId, requested);
			}

			const items: OrderLineValidationDecision["items"] = [];
			for (const [orderItemId, requestedQuantity] of requestedQuantities) {
				const orderedQuantity = orderedQuantities.get(orderItemId);
				if (orderedQuantity === undefined) {
					return rejectOrderLineValidation("ORDER_LINE_DATA_INVALID");
				}
				items.push({ orderItemId, requestedQuantity, orderedQuantity });
			}

			return acceptOrderLineValidation({
				orderId: order.id,
				items,
			});
		} catch {
			return rejectOrderLineValidation("ORDER_LOOKUP_FAILED");
		}
	},
);

export const orderPurchaseVerifyProvider = provideCapability(
	orderPurchaseVerifyCapability,
	async (ctx, request) => {
		try {
			const verified = await createOrderController(
				ctx.data,
			).hasCustomerPurchasedProduct(request.customerId, request.productId);
			return { ok: true, decision: { verified } };
		} catch {
			return { ok: false, failure: { code: "lookup_failed" as const } };
		}
	},
);
