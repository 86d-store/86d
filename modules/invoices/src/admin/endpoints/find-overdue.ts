import { createAdminEndpoint } from "@86d-app/core/api";
import type { InvoiceController } from "../../service";

export const adminFindOverdue = createAdminEndpoint(
	"/admin/invoices/overdue",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const invoices = await controller.findOverdue();
		return { invoices, total: invoices.length };
	},
);
