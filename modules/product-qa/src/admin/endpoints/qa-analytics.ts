import { createAdminEndpoint } from "@86d-app/core/api";
import type { ProductQaController } from "../../service";

export const qaAnalytics = createAdminEndpoint(
	"/admin/product-qa/analytics",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const analytics = await controller.getQaAnalytics();
		return { analytics };
	},
);
