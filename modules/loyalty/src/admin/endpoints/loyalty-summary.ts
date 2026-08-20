import { createAdminEndpoint } from "@86d-app/core/api";
import type { LoyaltyController } from "../../service";

export const loyaltySummary = createAdminEndpoint(
	"/admin/loyalty/summary",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const summary = await controller.getSummary();
		return summary;
	},
);
