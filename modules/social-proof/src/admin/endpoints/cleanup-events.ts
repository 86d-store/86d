import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SocialProofController } from "../../service";

export const cleanupEvents = createAdminEndpoint(
	"/admin/social-proof/events/cleanup",
	{
		method: "POST",
		body: z.object({
			olderThanDays: z.number().int().min(1).max(365),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const deleted = await controller.cleanupEvents(ctx.body.olderThanDays);

		return { deleted, success: true };
	},
);
