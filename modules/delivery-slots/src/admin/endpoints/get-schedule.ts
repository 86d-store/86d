import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DeliverySlotsController } from "../../service";

export const getSchedule = createAdminEndpoint(
	"/admin/delivery-slots/:id",
	{ method: "GET", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const schedule = await controller.getSchedule(ctx.params.id);
		if (!schedule) return { error: "Schedule not found" };
		return { schedule };
	},
);
