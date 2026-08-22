import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GiftWrappingController } from "../../service";

export const removeWrapping = createStoreEndpoint(
	"/gift-wrapping/remove",
	{
		method: "POST",
		body: z.object({
			selectionId: z.string().min(1).max(100),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;

		const existing = await controller.getSelection(ctx.body.selectionId);
		if (!existing) {
			return { error: "Selection not found", status: 404 };
		}
		if (existing.customerId !== userId) {
			return { error: "Selection not found", status: 404 };
		}

		const removed = await controller.removeSelection(ctx.body.selectionId);
		return { removed };
	},
);
