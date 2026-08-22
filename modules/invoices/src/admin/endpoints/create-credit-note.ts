import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { InvoiceController } from "../../service";

export const adminCreateCreditNote = createAdminEndpoint(
	"/admin/invoices/:id/credit-notes/create",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			reason: z.string().max(1000).transform(sanitizeText).optional(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
			lineItems: z
				.array(
					z.object({
						description: z.string().min(1).max(500).transform(sanitizeText),
						quantity: z.number().int().min(1),
						unitPrice: z.number().int().min(0),
					}),
				)
				.min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const invoice = await controller.getById(ctx.params.id);
		if (!invoice) {
			return { error: "Invoice not found", status: 404 };
		}

		try {
			const creditNote = await controller.createCreditNote({
				invoiceId: ctx.params.id,
				reason: ctx.body.reason,
				notes: ctx.body.notes,
				lineItems: ctx.body.lineItems,
			});
			return { creditNote };
		} catch {
			return { error: "Failed to create credit note", status: 422 };
		}
	},
);
