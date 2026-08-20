import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createInvoiceController } from "../service-impl";

/**
 * Store endpoint integration tests for the invoices module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. track-invoice: guest looks up invoice by number + email
 * 2. list-my-invoices: auth required, scoped to customer
 * 3. get-my-invoice: auth required, ownership check
 * 4. Full lifecycle: create → send → record payment → auto-status-transition
 */

type DataService = ReturnType<typeof createMockDataService>;

function createController(data: DataService) {
	return createInvoiceController(data);
}

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateTrackInvoice(
	data: DataService,
	body: { invoiceNumber: string; email: string },
) {
	const controller = createController(data);
	const invoice = await controller.getByTracking(
		body.invoiceNumber,
		body.email,
	);
	if (!invoice) {
		return { error: "Invoice not found", status: 404 };
	}
	return { invoice };
}

async function simulateListMyInvoices(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const result = await controller.listForCustomer(opts.customerId);
	return { invoices: result.invoices, total: result.total };
}

async function simulateGetMyInvoice(
	data: DataService,
	id: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createController(data);
	const invoice = await controller.getById(id);
	if (!invoice || invoice.customerId !== opts.customerId) {
		return { error: "Invoice not found", status: 404 };
	}
	return { invoice };
}

// ── Helpers ─────────────────────────────────────────────────────────

function makeInvoiceParams(customerId: string, email: string) {
	return {
		customerId,
		guestEmail: email,
		customerName: "Test Customer",
		subtotal: 10000,
		lineItems: [{ description: "Widget Pro", quantity: 2, unitPrice: 5000 }],
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: track invoice — find by number + email", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("finds an invoice by number and email", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);

		const result = await simulateTrackInvoice(data, {
			invoiceNumber: invoice.invoiceNumber,
			email: "jane@example.com",
		});

		expect("invoice" in result).toBe(true);
		if ("invoice" in result) {
			expect(result.invoice.id).toBe(invoice.id);
			expect(result.invoice.invoiceNumber).toBe(invoice.invoiceNumber);
			expect(result.invoice.lineItems).toHaveLength(1);
		}
	});

	it("returns 404 when email does not match", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);

		const result = await simulateTrackInvoice(data, {
			invoiceNumber: invoice.invoiceNumber,
			email: "wrong@example.com",
		});

		expect(result).toEqual({ error: "Invoice not found", status: 404 });
	});

	it("returns 404 when invoice number does not exist", async () => {
		const result = await simulateTrackInvoice(data, {
			invoiceNumber: "INV-NONEXISTENT-9999",
			email: "jane@example.com",
		});

		expect(result).toEqual({ error: "Invoice not found", status: 404 });
	});

	it("matches email case-insensitively", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "Jane@Example.COM"),
		);

		const result = await simulateTrackInvoice(data, {
			invoiceNumber: invoice.invoiceNumber,
			email: "jane@example.com",
		});

		expect("invoice" in result).toBe(true);
		if ("invoice" in result) {
			expect(result.invoice.id).toBe(invoice.id);
		}
	});

	it("matches email case-insensitively when lookup uses uppercase", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);

		const result = await simulateTrackInvoice(data, {
			invoiceNumber: invoice.invoiceNumber,
			email: "JANE@EXAMPLE.COM",
		});

		expect("invoice" in result).toBe(true);
		if ("invoice" in result) {
			expect(result.invoice.id).toBe(invoice.id);
		}
	});
});

describe("store endpoint: list my invoices — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateListMyInvoices(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns only the customer's invoices", async () => {
		const ctrl = createController(data);
		await ctrl.create(makeInvoiceParams("cust_1", "jane@example.com"));
		await ctrl.create(makeInvoiceParams("cust_1", "jane@example.com"));
		await ctrl.create(makeInvoiceParams("cust_2", "bob@example.com"));

		const result = await simulateListMyInvoices(data, {
			customerId: "cust_1",
		});

		expect("invoices" in result).toBe(true);
		if ("invoices" in result) {
			expect(result.invoices).toHaveLength(2);
			expect(result.total).toBe(2);
			for (const inv of result.invoices) {
				expect(inv.customerId).toBe("cust_1");
			}
		}
	});

	it("returns empty for customer with no invoices", async () => {
		const result = await simulateListMyInvoices(data, {
			customerId: "cust_new",
		});

		expect("invoices" in result).toBe(true);
		if ("invoices" in result) {
			expect(result.invoices).toHaveLength(0);
			expect(result.total).toBe(0);
		}
	});

	it("does not leak another customer's invoices", async () => {
		const ctrl = createController(data);
		await ctrl.create(makeInvoiceParams("cust_2", "bob@example.com"));
		await ctrl.create(makeInvoiceParams("cust_2", "bob@example.com"));

		const result = await simulateListMyInvoices(data, {
			customerId: "cust_1",
		});

		expect("invoices" in result).toBe(true);
		if ("invoices" in result) {
			expect(result.invoices).toHaveLength(0);
		}
	});
});

