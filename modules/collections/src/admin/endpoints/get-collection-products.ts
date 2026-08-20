import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CollectionController } from "../../service";

export const getCollectionProducts = createAdminEndpoint(
	"/admin/collections/:id/products",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const collection = await controller.getCollection(ctx.params.id);
		if (!collection) {
			return { error: "Collection not found", status: 404 };
		}

		const products = await controller.getCollectionProducts({
			collectionId: ctx.params.id,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});

		const total = await controller.countCollectionProducts(ctx.params.id);

		return { products, total };
	},
);
