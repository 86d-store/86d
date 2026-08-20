import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CollectionController } from "../../service";

export const getCollectionProducts = createStoreEndpoint(
	"/collections/:slug/products",
	{
		method: "GET",
		params: z.object({
			slug: z.string().max(200),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const collection = await controller.getCollectionBySlug(ctx.params.slug);
		if (!collection?.isActive) {
			return { error: "Collection not found", status: 404 };
		}

		const products = await controller.getCollectionProducts({
			collectionId: collection.id,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});

		const totalCount = await controller.countCollectionProducts(collection.id);

		return { products, totalCount };
	},
);
