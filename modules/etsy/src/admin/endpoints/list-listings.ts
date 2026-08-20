import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { EtsyController, ListingStatus } from "../../service";

export const listListingsEndpoint = createAdminEndpoint(
	"/admin/etsy/listings",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["active", "draft", "expired", "inactive", "sold-out"])
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.etsy as EtsyController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listListings({
			status: ctx.query.status as ListingStatus | undefined,
		});
		const total = all.length;
		const listings = all.slice(skip, skip + limit);
		return { listings, total };
	},
);
