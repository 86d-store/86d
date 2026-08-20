import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

const billingAddressSchema = z.object({
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
});

export const adminCreateInvoice = createAdminEndpoint(
	"/admin/invoices/create",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().optional(),
			customerId: z.string().optional(),
			guestEmail: z.string().email().optional(),
			customerName: z.string().max(200).transform(sanitizeText).optional(),
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
			subtotal: z.number().int().min(0),
			taxAmount: z.number().int().min(0).optional(),
			shippingAmount: z.number().int().min(0).optional(),
			discountAmount: z.number().int().min(0).optional(),
			currency: z.string().max(3).optional(),
			billingAddress: billingAddressSchema.optional(),
			notes: z.string().max(5000).transform(sanitizeText).optional(),
			internalNotes: z.string().max(5000).transform(sanitizeText).optional(),
			lineItems: z
				.array(
					z.object({
						description: z.string().min(1).max(500).transform(sanitizeText),
						quantity: z.number().int().min(1),
						unitPrice: z.number().int().min(0),
						sku: z.string().max(100).transform(sanitizeText).optional(),
						productId: z.string().optional(),
					}),
				)
				.min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.invoice as InvoiceController;

		const invoice = await controller.create(ctx.body);
		return { invoice };
	},
);
