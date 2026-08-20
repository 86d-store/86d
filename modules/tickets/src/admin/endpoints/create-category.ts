import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TicketController } from "../../service";

export const createCategory = createAdminEndpoint(
	"/admin/tickets/categories/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1),
			slug: z.string().min(1),
			description: z.string().optional(),
			position: z.number().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const category = await controller.createCategory(ctx.body);

		return { category };
	},
);
