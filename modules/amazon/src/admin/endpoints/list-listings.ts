import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type {
	AmazonController,
	FulfillmentChannel,
	ListingStatus,
} from "../../service";

export const listListingsEndpoint = createAdminEndpoint(
	"/admin/amazon/listings",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["active", "inactive", "suppressed", "incomplete"])
				.optional(),
			fulfillmentChannel: z.enum(["FBA", "FBM"]).optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		// Fetch all matching for accurate total count, then slice for page
		const all = await controller.listListings({
			status: ctx.query.status as ListingStatus | undefined,
			fulfillmentChannel: ctx.query.fulfillmentChannel as
				| FulfillmentChannel
				| undefined,
		});
		const total = all.length;
		const listings = all.slice(skip, skip + limit);
		return { listings, total };
	},
);
