import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type {
	TicketController,
	TicketPriority,
	TicketStatus,
} from "../../service";

export const listTickets = createAdminEndpoint(
	"/admin/tickets",
	{
		method: "GET",
		query: z
			.object({
				status: z.string().optional(),
				priority: z.string().optional(),
				categoryId: z.string().optional(),
				assigneeId: z.string().optional(),
				customerEmail: z.string().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;
		const { query = {} } = ctx;

		const tickets = await controller.listTickets({
			status: query.status as TicketStatus | undefined,
			priority: query.priority as TicketPriority | undefined,
			categoryId: query.categoryId,
			assigneeId: query.assigneeId,
			customerEmail: query.customerEmail,
		});

		return { tickets };
	},
);
