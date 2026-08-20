import { createAdminEndpoint } from "@86d-app/core/api";
import type { TicketController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/tickets/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const stats = await controller.getStats();

		return { stats };
	},
);
