import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FacebookShopController } from "../../service";

export const listSyncsEndpoint = createAdminEndpoint(
	"/admin/facebook-shop/syncs",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.facebookShop as FacebookShopController;
		const limit = ctx.query.limit ?? 20;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listSyncs({});
		const total = all.length;
		const syncs = all.slice(skip, skip + limit);
		return { syncs, total };
	},
);
