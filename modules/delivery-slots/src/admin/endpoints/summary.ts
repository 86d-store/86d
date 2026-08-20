import { createAdminEndpoint } from "@86d-app/core/api";
import type { DeliverySlotsController } from "../../service";

export const summary = createAdminEndpoint(
	"/admin/delivery-slots/summary",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const summaryData = await controller.getSummary();
		return { summary: summaryData };
	},
);
