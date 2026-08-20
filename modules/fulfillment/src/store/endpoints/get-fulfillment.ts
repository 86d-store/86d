import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FulfillmentController } from "../../service";
import { canAccessOrderFulfillment } from "./order-access";

export const getFulfillment = createStoreEndpoint(
	"/fulfillment/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().min(1).max(100) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.fulfillment as FulfillmentController;
		const fulfillment = await controller.getFulfillment(ctx.params.id);
		if (!fulfillment) {
			return { error: "Fulfillment not found", status: 404 };
		}
		if (
			!(await canAccessOrderFulfillment(
				ctx.context,
				fulfillment.orderId,
				ctx.headers?.get("cookie") ?? null,
			))
		) {
			return { error: "Fulfillment not found", status: 404 };
		}
		return {
			fulfillment: {
				id: fulfillment.id,
				orderId: fulfillment.orderId,
				status: fulfillment.status,
				items: fulfillment.items,
				carrier: fulfillment.carrier,
				trackingNumber: fulfillment.trackingNumber,
				trackingUrl: fulfillment.trackingUrl,
				shippedAt: fulfillment.shippedAt,
				deliveredAt: fulfillment.deliveredAt,
				createdAt: fulfillment.createdAt,
			},
		};
	},
);
