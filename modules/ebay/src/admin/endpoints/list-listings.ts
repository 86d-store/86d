import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { EbayController, ListingStatus, ListingType } from "../../service";

export const listListingsEndpoint = createAdminEndpoint(
	"/admin/ebay/listings",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["active", "ended", "sold", "draft", "error"]).optional(),
			listingType: z.enum(["fixed-price", "auction"]).optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.ebay as EbayController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listListings({
			status: ctx.query.status as ListingStatus | undefined,
			listingType: ctx.query.listingType as ListingType | undefined,
		});
		const total = all.length;
		const listings = all.slice(skip, skip + limit);
		return { listings, total };
	},
);
