import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const invoicesInvoiceShape = z.object({
	id: z.string().register(col, { pk: true }),
	invoiceNumber: z.string().register(col, { unique: true }),
	orderId: z.string().register(col, { index: true }).optional(),
	customerId: z.string().register(col, { index: true }).optional(),
	guestEmail: z.string().optional(),
	customerName: z.string().optional(),
	status: z.enum([
		"draft",
		"sent",
		"viewed",
		"paid",
		"partially_paid",
		"overdue",
		"void",
	]),
	paymentTerms: z.enum([
		"due_on_receipt",
		"net_7",
		"net_15",
		"net_30",
		"net_45",
		"net_60",
		"net_90",
	]),
	issuedAt: z.coerce.date().optional(),
	dueDate: z.coerce.date().optional(),
	subtotal: z.number(),
	taxAmount: z.int().default(0),
	shippingAmount: z.int().default(0),
	discountAmount: z.int().default(0),
	total: z.number(),
	amountPaid: z.int().default(0),
	amountDue: z.number(),
	currency: z.string(),
	billingAddress: z.record(z.string(), z.unknown()).optional(),
	notes: z.string().optional(),
	internalNotes: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const invoicesInvoiceLineItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	invoiceId: z.string().register(col, {
		references: { table: "self.invoice", column: "id", onDelete: "cascade" },
	}),
	description: z.string(),
	quantity: z.number(),
	unitPrice: z.number(),
	amount: z.number(),
	sku: z.string().optional(),
	productId: z.string().optional(),
	sortOrder: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const invoicesInvoicePaymentShape = z.object({
	id: z.string().register(col, { pk: true }),
	invoiceId: z.string().register(col, {
		references: { table: "self.invoice", column: "id", onDelete: "cascade" },
	}),
	amount: z.number(),
	method: z.enum([
		"card",
		"bank_transfer",
		"cash",
		"check",
		"store_credit",
		"other",
	]),
	reference: z.string().optional(),
	notes: z.string().optional(),
	paidAt: z.coerce.date().default(() => new Date()),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const invoicesCreditNoteShape = z.object({
	id: z.string().register(col, { pk: true }),
	invoiceId: z.string().register(col, {
		references: { table: "self.invoice", column: "id", onDelete: "cascade" },
	}),
	creditNoteNumber: z.string().register(col, { unique: true }),
	status: z.enum(["draft", "issued", "applied", "void"]),
	amount: z.number(),
	reason: z.string().optional(),
	notes: z.string().optional(),
	issuedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const invoicesCreditNoteLineItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	creditNoteId: z.string().register(col, {
		references: {
			table: "self.creditNote",
			column: "id",
			onDelete: "cascade",
		},
	}),
	description: z.string(),
	quantity: z.number(),
	unitPrice: z.number(),
	amount: z.number(),
	sortOrder: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for invoices. */
export const invoicesStorage = {
	kind: "relational",
	tables: {
		invoice: {
			shape: invoicesInvoiceShape,
		},
		invoiceLineItem: {
			shape: invoicesInvoiceLineItemShape,
		},
		invoicePayment: {
			shape: invoicesInvoicePaymentShape,
		},
		creditNote: {
			shape: invoicesCreditNoteShape,
		},
		creditNoteLineItem: {
			shape: invoicesCreditNoteLineItemShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
