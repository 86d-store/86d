import { createAdminEndpoint } from "@86d-app/core/api";
import type { CheckoutController } from "../../service";

export const adminGetStats = createAdminEndpoint(
	"/admin/checkout/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.checkout as CheckoutController;
		return controller.getStats();
	},
);
