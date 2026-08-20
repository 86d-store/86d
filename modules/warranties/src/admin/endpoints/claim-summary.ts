import { createAdminEndpoint } from "@86d-app/core/api";
import type { WarrantyController } from "../../service";

export const claimSummary = createAdminEndpoint(
	"/admin/warranties/claims/summary",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.warranties as WarrantyController;
		const summary = await controller.getClaimSummary();
		return { summary };
	},
);
