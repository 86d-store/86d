import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { RecentlyViewedController } from "../../service";

export const trackView = createStoreEndpoint(
	"/recently-viewed/track",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			productName: z.string().max(500).transform(sanitizeText),
			productSlug: z.string().max(500).transform(sanitizeText),
			productImage: z
				.string()
				.max(2000)
				.optional()
				.transform((s) => (s === undefined ? undefined : sanitizeText(s))),
			productPrice: z.number().min(0).optional(),
			sessionId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recentlyViewed as RecentlyViewedController;
		const customerId = ctx.context.session?.user.id;

		const view = await controller.trackView({
			customerId,
			sessionId: !customerId ? ctx.body.sessionId : undefined,
			productId: ctx.body.productId,
			productName: ctx.body.productName,
			productSlug: ctx.body.productSlug,
			productImage: ctx.body.productImage,
			productPrice: ctx.body.productPrice,
		});
		return { view };
	},
);
