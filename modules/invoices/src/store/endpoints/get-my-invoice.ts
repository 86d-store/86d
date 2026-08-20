import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const getMyInvoice = createStoreEndpoint(
	"/invoices/me/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.invoice as InvoiceController;
		const invoice = await controller.getById(ctx.params.id);

		if (!invoice || invoice.customerId !== userId) {
			return { error: "Invoice not found", status: 404 };
		}

		// Mark as viewed when customer opens it
		if (invoice.status === "sent") {
			await controller.markViewed(invoice.id);
		}

		return { invoice };
	},
);
