import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminVoidInvoice = createAdminEndpoint(
	"/admin/invoices/:id/void",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const invoice = await controller.voidInvoice(ctx.params.id);
		if (!invoice) {
			return {
				error: "Invoice not found or already void",
				status: 422,
			};
		}

		if (ctx.context.events) {
			await ctx.context.events.emit("invoice.voided", {
				invoiceId: invoice.id,
				invoiceNumber: invoice.invoiceNumber,
			});
		}

		return { invoice };
	},
);