describe("store endpoint: get my invoice — auth + ownership check", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);

		const result = await simulateGetMyInvoice(data, invoice.id);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns the invoice for its owner", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);

		const result = await simulateGetMyInvoice(data, invoice.id, {
			customerId: "cust_1",
		});

		expect("invoice" in result).toBe(true);
		if ("invoice" in result) {
			expect(result.invoice.id).toBe(invoice.id);
			expect(result.invoice.lineItems).toBeDefined();
			expect(result.invoice.payments).toBeDefined();
			expect(result.invoice.creditNotes).toBeDefined();
		}
	});

	it("returns 404 for another customer's invoice", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_2", "bob@example.com"),
		);

		const result = await simulateGetMyInvoice(data, invoice.id, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Invoice not found", status: 404 });
	});

	it("returns 404 for nonexistent invoice id", async () => {
		const result = await simulateGetMyInvoice(data, "nonexistent_id", {
			customerId: "cust_1",
		});

		expect(result).toEqual({ error: "Invoice not found", status: 404 });
	});
});

describe("store endpoint: full lifecycle — create → send → pay → auto-transition", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("invoice starts as draft", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);

		expect(invoice.status).toBe("draft");
		expect(invoice.amountPaid).toBe(0);
		expect(invoice.amountDue).toBe(invoice.total);
	});

	it("draft invoices have no issuedAt or dueDate", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);

		expect(invoice.issuedAt).toBeUndefined();
		expect(invoice.dueDate).toBeUndefined();
	});

	it("send transitions to sent and sets issuedAt and dueDate", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);

		const sent = await ctrl.send(invoice.id);

		expect(sent).not.toBeNull();
		expect(sent?.status).toBe("sent");
		expect(sent?.issuedAt).toBeDefined();
		expect(sent?.dueDate).toBeDefined();
	});

	it("cannot send a non-draft invoice", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);
		await ctrl.send(invoice.id);

		const result = await ctrl.send(invoice.id);
		expect(result).toBeNull();
	});

	it("cannot record payment on a draft invoice", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);

		await expect(
			ctrl.recordPayment({
				invoiceId: invoice.id,
				amount: 5000,
				method: "card",
			}),
		).rejects.toThrow("Cannot record payment on draft invoice");
	});

	it("partial payment transitions status to partially_paid", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);
		await ctrl.send(invoice.id);

		await ctrl.recordPayment({
			invoiceId: invoice.id,
			amount: 3000,
			method: "card",
			reference: "ch_partial",
		});

		const updated = await ctrl.getById(invoice.id);
		expect(updated).not.toBeNull();
		expect(updated?.status).toBe("partially_paid");
		expect(updated?.amountPaid).toBe(3000);
		expect(updated?.amountDue).toBe(invoice.total - 3000);
	});

	it("full payment transitions status to paid", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);
		await ctrl.send(invoice.id);

		await ctrl.recordPayment({
			invoiceId: invoice.id,
			amount: invoice.total,
			method: "bank_transfer",
			reference: "txn_full",
		});

		const updated = await ctrl.getById(invoice.id);
		expect(updated).not.toBeNull();
		expect(updated?.status).toBe("paid");
		expect(updated?.amountPaid).toBe(invoice.total);
		expect(updated?.amountDue).toBe(0);
	});

	it("multiple partial payments eventually mark as paid", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create({
			customerId: "cust_1",
			guestEmail: "jane@example.com",
			customerName: "Jane",
			subtotal: 9000,
			lineItems: [{ description: "Item A", quantity: 3, unitPrice: 3000 }],
		});
		await ctrl.send(invoice.id);

		await ctrl.recordPayment({
			invoiceId: invoice.id,
			amount: 3000,
			method: "card",
		});
		const afterFirst = await ctrl.getById(invoice.id);
		expect(afterFirst?.status).toBe("partially_paid");

		await ctrl.recordPayment({
			invoiceId: invoice.id,
			amount: 3000,
			method: "card",
		});
		const afterSecond = await ctrl.getById(invoice.id);
		expect(afterSecond?.status).toBe("partially_paid");

		await ctrl.recordPayment({
			invoiceId: invoice.id,
			amount: 3000,
			method: "card",
		});
		const afterThird = await ctrl.getById(invoice.id);
		expect(afterThird?.status).toBe("paid");
		expect(afterThird?.amountPaid).toBe(9000);
		expect(afterThird?.amountDue).toBe(0);
	});

	it("overpayment still marks as paid with zero amountDue", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);
		await ctrl.send(invoice.id);

		await ctrl.recordPayment({
			invoiceId: invoice.id,
			amount: invoice.total + 500,
			method: "cash",
		});

		const updated = await ctrl.getById(invoice.id);
		expect(updated?.status).toBe("paid");
		expect(updated?.amountDue).toBe(0);
	});

	it("cannot record payment on a void invoice", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);
		await ctrl.send(invoice.id);
		await ctrl.voidInvoice(invoice.id);

		await expect(
			ctrl.recordPayment({
				invoiceId: invoice.id,
				amount: 1000,
				method: "card",
			}),
		).rejects.toThrow("Cannot record payment on void invoice");
	});

	it("line items can only be added to draft invoices", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);
		await ctrl.send(invoice.id);

		await expect(
			ctrl.addLineItem(invoice.id, {
				description: "Extra item",
				quantity: 1,
				unitPrice: 100,
			}),
		).rejects.toThrow("Can only add items to draft invoices");
	});

	it("adding a line item to a draft updates the invoice total", async () => {
		const ctrl = createController(data);
		const invoice = await ctrl.create(
			makeInvoiceParams("cust_1", "jane@example.com"),
		);
		const originalTotal = invoice.total;

		await ctrl.addLineItem(invoice.id, {
			description: "Bonus item",
			quantity: 1,
			unitPrice: 2500,
		});

		const updated = await ctrl.getById(invoice.id);
		expect(updated).not.toBeNull();
		expect(updated?.total).toBe(originalTotal + 2500);
		expect(updated?.lineItems).toHaveLength(2);
	});

	it("full lifecycle: create → add line item → send → partial pay → full pay", async () => {
		const ctrl = createController(data);

		// Create
		const invoice = await ctrl.create({
			customerId: "cust_1",
			guestEmail: "jane@example.com",
			customerName: "Jane Doe",
			subtotal: 5000,
			paymentTerms: "net_30",
			lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 5000 }],
		});
		expect(invoice.status).toBe("draft");
		expect(invoice.total).toBe(5000);

		// Add line item while draft
		await ctrl.addLineItem(invoice.id, {
			description: "Support plan",
			quantity: 1,
			unitPrice: 1000,
		});
		const withExtraItem = await ctrl.getById(invoice.id);
		expect(withExtraItem?.total).toBe(6000);
		expect(withExtraItem?.lineItems).toHaveLength(2);

		// Send
		const sent = await ctrl.send(invoice.id);
		expect(sent?.status).toBe("sent");
		expect(sent?.issuedAt).toBeDefined();
		expect(sent?.dueDate).toBeDefined();

		// Verify via tracking
		const tracked = await simulateTrackInvoice(data, {
			invoiceNumber: invoice.invoiceNumber,
			email: "jane@example.com",
		});
		expect("invoice" in tracked).toBe(true);
		if ("invoice" in tracked) {
			expect(tracked.invoice.status).toBe("sent");
		}

		// Partial payment
		await ctrl.recordPayment({
			invoiceId: invoice.id,
			amount: 2000,
			method: "card",
			reference: "ch_first",
		});
		const afterPartial = await ctrl.getById(invoice.id);
		expect(afterPartial?.status).toBe("partially_paid");
		expect(afterPartial?.amountPaid).toBe(2000);
		expect(afterPartial?.amountDue).toBe(4000);
		expect(afterPartial?.payments).toHaveLength(1);

		// Remaining payment
		await ctrl.recordPayment({
			invoiceId: invoice.id,
			amount: 4000,
			method: "bank_transfer",
			reference: "txn_final",
		});
		const afterFull = await ctrl.getById(invoice.id);
		expect(afterFull?.status).toBe("paid");
		expect(afterFull?.amountPaid).toBe(6000);
		expect(afterFull?.amountDue).toBe(0);
		expect(afterFull?.payments).toHaveLength(2);

		// Verify customer can see it via my-invoices
		const myInvoices = await simulateListMyInvoices(data, {
			customerId: "cust_1",
		});
		expect("invoices" in myInvoices).toBe(true);
		if ("invoices" in myInvoices) {
			expect(myInvoices.invoices).toHaveLength(1);
			expect(myInvoices.invoices[0].status).toBe("paid");
		}
	});
});
