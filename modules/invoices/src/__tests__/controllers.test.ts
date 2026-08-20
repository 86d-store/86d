import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createInvoiceController } from "../service-impl";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeInvoice(overrides: Record<string, unknown> = {}) {
	return {
		subtotal: 10000,
		lineItems: [
			{ description: "Widget A", quantity: 2, unitPrice: 3000 },
			{ description: "Widget B", quantity: 1, unitPrice: 4000 },
		],
		...overrides,
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("invoices controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createInvoiceController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createInvoiceController(mockData);
	});

	// ── Invoice creation and total calculation ────────────────────────

	describe("create — total calculation", () => {
		it("calculates total as subtotal + tax + shipping - discount", async () => {
			const inv = await controller.create(
				makeInvoice({
					subtotal: 10000,
					taxAmount: 800,
					shippingAmount: 1200,
					discountAmount: 500,
				}),
			);
			// 10000 + 800 + 1200 - 500 = 11500
			expect(inv.total).toBe(11500);
			expect(inv.amountDue).toBe(11500);
			expect(inv.amountPaid).toBe(0);
		});

		it("defaults tax, shipping, and discount to zero", async () => {
			const inv = await controller.create(makeInvoice({ subtotal: 7500 }));
			expect(inv.taxAmount).toBe(0);
			expect(inv.shippingAmount).toBe(0);
			expect(inv.discountAmount).toBe(0);
			expect(inv.total).toBe(7500);
		});

		it("defaults currency to USD", async () => {
			const inv = await controller.create(makeInvoice());
			expect(inv.currency).toBe("USD");
		});

		it("accepts custom currency", async () => {
			const inv = await controller.create(makeInvoice({ currency: "EUR" }));
			expect(inv.currency).toBe("EUR");
		});

		it("assigns sortOrder to line items sequentially", async () => {
			const inv = await controller.create(makeInvoice());
			const items = await controller.getLineItems(inv.id);
			expect(items[0].sortOrder).toBe(0);
			expect(items[1].sortOrder).toBe(1);
		});

		it("calculates line item amount as quantity * unitPrice", async () => {
			const inv = await controller.create(makeInvoice());
			const items = await controller.getLineItems(inv.id);
			expect(items[0].amount).toBe(6000); // 2 * 3000
			expect(items[1].amount).toBe(4000); // 1 * 4000
		});
	});

	// ── Lifecycle transition guards ──────────────────────────────────

	describe("lifecycle — transition guards", () => {
		it("send rejects non-draft invoices", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			// Already sent, cannot send again
			const result = await controller.send(inv.id);
			expect(result).toBeNull();
		});

		it("markViewed only accepts sent status", async () => {
			const inv = await controller.create(makeInvoice());
			// Draft -> markViewed should fail
			expect(await controller.markViewed(inv.id)).toBeNull();

			await controller.send(inv.id);
			await controller.markViewed(inv.id);
			// Viewed -> markViewed should fail (already viewed)
			expect(await controller.markViewed(inv.id)).toBeNull();
		});

		it("markOverdue accepts sent, viewed, and partially_paid", async () => {
			const inv1 = await controller.create(makeInvoice());
			await controller.send(inv1.id);
			expect((await controller.markOverdue(inv1.id))?.status).toBe("overdue");

			const inv2 = await controller.create(makeInvoice());
			await controller.send(inv2.id);
			await controller.markViewed(inv2.id);
			expect((await controller.markOverdue(inv2.id))?.status).toBe("overdue");

			const inv3 = await controller.create(makeInvoice());
			await controller.send(inv3.id);
			await controller.recordPayment({
				invoiceId: inv3.id,
				amount: 1000,
				method: "card",
			});
			expect((await controller.markOverdue(inv3.id))?.status).toBe("overdue");
		});

		it("markOverdue rejects paid and void statuses", async () => {
			const inv1 = await controller.create(makeInvoice());
			await controller.send(inv1.id);
			await controller.recordPayment({
				invoiceId: inv1.id,
				amount: 10000,
				method: "card",
			});
			expect(await controller.markOverdue(inv1.id)).toBeNull();

			const inv2 = await controller.create(makeInvoice());
			await controller.voidInvoice(inv2.id);
			expect(await controller.markOverdue(inv2.id)).toBeNull();
		});

		it("voidInvoice works from any non-void status", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await controller.markViewed(inv.id);
			const voided = await controller.voidInvoice(inv.id);
			expect(voided?.status).toBe("void");
			expect(voided?.amountDue).toBe(0);
		});

		it("voidInvoice rejects already-void invoices", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.voidInvoice(inv.id);
			expect(await controller.voidInvoice(inv.id)).toBeNull();
		});
	});

	// ── Due date calculation from payment terms ──────────────────────

	describe("send — due date calculation", () => {
		it("due_on_receipt sets dueDate equal to issuedAt", async () => {
			const inv = await controller.create(
				makeInvoice({ paymentTerms: "due_on_receipt" }),
			);
			const sent = await controller.send(inv.id);
			expect(sent).not.toBeNull();
			if (sent?.issuedAt && sent?.dueDate) {
				const issued = new Date(sent.issuedAt);
				const due = new Date(sent.dueDate);
				const diffDays = Math.round(
					(due.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24),
				);
				expect(diffDays).toBe(0);
			}
		});

		it("net_7 sets dueDate 7 days after issuedAt", async () => {
			const inv = await controller.create(
				makeInvoice({ paymentTerms: "net_7" }),
			);
			const sent = await controller.send(inv.id);
			if (sent?.issuedAt && sent?.dueDate) {
				const diffDays = Math.round(
					(new Date(sent.dueDate).getTime() -
						new Date(sent.issuedAt).getTime()) /
						(1000 * 60 * 60 * 24),
				);
				expect(diffDays).toBe(7);
			}
		});

		it("net_60 sets dueDate 60 days after issuedAt", async () => {
			const inv = await controller.create(
				makeInvoice({ paymentTerms: "net_60" }),
			);
			const sent = await controller.send(inv.id);
			if (sent?.issuedAt && sent?.dueDate) {
				const diffDays = Math.round(
					(new Date(sent.dueDate).getTime() -
						new Date(sent.issuedAt).getTime()) /
						(1000 * 60 * 60 * 24),
				);
				expect(diffDays).toBe(60);
			}
		});

		it("defaults to due_on_receipt when paymentTerms not specified", async () => {
			const inv = await controller.create(makeInvoice());
			expect(inv.paymentTerms).toBe("due_on_receipt");
		});
	});

	// ── Update guards ────────────────────────────────────────────────

	describe("update — draft-only guard", () => {
		it("allows updating draft invoices", async () => {
			const inv = await controller.create(makeInvoice());
			const updated = await controller.update(inv.id, {
				customerName: "New Name",
				notes: "Updated notes",
			});
			expect(updated?.customerName).toBe("New Name");
			expect(updated?.notes).toBe("Updated notes");
		});

		it("rejects updates to sent invoices", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const result = await controller.update(inv.id, {
				customerName: "Nope",
			});
			expect(result).toBeNull();
		});

		it("rejects updates to paid invoices", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 10000,
				method: "card",
			});
			const result = await controller.update(inv.id, {
				customerName: "Nope",
			});
			expect(result).toBeNull();
		});

		it("rejects updates to void invoices", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.voidInvoice(inv.id);
			const result = await controller.update(inv.id, {
				customerName: "Nope",
			});
			expect(result).toBeNull();
		});
	});

	// ── Payment recording and auto-transitions ───────────────────────

	describe("recordPayment — auto-transitions", () => {
		it("partial payment transitions to partially_paid", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 3000,
				method: "card",
			});
			const detail = await controller.getById(inv.id);
			expect(detail?.status).toBe("partially_paid");
			expect(detail?.amountPaid).toBe(3000);
			expect(detail?.amountDue).toBe(7000);
		});

		it("full payment transitions to paid", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 10000,
				method: "bank_transfer",
			});
			const detail = await controller.getById(inv.id);
			expect(detail?.status).toBe("paid");
			expect(detail?.amountDue).toBe(0);
		});

		it("multiple partial payments leading to full payment", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 4000,
				method: "card",
			});
			let detail = await controller.getById(inv.id);
			expect(detail?.status).toBe("partially_paid");

			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 4000,
				method: "cash",
			});
			detail = await controller.getById(inv.id);
			expect(detail?.status).toBe("partially_paid");
			expect(detail?.amountPaid).toBe(8000);

			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 2000,
				method: "check",
			});
			detail = await controller.getById(inv.id);
			expect(detail?.status).toBe("paid");
			expect(detail?.amountPaid).toBe(10000);
			expect(detail?.amountDue).toBe(0);
		});

		it("overpayment clamps amountDue to zero", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 15000,
				method: "card",
			});
			const detail = await controller.getById(inv.id);
			expect(detail?.amountDue).toBe(0);
			expect(detail?.status).toBe("paid");
		});

		it("throws when recording payment on draft invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await expect(
				controller.recordPayment({
					invoiceId: inv.id,
					amount: 1000,
					method: "card",
				}),
			).rejects.toThrow("Cannot record payment on draft invoice");
		});

		it("throws when recording payment on void invoice", async () => {
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

		it("throws when recording payment on nonexistent invoice", async () => {
			await expect(
				controller.recordPayment({
					invoiceId: "nonexistent",
					amount: 1000,
					method: "card",
				}),
			).rejects.toThrow("Invoice not found");
		});
	});

	// ── Payment deletion and recalculation ───────────────────────────

	describe("deletePayment — recalculation", () => {
		it("recalculates amountPaid and amountDue after deletion", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const p1 = await controller.recordPayment({
				invoiceId: inv.id,
				amount: 4000,
				method: "card",
			});
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 3000,
				method: "cash",
			});

			let detail = await controller.getById(inv.id);
			expect(detail?.amountPaid).toBe(7000);
			expect(detail?.status).toBe("partially_paid");

			await controller.deletePayment(p1.id);
			detail = await controller.getById(inv.id);
			expect(detail?.amountPaid).toBe(3000);
			expect(detail?.amountDue).toBe(7000);
			expect(detail?.status).toBe("partially_paid");
		});

		it("reverts status to sent when all payments deleted", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const payment = await controller.recordPayment({
				invoiceId: inv.id,
				amount: 10000,
				method: "card",
			});

			let detail = await controller.getById(inv.id);
			expect(detail?.status).toBe("paid");

			await controller.deletePayment(payment.id);
			detail = await controller.getById(inv.id);
			expect(detail?.amountPaid).toBe(0);
			expect(detail?.amountDue).toBe(10000);
			expect(detail?.status).toBe("sent");
		});

		it("does nothing for nonexistent payment id", async () => {
			await controller.deletePayment("no-such-payment");
			// No error thrown
		});
	});

	// ── Credit note lifecycle ────────────────────────────────────────

	describe("credit note lifecycle", () => {
		it("draft -> issued -> applied records payment on invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				reason: "Damaged goods",
				lineItems: [
					{ description: "Refund Widget A", quantity: 1, unitPrice: 3000 },
				],
			});
			expect(cn.status).toBe("draft");
			expect(cn.amount).toBe(3000);

			const issued = await controller.issueCreditNote(cn.id);
			expect(issued?.status).toBe("issued");
			expect(issued?.issuedAt).toBeDefined();

			const applied = await controller.applyCreditNote(cn.id);
			expect(applied?.status).toBe("applied");

			// Verify payment was recorded on the invoice
			const payments = await controller.listPayments(inv.id);
			const creditPayment = payments.find((p) => p.method === "store_credit");
			expect(creditPayment).toBeDefined();
			expect(creditPayment?.amount).toBe(3000);

			const detail = await controller.getById(inv.id);
			expect(detail?.amountPaid).toBe(3000);
			expect(detail?.amountDue).toBe(7000);
			expect(detail?.status).toBe("partially_paid");
		});

		it("applying credit note for full amount marks invoice paid", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [
					{ description: "Full refund", quantity: 1, unitPrice: 10000 },
				],
			});
			await controller.issueCreditNote(cn.id);
			await controller.applyCreditNote(cn.id);

			const detail = await controller.getById(inv.id);
			expect(detail?.status).toBe("paid");
			expect(detail?.amountDue).toBe(0);
		});

		it("credit note amount is calculated from line items", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [
					{ description: "Item A", quantity: 2, unitPrice: 1500 },
					{ description: "Item B", quantity: 3, unitPrice: 1000 },
				],
			});
			// 2*1500 + 3*1000 = 6000
			expect(cn.amount).toBe(6000);
		});

		it("cannot apply a draft credit note (must issue first)", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 1000 }],
			});
			const result = await controller.applyCreditNote(cn.id);
			expect(result).toBeNull();
		});

		it("cannot void an applied credit note", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 1000 }],
			});
			await controller.issueCreditNote(cn.id);
			await controller.applyCreditNote(cn.id);

			const result = await controller.voidCreditNote(cn.id);
			expect(result).toBeNull();
		});

		it("cannot void an already-void credit note", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 500 }],
			});
			await controller.voidCreditNote(cn.id);
			const result = await controller.voidCreditNote(cn.id);
			expect(result).toBeNull();
		});

		it("throws when creating credit note for nonexistent invoice", async () => {
			await expect(
				controller.createCreditNote({
					invoiceId: "nonexistent",
					lineItems: [{ description: "Refund", quantity: 1, unitPrice: 100 }],
				}),
			).rejects.toThrow("Invoice not found");
		});
	});

	// ── Line item guards ─────────────────────────────────────────────

	describe("addLineItem — draft-only guard", () => {
		it("throws when adding to a sent invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await expect(
				controller.addLineItem(inv.id, {
					description: "Late addition",
					quantity: 1,
					unitPrice: 500,
				}),
			).rejects.toThrow("Can only add items to draft invoices");
		});

		it("throws when adding to a nonexistent invoice", async () => {
			await expect(
				controller.addLineItem("nonexistent", {
					description: "Ghost item",
					quantity: 1,
					unitPrice: 100,
				}),
			).rejects.toThrow("Invoice not found");
		});

		it("updates invoice totals after adding line item", async () => {
			const inv = await controller.create(
				makeInvoice({
					subtotal: 10000,
					taxAmount: 500,
					shippingAmount: 300,
					discountAmount: 200,
				}),
			);
			// total = 10000 + 500 + 300 - 200 = 10600

			await controller.addLineItem(inv.id, {
				description: "Extra item",
				quantity: 2,
				unitPrice: 1000,
			});

			const detail = await controller.getById(inv.id);
			// new subtotal = 10000 + 2000 = 12000
			// new total = 12000 + 500 + 300 - 200 = 12600
			expect(detail?.subtotal).toBe(12000);
			expect(detail?.total).toBe(12600);
			expect(detail?.amountDue).toBe(12600);
		});
	});

	describe("removeLineItem — recalculation for drafts", () => {
		it("recalculates totals when removing from a draft", async () => {
			const inv = await controller.create(
				makeInvoice({
					subtotal: 10000,
					taxAmount: 500,
				}),
			);
			const items = await controller.getLineItems(inv.id);
			// Remove Widget A (amount = 6000)
			await controller.removeLineItem(items[0].id);

			const detail = await controller.getById(inv.id);
			expect(detail?.subtotal).toBe(4000);
			// total = 4000 + 500 = 4500
			expect(detail?.total).toBe(4500);
		});

		it("does not recalculate for non-draft invoices", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			const items = await controller.getLineItems(inv.id);
			await controller.removeLineItem(items[0].id);

			// Invoice totals should remain unchanged since it's sent
			const detail = await controller.getById(inv.id);
			expect(detail?.subtotal).toBe(10000);
			expect(detail?.total).toBe(10000);
		});
	});

	// ── Cascade delete ───────────────────────────────────────────────

	describe("delete — cascade cleanup", () => {
		it("removes line items, payments, and credit notes on delete", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);

			// Record a payment
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 3000,
				method: "card",
			});

			// Create a credit note with line items
			await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "CN item", quantity: 1, unitPrice: 500 }],
			});

			// Delete the invoice
			await controller.delete(inv.id);

			// Everything should be gone
			expect(await controller.getById(inv.id)).toBeNull();
			expect(await controller.getLineItems(inv.id)).toHaveLength(0);
			expect(await controller.listPayments(inv.id)).toHaveLength(0);
			expect(await controller.listCreditNotes(inv.id)).toHaveLength(0);
		});
	});

	// ── Search and filtering ─────────────────────────────────────────

	describe("list — search filtering", () => {
		it("searches by invoice number (case insensitive)", async () => {
			const inv = await controller.create(makeInvoice());
			const partial = inv.invoiceNumber.slice(0, 8).toLowerCase();
			const { invoices } = await controller.list({ search: partial });
			expect(invoices.length).toBeGreaterThanOrEqual(1);
		});

		it("searches by customer name (case insensitive)", async () => {
			await controller.create(makeInvoice({ customerName: "Alice Johnson" }));
			await controller.create(makeInvoice({ customerName: "Bob Smith" }));
			const { invoices } = await controller.list({ search: "alice" });
			expect(invoices).toHaveLength(1);
		});

		it("searches by guest email (case insensitive)", async () => {
			await controller.create(
				makeInvoice({ guestEmail: "Customer@Store.COM" }),
			);
			const { invoices } = await controller.list({
				search: "customer@store",
			});
			expect(invoices).toHaveLength(1);
		});

		it("combines status filter with search", async () => {
			const inv1 = await controller.create(
				makeInvoice({ customerName: "Test User" }),
			);
			await controller.create(makeInvoice({ customerName: "Test User" }));
			await controller.send(inv1.id);

			const { invoices } = await controller.list({
				status: "sent",
				search: "test",
			});
			expect(invoices).toHaveLength(1);
		});
	});

	// ── getByTracking — email matching ───────────────────────────────

	describe("getByTracking — email validation", () => {
		it("returns invoice when email matches (case insensitive)", async () => {
			const inv = await controller.create(
				makeInvoice({ guestEmail: "Alice@Example.COM" }),
			);
			const result = await controller.getByTracking(
				inv.invoiceNumber,
				"alice@example.com",
			);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(inv.id);
		});

		it("returns null when email does not match", async () => {
			const inv = await controller.create(
				makeInvoice({ guestEmail: "legit@example.com" }),
			);
			const result = await controller.getByTracking(
				inv.invoiceNumber,
				"attacker@example.com",
			);
			expect(result).toBeNull();
		});

		it("returns null for unknown invoice number", async () => {
			const result = await controller.getByTracking(
				"INV-NONEXISTENT",
				"anyone@example.com",
			);
			expect(result).toBeNull();
		});

		it("returns hydrated invoice with lineItems, payments, creditNotes", async () => {
			const inv = await controller.create(
				makeInvoice({ guestEmail: "guest@example.com" }),
			);
			const result = await controller.getByTracking(
				inv.invoiceNumber,
				"guest@example.com",
			);
			expect(result?.lineItems).toBeDefined();
			expect(result?.payments).toBeDefined();
			expect(result?.creditNotes).toBeDefined();
		});
	});

	// ── Bulk operations ──────────────────────────────────────────────

	describe("bulk operations", () => {
		it("bulkUpdateStatus skips nonexistent ids", async () => {
			const inv = await controller.create(makeInvoice());
			const { updated } = await controller.bulkUpdateStatus(
				[inv.id, "fake-1", "fake-2"],
				"void",
			);
			expect(updated).toBe(1);
		});

		it("bulkDelete cascades for each invoice", async () => {
			const inv1 = await controller.create(makeInvoice());
			const inv2 = await controller.create(makeInvoice());

			// Add line items via creation — already have them
			const { deleted } = await controller.bulkDelete([inv1.id, inv2.id]);
			expect(deleted).toBe(2);

			expect(await controller.getById(inv1.id)).toBeNull();
			expect(await controller.getById(inv2.id)).toBeNull();
			expect(await controller.getLineItems(inv1.id)).toHaveLength(0);
			expect(await controller.getLineItems(inv2.id)).toHaveLength(0);
		});

		it("bulkDelete skips nonexistent ids", async () => {
			const inv = await controller.create(makeInvoice());
			const { deleted } = await controller.bulkDelete([inv.id, "no-such-id"]);
			expect(deleted).toBe(1);
		});
	});

	// ── getByOrder ───────────────────────────────────────────────────

	describe("getByOrder", () => {
		it("returns hydrated invoice by orderId", async () => {
			const inv = await controller.create(
				makeInvoice({ orderId: "order_abc" }),
			);
			const result = await controller.getByOrder("order_abc");
			expect(result).not.toBeNull();
			expect(result?.id).toBe(inv.id);
			expect(result?.lineItems).toHaveLength(2);
		});

		it("returns null for nonexistent orderId", async () => {
			const result = await controller.getByOrder("no-such-order");
			expect(result).toBeNull();
		});
	});

	// ── Sequence numbering ───────────────────────────────────────────

	describe("sequence numbering", () => {
		it("invoice numbers are unique and follow INV-DATE-NNNN pattern", async () => {
			const inv1 = await controller.create(makeInvoice());
			const inv2 = await controller.create(makeInvoice());
			const inv3 = await controller.create(makeInvoice());

			expect(inv1.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);
			expect(inv2.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);
			expect(inv3.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);

			const numbers = new Set([
				inv1.invoiceNumber,
				inv2.invoiceNumber,
				inv3.invoiceNumber,
			]);
			expect(numbers.size).toBe(3);
		});

		it("credit note numbers follow CN-DATE-NNNN pattern", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 1000 }],
			});
			expect(cn.creditNoteNumber).toMatch(/^CN-\d{8}-\d{4}$/);
		});
	});
});
