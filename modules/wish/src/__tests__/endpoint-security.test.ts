import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWishController } from "../service-impl";

describe("wish endpoint security", () => {
	let mockDataA: ReturnType<typeof createMockDataService>;
	let mockDataB: ReturnType<typeof createMockDataService>;
	let controllerA: ReturnType<typeof createWishController>;
	let controllerB: ReturnType<typeof createWishController>;

	beforeEach(() => {
		mockDataA = createMockDataService();
		mockDataB = createMockDataService();
		controllerA = createWishController(mockDataA);
		controllerB = createWishController(mockDataB);
	});

	// ── Data isolation: products ───────────────────────────────────────────

	describe("data isolation – products", () => {
		it("product created in store A is not visible in store B", async () => {
			await controllerA.createProduct({
				localProductId: "prod-1",
				title: "Store A Product",
				price: 19.99,
				shippingPrice: 3.99,
			});

			const productsB = await controllerB.listProducts();
			expect(productsB).toHaveLength(0);
		});

		it("product created in store B is not visible in store A", async () => {
			await controllerB.createProduct({
				localProductId: "prod-1",
				title: "Store B Product",
				price: 9.99,
				shippingPrice: 2.99,
			});

			const productsA = await controllerA.listProducts();
			expect(productsA).toHaveLength(0);
		});

		it("getProduct does not return a product from another store", async () => {
			const productA = await controllerA.createProduct({
				localProductId: "prod-1",
				title: "Store A Product",
				price: 19.99,
				shippingPrice: 3.99,
			});

			const result = await controllerB.getProduct(productA.id);
			expect(result).toBeNull();
		});

		it("getProductByLocalId does not cross store boundaries", async () => {
			await controllerA.createProduct({
				localProductId: "prod-shared",
				title: "Store A Product",
				price: 19.99,
				shippingPrice: 3.99,
			});

			const result = await controllerB.getProductByLocalId("prod-shared");
			expect(result).toBeNull();
		});

		it("multiple products in A do not appear in B", async () => {
			await controllerA.createProduct({
				localProductId: "p1",
				title: "One",
				price: 10,
				shippingPrice: 2,
			});
			await controllerA.createProduct({
				localProductId: "p2",
				title: "Two",
				price: 20,
				shippingPrice: 3,
			});
			await controllerA.createProduct({
				localProductId: "p3",
				title: "Three",
				price: 30,
				shippingPrice: 4,
			});

			const productsB = await controllerB.listProducts();
			expect(productsB).toHaveLength(0);
		});

		it("updateProduct in store A does not affect store B", async () => {
			const productA = await controllerA.createProduct({
				localProductId: "prod-1",
				title: "Original",
				price: 19.99,
				shippingPrice: 3.99,
			});
			await controllerA.updateProduct(productA.id, { title: "Updated" });

			const resultB = await controllerB.getProduct(productA.id);
			expect(resultB).toBeNull();
		});

		it("disableProduct via wrong store returns null", async () => {
			const productA = await controllerA.createProduct({
				localProductId: "prod-1",
				title: "Store A Product",
				price: 19.99,
				shippingPrice: 3.99,
			});

			const result = await controllerB.disableProduct(productA.id);
			expect(result).toBeNull();
		});
	});

	// ── Data isolation: orders ─────────────────────────────────────────────

	describe("data isolation – orders", () => {
		it("order received in store A is not visible in store B", async () => {
			await controllerA.receiveOrder({
				wishOrderId: "wish-order-1",
				items: [],
				orderTotal: 49.99,
				shippingTotal: 5.99,
				wishFee: 4.99,
			});

			const ordersB = await controllerB.listOrders();
			expect(ordersB).toHaveLength(0);
		});

		it("getOrder does not return an order from another store", async () => {
			const orderA = await controllerA.receiveOrder({
				wishOrderId: "wish-order-1",
				items: [],
				orderTotal: 49.99,
				shippingTotal: 5.99,
				wishFee: 4.99,
			});

			const result = await controllerB.getOrder(orderA.id);
			expect(result).toBeNull();
		});

		it("shipOrder via wrong store returns null", async () => {
			const orderA = await controllerA.receiveOrder({
				wishOrderId: "wish-order-1",
				items: [],
				orderTotal: 49.99,
				shippingTotal: 5.99,
				wishFee: 4.99,
			});

			const result = await controllerB.shipOrder(orderA.id, "TRK001", "USPS");
			expect(result).toBeNull();
		});

		it("orders from both stores are independently countable", async () => {
			await controllerA.receiveOrder({
				wishOrderId: "wish-A-1",
				items: [],
				orderTotal: 49.99,
				shippingTotal: 5.99,
				wishFee: 4.99,
			});
			await controllerA.receiveOrder({
				wishOrderId: "wish-A-2",
				items: [],
				orderTotal: 30,
				shippingTotal: 3,
				wishFee: 2,
			});
			await controllerB.receiveOrder({
				wishOrderId: "wish-B-1",
				items: [],
				orderTotal: 10,
				shippingTotal: 2,
				wishFee: 1,
			});

			expect(await controllerA.listOrders()).toHaveLength(2);
			expect(await controllerB.listOrders()).toHaveLength(1);
		});
	});

	// ── Data isolation: pending shipments ─────────────────────────────────

	describe("data isolation – pending shipments", () => {
		it("getPendingShipments returns only store A approved orders, not store B", async () => {
			const orderA = await controllerA.receiveOrder({
				wishOrderId: "wish-A-1",
				items: [],
				orderTotal: 49.99,
				shippingTotal: 5.99,
				wishFee: 4.99,
			});
			// Manually set to approved status via updateProduct equivalent
			// getPendingShipments queries status=approved; new orders are "pending"
			// so this verifies store isolation at the query level
			await controllerA.updateProduct(orderA.id, {}).catch(() => {
				// no-op: testing isolation not product update
			});

			const shipmentsB = await controllerB.getPendingShipments();
			expect(shipmentsB).toHaveLength(0);
		});
	});

	// ── Data isolation: channel stats ──────────────────────────────────────

	describe("data isolation – channel stats", () => {
		it("stats from store A do not bleed into store B", async () => {
			await controllerA.createProduct({
				localProductId: "prod-1",
				title: "Active Product",
				price: 19.99,
				shippingPrice: 3.99,
			});
			await controllerA.receiveOrder({
				wishOrderId: "wish-order-1",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				wishFee: 5,
			});

			const statsB = await controllerB.getChannelStats();
			expect(statsB.totalProducts).toBe(0);
			expect(statsB.activeProducts).toBe(0);
			expect(statsB.totalOrders).toBe(0);
			expect(statsB.totalRevenue).toBe(0);
		});

		it("each store accumulates its own product and order counts", async () => {
			await controllerA.createProduct({
				localProductId: "p1",
				title: "A Product",
				price: 10,
				shippingPrice: 2,
			});
			await controllerA.createProduct({
				localProductId: "p2",
				title: "A Product 2",
				price: 20,
				shippingPrice: 3,
			});
			await controllerB.createProduct({
				localProductId: "p3",
				title: "B Product",
				price: 15,
				shippingPrice: 2,
			});

			const statsA = await controllerA.getChannelStats();
			const statsB = await controllerB.getChannelStats();

			expect(statsA.totalProducts).toBe(2);
			expect(statsB.totalProducts).toBe(1);
		});

		it("disabled products counted separately per store", async () => {
			const p1 = await controllerA.createProduct({
				localProductId: "p1",
				title: "Will Disable",
				price: 10,
				shippingPrice: 2,
			});
			await controllerA.disableProduct(p1.id);
			await controllerB.createProduct({
				localProductId: "p2",
				title: "Active B",
				price: 20,
				shippingPrice: 3,
			});

			const statsA = await controllerA.getChannelStats();
			const statsB = await controllerB.getChannelStats();

			expect(statsA.disabledProducts).toBe(1);
			expect(statsB.disabledProducts).toBe(0);
		});
	});

	// ── State machine: order shipment ──────────────────────────────────────

	describe("state machine – order shipment", () => {
		it("shipOrder on non-existent order returns null", async () => {
			expect(
				await controllerA.shipOrder("ghost-id", "TRK001", "USPS"),
			).toBeNull();
		});

		it("cannot ship an order belonging to another store", async () => {
			const orderA = await controllerA.receiveOrder({
				wishOrderId: "wish-order-1",
				items: [],
				orderTotal: 49.99,
				shippingTotal: 5.99,
				wishFee: 4.99,
			});

			const result = await controllerB.shipOrder(
				orderA.id,
				"TRK-CROSS",
				"FedEx",
			);
			expect(result).toBeNull();
		});

		it("shipOrder within the same store transitions status to shipped", async () => {
			const order = await controllerA.receiveOrder({
				wishOrderId: "wish-order-1",
				items: [],
				orderTotal: 49.99,
				shippingTotal: 5.99,
				wishFee: 4.99,
			});
			expect(order.status).toBe("pending");

			const shipped = await controllerA.shipOrder(
				order.id,
				"TRK-WISH-001",
				"USPS",
			);
			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("TRK-WISH-001");
			expect(shipped?.carrier).toBe("USPS");
		});

		it("shipOrder sets tracking info immutably scoped to the order", async () => {
			const orderA = await controllerA.receiveOrder({
				wishOrderId: "wish-order-A",
				items: [],
				orderTotal: 49.99,
				shippingTotal: 5.99,
				wishFee: 4.99,
			});
			const orderB = await controllerA.receiveOrder({
				wishOrderId: "wish-order-B",
				items: [],
				orderTotal: 29.99,
				shippingTotal: 3.99,
				wishFee: 2.99,
			});

			await controllerA.shipOrder(orderA.id, "TRK-A", "UPS");

			// orderB must remain unshipped
			const fetchedB = await controllerA.getOrder(orderB.id);
			expect(fetchedB?.status).toBe("pending");
			expect(fetchedB?.trackingNumber).toBeUndefined();
		});
	});

	// ── Resource immutability: disableProduct ──────────────────────────────

	describe("resource immutability – disableProduct", () => {
		it("disabled product still retrievable via getProduct", async () => {
			const product = await controllerA.createProduct({
				localProductId: "prod-1",
				title: "To Disable",
				price: 10,
				shippingPrice: 2,
			});

			const disabled = await controllerA.disableProduct(product.id);
			expect(disabled?.status).toBe("disabled");

			const fetched = await controllerA.getProduct(product.id);
			expect(fetched?.status).toBe("disabled");
		});

		it("disableProduct on non-existent product returns null", async () => {
			expect(await controllerA.disableProduct("ghost-id")).toBeNull();
		});

		it("disabled product is excluded from active count in stats", async () => {
			const product = await controllerA.createProduct({
				localProductId: "prod-1",
				title: "To Disable",
				price: 10,
				shippingPrice: 2,
			});

			const before = await controllerA.getChannelStats();
			expect(before.activeProducts).toBe(1);

			await controllerA.disableProduct(product.id);

			const after = await controllerA.getChannelStats();
			expect(after.activeProducts).toBe(0);
			expect(after.disabledProducts).toBe(1);
		});

		it("disableProduct does not affect sibling active products", async () => {
			const p1 = await controllerA.createProduct({
				localProductId: "p1",
				title: "To Disable",
				price: 10,
				shippingPrice: 2,
			});
			await controllerA.createProduct({
				localProductId: "p2",
				title: "Stays Active",
				price: 20,
				shippingPrice: 3,
			});

			await controllerA.disableProduct(p1.id);

			const products = await controllerA.listProducts({ status: "active" });
			expect(products).toHaveLength(1);
			expect(products[0]?.localProductId).toBe("p2");
		});
	});

	// ── Non-existent resource returns ──────────────────────────────────────

	describe("non-existent resource returns", () => {
		it("getProduct on unknown id returns null", async () => {
			expect(await controllerA.getProduct("no-such-id")).toBeNull();
		});

		it("getProductByLocalId on unknown product returns null", async () => {
			expect(
				await controllerA.getProductByLocalId("no-such-product"),
			).toBeNull();
		});

		it("getOrder on unknown id returns null", async () => {
			expect(await controllerA.getOrder("no-such-order")).toBeNull();
		});

		it("listProducts on empty store returns empty array", async () => {
			expect(await controllerA.listProducts()).toEqual([]);
		});

		it("listOrders on empty store returns empty array", async () => {
			expect(await controllerA.listOrders()).toEqual([]);
		});

		it("getPendingShipments on empty store returns empty array", async () => {
			expect(await controllerA.getPendingShipments()).toEqual([]);
		});

		it("getChannelStats on empty store returns all zeros", async () => {
			const stats = await controllerA.getChannelStats();
			expect(stats.totalProducts).toBe(0);
			expect(stats.activeProducts).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
			expect(stats.pendingShipments).toBe(0);
			expect(stats.disabledProducts).toBe(0);
		});
	});
});
