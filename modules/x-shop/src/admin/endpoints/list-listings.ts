import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { XShopController } from "../../service";

export const listListingsEndpoint = createAdminEndpoint(
	"/admin/x-shop/listings",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["draft", "pending", "active", "rejected", "suspended"])
				.optional(),
			syncStatus: z
				.enum(["pending", "synced", "failed", "outdated"])
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const limit = ctx.query.limit ?? 20;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listListings({
			status: ctx.query.status,
			syncStatus: ctx.query.syncStatus,
		});
		const total = all.length;
		const listings = all.slice(skip, skip + limit);
		return { listings, total };
	},
);
