import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { EbayController } from "../../service";

export const updateListingEndpoint = createAdminEndpoint(
	"/admin/ebay/listings/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			title: z.string().min(1).max(500).transform(sanitizeText).optional(),
			price: z.number().min(0).optional(),
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
			ebayItemId: z.string().max(200).optional(),
			status: z.enum(["active", "ended", "sold", "draft", "error"]).optional(),
			metadata: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.ebay as EbayController;
		const listing = await controller.updateListing(ctx.params.id, {
			title: ctx.body.title,
			price: ctx.body.price,
			quantity: ctx.body.quantity,
			condition: ctx.body.condition,
			categoryId: ctx.body.categoryId,
			duration: ctx.body.duration,
			ebayItemId: ctx.body.ebayItemId,
			status: ctx.body.status,
			metadata: ctx.body.metadata,
		});
		return { listing };
	},
);
