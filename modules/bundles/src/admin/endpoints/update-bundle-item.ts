import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BundleController } from "../../service";

export const updateBundleItem = createAdminEndpoint(
	"/admin/bundles/:id/items/:itemId/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
			itemId: z.string().min(1),
		}),
		body: z.object({
			quantity: z.number().int().min(1).max(999).optional(),
			sortOrder: z.number().int().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.bundles as BundleController;
		const updates: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(ctx.body)) {
			if (value !== undefined) updates[key] = value;
		}

		const item = await controller.updateItem(ctx.params.itemId, updates);

		if (!item) {
			return { error: "Item not found", status: 404 };
		}

		return { item };
	},
);
