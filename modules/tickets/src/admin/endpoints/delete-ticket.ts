import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TicketController } from "../../service";

export const deleteTicket = createAdminEndpoint(
	"/admin/tickets/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;
		const ok = await controller.deleteTicket(ctx.params.id);
		if (!ok) return { error: "Ticket not found" };
		return { success: true };
	},
);
