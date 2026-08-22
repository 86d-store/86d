import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ActivityPeriod, SocialProofController } from "../../service";

export const getTrending = createStoreEndpoint(
	"/social-proof/trending",
	{
		method: "GET",
		query: z.object({
			period: z.enum(["1h", "24h", "7d", "30d"]).optional(),
			take: z.coerce.number().int().min(1).max(50).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const products = await controller.getTrendingProducts({
			period: (ctx.query.period as ActivityPeriod | undefined) ?? "24h",
			take: ctx.query.take ?? 10,
			skip: ctx.query.skip ?? 0,
		});

		return { products };
	},
);
