import { describe, expect, it, vi } from "vitest";
import { adminApplyCreditNote } from "../admin/endpoints/apply-credit-note";
import { adminBulkAction } from "../admin/endpoints/bulk-action";
import { adminCreateCreditNote } from "../admin/endpoints/create-credit-note";
import { adminCreateInvoice } from "../admin/endpoints/create-invoice";
import { adminDeleteInvoice } from "../admin/endpoints/delete-invoice";
import { adminDeletePayment } from "../admin/endpoints/delete-payment";
import { adminFindOverdue } from "../admin/endpoints/find-overdue";
import { adminGetCreditNote } from "../admin/endpoints/get-credit-note";
import { adminGetInvoice } from "../admin/endpoints/get-invoice";
import { adminIssueCreditNote } from "../admin/endpoints/issue-credit-note";
import { adminListCreditNotes } from "../admin/endpoints/list-credit-notes";
import { adminListInvoices } from "../admin/endpoints/list-invoices";
import { adminListPayments } from "../admin/endpoints/list-payments";
import { adminRecordPayment } from "../admin/endpoints/record-payment";
import { adminSendInvoice } from "../admin/endpoints/send-invoice";
import { adminUpdateInvoice } from "../admin/endpoints/update-invoice";
import { adminVoidCreditNote } from "../admin/endpoints/void-credit-note";
import { adminVoidInvoice } from "../admin/endpoints/void-invoice";
import type {
	CreditNote,
	CreditNoteWithItems,
	Invoice,
	InvoiceController,
	InvoicePayment,
	InvoiceWithDetails,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		invoiceNumber: "INV-001",
		status: "draft",
		paymentTerms: "net_30",
		subtotal: 10000,
		taxAmount: 800,
		shippingAmount: 0,
		discountAmount: 0,
		total: 10800,
		amountPaid: 0,
		amountDue: 10800,
		currency: "USD",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeInvoiceWithDetails(
	overrides: Partial<Invoice> = {},
): InvoiceWithDetails {
	return {
		...makeInvoice(overrides),
		lineItems: [],
		payments: [],
		creditNotes: [],
	};
}

function makePayment(overrides: Partial<InvoicePayment> = {}): InvoicePayment {
	return {
		id: crypto.randomUUID(),
		invoiceId: "inv-1",
		amount: 10800,
		method: "card",
		paidAt: new Date().toISOString(),
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

function makeCreditNote(overrides: Partial<CreditNote> = {}): CreditNote {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		invoiceId: "inv-1",
		creditNoteNumber: "CN-001",
		status: "draft",
		amount: 500,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCreditNoteWithItems(
	overrides: Partial<CreditNote> = {},
): CreditNoteWithItems {
	return { ...makeCreditNote(overrides), lineItems: [] };
}

function makeController(
	overrides: Partial<InvoiceController> = {},
): InvoiceController {
	return {
		create: vi.fn().mockResolvedValue(makeInvoice()),
		getById: vi.fn().mockResolvedValue(null),
		getByNumber: vi.fn().mockResolvedValue(null),
		list: vi.fn().mockResolvedValue({ invoices: [], total: 0 }),
		listForCustomer: vi.fn().mockResolvedValue({ invoices: [], total: 0 }),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(undefined),
		send: vi.fn().mockResolvedValue(null),
		markViewed: vi.fn().mockResolvedValue(null),
		markOverdue: vi.fn().mockResolvedValue(null),
		voidInvoice: vi.fn().mockResolvedValue(null),
		getLineItems: vi.fn().mockResolvedValue([]),
		addLineItem: vi.fn().mockResolvedValue(null),
		removeLineItem: vi.fn().mockResolvedValue(undefined),
		recordPayment: vi.fn().mockResolvedValue(makePayment()),
		listPayments: vi.fn().mockResolvedValue([]),
		deletePayment: vi.fn().mockResolvedValue(undefined),
		createCreditNote: vi.fn().mockResolvedValue(makeCreditNote()),
		getCreditNote: vi.fn().mockResolvedValue(null),
		listCreditNotes: vi.fn().mockResolvedValue([]),
		issueCreditNote: vi.fn().mockResolvedValue(null),
		applyCreditNote: vi.fn().mockResolvedValue(null),
		voidCreditNote: vi.fn().mockResolvedValue(null),
		bulkUpdateStatus: vi.fn().mockResolvedValue({ updated: 0 }),
		bulkDelete: vi.fn().mockResolvedValue({ deleted: 0 }),
		getByOrder: vi.fn().mockResolvedValue(null),
		getByTracking: vi.fn().mockResolvedValue(null),
		findOverdue: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, unknown>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: InvoiceController;
		context?: Record<string, unknown>;
	} = {},
) {
	return handler({
		query: opts.query ?? { page: 1, limit: 20 },
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { invoice: opts.controller ?? makeController() },
			...(opts.context ?? {}),
		},
	});
}

const listHandler = extractHandler(adminListInvoices);
const createHandler = extractHandler(adminCreateInvoice);
const getHandler = extractHandler(adminGetInvoice);
const updateHandler = extractHandler(adminUpdateInvoice);
const deleteHandler = extractHandler(adminDeleteInvoice);
const sendHandler = extractHandler(adminSendInvoice);
const voidHandler = extractHandler(adminVoidInvoice);
const recordPaymentHandler = extractHandler(adminRecordPayment);
const listPaymentsHandler = extractHandler(adminListPayments);
const deletePaymentHandler = extractHandler(adminDeletePayment);
const createCreditNoteHandler = extractHandler(adminCreateCreditNote);
const getCreditNoteHandler = extractHandler(adminGetCreditNote);
const listCreditNotesHandler = extractHandler(adminListCreditNotes);
const issueCreditNoteHandler = extractHandler(adminIssueCreditNote);
const applyCreditNoteHandler = extractHandler(adminApplyCreditNote);
const voidCreditNoteHandler = extractHandler(adminVoidCreditNote);
const findOverdueHandler = extractHandler(adminFindOverdue);
const bulkHandler = extractHandler(adminBulkAction);

describe("admin GET /invoices", () => {
	it("returns empty invoice list", async () => {
		const result = (await call(listHandler)) as {
			invoices: Invoice[];
			total: number;
		};
		expect(result.invoices).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { page: 1, limit: 20, status: "paid" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ status: "paid" }),
		);
	});
});

describe("admin POST /invoices/create", () => {
	it("creates invoice and returns it", async () => {
		const invoice = makeInvoice({ invoiceNumber: "INV-100" });
		const ctrl = makeController({ create: vi.fn().mockResolvedValue(invoice) });
		const result = (await call(createHandler, {
			body: {
				subtotal: 10000,
				lineItems: [{ description: "Service", quantity: 1, unitPrice: 10000 }],
			},
			controller: ctrl,
		})) as { invoice: Invoice };
		expect(result.invoice.invoiceNumber).toBe("INV-100");
	});

	it("calls controller.create with body params", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: {
				subtotal: 5000,
				currency: "EUR",
				lineItems: [{ description: "Product", quantity: 2, unitPrice: 2500 }],
			},
			controller: ctrl,
		});
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({ subtotal: 5000, currency: "EUR" }),
		);
	});
});

