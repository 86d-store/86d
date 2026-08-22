import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BadgePosition, SocialProofController } from "../../service";

export const listBadges = createStoreEndpoint(
	"/social-proof/badges",
	{
		method: "GET",
		query: z.object({
			position: z
				.enum(["header", "footer", "product", "checkout", "cart"])
				.optional(),
			take: z.coerce.number().int().min(1).max(50).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const badges = await controller.listBadges({
			position: ctx.query.position as BadgePosition | undefined,
			isActive: true,
			take: ctx.query.take ?? 20,
			skip: ctx.query.skip ?? 0,
		});

		return { badges };
	},
);
