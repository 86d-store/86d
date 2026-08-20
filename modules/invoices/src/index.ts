import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { invoicesSchema } from "./schema";
import { createInvoiceController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export interface InvoicesOptions extends ModuleConfig {
	/** Default currency code. Default: "USD". */
	currency?: string;
	/** Default payment terms for new invoices. Default: "due_on_receipt". */
	defaultPaymentTerms?: string;
}

export default function invoices(options?: InvoicesOptions): Module {
	return {
		id: "invoices",
		version: "0.0.1",
		schema: invoicesSchema,

		requires: ["orders"],

		exports: {
			read: [
				"invoiceNumber",
				"invoiceStatus",
				"invoiceTotal",
				"invoiceAmountDue",
				"invoiceDueDate",
			],
		},

		events: {
			emits: [
				"invoice.created",
				"invoice.sent",
				"invoice.viewed",
				"invoice.paid",
				"invoice.partially_paid",
				"invoice.overdue",
				"invoice.voided",
				"invoice.payment_recorded",
				"credit_note.created",
				"credit_note.issued",
				"credit_note.applied",
				"credit_note.voided",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createInvoiceController(ctx.data);
			return {
				controllers: { invoice: controller },
			};
		},

		search: { store: "/invoices/store-search" },

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/invoices",
					component: "InvoiceList",
					label: "Invoices",
					icon: "Receipt",
					group: "Sales",
				},
				{
					path: "/admin/invoices/:id",
					component: "InvoiceDetail",
				},
				{
					path: "/admin/invoices/overdue",
					component: "OverdueList",
					label: "Overdue",
					icon: "Warning",
					group: "Sales",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/account/invoices",
					component: "InvoiceHistory",
				},
				{
					path: "/invoices/track",
					component: "InvoiceTracker",
				},
			],
		},

		options,
	};
}

export type {
	BillingAddress,
	CreateCreditNoteLineItemParams,
	CreateCreditNoteParams,
	CreateInvoiceParams,
	CreateLineItemParams,
	CreditNote,
	CreditNoteLineItem,
	CreditNoteStatus,
	CreditNoteWithItems,
	Invoice,
	InvoiceController,
	InvoiceLineItem,
	InvoicePayment,
	InvoiceStatus,
	InvoiceWithDetails,
	ListInvoiceParams,
	PaymentMethod,
	PaymentTerms,
	RecordPaymentParams,
	UpdateInvoiceParams,
} from "./service";
