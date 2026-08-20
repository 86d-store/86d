import { createAdminEndpoint } from "@86d-app/core/api";
import type { TicketController } from "../../service";

export const listCategories = createAdminEndpoint(
	"/admin/tickets/categories",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const categories = await controller.listCategories();

		return { categories };
	},
);
