import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { TicketController } from "../../service";
import {
	getAuthenticatedTicketCustomer,
	isTicketOwnedByUser,
} from "./_ownership";

export const customerReply = createStoreEndpoint(
	"/tickets/:id/reply",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
		}),
		body: z.object({
			body: z.string().min(1).max(5000).transform(sanitizeText),
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

		if (ticket.status === "closed") {
			return { error: "Ticket is closed", status: 400 };
		}

		const customer = getAuthenticatedTicketCustomer(session.user);
		const message = await controller.addMessage({
			ticketId: ticket.id,
			body: ctx.body.body,
			authorType: "customer",
			authorId: session.user.id,
			authorName: customer.customerName,
			authorEmail: customer.customerEmail,
		});

		return { message };
	},
);
