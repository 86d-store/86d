import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { AmazonController } from "../../service";

export const updateListingEndpoint = createAdminEndpoint(
	"/admin/amazon/listings/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			asin: z.string().max(20).optional(),
			sku: z.string().min(1).max(200).optional(),
			title: z.string().min(1).max(500).transform(sanitizeText).optional(),
			status: z
				.enum(["active", "inactive", "suppressed", "incomplete"])
				.optional(),
			fulfillmentChannel: z.enum(["FBA", "FBM"]).optional(),
			price: z.number().min(0).optional(),
			quantity: z.number().int().min(0).optional(),
			condition: z
				.enum([
					"new",
					"used-like-new",
					"used-very-good",
					"used-good",
					"used-acceptable",
					"refurbished",
				])
				.optional(),
			buyBoxOwned: z.boolean().optional(),
			error: z.string().max(1000).optional().nullable(),
			metadata: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const listing = await controller.updateListing(ctx.params.id, {
			asin: ctx.body.asin,
			sku: ctx.body.sku,
			title: ctx.body.title,
			status: ctx.body.status,
			fulfillmentChannel: ctx.body.fulfillmentChannel,
			price: ctx.body.price,
			quantity: ctx.body.quantity,
			condition: ctx.body.condition,
			buyBoxOwned: ctx.body.buyBoxOwned,
			error: ctx.body.error ?? undefined,
			metadata: ctx.body.metadata,
		});
		return { listing };
	},
);
