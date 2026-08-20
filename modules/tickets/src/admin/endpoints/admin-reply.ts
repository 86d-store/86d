import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TicketController } from "../../service";

export const adminReply = createAdminEndpoint(
	"/admin/tickets/:id/reply",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			body: z.string().min(1).max(10000),
			authorId: z.string().optional(),
			authorName: z.string().min(1),
			isInternal: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const ticket = await controller.getTicket(ctx.params.id);
		if (!ticket) {
			return { error: "Ticket not found", status: 404 };
		}

		const message = await controller.addMessage({
			ticketId: ticket.id,
			body: ctx.body.body,
			authorType: "admin",
			authorId: ctx.body.authorId,
			authorName: ctx.body.authorName,
			isInternal: ctx.body.isInternal,
		});

		return { message };
	},
);
