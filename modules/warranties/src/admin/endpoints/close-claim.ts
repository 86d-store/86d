import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WarrantyController } from "../../service";

export const closeClaim = createAdminEndpoint(
	"/admin/warranties/claims/:id/close",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.warranties as WarrantyController;
		const claim = await controller.closeClaim(ctx.params.id);
		if (!claim) {
			return { error: "Claim not found", status: 404 };
		}
		return { claim };
	},
);
