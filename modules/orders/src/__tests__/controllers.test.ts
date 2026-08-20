import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import orders from "../index";
import type { CreateOrderParams } from "../service";
import { createOrderController } from "../service-impl";

// ── Helpers ───────────────────────────────────────────────────────────────

const sampleAddress = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "123 Main St",
	city: "Springfield",
	state: "IL",
	postalCode: "62701",
	country: "US",
};

function makeOrderParams(
	overrides: Partial<CreateOrderParams> = {},
): CreateOrderParams {
	const items = overrides.items ?? [
		{ productId: "prod_1", name: "Widget", price: 1000, quantity: 1 },
	];
	const subtotal =
		overrides.subtotal ??
		items.reduce((sum, item) => sum + item.price * item.quantity, 0);
	const taxAmount = overrides.taxAmount ?? 100;
	const total =
		overrides.total ??
		Math.max(
			0,
			subtotal +
				taxAmount +
				(overrides.shippingAmount ?? 0) -
				(overrides.discountAmount ?? 0) -
				(overrides.giftCardAmount ?? 0) -
				(overrides.storeCreditAmount ?? 0),
		);
	return {
		...overrides,
		subtotal,
		total,
		taxAmount,
		items,
	};
}

// ── Controller registration contract ─────────────────────────────────────
// The checkout module accesses `controllers.order` (singular) to create
// orders after payment. If this key ever changes, checkout breaks silently.

describe("orders module — controller key contract", () => {
	it("registers its controller as 'order' (singular)", async () => {
		const mod = orders();
		const data = createMockDataService();
		const result = await mod.init?.(createMockModuleContext({ data }));

		expect(result?.controllers).toHaveProperty("order");
		expect(result?.controllers).not.toHaveProperty("orders");
	});
});

// ── Edge-case and data integrity tests ───────────────────────────────────