describe("admin GET /invoices/:id", () => {
	it("returns 404 when invoice not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns invoice when found", async () => {
		const invoice = makeInvoiceWithDetails({ id: "inv-1" });
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(invoice),
		});
		const result = (await call(getHandler, {
			params: { id: "inv-1" },
			controller: ctrl,
		})) as { invoice: InvoiceWithDetails };
		expect(result.invoice.id).toBe("inv-1");
	});
});

describe("admin PUT /invoices/:id/update", () => {
	it("returns 404 when invoice not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { customerName: "Acme" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates invoice and returns it", async () => {
		const invoice = makeInvoice({ customerName: "Acme Corp" });
		const ctrl = makeController({ update: vi.fn().mockResolvedValue(invoice) });
		const result = (await call(updateHandler, {
			params: { id: invoice.id },
			body: { customerName: "Acme Corp" },
			controller: ctrl,
		})) as { invoice: Invoice };
		expect(result.invoice.customerName).toBe("Acme Corp");
	});
});

describe("admin DELETE /invoices/:id/delete", () => {
	it("returns 404 when invoice not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns success after deletion", async () => {
		const invoice = makeInvoiceWithDetails();
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(invoice),
			delete: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteHandler, {
			params: { id: invoice.id },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin POST /invoices/:id/send", () => {
	it("returns 422 when invoice not in draft status", async () => {
		const result = (await call(sendHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(422);
	});

	it("sends invoice and returns updated invoice", async () => {
		const invoice = makeInvoice({ status: "sent" });
		const ctrl = makeController({ send: vi.fn().mockResolvedValue(invoice) });
		const result = (await call(sendHandler, {
			params: { id: invoice.id },
			controller: ctrl,
		})) as { invoice: Invoice };
		expect(result.invoice.status).toBe("sent");
	});
});

describe("admin POST /invoices/:id/void", () => {
	it("returns 422 when invoice not found", async () => {
		const result = (await call(voidHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(422);
	});

	it("voids invoice and returns it", async () => {
		const invoice = makeInvoice({ status: "void" });
		const ctrl = makeController({
			voidInvoice: vi.fn().mockResolvedValue(invoice),
		});
		const result = (await call(voidHandler, {
			params: { id: invoice.id },
			controller: ctrl,
		})) as { invoice: Invoice };
		expect(result.invoice.status).toBe("void");
	});
});

describe("admin POST /invoices/:id/payments/record", () => {
	it("returns 404 when invoice not found", async () => {
		const result = (await call(recordPaymentHandler, {
			params: { id: "missing" },
			body: { amount: 5000, method: "card" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("records payment and returns it", async () => {
		const invoice = makeInvoiceWithDetails();
		const payment = makePayment({ amount: 5000 });
		const updated = makeInvoiceWithDetails({ amountPaid: 5000 });
		const ctrl = makeController({
			getById: vi
				.fn()
				.mockResolvedValueOnce(invoice)
				.mockResolvedValueOnce(updated),
			recordPayment: vi.fn().mockResolvedValue(payment),
		});
		const result = (await call(recordPaymentHandler, {
			params: { id: invoice.id },
			body: { amount: 5000, method: "card" },
			controller: ctrl,
		})) as { payment: InvoicePayment };
		expect(result.payment.amount).toBe(5000);
	});
});

describe("admin GET /invoices/:id/payments", () => {
	it("returns 404 when invoice not found", async () => {
		const result = (await call(listPaymentsHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns payment list for invoice", async () => {
		const invoice = makeInvoiceWithDetails();
		const payment = makePayment();
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(invoice),
			listPayments: vi.fn().mockResolvedValue([payment]),
		});
		const result = (await call(listPaymentsHandler, {
			params: { id: invoice.id },
			controller: ctrl,
		})) as { payments: InvoicePayment[] };
		expect(result.payments).toHaveLength(1);
	});
});

describe("admin DELETE /invoices/payments/:id/delete", () => {
	it("returns success after payment deletion", async () => {
		const result = (await call(deletePaymentHandler, {
			params: { id: "pay-1" },
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});

	it("calls deletePayment with the payment id", async () => {
		const ctrl = makeController();
		await call(deletePaymentHandler, {
			params: { id: "pay-42" },
			controller: ctrl,
		});
		expect(ctrl.deletePayment).toHaveBeenCalledWith("pay-42");
	});
});

describe("admin POST /invoices/:id/credit-notes/create", () => {
	it("returns 404 when invoice not found", async () => {
		const result = (await call(createCreditNoteHandler, {
			params: { id: "missing" },
			body: {
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 500 }],
			},
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("creates credit note and returns it", async () => {
		const invoice = makeInvoiceWithDetails();
		const creditNote = makeCreditNote();
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(invoice),
			createCreditNote: vi.fn().mockResolvedValue(creditNote),
		});
		const result = (await call(createCreditNoteHandler, {
			params: { id: invoice.id },
			body: {
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 500 }],
			},
			controller: ctrl,
		})) as { creditNote: CreditNote };
		expect(result.creditNote.id).toBe(creditNote.id);
	});
});

describe("admin GET /credit-notes/:id", () => {
	it("returns 404 when credit note not found", async () => {
		const result = (await call(getCreditNoteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns credit note when found", async () => {
		const cn = makeCreditNoteWithItems();
		const ctrl = makeController({
			getCreditNote: vi.fn().mockResolvedValue(cn),
		});
		const result = (await call(getCreditNoteHandler, {
			params: { id: cn.id },
			controller: ctrl,
		})) as { creditNote: CreditNoteWithItems };
		expect(result.creditNote.id).toBe(cn.id);
	});
});

describe("admin GET /invoices/:id/credit-notes", () => {
	it("returns 404 when invoice not found", async () => {
		const result = (await call(listCreditNotesHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns credit notes for invoice", async () => {
		const invoice = makeInvoiceWithDetails();
		const cn = makeCreditNoteWithItems();
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(invoice),
			listCreditNotes: vi.fn().mockResolvedValue([cn]),
		});
		const result = (await call(listCreditNotesHandler, {
			params: { id: invoice.id },
			controller: ctrl,
		})) as { creditNotes: CreditNoteWithItems[] };
		expect(result.creditNotes).toHaveLength(1);
	});
});

describe("admin POST /credit-notes/:id/issue", () => {
	it("returns 422 when credit note not found", async () => {
		const result = (await call(issueCreditNoteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(422);
	});

	it("issues credit note and returns it", async () => {
		const cn = makeCreditNote({ status: "issued" });
		const ctrl = makeController({
			issueCreditNote: vi.fn().mockResolvedValue(cn),
		});
		const result = (await call(issueCreditNoteHandler, {
			params: { id: cn.id },
			controller: ctrl,
		})) as { creditNote: CreditNote };
		expect(result.creditNote.status).toBe("issued");
	});
});

describe("admin POST /credit-notes/:id/apply", () => {
	it("returns 422 when credit note not in issued status", async () => {
		const result = (await call(applyCreditNoteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(422);
	});

	it("applies credit note and returns it", async () => {
		const cn = makeCreditNote({ status: "applied" });
		const ctrl = makeController({
			applyCreditNote: vi.fn().mockResolvedValue(cn),
		});
		const result = (await call(applyCreditNoteHandler, {
			params: { id: cn.id },
			controller: ctrl,
		})) as { creditNote: CreditNote };
		expect(result.creditNote.status).toBe("applied");
	});
});

describe("admin POST /credit-notes/:id/void", () => {
	it("returns 422 when credit note cannot be voided", async () => {
		const result = (await call(voidCreditNoteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(422);
	});

	it("voids credit note and returns it", async () => {
		const cn = makeCreditNote({ status: "void" });
		const ctrl = makeController({
			voidCreditNote: vi.fn().mockResolvedValue(cn),
		});
		const result = (await call(voidCreditNoteHandler, {
			params: { id: cn.id },
			controller: ctrl,
		})) as { creditNote: CreditNote };
		expect(result.creditNote.status).toBe("void");
	});
});

describe("admin GET /invoices/overdue", () => {
	it("returns empty overdue list", async () => {
		const result = (await call(findOverdueHandler)) as {
			invoices: Invoice[];
			total: number;
		};
		expect(result.invoices).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns overdue invoices", async () => {
		const invoice = makeInvoice({ status: "overdue" });
		const ctrl = makeController({
			findOverdue: vi.fn().mockResolvedValue([invoice]),
		});
		const result = (await call(findOverdueHandler, { controller: ctrl })) as {
			invoices: Invoice[];
		};
		expect(result.invoices).toHaveLength(1);
	});
});

describe("admin POST /invoices/bulk", () => {
	it("bulk updates invoice statuses", async () => {
		const ctrl = makeController({
			bulkUpdateStatus: vi.fn().mockResolvedValue({ updated: 3 }),
		});
		const result = (await call(bulkHandler, {
			body: { action: "updateStatus", ids: ["i1", "i2", "i3"], status: "void" },
			controller: ctrl,
		})) as { updated: number };
		expect(result.updated).toBe(3);
	});

	it("bulk deletes invoices", async () => {
		const ctrl = makeController({
			bulkDelete: vi.fn().mockResolvedValue({ deleted: 2 }),
		});
		const result = (await call(bulkHandler, {
			body: { action: "delete", ids: ["i1", "i2"] },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(2);
	});
});
