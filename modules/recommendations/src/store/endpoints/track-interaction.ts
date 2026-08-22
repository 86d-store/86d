import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { RecommendationController } from "../../service";

export const trackInteraction = createStoreEndpoint(
	"/recommendations/track",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			type: z.enum(["view", "purchase", "add_to_cart"]),
			productName: z.string().max(500).transform(sanitizeText),
			productSlug: z.string().max(500).transform(sanitizeText),
			productImage: z
				.string()
				.max(2000)
				.optional()
				.transform((s) => (s === undefined ? undefined : sanitizeText(s))),
			productPrice: z.number().min(0).optional(),
			productCategory: z.string().max(200).transform(sanitizeText).optional(),
			sessionId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;
		const customerId = ctx.context.session?.user.id;

		try {
			const interaction = await controller.trackInteraction({
				productId: ctx.body.productId,
				customerId,
				sessionId: !customerId ? ctx.body.sessionId : undefined,
				type: ctx.body.type,
				productName: ctx.body.productName,
				productSlug: ctx.body.productSlug,
				productImage: ctx.body.productImage,
				productPrice: ctx.body.productPrice,
				productCategory: ctx.body.productCategory,
			});
			return { interaction };
		} catch {
			return { error: "Failed to track interaction", status: 400 };
		}
	},
);
