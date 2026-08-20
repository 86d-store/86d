import { createAdminEndpoint } from "@86d-app/core/api";
import type { StoreCreditController } from "../../service";

export const creditSummary = createAdminEndpoint(
	"/admin/store-credits/summary",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"store-credits"
		] as StoreCreditController;
		return controller.getSummary();
	},
);
