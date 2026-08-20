import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminGetInvoice = createAdminEndpoint(
	"/admin/invoices/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const invoice = await controller.getById(ctx.params.id);
		if (!invoice) {
			return { error: "Invoice not found", status: 404 };
		}
		return { invoice };
	},
);
