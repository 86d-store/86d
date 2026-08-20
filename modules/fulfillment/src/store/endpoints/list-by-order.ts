import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FulfillmentController } from "../../service";
import { canAccessOrderFulfillment } from "./order-access";

export const listByOrder = createStoreEndpoint(
	"/fulfillment/order/:orderId",
	{
		method: "GET",
		params: z.object({ orderId: z.string().min(1).max(100) }),
	},
	async (ctx) => {
		if (
			!(await canAccessOrderFulfillment(
				ctx.context,
				ctx.params.orderId,
				ctx.headers?.get("cookie") ?? null,
			))
		) {
			return { error: "Fulfillment not found", status: 404 };
		}
		const controller = ctx.context.controllers
			.fulfillment as FulfillmentController;
		const fulfillments = await controller.listByOrder(ctx.params.orderId);
		return {
			fulfillments: fulfillments.map((f) => ({
				id: f.id,
				orderId: f.orderId,
				status: f.status,
				items: f.items,
				carrier: f.carrier,
				trackingNumber: f.trackingNumber,
				trackingUrl: f.trackingUrl,
				shippedAt: f.shippedAt,
				deliveredAt: f.deliveredAt,
				createdAt: f.createdAt,
			})),
		};
	},
);
