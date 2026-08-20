import { createAdminEndpoint } from "@86d-app/core/api";
import type { BulkPricingController } from "../../service";

export const summary = createAdminEndpoint(
	"/admin/bulk-pricing/summary",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const result = await controller.getSummary();
		return { summary: result };
	},
);
