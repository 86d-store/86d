import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DeliverySlotsController } from "../../service";

export const deleteSchedule = createAdminEndpoint(
	"/admin/delivery-slots/:id/delete",
	{ method: "POST", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const deleted = await controller.deleteSchedule(ctx.params.id);
		return { deleted };
	},
);
