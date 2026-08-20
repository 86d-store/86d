import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { InvoiceController } from "../service";
import { createInvoiceController } from "../service-impl";

const makeInvoice = (overrides?: Record<string, unknown>) => ({
	subtotal: 5000,
	lineItems: [
		{
			description: "Widget A",
			quantity: 2,
			unitPrice: 2500,
		},
	],
	...overrides,
});

describe("createInvoiceController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: InvoiceController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createInvoiceController(mockData);
	});

	// ── Invoice CRUD ──────────────────────────────────────────────

	describe("create", () => {
		it("creates an invoice with defaults", async () => {
			const invoice = await controller.create(makeInvoice());
			expect(invoice.id).toBeDefined();
			expect(invoice.invoiceNumber).toMatch(/^INV-/);
			expect(invoice.status).toBe("draft");
			expect(invoice.paymentTerms).toBe("due_on_receipt");
			expect(invoice.subtotal).toBe(5000);
			expect(invoice.total).toBe(5000);
			expect(invoice.amountPaid).toBe(0);
			expect(invoice.amountDue).toBe(5000);
			expect(invoice.currency).toBe("USD");
		});

		it("creates an invoice with custom payment terms", async () => {
			const invoice = await controller.create(
				makeInvoice({ paymentTerms: "net_30" }),
			);
			expect(invoice.paymentTerms).toBe("net_30");
		});

		it("creates an invoice with tax and shipping", async () => {
			const invoice = await controller.create(
				makeInvoice({
					taxAmount: 500,
					shippingAmount: 1000,
					discountAmount: 200,
				}),
			);
			expect(invoice.taxAmount).toBe(500);
			expect(invoice.shippingAmount).toBe(1000);
			expect(invoice.discountAmount).toBe(200);
			expect(invoice.total).toBe(5000 + 500 + 1000 - 200);
			expect(invoice.amountDue).toBe(6300);
		});

		it("creates an invoice with customer info", async () => {
			const invoice = await controller.create(
				makeInvoice({
					customerId: "cust_1",
					customerName: "Jane Doe",
					guestEmail: "jane@example.com",
				}),
			);
			expect(invoice.customerId).toBe("cust_1");
			expect(invoice.customerName).toBe("Jane Doe");
			expect(invoice.guestEmail).toBe("jane@example.com");
		});

		it("creates an invoice with an orderId", async () => {
			const invoice = await controller.create(
				makeInvoice({ orderId: "order_123" }),
			);
			expect(invoice.orderId).toBe("order_123");
		});

		it("creates line items", async () => {
			const invoice = await controller.create(
				makeInvoice({
					lineItems: [
						{ description: "Item A", quantity: 1, unitPrice: 3000 },
						{
							description: "Item B",
							quantity: 3,
							unitPrice: 1000,
							sku: "SKU-B",
						},
					],
				}),
			);
			const items = await controller.getLineItems(invoice.id);
			expect(items).toHaveLength(2);
			expect(items[0].description).toBe("Item A");
			expect(items[0].amount).toBe(3000);
			expect(items[1].description).toBe("Item B");
			expect(items[1].amount).toBe(3000);
			expect(items[1].sku).toBe("SKU-B");
		});

		it("generates unique invoice numbers", async () => {
			const inv1 = await controller.create(makeInvoice());
			const inv2 = await controller.create(makeInvoice());
			expect(inv1.invoiceNumber).not.toBe(inv2.invoiceNumber);
		});
	});

	describe("getById", () => {
		it("returns invoice with details", async () => {
			const created = await controller.create(makeInvoice());
			const invoice = await controller.getById(created.id);
			expect(invoice).not.toBeNull();
			expect(invoice?.invoiceNumber).toBe(created.invoiceNumber);
			expect(invoice?.lineItems).toHaveLength(1);
			expect(invoice?.payments).toHaveLength(0);
			expect(invoice?.creditNotes).toHaveLength(0);
		});

		it("returns null for missing invoice", async () => {
			const invoice = await controller.getById("nonexistent");
			expect(invoice).toBeNull();
		});
	});

	describe("getByNumber", () => {
		it("finds by invoice number", async () => {
			const created = await controller.create(makeInvoice());
			const invoice = await controller.getByNumber(created.invoiceNumber);
			expect(invoice).not.toBeNull();
			expect(invoice?.id).toBe(created.id);
		});

		it("returns null for unknown number", async () => {
			const invoice = await controller.getByNumber("INV-FAKE");
			expect(invoice).toBeNull();
		});
	});

	describe("list", () => {
		it("lists all invoices newest first", async () => {
			await controller.create(makeInvoice({ customerName: "First" }));
			await controller.create(makeInvoice({ customerName: "Second" }));
			const { invoices, total } = await controller.list();
			expect(total).toBe(2);
			expect(invoices).toHaveLength(2);
		});

		it("paginates results", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create(makeInvoice());
			}
			const { invoices, total } = await controller.list({
				limit: 2,
				offset: 0,
			});
			expect(total).toBe(5);
			expect(invoices).toHaveLength(2);
		});

		it("filters by status", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await controller.create(makeInvoice());

			const { invoices } = await controller.list({ status: "sent" });
			expect(invoices).toHaveLength(1);
		});

		it("searches by invoice number", async () => {
			const inv = await controller.create(makeInvoice());
			const { invoices } = await controller.list({
				search: inv.invoiceNumber,
			});
			expect(invoices).toHaveLength(1);
		});

		it("searches by customer name", async () => {
			await controller.create(makeInvoice({ customerName: "John Smith" }));
			await controller.create(makeInvoice({ customerName: "Jane Doe" }));
			const { invoices } = await controller.list({ search: "john" });
			expect(invoices).toHaveLength(1);
		});

		it("searches by email", async () => {
			await controller.create(makeInvoice({ guestEmail: "test@example.com" }));
			const { invoices } = await controller.list({ search: "test@" });
			expect(invoices).toHaveLength(1);
		});

		it("filters by customerId", async () => {
			await controller.create(makeInvoice({ customerId: "cust_1" }));
			await controller.create(makeInvoice({ customerId: "cust_2" }));
			const { invoices } = await controller.list({
				customerId: "cust_1",
			});
			expect(invoices).toHaveLength(1);
		});

		it("filters by orderId", async () => {
			await controller.create(makeInvoice({ orderId: "order_1" }));
			await controller.create(makeInvoice({ orderId: "order_2" }));
			const { invoices } = await controller.list({
				orderId: "order_1",
			});
			expect(invoices).toHaveLength(1);
		});
	});

	describe("listForCustomer", () => {
		it("lists invoices for specific customer", async () => {
			await controller.create(makeInvoice({ customerId: "cust_1" }));
			await controller.create(makeInvoice({ customerId: "cust_1" }));
			await controller.create(makeInvoice({ customerId: "cust_2" }));

			const { invoices, total } = await controller.listForCustomer("cust_1");
			expect(total).toBe(2);
			expect(invoices).toHaveLength(2);
		});
	});

	describe("update", () => {
		it("updates draft invoice fields", async () => {
			const inv = await controller.create(makeInvoice());
			const updated = await controller.update(inv.id, {
				customerName: "Updated Name",
				notes: "Important note",
			});
			expect(updated).not.toBeNull();
			expect(updated?.customerName).toBe("Updated Name");
			expect(updated?.notes).toBe("Important note");
		});

		it("returns null for non-draft invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const updated = await controller.update(inv.id, {
				customerName: "Nope",
			});
			expect(updated).toBeNull();
		});

		it("returns null for missing invoice", async () => {
			const updated = await controller.update("fake", {
				customerName: "Nope",
			});
			expect(updated).toBeNull();
		});
	});

	describe("delete", () => {
		it("deletes invoice and related records", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.delete(inv.id);
			const found = await controller.getById(inv.id);
			expect(found).toBeNull();
		});

		it("deletes line items when invoice is deleted", async () => {
			const inv = await controller.create(makeInvoice());
			const items = await controller.getLineItems(inv.id);
			expect(items).toHaveLength(1);

			await controller.delete(inv.id);
			const itemsAfter = await controller.getLineItems(inv.id);
			expect(itemsAfter).toHaveLength(0);
		});
	});

	// ── Lifecycle ─────────────────────────────────────────────────

	describe("send", () => {
		it("transitions draft to sent and sets dates", async () => {
			const inv = await controller.create(makeInvoice());
			const sent = await controller.send(inv.id);
			expect(sent).not.toBeNull();
			expect(sent?.status).toBe("sent");
			expect(sent?.issuedAt).toBeDefined();
			expect(sent?.dueDate).toBeDefined();
		});

		it("returns null for non-draft invoices", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const result = await controller.send(inv.id);
			expect(result).toBeNull();
		});

		it("calculates due date for net_30", async () => {
			const inv = await controller.create(
				makeInvoice({ paymentTerms: "net_30" }),
			);
			const sent = await controller.send(inv.id);
			expect(sent?.dueDate).toBeDefined();
			if (sent?.issuedAt && sent?.dueDate) {
				const issued = new Date(sent.issuedAt);
				const due = new Date(sent.dueDate);
				const daysDiff = Math.round(
					(due.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24),
				);
				expect(daysDiff).toBe(30);
			}
		});

		it("returns null for missing invoice", async () => {
			const result = await controller.send("fake");
			expect(result).toBeNull();
		});
	});

	describe("markViewed", () => {
		it("transitions sent to viewed", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const viewed = await controller.markViewed(inv.id);
			expect(viewed?.status).toBe("viewed");
		});

		it("returns null for non-sent invoices", async () => {
			const inv = await controller.create(makeInvoice());
			const result = await controller.markViewed(inv.id);
			expect(result).toBeNull();
		});
	});

	describe("markOverdue", () => {
		it("transitions sent to overdue", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const overdue = await controller.markOverdue(inv.id);
			expect(overdue?.status).toBe("overdue");
		});

		it("transitions viewed to overdue", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await controller.markViewed(inv.id);
			const overdue = await controller.markOverdue(inv.id);
			expect(overdue?.status).toBe("overdue");
		});

		it("returns null for draft invoices", async () => {
			const inv = await controller.create(makeInvoice());
			const result = await controller.markOverdue(inv.id);
			expect(result).toBeNull();
		});
	});

	describe("voidInvoice", () => {
		it("voids an invoice and zeroes amount due", async () => {
			const inv = await controller.create(makeInvoice());
			const voided = await controller.voidInvoice(inv.id);
			expect(voided?.status).toBe("void");
			expect(voided?.amountDue).toBe(0);
		});

		it("returns null for already void invoices", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.voidInvoice(inv.id);
			const result = await controller.voidInvoice(inv.id);
			expect(result).toBeNull();
		});
	});

	// ── Line items ────────────────────────────────────────────────

	describe("addLineItem", () => {
		it("adds a line item to a draft invoice", async () => {
			const inv = await controller.create(makeInvoice());
			const lineItem = await controller.addLineItem(inv.id, {
				description: "Extra Widget",
				quantity: 3,
				unitPrice: 1000,
			});
			expect(lineItem.description).toBe("Extra Widget");
			expect(lineItem.amount).toBe(3000);

			const items = await controller.getLineItems(inv.id);
			expect(items).toHaveLength(2);
		});

		it("updates invoice totals when adding item", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.addLineItem(inv.id, {
				description: "Extra",
				quantity: 1,
				unitPrice: 2000,
			});
			const updated = await controller.getById(inv.id);
			expect(updated?.subtotal).toBe(7000);
			expect(updated?.total).toBe(7000);
			expect(updated?.amountDue).toBe(7000);
		});

		it("throws for non-draft invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await expect(
				controller.addLineItem(inv.id, {
					description: "Nope",
					quantity: 1,
					unitPrice: 100,
				}),
			).rejects.toThrow("Can only add items to draft invoices");
		});

		it("throws for missing invoice", async () => {
			await expect(
				controller.addLineItem("fake", {
					description: "Nope",
					quantity: 1,
					unitPrice: 100,
				}),
			).rejects.toThrow("Invoice not found");
		});
	});

	describe("removeLineItem", () => {
		it("removes a line item and updates totals", async () => {
			const inv = await controller.create(
				makeInvoice({
					subtotal: 6000,
					lineItems: [
						{ description: "A", quantity: 1, unitPrice: 3000 },
						{ description: "B", quantity: 1, unitPrice: 3000 },
					],
				}),
			);
			const items = await controller.getLineItems(inv.id);
			await controller.removeLineItem(items[0].id);

			const remaining = await controller.getLineItems(inv.id);
			expect(remaining).toHaveLength(1);

			const updated = await controller.getById(inv.id);
			expect(updated?.subtotal).toBe(3000);
		});

		it("does nothing for missing line item", async () => {
			await controller.removeLineItem("nonexistent");
		});
	});

	// ── Payments ──────────────────────────────────────────────────

	describe("recordPayment", () => {
		it("records a payment and updates invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const payment = await controller.recordPayment({
				invoiceId: inv.id,
				amount: 3000,
				method: "card",
				reference: "txn_123",
			});
			expect(payment.amount).toBe(3000);
			expect(payment.method).toBe("card");
			expect(payment.reference).toBe("txn_123");

			const updated = await controller.getById(inv.id);
			expect(updated?.amountPaid).toBe(3000);
			expect(updated?.amountDue).toBe(2000);
			expect(updated?.status).toBe("partially_paid");
		});

		it("marks invoice as paid when fully paid", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 5000,
				method: "bank_transfer",
			});

			const updated = await controller.getById(inv.id);
			expect(updated?.status).toBe("paid");
			expect(updated?.amountDue).toBe(0);
		});

		it("handles overpayment gracefully", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 6000,
				method: "cash",
			});

			const updated = await controller.getById(inv.id);
			expect(updated?.status).toBe("paid");
			expect(updated?.amountDue).toBe(0);
		});

		it("throws for draft invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await expect(
				controller.recordPayment({
					invoiceId: inv.id,
					amount: 1000,
					method: "card",
				}),
			).rejects.toThrow("Cannot record payment on draft invoice");
		});

		it("throws for void invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.voidInvoice(inv.id);
			await expect(
				controller.recordPayment({
					invoiceId: inv.id,
					amount: 1000,
					method: "card",
				}),
			).rejects.toThrow("Cannot record payment on void invoice");
		});

		it("throws for missing invoice", async () => {
			await expect(
				controller.recordPayment({
					invoiceId: "fake",
					amount: 1000,
					method: "card",
				}),
			).rejects.toThrow("Invoice not found");
		});
	});

	describe("listPayments", () => {
		it("lists payments sorted by date", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 1000,
				method: "card",
			});
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 2000,
				method: "cash",
			});

			const payments = await controller.listPayments(inv.id);
			expect(payments).toHaveLength(2);
		});
	});

	describe("deletePayment", () => {
		it("deletes payment and recalculates amounts", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const payment = await controller.recordPayment({
				invoiceId: inv.id,
				amount: 3000,
				method: "card",
			});

			await controller.deletePayment(payment.id);

			const updated = await controller.getById(inv.id);
			expect(updated?.amountPaid).toBe(0);
			expect(updated?.amountDue).toBe(5000);
		});

		it("does nothing for missing payment", async () => {
			await controller.deletePayment("nonexistent");
		});
	});

	// ── Credit notes ──────────────────────────────────────────────

	describe("createCreditNote", () => {
		it("creates a credit note in draft status", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				reason: "Damaged item",
				lineItems: [
					{ description: "Refund Widget A", quantity: 1, unitPrice: 2500 },
				],
			});
			expect(cn.creditNoteNumber).toMatch(/^CN-/);
			expect(cn.status).toBe("draft");
			expect(cn.amount).toBe(2500);
			expect(cn.reason).toBe("Damaged item");
		});

		it("creates credit note with multiple items", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [
					{ description: "Item 1", quantity: 2, unitPrice: 1000 },
					{ description: "Item 2", quantity: 1, unitPrice: 500 },
				],
			});
			expect(cn.amount).toBe(2500);

			const detailed = await controller.getCreditNote(cn.id);
			expect(detailed?.lineItems).toHaveLength(2);
		});

		it("throws for missing invoice", async () => {
			await expect(
				controller.createCreditNote({
					invoiceId: "fake",
					lineItems: [{ description: "X", quantity: 1, unitPrice: 100 }],
				}),
			).rejects.toThrow("Invoice not found");
		});
	});

	describe("getCreditNote", () => {
		it("returns credit note with items", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 1000 }],
			});
			const detailed = await controller.getCreditNote(cn.id);
			expect(detailed).not.toBeNull();
			expect(detailed?.lineItems).toHaveLength(1);
		});

		it("returns null for missing credit note", async () => {
			const result = await controller.getCreditNote("fake");
			expect(result).toBeNull();
		});
	});

	describe("listCreditNotes", () => {
		it("lists credit notes for an invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "CN1", quantity: 1, unitPrice: 500 }],
			});
			await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "CN2", quantity: 1, unitPrice: 300 }],
			});

			const creditNotes = await controller.listCreditNotes(inv.id);
			expect(creditNotes).toHaveLength(2);
		});
	});

	describe("issueCreditNote", () => {
		it("transitions draft to issued", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 1000 }],
			});
			const issued = await controller.issueCreditNote(cn.id);
			expect(issued?.status).toBe("issued");
			expect(issued?.issuedAt).toBeDefined();
		});

		it("returns null for non-draft", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 1000 }],
			});
			await controller.issueCreditNote(cn.id);
			const result = await controller.issueCreditNote(cn.id);
			expect(result).toBeNull();
		});
	});

	describe("applyCreditNote", () => {
		it("applies credit and records payment on invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 2000 }],
			});
			await controller.issueCreditNote(cn.id);
			const applied = await controller.applyCreditNote(cn.id);
			expect(applied?.status).toBe("applied");

			const updated = await controller.getById(inv.id);
			expect(updated?.amountPaid).toBe(2000);
			expect(updated?.amountDue).toBe(3000);
			expect(updated?.status).toBe("partially_paid");
		});

		it("returns null for non-issued credit note", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 1000 }],
			});
			const result = await controller.applyCreditNote(cn.id);
			expect(result).toBeNull();
		});
	});

	describe("voidCreditNote", () => {
		it("voids a draft credit note", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "X", quantity: 1, unitPrice: 100 }],
			});
			const voided = await controller.voidCreditNote(cn.id);
			expect(voided?.status).toBe("void");
		});

		it("voids an issued credit note", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "X", quantity: 1, unitPrice: 100 }],
			});
			await controller.issueCreditNote(cn.id);
			const voided = await controller.voidCreditNote(cn.id);
			expect(voided?.status).toBe("void");
		});

		it("returns null for already void", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "X", quantity: 1, unitPrice: 100 }],
			});
			await controller.voidCreditNote(cn.id);
			const result = await controller.voidCreditNote(cn.id);
			expect(result).toBeNull();
		});

		it("returns null for applied credit note", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "X", quantity: 1, unitPrice: 100 }],
			});
			await controller.issueCreditNote(cn.id);
			await controller.applyCreditNote(cn.id);
			const result = await controller.voidCreditNote(cn.id);
			expect(result).toBeNull();
		});
	});

	// ── Bulk operations ───────────────────────────────────────────

	describe("bulkUpdateStatus", () => {
		it("updates status on multiple invoices", async () => {
			const inv1 = await controller.create(makeInvoice());
			const inv2 = await controller.create(makeInvoice());
			const { updated } = await controller.bulkUpdateStatus(
				[inv1.id, inv2.id],
				"void",
			);
			expect(updated).toBe(2);

			const i1 = await controller.getById(inv1.id);
			const i2 = await controller.getById(inv2.id);
			expect(i1?.status).toBe("void");
			expect(i2?.status).toBe("void");
		});

		it("skips missing invoices", async () => {
			const inv = await controller.create(makeInvoice());
			const { updated } = await controller.bulkUpdateStatus(
				[inv.id, "fake"],
				"void",
			);
			expect(updated).toBe(1);
		});
	});

	describe("bulkDelete", () => {
		it("deletes multiple invoices", async () => {
			const inv1 = await controller.create(makeInvoice());
			const inv2 = await controller.create(makeInvoice());
			const { deleted } = await controller.bulkDelete([inv1.id, inv2.id]);
			expect(deleted).toBe(2);

			const { total } = await controller.list();
			expect(total).toBe(0);
		});
	});

	// ── Lookups ───────────────────────────────────────────────────

	describe("getByOrder", () => {
		it("finds invoice by orderId", async () => {
			await controller.create(makeInvoice({ orderId: "order_1" }));
			const result = await controller.getByOrder("order_1");
			expect(result).not.toBeNull();
			expect(result?.orderId).toBe("order_1");
		});

		it("returns null for unknown orderId", async () => {
			const result = await controller.getByOrder("unknown");
			expect(result).toBeNull();
		});
	});

	describe("getByTracking", () => {
		it("finds invoice by number and email", async () => {
			const inv = await controller.create(
				makeInvoice({ guestEmail: "guest@example.com" }),
			);
			const result = await controller.getByTracking(
				inv.invoiceNumber,
				"guest@example.com",
			);
			expect(result).not.toBeNull();
		});

		it("is case insensitive for email", async () => {
			const inv = await controller.create(
				makeInvoice({ guestEmail: "Guest@Example.com" }),
			);
			const result = await controller.getByTracking(
				inv.invoiceNumber,
				"guest@example.com",
			);
			expect(result).not.toBeNull();
		});

		it("returns null for wrong email", async () => {
			const inv = await controller.create(
				makeInvoice({ guestEmail: "real@example.com" }),
			);
			const result = await controller.getByTracking(
				inv.invoiceNumber,
				"wrong@example.com",
			);
			expect(result).toBeNull();
		});
	});

	// ── Overdue detection ─────────────────────────────────────────

	describe("findOverdue", () => {
		it("finds invoices past due date", async () => {
			const inv = await controller.create(
				makeInvoice({ paymentTerms: "due_on_receipt" }),
			);
			// Send the invoice (sets dueDate to now for due_on_receipt)
			await controller.send(inv.id);

			// Manually set the due date to the past
			const invoice = (await mockData.get("invoice", inv.id)) as Record<
				string,
				unknown
			>;
			await mockData.upsert("invoice", inv.id, {
				...invoice,
				dueDate: new Date("2020-01-01"),
			});

			const overdue = await controller.findOverdue();
			expect(overdue.length).toBeGreaterThanOrEqual(1);
		});

		it("does not include draft invoices", async () => {
			await controller.create(makeInvoice());
			const overdue = await controller.findOverdue();
			expect(overdue).toHaveLength(0);
		});

		it("does not include paid invoices", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 5000,
				method: "card",
			});

			// Set due date in the past
			const invoice = (await mockData.get("invoice", inv.id)) as Record<
				string,
				unknown
			>;
			await mockData.upsert("invoice", inv.id, {
				...invoice,
				dueDate: new Date("2020-01-01"),
			});

			const overdue = await controller.findOverdue();
			expect(overdue).toHaveLength(0);
		});
	});

	// ── Full lifecycle ────────────────────────────────────────────

	describe("full invoice lifecycle", () => {
		it("draft -> sent -> viewed -> partially_paid -> paid", async () => {
			const inv = await controller.create(
				makeInvoice({
					customerId: "cust_1",
					customerName: "Test Customer",
					paymentTerms: "net_30",
				}),
			);
			expect(inv.status).toBe("draft");

			const sent = await controller.send(inv.id);
			expect(sent?.status).toBe("sent");
			expect(sent?.issuedAt).toBeDefined();
			expect(sent?.dueDate).toBeDefined();

			const viewed = await controller.markViewed(inv.id);
			expect(viewed?.status).toBe("viewed");

			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 2000,
				method: "card",
			});
			let detail = await controller.getById(inv.id);
			expect(detail?.status).toBe("partially_paid");
			expect(detail?.amountPaid).toBe(2000);

			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 3000,
				method: "bank_transfer",
			});
			detail = await controller.getById(inv.id);
			expect(detail?.status).toBe("paid");
			expect(detail?.amountPaid).toBe(5000);
			expect(detail?.amountDue).toBe(0);
		});

		it("draft -> sent -> void", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const voided = await controller.voidInvoice(inv.id);
			expect(voided?.status).toBe("void");
			expect(voided?.amountDue).toBe(0);
		});

		it("credit note lifecycle: draft -> issued -> applied", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				reason: "Return",
				lineItems: [
					{ description: "Returned Widget", quantity: 1, unitPrice: 5000 },
				],
			});
			expect(cn.status).toBe("draft");

			const issued = await controller.issueCreditNote(cn.id);
			expect(issued?.status).toBe("issued");

			const applied = await controller.applyCreditNote(cn.id);
			expect(applied?.status).toBe("applied");

			const updated = await controller.getById(inv.id);
			expect(updated?.status).toBe("paid");
			expect(updated?.amountPaid).toBe(5000);
		});
	});
});
