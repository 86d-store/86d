import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { TicketController } from "../../service";
import { getAuthenticatedTicketCustomer } from "./_ownership";

export const submitTicket = createStoreEndpoint(
	"/tickets/submit",
	{
		method: "POST",
		body: z.object({
			subject: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().min(1).max(5000).transform(sanitizeText),
			categoryId: z.string().max(200).optional(),
			customerEmail: z.string().email().max(320),
			customerName: z.string().min(1).max(200).transform(sanitizeText),
			orderId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;
		const sessionUser = ctx.context.session?.user;
		const customer = sessionUser
			? getAuthenticatedTicketCustomer(sessionUser)
			: {
					customerEmail: ctx.body.customerEmail,
					customerId: undefined,
					customerName: ctx.body.customerName,
				};

		const ticket = await controller.createTicket({
			...ctx.body,
			...customer,
		});

		return { ticket };
	},
);
