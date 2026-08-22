import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TicketController } from "../../service";

export const getTicket = createAdminEndpoint(
	"/admin/tickets/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const ticket = await controller.getTicket(ctx.params.id);
		if (!ticket) {
			return { error: "Ticket not found", status: 404 };
		}

		const messages = await controller.listMessages(ticket.id, {
			includeInternal: true,
		});

		return { ticket, messages };
	},
);
