import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftRegistryController } from "../../service";

export const removeItem = createStoreEndpoint(
	"/gift-registry/items/remove",
	{
		method: "POST",
		body: z.object({
			itemId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const item = await controller.getItem(ctx.body.itemId);
		if (!item) {
			return { error: "Item not found", status: 404 };
		}

		// Verify ownership
		const registry = await controller.getRegistry(item.registryId);
		if (!registry || registry.customerId !== userId) {
			return { error: "Item not found", status: 404 };
		}

		await controller.removeItem(ctx.body.itemId);
		return { success: true };
	},
);
