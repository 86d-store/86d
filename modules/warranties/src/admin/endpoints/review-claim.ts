import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WarrantyController } from "../../service";

export const reviewClaim = createAdminEndpoint(
	"/admin/warranties/claims/:id/review",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			adminNotes: z.string().max(2000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.warranties as WarrantyController;
		const claim = await controller.reviewClaim(
			ctx.params.id,
			ctx.body.adminNotes,
		);
		if (!claim) {
			return { error: "Claim not found", status: 404 };
		}
		return { claim };
	},
);
