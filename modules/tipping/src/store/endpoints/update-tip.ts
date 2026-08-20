import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TippingController } from "../../service";

export const updateTip = createStoreEndpoint(
	"/tipping/tips/:id",
	{
		method: "PUT",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			amount: z.number().positive().max(100000).optional(),
			percentage: z.number().min(0).max(100).optional(),
			recipientType: z.enum(["driver", "server", "staff", "store"]).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.tipping as TippingController;

		// Verify ownership before mutation
		const existing = await controller.getTip(ctx.params.id);
		if (!existing || existing.customerId !== customerId) {
			return { error: "Tip not found", status: 404 };
		}

		const tip = await controller.updateTip(ctx.params.id, {
			...(ctx.body.amount !== undefined ? { amount: ctx.body.amount } : {}),
			...(ctx.body.percentage !== undefined
				? { percentage: ctx.body.percentage }
				: {}),
			...(ctx.body.recipientType !== undefined
				? { recipientType: ctx.body.recipientType }
				: {}),
		});

		if (!tip) {
			return { error: "Tip not found", status: 404 };
		}

		return { tip };
	},
);
