import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { InvoiceController } from "../../service";

export const trackInvoice = createStoreEndpoint(
	"/invoices/track",
	{
		method: "POST",
		body: z.object({
			invoiceNumber: z
				.string()
				.min(1)
				.transform((v) => v.trim()),
			email: z
				.string()
				.email()
				.transform((v) => v.toLowerCase().trim()),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const { invoiceNumber, email } = ctx.body;

		const invoice = await controller.getByTracking(invoiceNumber, email);
		if (!invoice) {
			return { error: "Invoice not found", status: 404 };
		}

		// Mark as viewed when guest looks it up
		if (invoice.status === "sent") {
			await controller.markViewed(invoice.id);
		}

		return { invoice };
	},
);
