import { createAdminEndpoint } from "@86d-store/core/api";
import type { DiscountController } from "../../service";

export const adminDiscountAnalytics = createAdminEndpoint(
	"/admin/discounts/analytics",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const analytics = await controller.getAnalytics();
		return { analytics };
	},
);
