import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TicketController } from "../../service";

export const reopenTicket = createAdminEndpoint(
	"/admin/tickets/:id/reopen",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const ticket = await controller.reopenTicket(ctx.params.id);

		return { ticket };
	},
);
