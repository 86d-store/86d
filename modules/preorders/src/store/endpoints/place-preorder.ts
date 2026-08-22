import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PreordersController } from "../../service";

export const placePreorder = createStoreEndpoint(
	"/preorders/place",
	{
		method: "POST",
		body: z.object({
			campaignId: z.string().max(200),
			quantity: z.number().int().min(1).max(9999),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.preorders as PreordersController;
		const item = await controller.placePreorder({
			campaignId: ctx.body.campaignId,
			customerId: session.user.id,
			customerEmail: session.user.email,
			quantity: ctx.body.quantity,
		});
		if (!item) {
			return { error: "Preorder not available", item: null };
		}
		return { item };
	},
);
