import { createStoreEndpoint } from "@86d-app/core/api";
import type { TicketController } from "../../service";

export const listCategories = createStoreEndpoint(
	"/tickets/categories",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tickets as TicketController;

		const categories = await controller.listCategories({ activeOnly: true });

		return { categories };
	},
);
