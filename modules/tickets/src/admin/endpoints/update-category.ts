import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TicketController } from "../../service";

export const updateCategory = createAdminEndpoint(
	"/admin/tickets/categories/:id",
	{
		method: "PUT",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().min(1).optional(),
			slug: z.string().min(1).optional(),
			description: z.string().optional(),
			position: z.number().optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const category = await controller.updateCategory(ctx.params.id, ctx.body);

		return { category };
	},
);
