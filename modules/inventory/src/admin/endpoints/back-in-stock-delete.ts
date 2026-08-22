import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { InventoryController } from "../../service";

export const backInStockDelete = createAdminEndpoint(
	"/admin/inventory/back-in-stock/:id",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.inventory as InventoryController;
		// The id is in the format productId:variantId:email — extract parts
		const parts = ctx.params.id.split(":");
		if (parts.length < 3) {
			return { removed: false };
		}
		const productId = parts[0];
		const variantId = parts[1] === "_" ? undefined : parts[1];
		const email = parts.slice(2).join(":");

		const removed = await controller.unsubscribeBackInStock({
			productId,
			variantId,
			email,
		});
		return { removed };
	},
);
