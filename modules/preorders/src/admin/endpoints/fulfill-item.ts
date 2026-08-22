import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PreordersController } from "../../service";

export const fulfillItem = createAdminEndpoint(
	"/admin/preorders/items/:id/fulfill",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			orderId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const item = await controller.fulfillPreorderItem(
			ctx.params.id,
			ctx.body.orderId,
		);
		if (!item) {
			return { error: "Cannot fulfill preorder", item: null };
		}
		void ctx.context.events?.emit("preorder.fulfilled", {
			preorderItemId: item.id,
			customerId: item.customerId,
			orderId: item.orderId ?? ctx.body.orderId,
		});
		return { item };
	},
);
