import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { AmazonController } from "../../service";

export const createListingEndpoint = createAdminEndpoint(
	"/admin/amazon/listings/create",
	{
		method: "POST",
		body: z.object({
			localProductId: z.string().min(1).max(200),
			asin: z.string().max(20).optional(),
			sku: z.string().min(1).max(200),
			title: z.string().min(1).max(500).transform(sanitizeText),
			status: z
				.enum(["active", "inactive", "suppressed", "incomplete"])
				.optional(),
			fulfillmentChannel: z.enum(["FBA", "FBM"]).optional(),
			price: z.number().min(0),
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
			metadata: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const listing = await controller.createListing({
			localProductId: ctx.body.localProductId,
			asin: ctx.body.asin,
			sku: ctx.body.sku,
			title: ctx.body.title,
			status: ctx.body.status,
			fulfillmentChannel: ctx.body.fulfillmentChannel,
			price: ctx.body.price,
			quantity: ctx.body.quantity,
			condition: ctx.body.condition,
			buyBoxOwned: ctx.body.buyBoxOwned,
			metadata: ctx.body.metadata,
		});
		return { listing };
	},
);
