import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftWrappingController } from "../../service";

export const itemWrapping = createStoreEndpoint(
	"/gift-wrapping/item/:orderItemId",
	{
		method: "GET",
		params: z.object({
			orderItemId: z.string().min(1).max(100),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.giftWrapping as GiftWrappingController;
		const selection = await controller.getItemSelection(ctx.params.orderItemId);

		if (selection?.customerId && selection.customerId !== userId) {
			return { selection: null };
		}

		return { selection };
	},
);
