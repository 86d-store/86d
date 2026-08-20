import { createAdminEndpoint } from "@86d-app/core/api";
import type { DeliverySlotsController } from "../../service";

export const listSchedules = createAdminEndpoint(
	"/admin/delivery-slots",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const params: import("../../service").ListSchedulesParams = {};
		const q = ctx.query as Record<string, string | undefined>;
		if (q.dayOfWeek != null) params.dayOfWeek = Number(q.dayOfWeek);
		if (q.active != null) params.active = q.active === "true";
		if (q.take != null) params.take = Number(q.take);
		if (q.skip != null) params.skip = Number(q.skip);
		const schedules = await controller.listSchedules(params);
		return { schedules };
	},
);
