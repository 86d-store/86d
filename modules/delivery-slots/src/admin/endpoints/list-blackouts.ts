import { createAdminEndpoint } from "@86d-store/core/api";
import type { DeliverySlotsController } from "../../service";

export const listBlackoutsAdmin = createAdminEndpoint(
	"/admin/delivery-slots/blackouts",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const blackouts = await controller.listBlackouts();
		return { blackouts };
	},
);
