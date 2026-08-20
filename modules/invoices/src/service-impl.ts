import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	CreateInvoiceParams,
	CreditNote,
	CreditNoteLineItem,
	CreditNoteWithItems,
	Invoice,
	InvoiceController,
	InvoiceLineItem,
	InvoicePayment,
	InvoiceStatus,
	InvoiceWithDetails,
} from "./service";

type DataRecord = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PAYMENT_TERMS_DAYS: Record<string, number> = {
	due_on_receipt: 0,
	net_7: 7,
	net_15: 15,
	net_30: 30,
	net_45: 45,
	net_60: 60,
	net_90: 90,
};

let invoiceSeq = 0;
let creditNoteSeq = 0;

function generateInvoiceNumber(): string {
	invoiceSeq++;
	const now = new Date();
	const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
	return `INV-${date}-${String(invoiceSeq).padStart(4, "0")}`;
}

function generateCreditNoteNumber(): string {
	creditNoteSeq++;
	const now = new Date();
	const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
	return `CN-${date}-${String(creditNoteSeq).padStart(4, "0")}`;
}

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function calculateDueDate(issuedAt: Date, paymentTerms: string): Date {
	const days = PAYMENT_TERMS_DAYS[paymentTerms] ?? 0;
	const due = new Date(issuedAt);
	due.setDate(due.getDate() + days);
	return due;
}

function calculateTotal(params: CreateInvoiceParams): {
	subtotal: number;
	total: number;
	amountDue: number;
} {
	const subtotal = params.subtotal;
	const tax = params.taxAmount ?? 0;
	const shipping = params.shippingAmount ?? 0;
	const discount = params.discountAmount ?? 0;
	const total = subtotal + tax + shipping - discount;
	return { subtotal, total, amountDue: total };
}

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

