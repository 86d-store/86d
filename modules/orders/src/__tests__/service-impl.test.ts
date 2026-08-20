import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateOrderParams } from "../service";
import { createOrderController } from "../service-impl";

const sampleItems: CreateOrderParams["items"] = [
	{
		productId: "prod_abc",
		name: "Test Widget",
		price: 1999,
		quantity: 2,
	},
];

const sampleOrder: Omit<CreateOrderParams, "items"> = {
	customerId: "cust_123",
	subtotal: 3998,
	total: 3998,
};

describe("createOrderController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createOrderController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createOrderController(mockData);
	});

	describe("create", () => {
		it("creates an order with correct defaults", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			expect(order.status).toBe("pending");
			expect(order.paymentStatus).toBe("unpaid");
			expect(order.currency).toBe("USD");
			expect(order.customerId).toBe("cust_123");
			expect(order.subtotal).toBe(3998);
			expect(order.total).toBe(3998);
			expect(order.orderNumber).toMatch(/^ORD-/);
			expect(order.createdAt).toBeInstanceOf(Date);
		});

		it("creates order items", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const items = await controller.getItems(order.id);
			expect(items).toHaveLength(1);
			expect(items[0]?.productId).toBe("prod_abc");
			expect(items[0]?.name).toBe("Test Widget");
			expect(items[0]?.quantity).toBe(2);
			expect(items[0]?.subtotal).toBe(3998);
		});

		it("creates billing and shipping addresses", async () => {
			const address = {
				firstName: "John",
				lastName: "Doe",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			};

			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
				billingAddress: address,
				shippingAddress: { ...address, line1: "456 Oak Ave" },
			});

			const addresses = await controller.getAddresses(order.id);
			expect(addresses).toHaveLength(2);
			const billing = addresses.find((a) => a.type === "billing");
			const shipping = addresses.find((a) => a.type === "shipping");
			expect(billing?.line1).toBe("123 Main St");
			expect(shipping?.line1).toBe("456 Oak Ave");
		});

		it("generates unique order numbers", async () => {
			const orders = await Promise.all([
				controller.create({ ...sampleOrder, items: sampleItems }),
				controller.create({ ...sampleOrder, items: sampleItems }),
				controller.create({ ...sampleOrder, items: sampleItems }),
			]);

			const numbers = orders.map((o) => o.orderNumber);
			const unique = new Set(numbers);
			expect(unique.size).toBe(3);
		});

		it("uses provided currency", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
				currency: "EUR",
			});
			expect(order.currency).toBe("EUR");
		});

		it("defaults optional amounts to 0", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			expect(order.taxAmount).toBe(0);
			expect(order.shippingAmount).toBe(0);
			expect(order.discountAmount).toBe(0);
			expect(order.giftCardAmount).toBe(0);
		});

		it("persists giftCardAmount when provided", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
				giftCardAmount: 2500,
				total: 1498,
			});
			expect(order.giftCardAmount).toBe(2500);

			const fetched = await controller.getById(order.id);
			expect(fetched?.giftCardAmount).toBe(2500);
		});

		it("uses provided paymentStatus instead of defaulting to unpaid", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
				paymentStatus: "paid",
			});
			expect(order.paymentStatus).toBe("paid");

			const fetched = await controller.getById(order.id);
			expect(fetched?.paymentStatus).toBe("paid");
		});
	});

	describe("getById", () => {
		it("returns null for non-existent order", async () => {
			const result = await controller.getById("non-existent");
			expect(result).toBeNull();
		});

		it("returns order with items and addresses", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
				shippingAddress: {
					firstName: "Jane",
					lastName: "Doe",
					line1: "789 Elm",
					city: "Chicago",
					state: "IL",
					postalCode: "60601",
					country: "US",
				},
			});

			const found = await controller.getById(created.id);
			expect(found).not.toBeNull();
			expect(found?.items).toHaveLength(1);
			expect(found?.addresses).toHaveLength(1);
		});
	});

	describe("getByOrderNumber", () => {
		it("finds order by order number", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const found = await controller.getByOrderNumber(created.orderNumber);
			expect(found?.id).toBe(created.id);
		});

		it("returns null for non-existent order number", async () => {
			const result = await controller.getByOrderNumber("ORD-INVALID");
			expect(result).toBeNull();
		});
	});

	describe("listForCustomer", () => {
		it("lists orders for a specific customer", async () => {
			await controller.create({ ...sampleOrder, items: sampleItems });
			await controller.create({
				...sampleOrder,
				customerId: "cust_other",
				items: sampleItems,
			});

			const { orders, total } = await controller.listForCustomer("cust_123");
			expect(total).toBe(1);
			expect(orders[0]?.customerId).toBe("cust_123");
		});

		it("paginates results", async () => {
			await controller.create({ ...sampleOrder, items: sampleItems });
			await controller.create({ ...sampleOrder, items: sampleItems });
			await controller.create({ ...sampleOrder, items: sampleItems });

			const { orders, total } = await controller.listForCustomer("cust_123", {
				limit: 2,
				offset: 0,
			});
			expect(total).toBe(3);
			expect(orders).toHaveLength(2);
		});
	});

	describe("list", () => {
		beforeEach(async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			await controller.updateStatus(order1.id, "processing");

			const guestOrder: typeof sampleOrder = {
				subtotal: sampleOrder.subtotal,
				total: sampleOrder.total,
			};
			await controller.create({
				...guestOrder,
				guestEmail: "guest@example.com",
				items: sampleItems,
			});
		});

		it("lists all orders", async () => {
			const { total } = await controller.list({});
			expect(total).toBe(2);
		});

		it("filters by status", async () => {
			const { orders } = await controller.list({ status: "processing" });
			expect(orders).toHaveLength(1);
		});

		it("searches by guest email", async () => {
			const { orders } = await controller.list({ search: "guest@example" });
			expect(orders).toHaveLength(1);
			expect(orders[0]?.guestEmail).toBe("guest@example.com");
		});
	});

	describe("listForExport", () => {
		it("returns orders with items and addresses", async () => {
			const address = {
				firstName: "Jane",
				lastName: "Smith",
				line1: "100 Commerce Blvd",
				city: "Austin",
				state: "TX",
				postalCode: "73301",
				country: "US",
			};

			await controller.create({
				...sampleOrder,
				items: sampleItems,
				shippingAddress: address,
				billingAddress: address,
			});

			const { orders, total } = await controller.listForExport({});
			expect(total).toBe(1);
			expect(orders[0]?.items).toHaveLength(1);
			expect(orders[0]?.items[0]?.name).toBe("Test Widget");
			expect(orders[0]?.addresses).toHaveLength(2);
		});

		it("filters by date range", async () => {
			const old = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			// Manually backdate by overwriting the stored record
			const backdated = {
				...old,
				createdAt: new Date("2024-01-15T00:00:00Z"),
			};
			await mockData.upsert("order", old.id, backdated);

			await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			// Only orders from 2025 onward
			const { orders, total } = await controller.listForExport({
				dateFrom: new Date("2025-01-01T00:00:00Z"),
			});
			expect(total).toBe(1);
			expect(orders).toHaveLength(1);

			// Only orders before 2025
			const { total: oldTotal } = await controller.listForExport({
				dateTo: new Date("2024-12-31T23:59:59Z"),
			});
			expect(oldTotal).toBe(1);
		});

		it("filters by status", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			await controller.updateStatus(order1.id, "completed");

			await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const { orders, total } = await controller.listForExport({
				status: "completed",
			});
			expect(total).toBe(1);
			expect(orders[0]?.status).toBe("completed");
			expect(orders[0]?.items).toHaveLength(1);
		});

		it("filters by payment status", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			await controller.updatePaymentStatus(order1.id, "paid");

			await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const { orders } = await controller.listForExport({
				paymentStatus: "paid",
			});
			expect(orders).toHaveLength(1);
			expect(orders[0]?.paymentStatus).toBe("paid");
		});

		it("searches by order number", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			await controller.create({
				...sampleOrder,
				guestEmail: "other@example.com",
				items: sampleItems,
			});

			const { orders } = await controller.listForExport({
				search: created.orderNumber,
			});
			expect(orders).toHaveLength(1);
			expect(orders[0]?.orderNumber).toBe(created.orderNumber);
		});

		it("respects limit parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create({
					...sampleOrder,
					items: sampleItems,
				});
			}

			const { orders, total } = await controller.listForExport({
				limit: 2,
			});
			expect(total).toBe(5);
			expect(orders).toHaveLength(2);
		});

		it("combines date range with status filter", async () => {
			const old = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			await controller.updateStatus(old.id, "completed");
			const backdated = {
				...old,
				status: "completed" as const,
				createdAt: new Date("2024-06-01T00:00:00Z"),
				updatedAt: new Date("2024-06-01T00:00:00Z"),
			};
			await mockData.upsert("order", old.id, backdated);

			const recent = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			await controller.updateStatus(recent.id, "completed");

			await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const { orders } = await controller.listForExport({
				status: "completed",
				dateFrom: new Date("2025-01-01T00:00:00Z"),
			});
			expect(orders).toHaveLength(1);
		});

		it("returns empty array when no orders match", async () => {
			const { orders, total } = await controller.listForExport({
				status: "refunded",
			});
			expect(total).toBe(0);
			expect(orders).toHaveLength(0);
		});

		it("sorts by newest first", async () => {
			const first = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			// Backdate first order so second is clearly newer
			const backdated = {
				...first,
				createdAt: new Date("2024-01-01T00:00:00Z"),
			};
			await mockData.upsert("order", first.id, backdated);

			const second = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const { orders } = await controller.listForExport({});
			expect(orders[0]?.id).toBe(second.id);
			expect(orders[1]?.id).toBe(first.id);
		});
	});

	describe("updateStatus", () => {
		it("returns null for non-existent order", async () => {
			const result = await controller.updateStatus(
				"non-existent",
				"processing",
			);
			expect(result).toBeNull();
		});

		it("updates order status", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const updated = await controller.updateStatus(created.id, "processing");
			expect(updated?.status).toBe("processing");

			const found = await controller.getById(created.id);
			expect(found?.status).toBe("processing");
		});
	});

	describe("updatePaymentStatus", () => {
		it("updates payment status", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const updated = await controller.updatePaymentStatus(created.id, "paid");
			expect(updated?.paymentStatus).toBe("paid");
		});
	});

	describe("cancel", () => {
		it("cancels a pending order", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const cancelled = await controller.cancel(created.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cannot cancel a completed order", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			await controller.updateStatus(created.id, "completed");

			const result = await controller.cancel(created.id);
			expect(result).toBeNull();
		});

		it("can cancel processing order", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			await controller.updateStatus(created.id, "processing");

			const cancelled = await controller.cancel(created.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.cancel("non-existent");
			expect(result).toBeNull();
		});
	});

	describe("update", () => {
		it("updates notes and metadata", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const updated = await controller.update(created.id, {
				notes: "Customer requested gift wrapping",
				metadata: { giftWrap: true },
			});

			expect(updated?.notes).toBe("Customer requested gift wrapping");
			expect(updated?.metadata).toEqual({ giftWrap: true });
		});
	});

	describe("delete", () => {
		it("deletes an order", async () => {
			const created = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			await controller.delete(created.id);
			const found = await controller.getById(created.id);
			expect(found).toBeNull();
		});
	});

	// ── Return Request Tests ───────────────────────────────────────────────

	describe("createReturn", () => {
		it("creates a return request with items", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			expect(ret.orderId).toBe(order.id);
			expect(ret.status).toBe("requested");
			expect(ret.type).toBe("refund");
			expect(ret.reason).toBe("defective");
			expect(ret.createdAt).toBeInstanceOf(Date);
		});

		it("defaults type to refund", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "wrong_item",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			expect(ret.type).toBe("refund");
		});

		it("accepts exchange type", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				type: "exchange",
				reason: "too_small",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			expect(ret.type).toBe("exchange");
		});

		it("stores customer notes", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "damaged_in_shipping",
				customerNotes: "Box was crushed on arrival",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			expect(ret.customerNotes).toBe("Box was crushed on arrival");
		});

		it("stores return items correctly", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [
					{ orderItemId: items[0]?.id, quantity: 1, reason: "Screen cracked" },
				],
			});

			const found = await controller.getReturn(ret.id);
			expect(found).not.toBeNull();
			expect(found?.items).toHaveLength(1);
			expect(found?.items[0]?.orderItemId).toBe(items[0]?.id);
			expect(found?.items[0]?.quantity).toBe(1);
			expect(found?.items[0]?.reason).toBe("Screen cracked");
		});
	});

	describe("getReturn", () => {
		it("returns null for non-existent return", async () => {
			const result = await controller.getReturn("non-existent");
			expect(result).toBeNull();
		});

		it("returns return request with items", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const created = await controller.createReturn({
				orderId: order.id,
				reason: "not_as_described",
				items: [{ orderItemId: items[0]?.id, quantity: 2 }],
			});

			const found = await controller.getReturn(created.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.items).toHaveLength(1);
			expect(found?.reason).toBe("not_as_described");
		});
	});

	describe("listReturns", () => {
		it("lists all returns for an order", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			await controller.createReturn({
				orderId: order.id,
				reason: "changed_mind",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const returns = await controller.listReturns(order.id);
			expect(returns).toHaveLength(2);
			expect(returns.every((r) => r.items.length > 0)).toBe(true);
		});

		it("returns empty array for order with no returns", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const returns = await controller.listReturns(order.id);
			expect(returns).toHaveLength(0);
		});
	});

	describe("listAllReturns", () => {
		it("lists all returns across orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items1 = await controller.getItems(order1.id);

			const order2 = await controller.create({
				...sampleOrder,
				customerId: "cust_other",
				items: sampleItems,
			});
			const items2 = await controller.getItems(order2.id);

			await controller.createReturn({
				orderId: order1.id,
				reason: "defective",
				items: [{ orderItemId: items1[0]?.id, quantity: 1 }],
			});

			await controller.createReturn({
				orderId: order2.id,
				reason: "wrong_item",
				items: [{ orderItemId: items2[0]?.id, quantity: 1 }],
			});

			const { returns, total } = await controller.listAllReturns({});
			expect(total).toBe(2);
			expect(returns).toHaveLength(2);
		});

		it("filters by status", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			await controller.updateReturn(ret.id, { status: "approved" });

			await controller.createReturn({
				orderId: order.id,
				reason: "changed_mind",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const { returns } = await controller.listAllReturns({
				status: "approved",
			});
			expect(returns).toHaveLength(1);
			expect(returns[0]?.status).toBe("approved");
		});

		it("paginates results", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			for (let i = 0; i < 3; i++) {
				await controller.createReturn({
					orderId: order.id,
					reason: "defective",
					items: [{ orderItemId: items[0]?.id, quantity: 1 }],
				});
			}

			const { returns, total } = await controller.listAllReturns({
				limit: 2,
				offset: 0,
			});
			expect(total).toBe(3);
			expect(returns).toHaveLength(2);
		});
	});

	describe("updateReturn", () => {
		it("returns null for non-existent return", async () => {
			const result = await controller.updateReturn("non-existent", {
				status: "approved",
			});
			expect(result).toBeNull();
		});

		it("updates return status", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const updated = await controller.updateReturn(ret.id, {
				status: "approved",
			});

			expect(updated?.status).toBe("approved");
		});

		it("updates admin notes and refund amount", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const updated = await controller.updateReturn(ret.id, {
				adminNotes: "Approved — full refund authorized",
				refundAmount: 1999,
			});

			expect(updated?.adminNotes).toBe("Approved — full refund authorized");
			expect(updated?.refundAmount).toBe(1999);
		});

		it("updates tracking info with auto-generated URL", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "wrong_item",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const updated = await controller.updateReturn(ret.id, {
				carrier: "UPS",
				trackingNumber: "1Z999RET",
			});

			expect(updated?.carrier).toBe("UPS");
			expect(updated?.trackingNumber).toBe("1Z999RET");
			expect(updated?.trackingUrl).toContain("ups.com");
		});

		it("transitions through complete return lifecycle", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			expect(ret.status).toBe("requested");

			const approved = await controller.updateReturn(ret.id, {
				status: "approved",
			});
			expect(approved?.status).toBe("approved");

			const shippedBack = await controller.updateReturn(ret.id, {
				status: "shipped_back",
				carrier: "USPS",
				trackingNumber: "9400RET",
			});
			expect(shippedBack?.status).toBe("shipped_back");

			const received = await controller.updateReturn(ret.id, {
				status: "received",
			});
			expect(received?.status).toBe("received");

			const refunded = await controller.updateReturn(ret.id, {
				status: "refunded",
				refundAmount: 1999,
			});
			expect(refunded?.status).toBe("refunded");
			expect(refunded?.refundAmount).toBe(1999);

			const completed = await controller.updateReturn(ret.id, {
				status: "completed",
			});
			expect(completed?.status).toBe("completed");
		});
	});

	describe("deleteReturn", () => {
		it("deletes a return and its items", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			await controller.deleteReturn(ret.id);

			const found = await controller.getReturn(ret.id);
			expect(found).toBeNull();
		});

		it("does not affect other returns", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret1 = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const ret2 = await controller.createReturn({
				orderId: order.id,
				reason: "changed_mind",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			await controller.deleteReturn(ret1.id);

			const remaining = await controller.listReturns(order.id);
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.id).toBe(ret2.id);
		});
	});

	// ── Bulk Operations Tests ──────────────────────────────────────────────

	describe("bulkUpdateStatus", () => {
		it("updates status of multiple orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const order2 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const result = await controller.bulkUpdateStatus(
				[order1.id, order2.id],
				"processing",
			);

			expect(result.updated).toBe(2);

			const found1 = await controller.getById(order1.id);
			const found2 = await controller.getById(order2.id);
			expect(found1?.status).toBe("processing");
			expect(found2?.status).toBe("processing");
		});

		it("skips non-existent orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const result = await controller.bulkUpdateStatus(
				[order1.id, "non-existent"],
				"completed",
			);

			expect(result.updated).toBe(1);
			const found = await controller.getById(order1.id);
			expect(found?.status).toBe("completed");
		});

		it("returns zero for empty ids array", async () => {
			const result = await controller.bulkUpdateStatus([], "processing");
			expect(result.updated).toBe(0);
		});

		it("does not affect other orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const order2 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			await controller.bulkUpdateStatus([order1.id], "completed");

			const found2 = await controller.getById(order2.id);
			expect(found2?.status).toBe("pending");
		});
	});

	describe("bulkUpdatePaymentStatus", () => {
		it("updates payment status of multiple orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const order2 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const result = await controller.bulkUpdatePaymentStatus(
				[order1.id, order2.id],
				"paid",
			);

			expect(result.updated).toBe(2);

			const found1 = await controller.getById(order1.id);
			const found2 = await controller.getById(order2.id);
			expect(found1?.paymentStatus).toBe("paid");
			expect(found2?.paymentStatus).toBe("paid");
		});

		it("skips non-existent orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const result = await controller.bulkUpdatePaymentStatus(
				[order1.id, "non-existent"],
				"refunded",
			);

			expect(result.updated).toBe(1);
		});

		it("returns zero for empty ids array", async () => {
			const result = await controller.bulkUpdatePaymentStatus([], "paid");
			expect(result.updated).toBe(0);
		});
	});

	describe("bulkDelete", () => {
		it("deletes multiple orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const order2 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const result = await controller.bulkDelete([order1.id, order2.id]);

			expect(result.deleted).toBe(2);

			const found1 = await controller.getById(order1.id);
			const found2 = await controller.getById(order2.id);
			expect(found1).toBeNull();
			expect(found2).toBeNull();
		});

		it("deletes orders with all related records", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
				billingAddress: {
					firstName: "John",
					lastName: "Doe",
					line1: "123 Main St",
					city: "Springfield",
					state: "IL",
					postalCode: "62701",
					country: "US",
				},
			});
			const items = await controller.getItems(order.id);

			// Create a return
			await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const result = await controller.bulkDelete([order.id]);

			expect(result.deleted).toBe(1);
			const found = await controller.getById(order.id);
			expect(found).toBeNull();

			// Related records should also be gone
			const orderItems = await controller.getItems(order.id);
			expect(orderItems).toHaveLength(0);

			const returns = await controller.listReturns(order.id);
			expect(returns).toHaveLength(0);
		});

		it("skips non-existent orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const result = await controller.bulkDelete([order1.id, "non-existent"]);

			expect(result.deleted).toBe(1);
		});

		it("returns zero for empty ids array", async () => {
			const result = await controller.bulkDelete([]);
			expect(result.deleted).toBe(0);
		});

		it("does not affect other orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const order2 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			await controller.bulkDelete([order1.id]);

			const found2 = await controller.getById(order2.id);
			expect(found2).not.toBeNull();
			expect(found2?.items).toHaveLength(1);
		});
	});

	// ── Order Notes ──────────────────────────────────────────────────────

	describe("addNote", () => {
		it("creates a note with defaults", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const note = await controller.addNote({
				orderId: order.id,
				content: "Customer called about delivery",
			});

			expect(note.id).toBeDefined();
			expect(note.orderId).toBe(order.id);
			expect(note.type).toBe("note");
			expect(note.content).toBe("Customer called about delivery");
			expect(note.createdAt).toBeInstanceOf(Date);
		});

		it("creates a system note", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const note = await controller.addNote({
				orderId: order.id,
				content: "Status changed to processing",
				type: "system",
			});

			expect(note.type).toBe("system");
		});

		it("stores author information", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const note = await controller.addNote({
				orderId: order.id,
				content: "Expediting shipment",
				authorId: "user_abc",
				authorName: "Jane Admin",
			});

			expect(note.authorId).toBe("user_abc");
			expect(note.authorName).toBe("Jane Admin");
		});

		it("stores metadata", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const note = await controller.addNote({
				orderId: order.id,
				content: "Escalated to manager",
				metadata: { priority: "high", department: "support" },
			});

			expect(note.metadata).toEqual({
				priority: "high",
				department: "support",
			});
		});
	});

	describe("listNotes", () => {
		it("returns empty array for order with no notes", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const notes = await controller.listNotes(order.id);
			expect(notes).toEqual([]);
		});

		it("returns all notes for the order", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			await controller.addNote({
				orderId: order.id,
				content: "First note",
			});
			await controller.addNote({
				orderId: order.id,
				content: "Second note",
			});

			const notes = await controller.listNotes(order.id);
			expect(notes).toHaveLength(2);
			const contents = notes.map((n) => n.content).sort();
			expect(contents).toEqual(["First note", "Second note"]);
		});

		it("does not return notes from other orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			const order2 = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			await controller.addNote({
				orderId: order1.id,
				content: "Note for order 1",
			});
			await controller.addNote({
				orderId: order2.id,
				content: "Note for order 2",
			});

			const notes1 = await controller.listNotes(order1.id);
			expect(notes1).toHaveLength(1);
			expect(notes1[0]?.content).toBe("Note for order 1");

			const notes2 = await controller.listNotes(order2.id);
			expect(notes2).toHaveLength(1);
			expect(notes2[0]?.content).toBe("Note for order 2");
		});
	});

	describe("deleteNote", () => {
		it("deletes a note by ID", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const note = await controller.addNote({
				orderId: order.id,
				content: "To be deleted",
			});

			await controller.deleteNote(note.id);

			const notes = await controller.listNotes(order.id);
			expect(notes).toHaveLength(0);
		});

		it("only deletes the specified note", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			await controller.addNote({
				orderId: order.id,
				content: "Keep this",
			});
			const note2 = await controller.addNote({
				orderId: order.id,
				content: "Delete this",
			});

			await controller.deleteNote(note2.id);

			const notes = await controller.listNotes(order.id);
			expect(notes).toHaveLength(1);
			expect(notes[0]?.content).toBe("Keep this");
		});
	});

	// ── Invoice ─────────────────────────────────────────────────────────

	describe("getInvoiceData", () => {
		it("returns null for non-existent order", async () => {
			const result = await controller.getInvoiceData(
				"non-existent",
				"Test Store",
			);
			expect(result).toBeNull();
		});

		it("generates invoice data from an order", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const invoice = await controller.getInvoiceData(order.id, "My Shop");
			expect(invoice).not.toBeNull();
			expect(invoice?.invoiceNumber).toMatch(/^INV-/);
			expect(invoice?.orderNumber).toBe(order.orderNumber);
			expect(invoice?.orderId).toBe(order.id);
			expect(invoice?.storeName).toBe("My Shop");
			expect(invoice?.total).toBe(order.total);
			expect(invoice?.currency).toBe("USD");
			expect(invoice?.status).toBe("issued"); // unpaid order
		});

		it("maps line items correctly", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.lineItems).toHaveLength(1);
			expect(invoice?.lineItems[0]?.name).toBe("Test Widget");
			expect(invoice?.lineItems[0]?.quantity).toBe(2);
			expect(invoice?.lineItems[0]?.unitPrice).toBe(1999);
		});

		it("resolves status to paid when payment is paid", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			await controller.updatePaymentStatus(order.id, "paid");

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.status).toBe("paid");
		});

		it("resolves status to void when order is cancelled", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			await controller.cancel(order.id);

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.status).toBe("void");
		});

		it("includes billing address when present", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
				billingAddress: {
					firstName: "Jane",
					lastName: "Doe",
					line1: "123 Main St",
					city: "Austin",
					state: "TX",
					postalCode: "73301",
					country: "US",
				},
			});

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.customerName).toBe("Jane Doe");
			expect(invoice?.billingAddress?.line1).toBe("123 Main St");
			expect(invoice?.billingAddress?.city).toBe("Austin");
		});

		it("includes shipping address when present", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
				shippingAddress: {
					firstName: "Bob",
					lastName: "Smith",
					line1: "456 Oak Ave",
					city: "Dallas",
					state: "TX",
					postalCode: "75201",
					country: "US",
				},
			});

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.shippingAddress).not.toBeNull();
			expect(invoice?.shippingAddress?.firstName).toBe("Bob");
		});

		it("includes amounts breakdown", async () => {
			const order = await controller.create({
				customerId: "cust_123",
				subtotal: 10000,
				taxAmount: 800,
				shippingAmount: 500,
				discountAmount: 1500,
				giftCardAmount: 2000,
				total: 7800,
				items: [
					{
						productId: "p1",
						name: "Expensive Item",
						price: 5000,
						quantity: 2,
					},
				],
			});

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.subtotal).toBe(10000);
			expect(invoice?.taxAmount).toBe(800);
			expect(invoice?.shippingAmount).toBe(500);
			expect(invoice?.discountAmount).toBe(1500);
			expect(invoice?.giftCardAmount).toBe(2000);
			expect(invoice?.total).toBe(7800);
		});

		it("includes order notes", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
				notes: "Please gift wrap",
			});

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.notes).toBe("Please gift wrap");
		});

		it("includes guest email", async () => {
			const order = await controller.create({
				subtotal: 1000,
				total: 1000,
				guestEmail: "guest@example.com",
				items: [{ productId: "p1", name: "Item", price: 1000, quantity: 1 }],
			});

			const invoice = await controller.getInvoiceData(order.id, "Store");
			expect(invoice?.customerEmail).toBe("guest@example.com");
		});
	});

	// ── Public Order Tracking ──────────────────────────────────────────

	describe("getByTracking", () => {
		it("returns order when order number and guest email match", async () => {
			const order = await controller.create({
				subtotal: 2500,
				total: 2500,
				guestEmail: "guest@example.com",
				items: [{ productId: "p1", name: "Widget", price: 2500, quantity: 1 }],
			});

			const result = await controller.getByTracking(
				order.orderNumber,
				"guest@example.com",
			);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(order.id);
			expect(result?.items).toHaveLength(1);
		});

		it("returns null when email does not match", async () => {
			const order = await controller.create({
				subtotal: 2500,
				total: 2500,
				guestEmail: "guest@example.com",
				items: [{ productId: "p1", name: "Widget", price: 2500, quantity: 1 }],
			});

			const result = await controller.getByTracking(
				order.orderNumber,
				"wrong@example.com",
			);
			expect(result).toBeNull();
		});

		it("returns null when order number does not exist", async () => {
			const result = await controller.getByTracking(
				"ORD-NONEXISTENT",
				"guest@example.com",
			);
			expect(result).toBeNull();
		});

		it("performs case-insensitive email matching", async () => {
			const order = await controller.create({
				subtotal: 1000,
				total: 1000,
				guestEmail: "Guest@Example.COM",
				items: [{ productId: "p1", name: "Item", price: 1000, quantity: 1 }],
			});

			const result = await controller.getByTracking(
				order.orderNumber,
				"guest@example.com",
			);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(order.id);
		});

		it("trims whitespace in email", async () => {
			const order = await controller.create({
				subtotal: 1000,
				total: 1000,
				guestEmail: "guest@example.com",
				items: [{ productId: "p1", name: "Item", price: 1000, quantity: 1 }],
			});

			const result = await controller.getByTracking(
				order.orderNumber,
				"  guest@example.com  ",
			);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(order.id);
		});

		it("returns order with items and addresses", async () => {
			const address = {
				firstName: "John",
				lastName: "Doe",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			};

			const order = await controller.create({
				subtotal: 5000,
				total: 5000,
				guestEmail: "buyer@test.com",
				items: [
					{ productId: "p1", name: "Item A", price: 3000, quantity: 1 },
					{ productId: "p2", name: "Item B", price: 2000, quantity: 1 },
				],
				billingAddress: address,
				shippingAddress: address,
			});

			const result = await controller.getByTracking(
				order.orderNumber,
				"buyer@test.com",
			);
			expect(result).not.toBeNull();
			expect(result?.items).toHaveLength(2);
			expect(result?.addresses).toHaveLength(2);
		});

		it("matches via metadata.customerEmail for logged-in customers", async () => {
			const order = await controller.create({
				subtotal: 1000,
				total: 1000,
				customerId: "cust_123",
				metadata: { customerEmail: "customer@example.com" },
				items: [{ productId: "p1", name: "Item", price: 1000, quantity: 1 }],
			});

			const result = await controller.getByTracking(
				order.orderNumber,
				"customer@example.com",
			);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(order.id);
		});

		it("returns null for logged-in customer without metadata email", async () => {
			const order = await controller.create({
				subtotal: 1000,
				total: 1000,
				customerId: "cust_123",
				items: [{ productId: "p1", name: "Item", price: 1000, quantity: 1 }],
			});

			const result = await controller.getByTracking(
				order.orderNumber,
				"someone@example.com",
			);
			expect(result).toBeNull();
		});

		it("case-insensitive match on metadata email", async () => {
			const order = await controller.create({
				subtotal: 1000,
				total: 1000,
				customerId: "cust_123",
				metadata: { customerEmail: "Customer@EXAMPLE.com" },
				items: [{ productId: "p1", name: "Item", price: 1000, quantity: 1 }],
			});

			const result = await controller.getByTracking(
				order.orderNumber,
				"customer@example.com",
			);
			expect(result).not.toBeNull();
		});

		it("prefers guestEmail match over metadata", async () => {
			const order = await controller.create({
				subtotal: 1000,
				total: 1000,
				guestEmail: "guest@example.com",
				metadata: { customerEmail: "other@example.com" },
				items: [{ productId: "p1", name: "Item", price: 1000, quantity: 1 }],
			});

			// Should match on guestEmail
			const result = await controller.getByTracking(
				order.orderNumber,
				"guest@example.com",
			);
			expect(result).not.toBeNull();
		});
	});

	describe("listReturnsForCustomer", () => {
		it("returns empty array when customer has no orders", async () => {
			const result = await controller.listReturnsForCustomer("unknown_cust");
			expect(result.returns).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("returns empty array when customer has orders but no returns", async () => {
			await controller.create({
				...sampleOrder,
				customerId: "cust_returns_1",
				items: sampleItems,
			});

			const result = await controller.listReturnsForCustomer("cust_returns_1");
			expect(result.returns).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("returns returns for a customer across multiple orders", async () => {
			const order1 = await controller.create({
				...sampleOrder,
				customerId: "cust_returns_2",
				items: sampleItems,
			});
			const order2 = await controller.create({
				...sampleOrder,
				customerId: "cust_returns_2",
				items: sampleItems,
			});

			const items1 = await controller.getItems(order1.id);
			const items2 = await controller.getItems(order2.id);

			await controller.createReturn({
				orderId: order1.id,
				reason: "defective",
				items: [{ orderItemId: items1[0]?.id, quantity: 1 }],
			});
			await controller.createReturn({
				orderId: order2.id,
				reason: "wrong_item",
				items: [{ orderItemId: items2[0]?.id, quantity: 1 }],
			});

			const result = await controller.listReturnsForCustomer("cust_returns_2");
			expect(result.returns).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it("includes orderNumber in each return", async () => {
			const order = await controller.create({
				...sampleOrder,
				customerId: "cust_returns_3",
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			await controller.createReturn({
				orderId: order.id,
				reason: "changed_mind",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const result = await controller.listReturnsForCustomer("cust_returns_3");
			expect(result.returns[0]?.orderNumber).toBe(order.orderNumber);
		});

		it("does not include returns from other customers", async () => {
			const myOrder = await controller.create({
				...sampleOrder,
				customerId: "cust_mine",
				items: sampleItems,
			});
			const otherOrder = await controller.create({
				...sampleOrder,
				customerId: "cust_other",
				items: sampleItems,
			});
			const myItems = await controller.getItems(myOrder.id);
			const otherItems = await controller.getItems(otherOrder.id);

			await controller.createReturn({
				orderId: myOrder.id,
				reason: "defective",
				items: [{ orderItemId: myItems[0]?.id, quantity: 1 }],
			});
			await controller.createReturn({
				orderId: otherOrder.id,
				reason: "wrong_item",
				items: [{ orderItemId: otherItems[0]?.id, quantity: 1 }],
			});

			const result = await controller.listReturnsForCustomer("cust_mine");
			expect(result.returns).toHaveLength(1);
			expect(result.returns[0]?.reason).toBe("defective");
		});

		it("filters by status", async () => {
			const order = await controller.create({
				...sampleOrder,
				customerId: "cust_status_filter",
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			const ret1 = await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});
			await controller.createReturn({
				orderId: order.id,
				reason: "wrong_item",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			// Approve one return
			await controller.updateReturn(ret1.id, { status: "approved" });

			const result = await controller.listReturnsForCustomer(
				"cust_status_filter",
				{ status: "approved" },
			);
			expect(result.returns).toHaveLength(1);
			expect(result.returns[0]?.status).toBe("approved");
			expect(result.total).toBe(1);
		});

		it("paginates results", async () => {
			const order = await controller.create({
				...sampleOrder,
				customerId: "cust_paginate",
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			// Create 3 returns
			for (let i = 0; i < 3; i++) {
				await controller.createReturn({
					orderId: order.id,
					reason: "defective",
					items: [{ orderItemId: items[0]?.id, quantity: 1 }],
				});
			}

			const page1 = await controller.listReturnsForCustomer("cust_paginate", {
				limit: 2,
				offset: 0,
			});
			expect(page1.returns).toHaveLength(2);
			expect(page1.total).toBe(3);

			const page2 = await controller.listReturnsForCustomer("cust_paginate", {
				limit: 2,
				offset: 2,
			});
			expect(page2.returns).toHaveLength(1);
			expect(page2.total).toBe(3);
		});

		it("sorts returns newest first", async () => {
			const order = await controller.create({
				...sampleOrder,
				customerId: "cust_sort",
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			await controller.createReturn({
				orderId: order.id,
				reason: "defective",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});
			await controller.createReturn({
				orderId: order.id,
				reason: "wrong_item",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const result = await controller.listReturnsForCustomer("cust_sort");
			const dates = result.returns.map((r) => new Date(r.createdAt).getTime());
			expect(dates[0]).toBeGreaterThanOrEqual(dates[1] ?? 0);
		});

		it("includes return items", async () => {
			const order = await controller.create({
				...sampleOrder,
				customerId: "cust_with_items",
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			await controller.createReturn({
				orderId: order.id,
				reason: "too_large",
				items: [{ orderItemId: items[0]?.id, quantity: 1, reason: "sizing" }],
			});

			const result = await controller.listReturnsForCustomer("cust_with_items");
			expect(result.returns[0]?.items).toHaveLength(1);
			expect(result.returns[0]?.items[0]?.reason).toBe("sizing");
		});

		it("returns correct type and reason", async () => {
			const order = await controller.create({
				...sampleOrder,
				customerId: "cust_type",
				items: sampleItems,
			});
			const items = await controller.getItems(order.id);

			await controller.createReturn({
				orderId: order.id,
				type: "exchange",
				reason: "too_small",
				customerNotes: "Need a size larger",
				items: [{ orderItemId: items[0]?.id, quantity: 1 }],
			});

			const result = await controller.listReturnsForCustomer("cust_type");
			expect(result.returns[0]?.type).toBe("exchange");
			expect(result.returns[0]?.reason).toBe("too_small");
			expect(result.returns[0]?.customerNotes).toBe("Need a size larger");
		});
	});

	describe("getReorderItems", () => {
		it("returns cart-ready items from an order", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});

			const reorderItems = await controller.getReorderItems(order.id);
			expect(reorderItems).not.toBeNull();
			expect(reorderItems).toHaveLength(1);
			expect(reorderItems?.[0]?.productId).toBe("prod_abc");
			expect(reorderItems?.[0]?.name).toBe("Test Widget");
			expect(reorderItems?.[0]?.price).toBe(1999);
			expect(reorderItems?.[0]?.quantity).toBe(2);
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.getReorderItems("nonexistent");
			expect(result).toBeNull();
		});

		it("returns multiple items from a multi-item order", async () => {
			const order = await controller.create({
				...sampleOrder,
				subtotal: 8496,
				total: 8496,
				items: [
					{
						productId: "prod_1",
						name: "Widget A",
						price: 999,
						quantity: 1,
					},
					{
						productId: "prod_2",
						variantId: "var_1",
						name: "Widget B",
						sku: "WB-001",
						price: 2499,
						quantity: 3,
					},
				],
			});

			const reorderItems = await controller.getReorderItems(order.id);
			expect(reorderItems).toHaveLength(2);

			const itemA = reorderItems?.find((i) => i.productId === "prod_1");
			const itemB = reorderItems?.find((i) => i.productId === "prod_2");

			expect(itemA?.name).toBe("Widget A");
			expect(itemA?.quantity).toBe(1);
			expect(itemA?.variantId).toBeUndefined();

			expect(itemB?.name).toBe("Widget B");
			expect(itemB?.variantId).toBe("var_1");
			expect(itemB?.sku).toBe("WB-001");
			expect(itemB?.price).toBe(2499);
			expect(itemB?.quantity).toBe(3);
		});

		it("returns items from a cancelled order", async () => {
			const order = await controller.create({
				...sampleOrder,
				items: sampleItems,
			});
			await controller.cancel(order.id);

			const reorderItems = await controller.getReorderItems(order.id);
			expect(reorderItems).not.toBeNull();
			expect(reorderItems).toHaveLength(1);
		});

		it("preserves variant information", async () => {
			const order = await controller.create({
				...sampleOrder,
				subtotal: 2999,
				total: 2999,
				items: [
					{
						productId: "prod_v",
						variantId: "var_color_red",
						name: "T-Shirt (Red, L)",
						sku: "TS-RED-L",
						price: 2999,
						quantity: 1,
					},
				],
			});

			const reorderItems = await controller.getReorderItems(order.id);
			expect(reorderItems?.[0]?.productId).toBe("prod_v");
			expect(reorderItems?.[0]?.variantId).toBe("var_color_red");
			expect(reorderItems?.[0]?.sku).toBe("TS-RED-L");
		});

		it("rejects an Order with no immutable line items", async () => {
			await expect(
				controller.create({
					...sampleOrder,
					subtotal: 0,
					total: 0,
					items: [],
				}),
			).rejects.toThrow("Order must contain at least one immutable line item.");
		});
	});
});

describe("createOrderController replay safety", () => {
	function controllerWith() {
		const data = createMockDataService();
		return { data, controller: createOrderController(data) };
	}

	const replayable: CreateOrderParams = {
		...sampleOrder,
		id: "order-deterministic-1",
		items: sampleItems,
		billingAddress: {
			firstName: "Ada",
			lastName: "Lovelace",
			line1: "123 Main Street",
			city: "Austin",
			state: "TX",
			postalCode: "78701",
			country: "US",
		},
	};

	it("returns the same Order on replay instead of duplicating its lines", async () => {
		const { data, controller } = controllerWith();

		const first = await controller.create(replayable);
		const second = await controller.create(replayable);

		// A Finalization step that lost its response and retried must not create a
		// second set of line items for the same Order.
		expect(second.id).toBe(first.id);
		expect(second.orderNumber).toBe(first.orderNumber);
		const items = await data.findMany("orderItem", {
			where: { orderId: first.id },
		});
		expect(items).toHaveLength(sampleItems.length);
		const addresses = await data.findMany("orderAddress", {
			where: { orderId: first.id },
		});
		expect(addresses).toHaveLength(1);
	});

	it("completes line items when the first attempt wrote only the Order row", async () => {
		// The first attempt can commit the Order row and then fail before its
		// items land. Treating the row alone as proof of a finished write would
		// hand back an Order that permanently lost its line truth, so the replay
		// re-runs the deterministic child writes instead of returning early.
		const { data, controller } = controllerWith();
		const originalUpsert = data.upsert.bind(data);
		let failed = false;
		data.upsert = (async (
			name: string,
			id: string,
			record: Record<string, unknown>,
		) => {
			if (name === "orderItem" && !failed) {
				failed = true;
				throw new Error("connection lost");
			}
			return originalUpsert(name, id, record);
		}) as typeof data.upsert;

		await expect(controller.create(replayable)).rejects.toThrow(
			"connection lost",
		);
		const partial = await data.findMany("orderItem", {
			where: { orderId: replayable.id },
		});
		expect(partial).toHaveLength(0);

		const replayed = await controller.create(replayable);

		expect(replayed.id).toBe(replayable.id);
		const items = await data.findMany("orderItem", {
			where: { orderId: replayable.id },
		});
		expect(items).toHaveLength(sampleItems.length);
	});

	it("does not roll a later status transition back to the original request", async () => {
		// A duplicate delivery can arrive after the Order legitimately advanced.
		// Rewriting the row from the original payload would undo that transition.
		const { data, controller } = controllerWith();
		const first = await controller.create(replayable);
		await data.upsert("order", first.id, {
			...(first as unknown as Record<string, unknown>),
			status: "paid",
			paymentStatus: "paid",
		});

		const replayed = await controller.create(replayable);

		expect(replayed.status).toBe("paid");
		expect(replayed.paymentStatus).toBe("paid");
	});

	it("keeps the Order number stable across a replay", async () => {
		const { controller } = controllerWith();
		const first = await controller.create(replayable);
		const second = await controller.create({
			...replayable,
			// Even a caller that recomputed its payload must not renumber the Order
			// a shopper has already been shown.
			notes: "retried",
		});

		expect(second.orderNumber).toBe(first.orderNumber);
		expect(second.createdAt).toEqual(first.createdAt);
	});

	it("still creates distinct Orders for distinct identities", async () => {
		const { controller } = controllerWith();
		const first = await controller.create(replayable);
		const second = await controller.create({
			...replayable,
			id: "order-deterministic-2",
		});

		expect(second.id).not.toBe(first.id);
		expect(second.orderNumber).not.toBe(first.orderNumber);
	});
});
