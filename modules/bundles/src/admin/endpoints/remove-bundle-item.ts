import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BundleController } from "../../service";

export const removeBundleItem = createAdminEndpoint(
	"/admin/bundles/:id/items/:itemId/remove",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
			itemId: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.bundles as BundleController;
		const removed = await controller.removeItem(ctx.params.itemId);

		if (!removed) {
			return { error: "Item not found", status: 404 };
		}

		return { success: true };
	},
);
