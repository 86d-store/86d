import { createAdminEndpoint } from "@86d-app/core/api";
import type { OrderNotesController } from "../../service";

export const notesSummary = createAdminEndpoint(
	"/admin/order-notes/summary",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.orderNotes as OrderNotesController;
		return controller.getSummary();
	},
);
