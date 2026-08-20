import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateInvoiceParams } from "../service";
import { createInvoiceController } from "../service-impl";

/**
 * Admin workflow and edge-case tests for the invoices module.
 *
 * Covers: invoice CRUD, lifecycle transitions, line items, payments,
 * credit notes, bulk operations, lookups, overdue detection, and edge cases.
 */

function makeInvoice(
	overrides: Partial<CreateInvoiceParams> = {},
): CreateInvoiceParams {
	return {
		subtotal: 10000,
		lineItems: [{ description: "Widget", quantity: 2, unitPrice: 5000 }],
		...overrides,
	};
}

describe("invoices — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createInvoiceController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createInvoiceController(mockData);
	});

	// ── Invoice creation ──────────────────────────────────────────

	describe("invoice creation", () => {
		it("creates an invoice with defaults", async () => {
			const inv = await controller.create(makeInvoice());
			expect(inv.id).toBeDefined();
			expect(inv.invoiceNumber).toBeDefined();
			expect(inv.status).toBe("draft");
			expect(inv.subtotal).toBe(10000);
			expect(inv.currency).toBe("USD");
			expect(inv.paymentTerms).toBe("due_on_receipt");
		});

		it("creates an invoice with customer info", async () => {
			const inv = await controller.create(
				makeInvoice({
					customerId: "cust_1",
					customerName: "Alice Johnson",
					guestEmail: "alice@example.com",
				}),
			);
			expect(inv.customerId).toBe("cust_1");
			expect(inv.customerName).toBe("Alice Johnson");
			expect(inv.guestEmail).toBe("alice@example.com");
		});

		it("creates an invoice with order reference", async () => {
			const inv = await controller.create(makeInvoice({ orderId: "order_42" }));
			expect(inv.orderId).toBe("order_42");
		});

		it("creates an invoice with tax and shipping", async () => {
			const inv = await controller.create(
				makeInvoice({
					taxAmount: 800,
					shippingAmount: 500,
					discountAmount: 200,
				}),
			);
			expect(inv.taxAmount).toBe(800);
			expect(inv.shippingAmount).toBe(500);
			expect(inv.discountAmount).toBe(200);
		});

		it("creates an invoice with custom payment terms", async () => {
			const inv = await controller.create(
				makeInvoice({ paymentTerms: "net_30" }),
			);
			expect(inv.paymentTerms).toBe("net_30");
		});

		it("creates an invoice with billing address", async () => {
			const address = {
				firstName: "Alice",
				lastName: "Johnson",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			};
			const inv = await controller.create(
				makeInvoice({ billingAddress: address }),
			);
			expect(inv.billingAddress).toEqual(address);
		});

		it("creates an invoice with notes", async () => {
			const inv = await controller.create(
				makeInvoice({
					notes: "Thank you for your business",
					internalNotes: "Priority customer",
				}),
			);
			expect(inv.notes).toBe("Thank you for your business");
			expect(inv.internalNotes).toBe("Priority customer");
		});

		it("creates an invoice with multiple line items", async () => {
			const inv = await controller.create(
				makeInvoice({
					subtotal: 15000,
					lineItems: [
						{ description: "Widget", quantity: 2, unitPrice: 5000 },
						{ description: "Gadget", quantity: 1, unitPrice: 5000 },
					],
				}),
			);
			expect(inv.subtotal).toBe(15000);
		});

		it("each invoice gets a unique number", async () => {
			const numbers = new Set<string>();
			for (let i = 0; i < 10; i++) {
				const inv = await controller.create(makeInvoice());
				numbers.add(inv.invoiceNumber);
			}
			expect(numbers.size).toBe(10);
		});
	});

	// ── Invoice retrieval ─────────────────────────────────────────

	describe("invoice retrieval", () => {
		it("gets invoice by id with details", async () => {
			const inv = await controller.create(makeInvoice());
			const found = await controller.getById(inv.id);
			expect(found?.id).toBe(inv.id);
			expect(found?.lineItems).toBeDefined();
			expect(found?.payments).toBeDefined();
			expect(found?.creditNotes).toBeDefined();
		});

		it("getById returns null for unknown id", async () => {
			const result = await controller.getById("fake-id");
			expect(result).toBeNull();
		});

		it("gets invoice by number", async () => {
			const inv = await controller.create(makeInvoice());
			const found = await controller.getByNumber(inv.invoiceNumber);
			expect(found?.id).toBe(inv.id);
		});

		it("getByNumber returns null for unknown number", async () => {
			const result = await controller.getByNumber("INV-FAKE");
			expect(result).toBeNull();
		});

		it("gets invoice by order", async () => {
			const inv = await controller.create(makeInvoice({ orderId: "order_42" }));
			const found = await controller.getByOrder("order_42");
			expect(found?.id).toBe(inv.id);
		});

		it("getByOrder returns null for unknown orderId", async () => {
			const result = await controller.getByOrder("fake-order");
			expect(result).toBeNull();
		});
	});

	// ── Invoice listing ───────────────────────────────────────────

	describe("invoice listing", () => {
		it("lists all invoices", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create(makeInvoice());
			}
			const result = await controller.list({});
			expect(result.invoices).toHaveLength(5);
			expect(result.total).toBe(5);
		});

		it("filters by status", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.create(makeInvoice());
			await controller.send(inv.id);

			const sent = await controller.list({ status: "sent" });
			expect(sent.invoices).toHaveLength(1);

			const drafts = await controller.list({ status: "draft" });
			expect(drafts.invoices).toHaveLength(1);
		});

		it("filters by customerId", async () => {
			await controller.create(makeInvoice({ customerId: "cust_1" }));
			await controller.create(makeInvoice({ customerId: "cust_1" }));
			await controller.create(makeInvoice({ customerId: "cust_2" }));

			const result = await controller.list({ customerId: "cust_1" });
			expect(result.invoices).toHaveLength(2);
		});

		it("paginates invoices", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.create(makeInvoice());
			}
			const result = await controller.list({ limit: 3, offset: 2 });
			expect(result.invoices).toHaveLength(3);
		});

		it("lists invoices for a specific customer", async () => {
			await controller.create(makeInvoice({ customerId: "cust_1" }));
			await controller.create(makeInvoice({ customerId: "cust_1" }));
			await controller.create(makeInvoice({ customerId: "cust_2" }));

			const result = await controller.listForCustomer("cust_1");
			expect(result.invoices).toHaveLength(2);
		});
	});

	// ── Invoice update ────────────────────────────────────────────

	describe("invoice update", () => {
		it("updates customer name", async () => {
			const inv = await controller.create(makeInvoice());
			const updated = await controller.update(inv.id, {
				customerName: "Updated Name",
			});
			expect(updated?.customerName).toBe("Updated Name");
		});

		it("updates payment terms", async () => {
			const inv = await controller.create(makeInvoice());
			const updated = await controller.update(inv.id, {
				paymentTerms: "net_60",
			});
			expect(updated?.paymentTerms).toBe("net_60");
		});

		it("updates notes", async () => {
			const inv = await controller.create(makeInvoice());
			const updated = await controller.update(inv.id, {
				notes: "Updated notes",
				internalNotes: "Internal update",
			});
			expect(updated?.notes).toBe("Updated notes");
			expect(updated?.internalNotes).toBe("Internal update");
		});

		it("update returns null for unknown id", async () => {
			const result = await controller.update("fake-id", {
				customerName: "X",
			});
			expect(result).toBeNull();
		});
	});

	// ── Lifecycle transitions ─────────────────────────────────────

	describe("lifecycle transitions", () => {
		it("sends a draft invoice", async () => {
			const inv = await controller.create(makeInvoice());
			const sent = await controller.send(inv.id);
			expect(sent?.status).toBe("sent");
			expect(sent?.issuedAt).toBeDefined();
		});

		it("marks invoice as viewed", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const viewed = await controller.markViewed(inv.id);
			expect(viewed?.status).toBe("viewed");
		});

		it("marks invoice as overdue", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const overdue = await controller.markOverdue(inv.id);
			expect(overdue?.status).toBe("overdue");
		});

		it("voids an invoice", async () => {
			const inv = await controller.create(makeInvoice());
			const voided = await controller.voidInvoice(inv.id);
			expect(voided?.status).toBe("void");
		});

		it("send returns null for unknown id", async () => {
			const result = await controller.send("fake-id");
			expect(result).toBeNull();
		});

		it("voidInvoice returns null for unknown id", async () => {
			const result = await controller.voidInvoice("fake-id");
			expect(result).toBeNull();
		});
	});

	// ── Line items ────────────────────────────────────────────────

	describe("line items", () => {
		it("retrieves line items for an invoice", async () => {
			const inv = await controller.create(
				makeInvoice({
					lineItems: [
						{ description: "Widget", quantity: 2, unitPrice: 5000 },
						{ description: "Gadget", quantity: 1, unitPrice: 3000 },
					],
				}),
			);
			const items = await controller.getLineItems(inv.id);
			expect(items).toHaveLength(2);
		});

		it("adds a line item to an existing invoice", async () => {
			const inv = await controller.create(makeInvoice());
			const item = await controller.addLineItem(inv.id, {
				description: "Extra item",
				quantity: 3,
				unitPrice: 1000,
			});
			expect(item.description).toBe("Extra item");
			expect(item.quantity).toBe(3);
			expect(item.unitPrice).toBe(1000);
		});

		it("removes a line item", async () => {
			const inv = await controller.create(makeInvoice());
			const items = await controller.getLineItems(inv.id);
			await controller.removeLineItem(items[0].id);
			const remaining = await controller.getLineItems(inv.id);
			expect(remaining).toHaveLength(0);
		});
	});

	// ── Payments ──────────────────────────────────────────────────

	describe("payments", () => {
		it("records a payment", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const payment = await controller.recordPayment({
				invoiceId: inv.id,
				amount: 5000,
				method: "card",
			});
			expect(payment.id).toBeDefined();
			expect(payment.amount).toBe(5000);
			expect(payment.method).toBe("card");
		});

		it("records payment with reference and notes", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const payment = await controller.recordPayment({
				invoiceId: inv.id,
				amount: 10000,
				method: "bank_transfer",
				reference: "TXN-123456",
				notes: "Wire transfer received",
			});
			expect(payment.reference).toBe("TXN-123456");
			expect(payment.notes).toBe("Wire transfer received");
		});

		it("lists payments for an invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 3000,
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

		it("deletes a payment", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.send(inv.id);
			const payment = await controller.recordPayment({
				invoiceId: inv.id,
				amount: 5000,
				method: "card",
			});
			await controller.deletePayment(payment.id);
			const payments = await controller.listPayments(inv.id);
			expect(payments).toHaveLength(0);
		});

		it("full payment marks invoice as paid", async () => {
			const inv = await controller.create(makeInvoice({ subtotal: 10000 }));
			await controller.send(inv.id);
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 10000,
				method: "card",
			});
			const updated = await controller.getById(inv.id);
			expect(updated?.status).toBe("paid");
		});

		it("partial payment marks invoice as partially_paid", async () => {
			const inv = await controller.create(makeInvoice({ subtotal: 10000 }));
			await controller.send(inv.id);
			await controller.recordPayment({
				invoiceId: inv.id,
				amount: 3000,
				method: "card",
			});
			const updated = await controller.getById(inv.id);
			expect(updated?.status).toBe("partially_paid");
		});
	});

	// ── Credit notes ──────────────────────────────────────────────

	describe("credit notes", () => {
		it("creates a credit note for an invoice", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				reason: "Damaged item",
				lineItems: [
					{ description: "Damaged Widget", quantity: 1, unitPrice: 5000 },
				],
			});
			expect(cn.id).toBeDefined();
			expect(cn.creditNoteNumber).toBeDefined();
			expect(cn.status).toBe("draft");
			expect(cn.amount).toBe(5000);
		});

		it("gets credit note with items", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Item", quantity: 1, unitPrice: 5000 }],
			});
			const found = await controller.getCreditNote(cn.id);
			expect(found?.lineItems).toHaveLength(1);
		});

		it("getCreditNote returns null for unknown id", async () => {
			const result = await controller.getCreditNote("fake-id");
			expect(result).toBeNull();
		});

		it("lists credit notes for an invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Item 1", quantity: 1, unitPrice: 2000 }],
			});
			await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Item 2", quantity: 1, unitPrice: 3000 }],
			});
			const notes = await controller.listCreditNotes(inv.id);
			expect(notes).toHaveLength(2);
		});

		it("issues a credit note", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Item", quantity: 1, unitPrice: 5000 }],
			});
			const issued = await controller.issueCreditNote(cn.id);
			expect(issued?.status).toBe("issued");
			expect(issued?.issuedAt).toBeDefined();
		});

		it("applies a credit note", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Item", quantity: 1, unitPrice: 5000 }],
			});
			await controller.issueCreditNote(cn.id);
			const applied = await controller.applyCreditNote(cn.id);
			expect(applied?.status).toBe("applied");
		});

		it("voids a credit note", async () => {
			const inv = await controller.create(makeInvoice());
			const cn = await controller.createCreditNote({
				invoiceId: inv.id,
				lineItems: [{ description: "Item", quantity: 1, unitPrice: 5000 }],
			});
			const voided = await controller.voidCreditNote(cn.id);
			expect(voided?.status).toBe("void");
		});

		it("issueCreditNote returns null for unknown id", async () => {
			const result = await controller.issueCreditNote("fake-id");
			expect(result).toBeNull();
		});
	});

	// ── Bulk operations ───────────────────────────────────────────

	describe("bulk operations", () => {
		it("bulk updates invoice status", async () => {
			const inv1 = await controller.create(makeInvoice());
			const inv2 = await controller.create(makeInvoice());
			const inv3 = await controller.create(makeInvoice());

			const result = await controller.bulkUpdateStatus(
				[inv1.id, inv2.id, inv3.id],
				"void",
			);
			expect(result.updated).toBe(3);
		});

		it("bulk deletes invoices", async () => {
			const inv1 = await controller.create(makeInvoice());
			const inv2 = await controller.create(makeInvoice());

			const result = await controller.bulkDelete([inv1.id, inv2.id]);
			expect(result.deleted).toBe(2);

			const found1 = await controller.getById(inv1.id);
			expect(found1).toBeNull();
		});

		it("bulk update with empty array returns 0", async () => {
			const result = await controller.bulkUpdateStatus([], "void");
			expect(result.updated).toBe(0);
		});

		it("bulk delete with empty array returns 0", async () => {
			const result = await controller.bulkDelete([]);
			expect(result.deleted).toBe(0);
		});
	});

	// ── Invoice deletion ──────────────────────────────────────────

	describe("invoice deletion", () => {
		it("deletes an invoice", async () => {
			const inv = await controller.create(makeInvoice());
			await controller.delete(inv.id);
			const found = await controller.getById(inv.id);
			expect(found).toBeNull();
		});
	});

	// ── Tracking lookup ───────────────────────────────────────────

	describe("tracking lookup", () => {
		it("finds invoice by number and email", async () => {
			const inv = await controller.create(
				makeInvoice({ guestEmail: "guest@example.com" }),
			);
			const found = await controller.getByTracking(
				inv.invoiceNumber,
				"guest@example.com",
			);
			expect(found?.id).toBe(inv.id);
		});

		it("returns null for wrong email", async () => {
			const inv = await controller.create(
				makeInvoice({ guestEmail: "guest@example.com" }),
			);
			const result = await controller.getByTracking(
				inv.invoiceNumber,
				"wrong@example.com",
			);
			expect(result).toBeNull();
		});
	});

	// ── Overdue detection ─────────────────────────────────────────

	describe("overdue detection", () => {
		it("returns empty when no invoices are overdue", async () => {
			await controller.create(makeInvoice());
			const overdue = await controller.findOverdue();
			expect(overdue).toHaveLength(0);
		});
	});

	// ── Multi-customer isolation ──────────────────────────────────

	describe("multi-customer isolation", () => {
		it("invoices are isolated per customer", async () => {
			await controller.create(makeInvoice({ customerId: "cust_1" }));
			await controller.create(makeInvoice({ customerId: "cust_1" }));
			await controller.create(makeInvoice({ customerId: "cust_2" }));

			const c1 = await controller.listForCustomer("cust_1");
			const c2 = await controller.listForCustomer("cust_2");
			expect(c1.invoices).toHaveLength(2);
			expect(c2.invoices).toHaveLength(1);
		});
	});
});
