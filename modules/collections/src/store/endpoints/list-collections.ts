import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CollectionController, CollectionType } from "../../service";

export const listCollections = createStoreEndpoint(
	"/collections",
	{
		method: "GET",
		query: z.object({
			type: z.enum(["manual", "automatic"]).optional(),
			featured: z.enum(["true", "false"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const params: Parameters<typeof controller.listCollections>[0] = {
			isActive: true,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.featured === "true") params.isFeatured = true;
		else if (ctx.query.featured === "false") params.isFeatured = false;
		if (ctx.query.type) params.type = ctx.query.type as CollectionType;

		const collections = await controller.listCollections(params);

		return { collections };
	},
);
