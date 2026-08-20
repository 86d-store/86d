import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CollectionController } from "../../service";

export const getFeatured = createStoreEndpoint(
	"/collections/featured",
	{
		method: "GET",
		query: z.object({
			limit: z.coerce.number().int().min(1).max(20).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const collections = await controller.getFeaturedCollections(
			ctx.query.limit ?? 10,
		);

		return { collections };
	},
);
