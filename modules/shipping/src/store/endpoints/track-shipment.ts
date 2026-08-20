import { createStoreEndpoint } from "@86d-app/core/api";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const trackShipment = createStoreEndpoint(
	"/shipping/track/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.shipping as ShippingController;
		const shipment = await controller.getShipment(ctx.params.id);
		if (!shipment) {
			return { error: "Shipment not found", status: 404 };
		}

		const authorization = await ctx.context.capabilities.invoke(
			orderCustomerAuthorizeCapability,
			{ orderId: shipment.orderId, customerId: userId },
		);
		if (!authorization.ok) {
			if (
				authorization.failure.code === "order_not_found" ||
				authorization.failure.code === "not_owner"
			) {
				return { error: "Shipment not found", status: 404 };
			}
			return {
				code: "ORDER_AUTHORIZATION_UNAVAILABLE",
				error: "Order authorization is unavailable.",
				status: 503,
			};
		}

		const trackingUrl = await controller.getTrackingUrl(shipment.id);

		return {
			shipment: {
				id: shipment.id,
				orderId: shipment.orderId,
				trackingNumber: shipment.trackingNumber,
				status: shipment.status,
				shippedAt: shipment.shippedAt,
				deliveredAt: shipment.deliveredAt,
				estimatedDelivery: shipment.estimatedDelivery,
			},
			trackingUrl,
		};
	},
);
