import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CollectionController } from "../../service";

export const getProductCollections = createStoreEndpoint(
	"/collections/product/:productId",
	{
		method: "GET",
		params: z.object({
			productId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const collections = await controller.getCollectionsForProduct(
			ctx.params.productId,
		);

		return { collections };
	},
);
