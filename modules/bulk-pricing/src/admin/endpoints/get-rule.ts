import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BulkPricingController } from "../../service";

export const getRule = createAdminEndpoint(
	"/admin/bulk-pricing/rules/:id",
	{ method: "GET", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const rule = await controller.getRule(ctx.params.id);
		return { rule };
	},
);
