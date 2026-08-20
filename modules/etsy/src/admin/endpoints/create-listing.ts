import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { EtsyController } from "../../service";

export const createListingEndpoint = createAdminEndpoint(
	"/admin/etsy/listings/create",
	{
		method: "POST",
		body: z.object({
			localProductId: z.string().min(1).max(200),
			etsyListingId: z.string().max(50).optional(),
			title: z.string().min(1).max(500).transform(sanitizeText),
			description: z.string().max(10000).transform(sanitizeText).optional(),
			status: z
				.enum(["active", "draft", "expired", "inactive", "sold-out"])
				.optional(),
			state: z.enum(["draft", "active", "inactive"]).optional(),
			price: z.number().min(0),
			quantity: z.number().int().min(0).optional(),
			whoMadeIt: z.enum(["i-did", "collective", "someone-else"]).optional(),
			whenMadeIt: z.string().max(100).optional(),
			isSupply: z.boolean().optional(),
			materials: z.array(z.string().max(100)).max(13).optional(),
			tags: z.array(z.string().max(100)).max(13).optional(),
			taxonomyId: z.string().max(50).optional(),
			shippingProfileId: z.string().max(50).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.etsy as EtsyController;
		const listing = await controller.createListing({
			localProductId: ctx.body.localProductId,
			etsyListingId: ctx.body.etsyListingId,
			title: ctx.body.title,
			description: ctx.body.description,
			status: ctx.body.status,
			state: ctx.body.state,
			price: ctx.body.price,
			quantity: ctx.body.quantity,
			whoMadeIt: ctx.body.whoMadeIt,
			whenMadeIt: ctx.body.whenMadeIt,
			isSupply: ctx.body.isSupply,
			materials: ctx.body.materials,
			tags: ctx.body.tags,
			taxonomyId: ctx.body.taxonomyId,
			shippingProfileId: ctx.body.shippingProfileId,
		});
		return { listing };
	},
);
