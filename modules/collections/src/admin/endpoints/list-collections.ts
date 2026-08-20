import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CollectionController, CollectionType } from "../../service";

export const listCollections = createAdminEndpoint(
	"/admin/collections",
	{
		method: "GET",
		query: z.object({
			type: z.enum(["manual", "automatic"]).optional(),
			isActive: z.enum(["true", "false"]).optional(),
			isFeatured: z.enum(["true", "false"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const listParams: Parameters<typeof controller.listCollections>[0] = {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.isActive === "true") listParams.isActive = true;
		else if (ctx.query.isActive === "false") listParams.isActive = false;
		if (ctx.query.isFeatured === "true") listParams.isFeatured = true;
		else if (ctx.query.isFeatured === "false") listParams.isFeatured = false;
		if (ctx.query.type) listParams.type = ctx.query.type as CollectionType;

		const collections = await controller.listCollections(listParams);

		const countParams: Parameters<typeof controller.countCollections>[0] = {};
		if (ctx.query.isActive === "true") countParams.isActive = true;
		else if (ctx.query.isActive === "false") countParams.isActive = false;
		if (ctx.query.isFeatured === "true") countParams.isFeatured = true;
		else if (ctx.query.isFeatured === "false") countParams.isFeatured = false;
		if (ctx.query.type) countParams.type = ctx.query.type as CollectionType;

		const total = await controller.countCollections(countParams);

		return { collections, total };
	},
);
