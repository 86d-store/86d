import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BulkPricingController } from "../../service";

export const getTier = createAdminEndpoint(
	"/admin/bulk-pricing/tiers/:id",
	{ method: "GET", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const tier = await controller.getTier(ctx.params.id);
		return { tier };
	},
);
