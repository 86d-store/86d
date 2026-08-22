import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TicketController } from "../../service";

export const updateTicket = createAdminEndpoint(
	"/admin/tickets/:id/update",
	{
		method: "PUT",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			subject: z.string().min(1).optional(),
			categoryId: z.string().optional(),
			status: z
				.enum(["open", "pending", "in-progress", "resolved", "closed"])
				.optional(),
			priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
			assigneeId: z.string().optional(),
			assigneeName: z.string().optional(),
			tags: z.array(z.string()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const ticket = await controller.updateTicket(ctx.params.id, ctx.body);

		return { ticket };
	},
);
