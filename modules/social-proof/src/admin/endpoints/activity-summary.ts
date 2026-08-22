import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ActivityPeriod, SocialProofController } from "../../service";

export const activitySummary = createAdminEndpoint(
	"/admin/social-proof/summary",
	{
		method: "GET",
		query: z.object({
			period: z.enum(["1h", "24h", "7d", "30d"]).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const summary = await controller.getActivitySummary({
			period: (ctx.query.period as ActivityPeriod | undefined) ?? "24h",
		});

		return { summary };
	},
);
