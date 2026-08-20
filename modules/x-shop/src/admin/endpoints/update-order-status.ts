import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { XShopController } from "../../service";

export const updateOrderStatusEndpoint = createAdminEndpoint(
	"/admin/x-shop/orders/:id/status",
	{
		method: "PUT",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
		body: z.object({
			status: z.enum([
				"pending",
				"confirmed",
				"shipped",
				"delivered",
				"cancelled",
				"refunded",
			]),
			trackingNumber: z.string().max(200).transform(sanitizeText).optional(),
			trackingUrl: z.string().url().max(2000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const order = await controller.updateOrderStatus(
			ctx.params.id,
			ctx.body.status,
			ctx.body.trackingNumber,
			ctx.body.trackingUrl,
		);
		if (!order) {
			return { error: "Order not found" };
		}
		return { order };
	},
);
