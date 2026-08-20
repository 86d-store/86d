import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { ActivityEventType, SocialProofController } from "../../service";

export const trackEvent = createStoreEndpoint(
	"/social-proof/track",
	{
		method: "POST",
		body: z.object({
			productId: z.string().min(1).max(200),
			productName: z.string().min(1).max(500).transform(sanitizeText),
			productSlug: z.string().min(1).max(500).transform(sanitizeText),
			productImage: z
				.string()
				.max(2000)
				.optional()
				.transform((s) => (s === undefined ? undefined : sanitizeText(s))),
			eventType: z.enum(["purchase", "view", "cart_add", "wishlist_add"]),
			region: z.string().max(200).transform(sanitizeText).optional(),
			country: z.string().max(100).transform(sanitizeText).optional(),
			city: z.string().max(200).transform(sanitizeText).optional(),
			quantity: z.number().int().min(1).max(10000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const event = await controller.recordEvent({
			productId: ctx.body.productId,
			productName: ctx.body.productName,
			productSlug: ctx.body.productSlug,
			productImage: ctx.body.productImage,
			eventType: ctx.body.eventType as ActivityEventType,
			region: ctx.body.region,
			country: ctx.body.country,
			city: ctx.body.city,
			quantity: ctx.body.quantity,
		});

		return { event };
	},
);