export function createInvoiceController(
	data: ModuleDataService,
): InvoiceController {
	/* ---- helpers to hydrate composite types ---- */

	async function hydrateInvoice(invoice: Invoice): Promise<InvoiceWithDetails> {
		const lineItems = (await data.findMany("invoiceLineItem", {
			where: { invoiceId: invoice.id },
		})) as InvoiceLineItem[];
		lineItems.sort((a, b) => a.sortOrder - b.sortOrder);

		const payments = (await data.findMany("invoicePayment", {
			where: { invoiceId: invoice.id },
		})) as InvoicePayment[];
		payments.sort(
			(a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
		);

		const creditNotes = (await data.findMany("creditNote", {
			where: { invoiceId: invoice.id },
		})) as CreditNote[];
		creditNotes.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		return { ...invoice, lineItems, payments, creditNotes };
	}

	async function hydrateCreditNote(
		cn: CreditNote,
	): Promise<CreditNoteWithItems> {
		const lineItems = (await data.findMany("creditNoteLineItem", {
			where: { creditNoteId: cn.id },
		})) as CreditNoteLineItem[];
		lineItems.sort((a, b) => a.sortOrder - b.sortOrder);
		return { ...cn, lineItems };
	}

	async function recalculateAmounts(invoiceId: string): Promise<void> {
		const invoice = (await data.get("invoice", invoiceId)) as Invoice | null;
		if (!invoice) return;

		const payments = (await data.findMany("invoicePayment", {
			where: { invoiceId },
		})) as InvoicePayment[];

		const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
		const amountDue = invoice.total - amountPaid;

		let status: InvoiceStatus = invoice.status;
		if (amountPaid >= invoice.total) {
			status = "paid";
		} else if (amountPaid > 0) {
			status = "partially_paid";
		} else if (
			invoice.status === "paid" ||
			invoice.status === "partially_paid"
		) {
			status = "sent";
		}

		await data.upsert("invoice", invoiceId, {
			...invoice,
			amountPaid,
			amountDue: Math.max(0, amountDue),
			status,
			updatedAt: new Date(),
		} as DataRecord);
	}

	/* ---- controller ---- */

	return {
		/* ============================================================ */
		/*  Invoice CRUD                                                 */
		/* ============================================================ */

		async create(params) {
			const id = generateId();
			const invoiceNumber = generateInvoiceNumber();
			const { subtotal, total, amountDue } = calculateTotal(params);
			const paymentTerms = params.paymentTerms ?? "due_on_receipt";
			const now = new Date();

			const invoice: Record<string, unknown> = {
				id,
				invoiceNumber,
				orderId: params.orderId,
				customerId: params.customerId,
				guestEmail: params.guestEmail,
				customerName: params.customerName,
				status: "draft" as const,
				paymentTerms,
				subtotal,
				taxAmount: params.taxAmount ?? 0,
				shippingAmount: params.shippingAmount ?? 0,
				discountAmount: params.discountAmount ?? 0,
				total,
				amountPaid: 0,
				amountDue,
				currency: params.currency ?? "USD",
				billingAddress: params.billingAddress,
				notes: params.notes,
				internalNotes: params.internalNotes,
				metadata: params.metadata,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("invoice", id, invoice as DataRecord);

			for (let i = 0; i < params.lineItems.length; i++) {
				const li = params.lineItems[i];
				const lineItemId = generateId();
				await data.upsert("invoiceLineItem", lineItemId, {
					id: lineItemId,
					invoiceId: id,
					description: li.description,
					quantity: li.quantity,
					unitPrice: li.unitPrice,
					amount: li.quantity * li.unitPrice,
					sku: li.sku,
					productId: li.productId,
					sortOrder: i,
					createdAt: now,
				} as DataRecord);
			}

			return invoice as unknown as Invoice;
		},

		async getById(id) {
			const invoice = (await data.get("invoice", id)) as Invoice | null;
			if (!invoice) return null;
			return hydrateInvoice(invoice);
		},

		async getByNumber(invoiceNumber) {
			const all = (await data.findMany("invoice", {
				where: { invoiceNumber },
			})) as Invoice[];
			if (all.length === 0) return null;
			return hydrateInvoice(all[0]);
		},

		async list(params) {
			const {
				limit = 20,
				offset = 0,
				status,
				search,
				customerId,
				orderId,
			} = params ?? {};
			const where: Record<string, unknown> = {};
			if (status) where.status = status;
			if (customerId) where.customerId = customerId;
			if (orderId) where.orderId = orderId;

			let all = (await data.findMany(
				"invoice",
				Object.keys(where).length > 0 ? { where } : undefined,
			)) as Invoice[];

			if (search) {
				const q = search.toLowerCase();
				all = all.filter(
					(inv) =>
						inv.invoiceNumber.toLowerCase().includes(q) ||
						inv.guestEmail?.toLowerCase().includes(q) ||
						inv.customerName?.toLowerCase().includes(q),
				);
			}

			all.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return {
				invoices: all.slice(offset, offset + limit),
				total: all.length,
			};
		},

		async listForCustomer(customerId, params) {
			const { limit = 20, offset = 0 } = params ?? {};
			const all = (await data.findMany("invoice", {
				where: { customerId },
			})) as Invoice[];
			all.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
			return {
				invoices: all.slice(offset, offset + limit),
				total: all.length,
			};
		},

		async update(id, params) {
			const invoice = (await data.get("invoice", id)) as Invoice | null;
			if (!invoice) return null;
			if (invoice.status !== "draft") return null;

			const updated = {
				...invoice,
				...params,
				updatedAt: new Date(),
			};
			await data.upsert("invoice", id, updated as DataRecord);
			return updated as unknown as Invoice;
		},

		async delete(id) {
			const lineItems = (await data.findMany("invoiceLineItem", {
				where: { invoiceId: id },
			})) as InvoiceLineItem[];
			for (const li of lineItems) {
				await data.delete("invoiceLineItem", li.id);
			}

			const payments = (await data.findMany("invoicePayment", {
				where: { invoiceId: id },
			})) as InvoicePayment[];
			for (const p of payments) {
				await data.delete("invoicePayment", p.id);
			}

			const creditNotes = (await data.findMany("creditNote", {
				where: { invoiceId: id },
			})) as CreditNote[];
			for (const cn of creditNotes) {
				const cnItems = (await data.findMany("creditNoteLineItem", {
					where: { creditNoteId: cn.id },
				})) as CreditNoteLineItem[];
				for (const item of cnItems) {
					await data.delete("creditNoteLineItem", item.id);
				}
				await data.delete("creditNote", cn.id);
			}

			await data.delete("invoice", id);
		},

		/* ============================================================ */
		/*  Lifecycle                                                    */
		/* ============================================================ */

		async send(id) {
			const invoice = (await data.get("invoice", id)) as Invoice | null;
			if (!invoice) return null;
			if (invoice.status !== "draft") return null;

			const now = new Date();
			const dueDate = calculateDueDate(now, invoice.paymentTerms);

			const updated = {
				...invoice,
				status: "sent" as const,
				issuedAt: now,
				dueDate,
				updatedAt: now,
			};
			await data.upsert("invoice", id, updated as DataRecord);
			return updated as unknown as Invoice;
		},

		async markViewed(id) {
			const invoice = (await data.get("invoice", id)) as Invoice | null;
			if (!invoice) return null;
			if (invoice.status !== "sent") return null;

			const updated = {
				...invoice,
				status: "viewed" as const,
				updatedAt: new Date(),
			};
			await data.upsert("invoice", id, updated as DataRecord);
			return updated as unknown as Invoice;
		},

		async markOverdue(id) {
			const invoice = (await data.get("invoice", id)) as Invoice | null;
			if (!invoice) return null;
			if (
				invoice.status !== "sent" &&
				invoice.status !== "viewed" &&
				invoice.status !== "partially_paid"
			)
				return null;

			const updated = {
				...invoice,
				status: "overdue" as const,
				updatedAt: new Date(),
			};
			await data.upsert("invoice", id, updated as DataRecord);
			return updated as unknown as Invoice;
		},

		async voidInvoice(id) {
			const invoice = (await data.get("invoice", id)) as Invoice | null;
			if (!invoice) return null;
			if (invoice.status === "void") return null;

			const updated = {
				...invoice,
				status: "void" as const,
				amountDue: 0,
				updatedAt: new Date(),
			};
			await data.upsert("invoice", id, updated as DataRecord);
			return updated as unknown as Invoice;
		},

		/* ============================================================ */
		/*  Line items                                                   */
		/* ============================================================ */

		async getLineItems(invoiceId) {
			const items = (await data.findMany("invoiceLineItem", {
				where: { invoiceId },
			})) as InvoiceLineItem[];
			items.sort((a, b) => a.sortOrder - b.sortOrder);
			return items;
		},

		async addLineItem(invoiceId, item) {
			const invoice = (await data.get("invoice", invoiceId)) as Invoice | null;
			if (!invoice) throw new Error("Invoice not found");
			if (invoice.status !== "draft")
				throw new Error("Can only add items to draft invoices");

			const existing = (await data.findMany("invoiceLineItem", {
				where: { invoiceId },
			})) as InvoiceLineItem[];

			const id = generateId();
			const amount = item.quantity * item.unitPrice;
			const lineItem: Record<string, unknown> = {
				id,
				invoiceId,
				description: item.description,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				amount,
				sku: item.sku,
				productId: item.productId,
				sortOrder: existing.length,
				createdAt: new Date(),
			};
			await data.upsert("invoiceLineItem", id, lineItem as DataRecord);

			const newSubtotal = invoice.subtotal + amount;
			const newTotal =
				newSubtotal +
				invoice.taxAmount +
				invoice.shippingAmount -
				invoice.discountAmount;
			await data.upsert("invoice", invoiceId, {
				...invoice,
				subtotal: newSubtotal,
				total: newTotal,
				amountDue: newTotal - invoice.amountPaid,
				updatedAt: new Date(),
			} as DataRecord);

			return lineItem as unknown as InvoiceLineItem;
		},

		async removeLineItem(lineItemId) {
			const lineItem = (await data.get(
				"invoiceLineItem",
				lineItemId,
			)) as InvoiceLineItem | null;
			if (!lineItem) return;

			const invoice = (await data.get(
				"invoice",
				lineItem.invoiceId,
			)) as Invoice | null;
			if (invoice && invoice.status === "draft") {
				const newSubtotal = invoice.subtotal - lineItem.amount;
				const newTotal =
					newSubtotal +
					invoice.taxAmount +
					invoice.shippingAmount -
					invoice.discountAmount;
				await data.upsert("invoice", invoice.id, {
					...invoice,
					subtotal: newSubtotal,
					total: newTotal,
					amountDue: newTotal - invoice.amountPaid,
					updatedAt: new Date(),
				} as DataRecord);
			}

			await data.delete("invoiceLineItem", lineItemId);
		},

		/* ============================================================ */
		/*  Payments                                                     */
		/* ============================================================ */

		async recordPayment(params) {
			const invoice = (await data.get(
				"invoice",
				params.invoiceId,
			)) as Invoice | null;
			if (!invoice) throw new Error("Invoice not found");
			if (invoice.status === "void")
				throw new Error("Cannot record payment on void invoice");
			if (invoice.status === "draft")
				throw new Error("Cannot record payment on draft invoice");

			const id = generateId();
			const payment: Record<string, unknown> = {
				id,
				invoiceId: params.invoiceId,
				amount: params.amount,
				method: params.method,
				reference: params.reference,
				notes: params.notes,
				paidAt: params.paidAt ?? new Date(),
				createdAt: new Date(),
			};
			await data.upsert("invoicePayment", id, payment as DataRecord);

			await recalculateAmounts(params.invoiceId);

			return payment as unknown as InvoicePayment;
		},

		async listPayments(invoiceId) {
			const payments = (await data.findMany("invoicePayment", {
				where: { invoiceId },
			})) as InvoicePayment[];
			payments.sort(
				(a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
			);
			return payments;
		},

		async deletePayment(paymentId) {
			const payment = (await data.get(
				"invoicePayment",
				paymentId,
			)) as InvoicePayment | null;
			if (!payment) return;

			await data.delete("invoicePayment", paymentId);
			await recalculateAmounts(payment.invoiceId);
		},

		/* ============================================================ */
		/*  Credit notes                                                 */
		/* ============================================================ */

		async createCreditNote(params) {
			const invoice = (await data.get(
				"invoice",
				params.invoiceId,
			)) as Invoice | null;
			if (!invoice) throw new Error("Invoice not found");

			const id = generateId();
			const creditNoteNumber = generateCreditNoteNumber();
			const amount = params.lineItems.reduce(
				(sum, li) => sum + li.quantity * li.unitPrice,
				0,
			);
			const now = new Date();

			const creditNote: Record<string, unknown> = {
				id,
				invoiceId: params.invoiceId,
				creditNoteNumber,
				status: "draft" as const,
				amount,
				reason: params.reason,
				notes: params.notes,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("creditNote", id, creditNote as DataRecord);

			for (let i = 0; i < params.lineItems.length; i++) {
				const li = params.lineItems[i];
				const lineItemId = generateId();
				await data.upsert("creditNoteLineItem", lineItemId, {
					id: lineItemId,
					creditNoteId: id,
					description: li.description,
					quantity: li.quantity,
					unitPrice: li.unitPrice,
					amount: li.quantity * li.unitPrice,
					sortOrder: i,
					createdAt: now,
				} as DataRecord);
			}

			return creditNote as unknown as CreditNote;
		},

		async getCreditNote(id) {
			const cn = (await data.get("creditNote", id)) as CreditNote | null;
			if (!cn) return null;
			return hydrateCreditNote(cn);
		},

		async listCreditNotes(invoiceId) {
			const all = (await data.findMany("creditNote", {
				where: { invoiceId },
			})) as CreditNote[];
			all.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
			const hydrated: CreditNoteWithItems[] = [];
			for (const cn of all) {
				hydrated.push(await hydrateCreditNote(cn));
			}
			return hydrated;
		},

		async issueCreditNote(id) {
			const cn = (await data.get("creditNote", id)) as CreditNote | null;
			if (!cn) return null;
			if (cn.status !== "draft") return null;

			const updated = {
				...cn,
				status: "issued" as const,
				issuedAt: new Date(),
				updatedAt: new Date(),
			};
			await data.upsert("creditNote", id, updated as DataRecord);
			return updated as unknown as CreditNote;
		},

		async applyCreditNote(id) {
			const cn = (await data.get("creditNote", id)) as CreditNote | null;
			if (!cn) return null;
			if (cn.status !== "issued") return null;

			const updated = {
				...cn,
				status: "applied" as const,
				updatedAt: new Date(),
			};
			await data.upsert("creditNote", id, updated as DataRecord);

			// Record as a payment on the invoice
			const paymentId = generateId();
			await data.upsert("invoicePayment", paymentId, {
				id: paymentId,
				invoiceId: cn.invoiceId,
				amount: cn.amount,
				method: "store_credit",
				reference: `Credit Note ${cn.creditNoteNumber}`,
				notes: cn.reason,
				paidAt: new Date(),
				createdAt: new Date(),
			} as DataRecord);

			await recalculateAmounts(cn.invoiceId);

			return updated as unknown as CreditNote;
		},

		async voidCreditNote(id) {
			const cn = (await data.get("creditNote", id)) as CreditNote | null;
			if (!cn) return null;
			if (cn.status === "void" || cn.status === "applied") return null;

			const updated = {
				...cn,
				status: "void" as const,
				updatedAt: new Date(),
			};
			await data.upsert("creditNote", id, updated as DataRecord);
			return updated as unknown as CreditNote;
		},

		/* ============================================================ */
		/*  Bulk operations                                              */
		/* ============================================================ */

		async bulkUpdateStatus(ids, status) {
			let updated = 0;
			for (const id of ids) {
				const invoice = (await data.get("invoice", id)) as Invoice | null;
				if (!invoice) continue;
				await data.upsert("invoice", id, {
					...invoice,
					status,
					updatedAt: new Date(),
				} as DataRecord);
				updated++;
			}
			return { updated };
		},

		async bulkDelete(ids) {
			let deleted = 0;
			for (const id of ids) {
				const invoice = (await data.get("invoice", id)) as Invoice | null;
				if (!invoice) continue;
				await this.delete(id);
				deleted++;
			}
			return { deleted };
		},

		/* ============================================================ */
		/*  Lookups                                                      */
		/* ============================================================ */

		async getByOrder(orderId) {
			const all = (await data.findMany("invoice", {
				where: { orderId },
			})) as Invoice[];
			if (all.length === 0) return null;
			return hydrateInvoice(all[0]);
		},

		async getByTracking(invoiceNumber, email) {
			const all = (await data.findMany("invoice", {
				where: { invoiceNumber },
			})) as Invoice[];
			if (all.length === 0) return null;

			const invoice = all[0];
			const invoiceEmail = invoice.guestEmail?.toLowerCase();
			if (invoiceEmail !== email.toLowerCase()) return null;

			return hydrateInvoice(invoice);
		},

		/* ============================================================ */
		/*  Overdue detection                                            */
		/* ============================================================ */

		async findOverdue() {
			const candidates = (await data.findMany("invoice")) as Invoice[];
			const now = new Date();
			return candidates.filter((inv) => {
				if (
					inv.status !== "sent" &&
					inv.status !== "viewed" &&
					inv.status !== "partially_paid"
				)
					return false;
				if (!inv.dueDate) return false;
				return new Date(inv.dueDate) < now;
			});
		},
	};
}
