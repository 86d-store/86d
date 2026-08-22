import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CollectionController } from "../../service";

export const reorderProducts = createAdminEndpoint(
	"/admin/collections/:id/products/reorder",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			productIds: z.array(z.string()).min(1).max(1000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const collection = await controller.getCollection(ctx.params.id);
		if (!collection) {
			return { error: "Collection not found", status: 404 };
		}

		await controller.reorderProducts({
			collectionId: ctx.params.id,
			productIds: ctx.body.productIds,
		});

		return { success: true };
	},
);
