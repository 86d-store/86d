import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SearchController } from "../../service";

export const indexItem = createAdminEndpoint(
	"/admin/search/index",
	{
		method: "POST",
		body: z.object({
			entityType: z.string().min(1).max(100),
			entityId: z.string().min(1).max(200),
			title: z.string().min(1).max(500),
			body: z.string().max(10000).optional(),
			tags: z.array(z.string().max(100)).max(50).optional(),
			url: z.string().min(1).max(500),
			image: z.string().max(500).optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const item = await controller.indexItem(ctx.body);
		return { item };
	},
);

export const removeFromIndex = createAdminEndpoint(
	"/admin/search/index/remove",
	{
		method: "POST",
		body: z.object({
			entityType: z.string().min(1).max(100),
			entityId: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const removed = await controller.removeFromIndex(
			ctx.body.entityType,
			ctx.body.entityId,
		);
		return { removed };
	},
);
