import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WarrantyController } from "../../service";

export const resolveClaim = createAdminEndpoint(
	"/admin/warranties/claims/:id/resolve",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			resolutionNotes: z.string().max(2000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.warranties as WarrantyController;
		const claim = await controller.resolveClaim(
			ctx.params.id,
			ctx.body.resolutionNotes,
		);
		if (!claim) {
			return { error: "Claim not found", status: 404 };
		}
		void ctx.context.events?.emit("claim.resolved", {
			claimId: claim.id,
			customerId: claim.customerId,
			warrantyRegistrationId: claim.warrantyRegistrationId,
		});
		return { claim };
	},
);
