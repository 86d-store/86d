import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TicketController } from "../../service";

export const customerTickets = createStoreEndpoint(
	"/tickets/mine",
	{
		method: "GET",
		query: z.object({}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.tickets as TicketController;
		const ticketsByCustomerId = session.user.id
			? await controller.listTickets({
					customerId: session.user.id,
				})
			: [];
		const ticketsByEmail = await controller.listTickets({
			customerEmail: session.user.email,
		});
		const tickets = [
			...ticketsByCustomerId,
			...ticketsByEmail.filter(
				(ticket) =>
					!ticket.customerId &&
					!ticketsByCustomerId.some((candidate) => candidate.id === ticket.id),
			),
		];

		return { tickets };
	},
);
