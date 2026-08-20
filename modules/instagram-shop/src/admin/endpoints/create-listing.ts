import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { InstagramShopController } from "../../service";

export const createListingEndpoint = createAdminEndpoint(
	"/admin/instagram-shop/listings/create",
	{
		method: "POST",
		body: z.object({
			localProductId: z.string().min(1).max(200).transform(sanitizeText),
			externalProductId: z.string().max(200).transform(sanitizeText).optional(),
			title: z.string().min(1).max(500).transform(sanitizeText),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			price: z.number().min(0).optional(),
			imageUrl: z.string().max(2000).transform(sanitizeText).optional(),
			status: z
				.enum(["draft", "pending", "active", "rejected", "suspended"])
				.optional(),
			syncStatus: z
				.enum(["pending", "synced", "failed", "outdated"])
				.optional(),
			metadata: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.instagramShop as InstagramShopController;
		const listing = await controller.createListing({
			localProductId: ctx.body.localProductId,
			externalProductId: ctx.body.externalProductId,
			title: ctx.body.title,
			description: ctx.body.description,
			price: ctx.body.price,
			imageUrl: ctx.body.imageUrl,
			status: ctx.body.status,
			syncStatus: ctx.body.syncStatus,
			metadata: ctx.body.metadata,
		});
		return { listing };
	},
);
