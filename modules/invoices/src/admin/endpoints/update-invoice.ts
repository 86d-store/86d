import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const adminUpdateInvoice = createAdminEndpoint(
	"/admin/invoices/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			customerName: z.string().max(200).transform(sanitizeText).optional(),
			guestEmail: z.string().email().optional(),
			paymentTerms: z
				.enum([
					"due_on_receipt",
					"net_7",
					"net_15",
					"net_30",
					"net_45",
					"net_60",
					"net_90",
				])
				.optional(),
			billingAddress: z
				.object({
					firstName: z.string().max(100).transform(sanitizeText),
					lastName: z.string().max(100).transform(sanitizeText),
					company: z.string().max(200).transform(sanitizeText).optional(),
					line1: z.string().max(200).transform(sanitizeText),
					line2: z.string().max(200).transform(sanitizeText).optional(),
					city: z.string().max(100).transform(sanitizeText),
					state: z.string().max(100).transform(sanitizeText),
					postalCode: z.string().max(20).transform(sanitizeText),
					country: z.string().max(100).transform(sanitizeText),
					phone: z.string().max(30).transform(sanitizeText).optional(),
				})
				.optional(),
			notes: z.string().max(5000).transform(sanitizeText).optional(),
			internalNotes: z.string().max(5000).transform(sanitizeText).optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;
		const invoice = await controller.update(ctx.params.id, ctx.body);
		if (!invoice) {
			return {
				error: "Invoice not found or not in draft status",
				status: 404,
			};
		}
		return { invoice };
	},
);
