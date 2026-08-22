import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TicketController } from "../../service";

export const listMessages = createAdminEndpoint(
	"/admin/tickets/:id/messages",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const messages = await controller.listMessages(ctx.params.id, {
			includeInternal: true,
		});

		return { messages };
	},
);
