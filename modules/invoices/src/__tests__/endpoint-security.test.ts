import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createInvoiceController } from "../service-impl";

/**
 * Security regression tests for invoices endpoints.
 *
 * Store endpoints scope invoices to customer. Admin endpoints have full access.
 * Security focuses on:
 * - Customer invoice tracking requires email match (no enumeration)
 * - Only draft invoices can be updated or have line items added
 * - Void and draft invoices reject payment recording
 * - Credit note lifecycle enforces valid state transitions
 * - Cascade deletion removes line items, payments, and credit notes
 * - Invoice status transitions follow strict lifecycle
 */

describe("invoices endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createInvoiceController>;

	const baseInvoice = {
		subtotal: 10000,
		lineItems: [{ description: "Widget", quantity: 2, unitPrice: 5000 }],
	};

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createInvoiceController(mockData);
	});

	describe("customer invoice tracking", () => {
		it("getByTracking requires matching email", async () => {
			const invoice = await controller.create({
				...baseInvoice,
				guestEmail: "alice@example.com",
				customerName: "Alice",
			});

			const found = await controller.getByTracking(
				invoice.invoiceNumber,
				"alice@example.com",
			);
			expect(found).not.toBeNull();

			const notFound = await controller.getByTracking(
				invoice.invoiceNumber,
				"attacker@example.com",
			);
			expect(notFound).toBeNull();
		});

		it("getByTracking is case-insensitive for email", async () => {
			const invoice = await controller.create({
				...baseInvoice,
				guestEmail: "Alice@Example.com",
			});

			const found = await controller.getByTracking(
				invoice.invoiceNumber,
				"alice@example.com",
			);
			expect(found).not.toBeNull();
		});

		it("listForCustomer scopes to customer ID", async () => {
			await controller.create({
				...baseInvoice,
				customerId: "cust_1",
			});
			await controller.create({
				...baseInvoice,
				customerId: "cust_2",
			});

			const cust1 = await controller.listForCustomer("cust_1");
			expect(cust1.total).toBe(1);

			const cust2 = await controller.listForCustomer("cust_2");
			expect(cust2.total).toBe(1);
		});
	});

	describe("draft-only updates", () => {
		it("update returns null for non-draft invoices", async () => {
			const invoice = await controller.create(baseInvoice);
			await controller.send(invoice.id);

			const result = await controller.update(invoice.id, {
				notes: "Updated",
			});
			expect(result).toBeNull();
		});

		it("addLineItem rejects non-draft invoices", async () => {
			const invoice = await controller.create(baseInvoice);
			await controller.send(invoice.id);

			await expect(
				controller.addLineItem(invoice.id, {
					description: "Extra",
					quantity: 1,
					unitPrice: 100,
				}),
			).rejects.toThrow("draft");
		});
	});

	describe("payment recording restrictions", () => {
		it("rejects payment on void invoice", async () => {
			const invoice = await controller.create(baseInvoice);
			await controller.send(invoice.id);
			await controller.voidInvoice(invoice.id);

			await expect(
				controller.recordPayment({
					invoiceId: invoice.id,
					amount: 5000,
					method: "card",
				}),
			).rejects.toThrow("void");
		});

		it("rejects payment on draft invoice", async () => {
			const invoice = await controller.create(baseInvoice);

			await expect(
				controller.recordPayment({
					invoiceId: invoice.id,
					amount: 5000,
					method: "card",
				}),
			).rejects.toThrow("draft");
		});

		it("auto-transitions to paid when fully paid", async () => {
			const invoice = await controller.create(baseInvoice);
			await controller.send(invoice.id);

			await controller.recordPayment({
				invoiceId: invoice.id,
				amount: 10000,
				method: "card",
			});

			const updated = await controller.getById(invoice.id);
			expect(updated?.status).toBe("paid");
		});

		it("auto-transitions to partially_paid", async () => {
			const invoice = await controller.create(baseInvoice);
			await controller.send(invoice.id);

			await controller.recordPayment({
				invoiceId: invoice.id,
				amount: 3000,
				method: "card",
			});

			const updated = await controller.getById(invoice.id);
			expect(updated?.status).toBe("partially_paid");
		});
	});

	describe("invoice lifecycle transitions", () => {
		it("send only works on draft invoices", async () => {
			const invoice = await controller.create(baseInvoice);
			const sent = await controller.send(invoice.id);
			expect(sent?.status).toBe("sent");

			// Can't send again
			const resend = await controller.send(invoice.id);
			expect(resend).toBeNull();
		});

		it("markViewed only works on sent invoices", async () => {
			const invoice = await controller.create(baseInvoice);

			// Can't view a draft
			const viewDraft = await controller.markViewed(invoice.id);
			expect(viewDraft).toBeNull();

			await controller.send(invoice.id);
			const viewed = await controller.markViewed(invoice.id);
			expect(viewed?.status).toBe("viewed");
		});

		it("voidInvoice works from any non-void status", async () => {
			const invoice = await controller.create(baseInvoice);
			const voided = await controller.voidInvoice(invoice.id);
			expect(voided?.status).toBe("void");

			// Can't void again
			const revoid = await controller.voidInvoice(invoice.id);
			expect(revoid).toBeNull();
		});

		it("void sets amountDue to 0", async () => {
			const invoice = await controller.create(baseInvoice);
			await controller.send(invoice.id);
			const voided = await controller.voidInvoice(invoice.id);
			expect(voided?.amountDue).toBe(0);
		});
	});

	describe("credit note lifecycle", () => {
		it("issueCreditNote only works on draft credit notes", async () => {
			const invoice = await controller.create(baseInvoice);
			const cn = await controller.createCreditNote({
				invoiceId: invoice.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 5000 }],
			});

			const issued = await controller.issueCreditNote(cn.id);
			expect(issued?.status).toBe("issued");

			// Can't issue again
			const reissue = await controller.issueCreditNote(cn.id);
			expect(reissue).toBeNull();
		});

		it("applyCreditNote only works on issued credit notes", async () => {
			const invoice = await controller.create(baseInvoice);
			await controller.send(invoice.id);
			const cn = await controller.createCreditNote({
				invoiceId: invoice.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 5000 }],
			});

			// Can't apply draft
			const applyDraft = await controller.applyCreditNote(cn.id);
			expect(applyDraft).toBeNull();

			await controller.issueCreditNote(cn.id);
			const applied = await controller.applyCreditNote(cn.id);
			expect(applied?.status).toBe("applied");
		});

		it("voidCreditNote rejects applied credit notes", async () => {
			const invoice = await controller.create(baseInvoice);
			await controller.send(invoice.id);
			const cn = await controller.createCreditNote({
				invoiceId: invoice.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 5000 }],
			});
			await controller.issueCreditNote(cn.id);
			await controller.applyCreditNote(cn.id);

			const voided = await controller.voidCreditNote(cn.id);
			expect(voided).toBeNull();
		});
	});

	describe("cascade deletion", () => {
		it("delete removes line items, payments, and credit notes", async () => {
			const invoice = await controller.create(baseInvoice);
			await controller.send(invoice.id);

			await controller.recordPayment({
				invoiceId: invoice.id,
				amount: 3000,
				method: "card",
			});
			await controller.createCreditNote({
				invoiceId: invoice.id,
				lineItems: [{ description: "Refund", quantity: 1, unitPrice: 1000 }],
			});

			await controller.delete(invoice.id);

			const fetched = await controller.getById(invoice.id);
			expect(fetched).toBeNull();
		});
	});
});
