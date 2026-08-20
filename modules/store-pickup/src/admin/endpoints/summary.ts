import { createAdminEndpoint } from "@86d-app/core/api";
import type { StorePickupController } from "../../service";

export const summary = createAdminEndpoint(
	"/admin/store-pickup/summary",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const summaryData = await controller.getSummary();
		return { summary: summaryData };
	},
);
