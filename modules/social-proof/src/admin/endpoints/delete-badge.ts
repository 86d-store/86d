import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SocialProofController } from "../../service";

export const deleteBadge = createAdminEndpoint(
	"/admin/social-proof/badges/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const deleted = await controller.deleteBadge(ctx.params.id);

		if (!deleted) {
			return { error: "Badge not found", status: 404 };
		}

		return { success: true };
	},
);
