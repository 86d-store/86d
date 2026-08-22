import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ActivityPeriod, SocialProofController } from "../../service";

export const getProductActivity = createStoreEndpoint(
	"/social-proof/activity/:productId",
	{
		method: "GET",
		params: z.object({ productId: z.string().max(200) }),
		query: z.object({
			period: z.enum(["1h", "24h", "7d", "30d"]).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const activity = await controller.getProductActivity(ctx.params.productId, {
			period: (ctx.query.period as ActivityPeriod | undefined) ?? "24h",
		});

		return { activity };
	},
);