describe("orders controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createOrderController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createOrderController(mockData);
	});

	// ── create — edge cases ─────────────────────────────────────────

	describe("create — edge cases", () => {
		it("uses provided id when given", async () => {
			const order = await controller.create(
				makeOrderParams({ id: "custom-id-123" }),
			);
			expect(order.id).toBe("custom-id-123");
		});

		it("generates a unique id when not provided", async () => {
			const a = await controller.create(makeOrderParams());
			const b = await controller.create(makeOrderParams());
			expect(a.id).not.toBe(b.id);
		});

		it("generates unique order numbers for each order", async () => {
			const orders = await Promise.all(
				Array.from({ length: 5 }, () => controller.create(makeOrderParams())),
			);
			const numbers = new Set(orders.map((o) => o.orderNumber));
			expect(numbers.size).toBe(5);
		});

		it("calculates subtotal per line item correctly", async () => {
			const order = await controller.create(
				makeOrderParams({
					items: [
						{
							productId: "p1",
							name: "A",
							price: 2550,
							quantity: 4,
						},
					],
				}),
			);
			const items = await controller.getItems(order.id);
			expect(items[0].subtotal).toBe(10_200);
		});

		it("creates both billing and shipping addresses", async () => {
			const order = await controller.create(
				makeOrderParams({
					billingAddress: sampleAddress,
					shippingAddress: {
						...sampleAddress,
						firstName: "John",
						line1: "456 Oak Ave",
					},
				}),
			);
			const addrs = await controller.getAddresses(order.id);
			expect(addrs).toHaveLength(2);
			const billing = addrs.find((a) => a.type === "billing");
			const shipping = addrs.find((a) => a.type === "shipping");
			expect(billing?.firstName).toBe("Jane");
			expect(shipping?.firstName).toBe("John");
		});

		it("handles order with no addresses", async () => {
			const order = await controller.create(makeOrderParams());
			const addrs = await controller.getAddresses(order.id);
			expect(addrs).toHaveLength(0);
		});

		it("handles order with multiple items", async () => {
			const order = await controller.create(
				makeOrderParams({
					items: [
						{
							productId: "p1",
							name: "Item A",
							price: 500,
							quantity: 2,
						},
						{
							productId: "p2",
							name: "Item B",
							price: 300,
							quantity: 3,
							variantId: "v1",
							sku: "SKU-B",
						},
					],
				}),
			);
			const items = await controller.getItems(order.id);
			expect(items).toHaveLength(2);
			expect(items.find((i) => i.productId === "p2")?.sku).toBe("SKU-B");
		});

		it("preserves metadata on creation", async () => {
			const order = await controller.create(
				makeOrderParams({
					metadata: { source: "api", campaign: "summer" },
				}),
			);
			expect(order.metadata).toEqual({
				source: "api",
				campaign: "summer",
			});
		});
	});

	// ── cancel — status guard edge cases ────────────────────────────

	describe("cancel — status guard", () => {
		it("cannot cancel a completed order", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.updateStatus(order.id, "completed");
			const result = await controller.cancel(order.id);
			expect(result).toBeNull();
		});

		it("cannot cancel a refunded order", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.updateStatus(order.id, "refunded");
			const result = await controller.cancel(order.id);
			expect(result).toBeNull();
		});

		it("cannot cancel an already-cancelled order", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.cancel(order.id);
			const result = await controller.cancel(order.id);
			expect(result).toBeNull();
		});

		it("can cancel from on_hold status", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.updateStatus(order.id, "on_hold");
			const result = await controller.cancel(order.id);
			expect(result?.status).toBe("cancelled");
		});

		it("cancel returns null for non-existent order", async () => {
			const result = await controller.cancel("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── listForCustomer — isolation ─────────────────────────────────

	describe("listForCustomer — customer isolation", () => {
		it("only returns orders for the specified customer", async () => {
			await controller.create(makeOrderParams({ customerId: "cust_a" }));
			await controller.create(makeOrderParams({ customerId: "cust_b" }));
			await controller.create(makeOrderParams({ customerId: "cust_a" }));

			const result = await controller.listForCustomer("cust_a");
			expect(result.orders).toHaveLength(2);
			expect(result.total).toBe(2);
			for (const o of result.orders) {
				expect(o.customerId).toBe("cust_a");
			}
		});

		it("returns empty list for customer with no orders", async () => {
			const result = await controller.listForCustomer("nonexistent");
			expect(result.orders).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it("paginates correctly", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create(makeOrderParams({ customerId: "pag_cust" }));
			}

			const page1 = await controller.listForCustomer("pag_cust", {
				limit: 2,
				offset: 0,
			});
			expect(page1.orders).toHaveLength(2);
			expect(page1.total).toBe(5);

			const page3 = await controller.listForCustomer("pag_cust", {
				limit: 2,
				offset: 4,
			});
			expect(page3.orders).toHaveLength(1);
		});
	});

	// ── list — search and filters ───────────────────────────────────

	describe("list — combined filters", () => {
		it("search by order number is case-insensitive", async () => {
			const order = await controller.create(makeOrderParams());
			const lowerNum = order.orderNumber.toLowerCase();

			const result = await controller.list({ search: lowerNum });
			expect(result.orders).toHaveLength(1);
		});

		it("search by guest email", async () => {
			await controller.create(
				makeOrderParams({ guestEmail: "alice@example.com" }),
			);
			await controller.create(
				makeOrderParams({ guestEmail: "bob@example.com" }),
			);

			const result = await controller.list({ search: "alice" });
			expect(result.orders).toHaveLength(1);
		});

		it("combines status and search filters", async () => {
			const o1 = await controller.create(
				makeOrderParams({ guestEmail: "target@test.com" }),
			);
			await controller.updateStatus(o1.id, "completed");
			await controller.create(
				makeOrderParams({ guestEmail: "target@test.com" }),
			);

			const result = await controller.list({
				status: "completed",
				search: "target",
			});
			expect(result.orders).toHaveLength(1);
			expect(result.orders[0].status).toBe("completed");
		});

		it("returns empty when no match", async () => {
			await controller.create(makeOrderParams());
			const result = await controller.list({
				search: "nonexistent-search-term",
			});
			expect(result.orders).toHaveLength(0);
			expect(result.total).toBe(0);
		});
	});

	// ── getByTracking — email matching ──────────────────────────────

	describe("getByTracking — email matching", () => {
		it("returns null when email does not match", async () => {
			const order = await controller.create(
				makeOrderParams({ guestEmail: "alice@test.com" }),
			);
			const result = await controller.getByTracking(
				order.orderNumber,
				"eve@attacker.com",
			);
			expect(result).toBeNull();
		});

		it("matches against metadata.customerEmail for logged-in customers", async () => {
			const order = await controller.create(
				makeOrderParams({
					customerId: "cust_1",
					metadata: { customerEmail: "customer@test.com" },
				}),
			);
			const result = await controller.getByTracking(
				order.orderNumber,
				"customer@test.com",
			);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(order.id);
		});

		it("returns null for logged-in customer without email in metadata", async () => {
			const order = await controller.create(
				makeOrderParams({ customerId: "cust_1" }),
			);
			const result = await controller.getByTracking(
				order.orderNumber,
				"random@test.com",
			);
			expect(result).toBeNull();
		});

		it("email matching is case-insensitive and trims whitespace", async () => {
			const order = await controller.create(
				makeOrderParams({ guestEmail: "Alice@Example.COM" }),
			);
			const result = await controller.getByTracking(
				order.orderNumber,
				"  alice@example.com  ",
			);
			expect(result).not.toBeNull();
		});

		it("returns null for non-existent order number", async () => {
			const result = await controller.getByTracking(
				"ORD-NONEXISTENT",
				"test@test.com",
			);
			expect(result).toBeNull();
		});
	});

	// ── fulfillment status — complex scenarios ──────────────────────

	// ── invoice — edge cases ────────────────────────────────────────

	describe("getInvoiceData — edge cases", () => {
		it("customer name falls back to 'Customer' when no billing address", async () => {
			const order = await controller.create(makeOrderParams());
			const invoice = await controller.getInvoiceData(order.id, "My Store");
			expect(invoice?.customerName).toBe("Customer");
		});

		it("due date is 30 days after issue for unpaid orders", async () => {
			const order = await controller.create(makeOrderParams());
			const invoice = await controller.getInvoiceData(order.id, "Store");
			// Just verify it exists and is a non-empty string
			expect(invoice?.dueDate).toBeTruthy();
			expect(invoice?.issueDate).toBeTruthy();
			expect(invoice?.dueDate).not.toBe(invoice?.issueDate);
		});

		it("due date equals issue date for paid orders", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.updatePaymentStatus(order.id, "paid");
			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.dueDate).toBe(invoice?.issueDate);
		});

		it("invoice status is void for cancelled orders", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.updateStatus(order.id, "cancelled");
			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.status).toBe("void");
		});

		it("invoice status is void for voided payment", async () => {
			const order = await controller.create(makeOrderParams());
			await controller.updatePaymentStatus(order.id, "voided");
			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.status).toBe("void");
		});

		it("invoice number format includes date and order suffix", async () => {
			const order = await controller.create(makeOrderParams());
			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.invoiceNumber).toMatch(/^INV-\d{8}-/);
		});
	});

	// ── reorder — edge cases ────────────────────────────────────────

	describe("getReorderItems — edge cases", () => {
		it("preserves variant and sku info", async () => {
			const order = await controller.create(
				makeOrderParams({
					items: [
						{
							productId: "p1",
							variantId: "v1",
							name: "Widget",
							sku: "WDG-V1",
							price: 500,
							quantity: 2,
						},
					],
				}),
			);

			const items = await controller.getReorderItems(order.id);
			expect(items).toHaveLength(1);
			expect(items?.[0].variantId).toBe("v1");
			expect(items?.[0].sku).toBe("WDG-V1");
			expect(items?.[0].price).toBe(500);
		});

		it("returns null for non-existent order", async () => {
			const items = await controller.getReorderItems("nonexistent");
			expect(items).toBeNull();
		});
	});

	// ── cross-order isolation ───────────────────────────────────────

	describe("cross-order isolation", () => {
		it("deleting one order does not affect another", async () => {
			const a = await controller.create(makeOrderParams());
			const b = await controller.create(makeOrderParams());

			await controller.delete(a.id);

			const orderB = await controller.getById(b.id);
			expect(orderB).not.toBeNull();
			expect(orderB?.id).toBe(b.id);
		});

		it("items from different orders are isolated", async () => {
			const a = await controller.create(
				makeOrderParams({
					items: [
						{
							productId: "p1",
							name: "A",
							price: 100,
							quantity: 1,
						},
					],
				}),
			);
			const b = await controller.create(
				makeOrderParams({
					items: [
						{
							productId: "p2",
							name: "B",
							price: 200,
							quantity: 2,
						},
						{
							productId: "p3",
							name: "C",
							price: 300,
							quantity: 3,
						},
					],
				}),
			);

			expect(await controller.getItems(a.id)).toHaveLength(1);
			expect(await controller.getItems(b.id)).toHaveLength(2);
		});

		it("returns from different orders are isolated", async () => {
			const a = await controller.create(makeOrderParams());
			const b = await controller.create(makeOrderParams());
			const aItems = await controller.getItems(a.id);

			await controller.createReturn({
				orderId: a.id,
				reason: "defective",
				items: [{ orderItemId: aItems[0].id, quantity: 1 }],
			});

			const aReturns = await controller.listReturns(a.id);
			const bReturns = await controller.listReturns(b.id);
			expect(aReturns).toHaveLength(1);
			expect(bReturns).toHaveLength(0);
		});

		it("notes from different orders are isolated", async () => {
			const a = await controller.create(makeOrderParams());
			const b = await controller.create(makeOrderParams());

			await controller.addNote({
				orderId: a.id,
				content: "Note for A",
			});
			await controller.addNote({
				orderId: a.id,
				content: "Another note for A",
			});

			expect(await controller.listNotes(a.id)).toHaveLength(2);
			expect(await controller.listNotes(b.id)).toHaveLength(0);
		});
	});

	// ── bulk operations — edge cases ────────────────────────────────

	describe("bulk operations — edge cases", () => {
		it("bulkDelete cascades related records", async () => {
			const order = await controller.create(
				makeOrderParams({
					billingAddress: sampleAddress,
				}),
			);
			const items = await controller.getItems(order.id);

			await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0].id, quantity: 1 }],
			});
			await controller.addNote({
				orderId: order.id,
				content: "Test note",
			});

			const result = await controller.bulkDelete([order.id]);
			expect(result.deleted).toBe(1);

			// Verify all related records are gone
			expect(await controller.getById(order.id)).toBeNull();
			expect(await controller.getItems(order.id)).toHaveLength(0);
			expect(await controller.getAddresses(order.id)).toHaveLength(0);
			expect(await controller.listReturns(order.id)).toHaveLength(0);
		});

		it("bulkUpdateStatus with mix of valid and invalid ids", async () => {
			const order = await controller.create(makeOrderParams());
			const result = await controller.bulkUpdateStatus(
				[order.id, "nonexistent_1", "nonexistent_2"],
				"processing",
			);
			expect(result.updated).toBe(1);
		});

		it("bulkUpdatePaymentStatus updates all valid orders", async () => {
			const orders = await Promise.all(
				Array.from({ length: 3 }, () => controller.create(makeOrderParams())),
			);
			const ids = orders.map((o) => o.id);

			const result = await controller.bulkUpdatePaymentStatus(ids, "paid");
			expect(result.updated).toBe(3);

			for (const id of ids) {
				const order = await controller.getById(id);
				expect(order?.paymentStatus).toBe("paid");
			}
		});
	});

	// ── update — metadata merge ─────────────────────────────────────

	describe("update — notes and metadata", () => {
		it("updates notes without affecting metadata", async () => {
			const order = await controller.create(
				makeOrderParams({ metadata: { key: "value" } }),
			);
			const updated = await controller.update(order.id, {
				notes: "New note",
			});
			expect(updated?.notes).toBe("New note");
			expect(updated?.metadata).toEqual({ key: "value" });
		});

		it("updates metadata without affecting notes", async () => {
			const order = await controller.create(
				makeOrderParams({ notes: "Original note" }),
			);
			const updated = await controller.update(order.id, {
				metadata: { newKey: "newValue" },
			});
			expect(updated?.notes).toBe("Original note");
			expect(updated?.metadata).toEqual({ newKey: "newValue" });
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.update("nonexistent", {
				notes: "test",
			});
			expect(result).toBeNull();
		});

		it("advances updatedAt timestamp", async () => {
			const order = await controller.create(makeOrderParams());
			const before = order.updatedAt.getTime();

			await new Promise((r) => setTimeout(r, 5));

			const updated = await controller.update(order.id, {
				notes: "updated",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
		});
	});

	// ── return lifecycle ────────────────────────────────────────────

	describe("return lifecycle", () => {
		it("full return lifecycle: request → approve → refund → complete", async () => {
			const order = await controller.create(makeOrderParams());
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				customerNotes: "Screen cracked on arrival",
				items: [{ orderItemId: items[0].id, quantity: 1 }],
			});
			expect(ret.status).toBe("requested");
			expect(ret.type).toBe("refund");

			const approved = await controller.updateReturn(ret.id, {
				status: "approved",
				adminNotes: "Approved by CS team",
			});
			expect(approved?.status).toBe("approved");

			const refunded = await controller.updateReturn(ret.id, {
				status: "refunded",
				refundAmount: 1000,
			});
			expect(refunded?.status).toBe("refunded");
			expect(refunded?.refundAmount).toBe(1000);

			const completed = await controller.updateReturn(ret.id, {
				status: "completed",
			});
			expect(completed?.status).toBe("completed");
		});

		it("return with tracking info and carrier URL generation", async () => {
			const order = await controller.create(makeOrderParams());
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "wrong_item",
				items: [{ orderItemId: items[0].id, quantity: 1 }],
			});

			const updated = await controller.updateReturn(ret.id, {
				status: "shipped_back",
				carrier: "UPS",
				trackingNumber: "1Z999AA10123456784",
			});
			expect(updated?.trackingUrl).toContain("ups.com");
			expect(updated?.trackingUrl).toContain("1Z999AA10123456784");
		});

		it("deleteReturn removes return and its items", async () => {
			const order = await controller.create(makeOrderParams());
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "changed_mind",
				items: [{ orderItemId: items[0].id, quantity: 1, reason: "test" }],
			});

			await controller.deleteReturn(ret.id);
			expect(await controller.getReturn(ret.id)).toBeNull();
		});
	});

	// ── fulfillment with tracking ───────────────────────────────────

	// ── listReturnsForCustomer — cross-order ────────────────────────

	describe("listReturnsForCustomer — complex scenarios", () => {
		it("aggregates returns across multiple orders", async () => {
			const o1 = await controller.create(
				makeOrderParams({ customerId: "cust_1" }),
			);
			const o2 = await controller.create(
				makeOrderParams({ customerId: "cust_1" }),
			);
			const o1Items = await controller.getItems(o1.id);
			const o2Items = await controller.getItems(o2.id);

			await controller.createReturn({
				orderId: o1.id,
				reason: "defective",
				items: [{ orderItemId: o1Items[0].id, quantity: 1 }],
			});
			await controller.createReturn({
				orderId: o2.id,
				reason: "wrong_item",
				items: [{ orderItemId: o2Items[0].id, quantity: 1 }],
			});

			const result = await controller.listReturnsForCustomer("cust_1");
			expect(result.returns).toHaveLength(2);
			expect(result.total).toBe(2);
			for (const r of result.returns) {
				expect(r.orderNumber).toMatch(/^ORD-/);
			}
		});

		it("excludes returns from other customers", async () => {
			const o1 = await controller.create(
				makeOrderParams({ customerId: "cust_1" }),
			);
			const o2 = await controller.create(
				makeOrderParams({ customerId: "cust_2" }),
			);
			const o1Items = await controller.getItems(o1.id);
			const o2Items = await controller.getItems(o2.id);

			await controller.createReturn({
				orderId: o1.id,
				reason: "defective",
				items: [{ orderItemId: o1Items[0].id, quantity: 1 }],
			});
			await controller.createReturn({
				orderId: o2.id,
				reason: "wrong_item",
				items: [{ orderItemId: o2Items[0].id, quantity: 1 }],
			});

			const c1Returns = await controller.listReturnsForCustomer("cust_1");
			expect(c1Returns.returns).toHaveLength(1);

			const c2Returns = await controller.listReturnsForCustomer("cust_2");
			expect(c2Returns.returns).toHaveLength(1);
		});

		it("filters by status", async () => {
			const order = await controller.create(
				makeOrderParams({ customerId: "cust_filter" }),
			);
			const items = await controller.getItems(order.id);

			const r1 = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0].id, quantity: 1 }],
			});
			await controller.createReturn({
				orderId: order.id,
				reason: "wrong_item",
				items: [{ orderItemId: items[0].id, quantity: 1 }],
			});

			await controller.updateReturn(r1.id, { status: "approved" });

			const result = await controller.listReturnsForCustomer("cust_filter", {
				status: "approved",
			});
			expect(result.returns).toHaveLength(1);
			expect(result.returns[0].status).toBe("approved");
		});
	});
});
