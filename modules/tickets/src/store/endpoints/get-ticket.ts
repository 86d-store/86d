import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TicketController } from "../../service";
import { isTicketOwnedByUser } from "./_ownership";

export const getTicket = createStoreEndpoint(
	"/tickets/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().max(200),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.tickets as TicketController;

		const ticket = await controller.getTicket(ctx.params.id);
		if (!ticket) {
			return { error: "Ticket not found", status: 404 };
		}

		// Verify ownership — return 404 to avoid leaking existence
		if (!isTicketOwnedByUser(ticket, session.user)) {
			return { error: "Ticket not found", status: 404 };
		}

		const messages = await controller.listMessages(ticket.id, {
			includeInternal: false,
		});

		return { ticket, messages };
	},
);
