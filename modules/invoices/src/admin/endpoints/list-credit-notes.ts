import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminListCreditNotes = createAdminEndpoint(
	"/admin/invoices/:id/credit-notes",
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
		const creditNotes = await controller.listCreditNotes(ctx.params.id);
		return { creditNotes };
	},
);
