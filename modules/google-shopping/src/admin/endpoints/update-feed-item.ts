import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { GoogleShoppingController } from "../../service";

export const updateFeedItemEndpoint = createAdminEndpoint(
	"/admin/google-shopping/feed-items/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			googleProductId: z.string().max(200).optional(),
			title: z.string().min(1).max(500).transform(sanitizeText).optional(),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			status: z
				.enum(["active", "pending", "disapproved", "expiring"])
				.optional(),
			googleCategory: z.string().max(500).optional(),
			condition: z.enum(["new", "refurbished", "used"]).optional(),
			availability: z.enum(["in-stock", "out-of-stock", "preorder"]).optional(),
			price: z.number().min(0).optional(),
			salePrice: z.number().min(0).optional().nullable(),
			link: z.string().url().optional(),
			imageLink: z.string().url().optional(),
			gtin: z.string().max(50).optional(),
			mpn: z.string().max(100).optional(),
			brand: z.string().max(200).transform(sanitizeText).optional(),
			expiresAt: z.coerce.date().optional().nullable(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"google-shopping"
		] as GoogleShoppingController;
		const item = await controller.updateFeedItem(ctx.params.id, {
			googleProductId: ctx.body.googleProductId,
			title: ctx.body.title,
			description: ctx.body.description,
			status: ctx.body.status,
			googleCategory: ctx.body.googleCategory,
			condition: ctx.body.condition,
			availability: ctx.body.availability,
			price: ctx.body.price,
			salePrice: ctx.body.salePrice ?? undefined,
			link: ctx.body.link,
			imageLink: ctx.body.imageLink,
			gtin: ctx.body.gtin,
			mpn: ctx.body.mpn,
			brand: ctx.body.brand,
			expiresAt: ctx.body.expiresAt ?? undefined,
		});
		return { item };
	},
);
