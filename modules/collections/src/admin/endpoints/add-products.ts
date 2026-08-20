import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CollectionController } from "../../service";

export const addProducts = createAdminEndpoint(
	"/admin/collections/:id/products/add",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			productIds: z.array(z.string()).min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const collection = await controller.getCollection(ctx.params.id);
		if (!collection) {
			return { error: "Collection not found", status: 404 };
		}

		const added = await controller.bulkAddProducts({
			collectionId: ctx.params.id,
			productIds: ctx.body.productIds,
		});

		return { added };
	},
);
