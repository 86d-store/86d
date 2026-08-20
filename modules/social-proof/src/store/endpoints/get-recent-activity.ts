import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ActivityEventType, SocialProofController } from "../../service";

export const getRecentActivity = createStoreEndpoint(
	"/social-proof/recent",
	{
		method: "GET",
		query: z.object({
			eventType: z
				.enum(["purchase", "view", "cart_add", "wishlist_add"])
				.optional(),
			take: z.coerce.number().int().min(1).max(50).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const events = await controller.getRecentActivity({
			eventType: ctx.query.eventType as ActivityEventType | undefined,
			take: ctx.query.take ?? 10,
			skip: ctx.query.skip ?? 0,
		});

		return { events };
	},
);
