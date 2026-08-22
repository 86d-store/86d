import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TicketController } from "../../service";

export const deleteCategory = createAdminEndpoint(
	"/admin/tickets/categories/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		await controller.deleteCategory(ctx.params.id);

		return { success: true };
	},
);
