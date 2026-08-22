import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ActivityEventType, SocialProofController } from "../../service";

export const adminListEvents = createAdminEndpoint(
	"/admin/social-proof/events",
	{
		method: "GET",
		query: z.object({
			productId: z.string().optional(),
			eventType: z
				.enum(["purchase", "view", "cart_add", "wishlist_add"])
				.optional(),
			take: z.coerce.number().int().min(1).max(200).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const [events, total] = await Promise.all([
			controller.listEvents({
				productId: ctx.query.productId,
				eventType: ctx.query.eventType as ActivityEventType | undefined,
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countEvents({
				productId: ctx.query.productId,
				eventType: ctx.query.eventType as ActivityEventType | undefined,
			}),
		]);

		return { events, total };
	},
);
