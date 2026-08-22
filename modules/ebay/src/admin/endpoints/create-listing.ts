import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { EbayController } from "../../service";

export const createListingEndpoint = createAdminEndpoint(
	"/admin/ebay/listings/create",
	{
		method: "POST",
		body: z.object({
			localProductId: z.string().min(1).max(200),
			title: z.string().min(1).max(500).transform(sanitizeText),
			price: z.number().min(0),
			listingType: z.enum(["fixed-price", "auction"]).optional(),
			auctionStartPrice: z.number().min(0).optional(),
			quantity: z.number().int().min(0).optional(),
			condition: z
				.enum([
					"new",
					"like-new",
					"very-good",
					"good",
					"acceptable",
					"for-parts",
				])
				.optional(),
			categoryId: z.string().max(200).optional(),
			duration: z.string().max(50).optional(),
			metadata: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.ebay as EbayController;
		const listing = await controller.createListing({
			localProductId: ctx.body.localProductId,
			title: ctx.body.title,
			price: ctx.body.price,
			listingType: ctx.body.listingType,
			auctionStartPrice: ctx.body.auctionStartPrice,
			quantity: ctx.body.quantity,
			condition: ctx.body.condition,
			categoryId: ctx.body.categoryId,
			duration: ctx.body.duration,
			metadata: ctx.body.metadata,
		});
		return { listing };
	},
);
