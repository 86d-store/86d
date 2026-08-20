import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminSendInvoice = createAdminEndpoint(
	"/admin/invoices/:id/send",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const invoice = await controller.send(ctx.params.id);
		if (!invoice) {
			return {
				error: "Invoice not found or not in draft status",
				status: 422,
			};
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("invoice.sent", {
				invoiceId: invoice.id,
				invoiceNumber: invoice.invoiceNumber,
				email: invoice.guestEmail,
				customerName: invoice.customerName,
				total: invoice.total,
				currency: invoice.currency,
				dueDate: invoice.dueDate,
			});
		}

		return { invoice };
	},
);
