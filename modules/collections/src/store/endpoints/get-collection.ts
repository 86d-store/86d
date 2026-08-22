import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CollectionController } from "../../service";

export const getCollection = createStoreEndpoint(
	"/collections/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const collection = await controller.getCollectionBySlug(ctx.params.slug);
		if (!collection?.isActive) {
			return { error: "Collection not found", status: 404 };
		}

		const productCount = await controller.countCollectionProducts(
			collection.id,
		);

		return { collection, productCount };
	},
);
