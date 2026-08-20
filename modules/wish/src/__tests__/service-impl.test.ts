import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWishController } from "../service-impl";

describe("createWishController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWishController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWishController(mockData);
	});

	// ── createProduct ──────────────────────────────────────────────────────────

	describe("createProduct", () => {
		it("creates an active product with minimal fields", async () => {
			const product = await controller.createProduct({
				localProductId: "prod-1",
				title: "Test Product",
				price: 9.99,
				shippingPrice: 2.0,
			});

			expect(product.id).toBeDefined();
			expect(product.localProductId).toBe("prod-1");
			expect(product.title).toBe("Test Product");
			expect(product.status).toBe("active");
			expect(product.price).toBe(9.99);
			expect(product.shippingPrice).toBe(2.0);
			expect(product.quantity).toBe(0);
			expect(product.tags).toEqual([]);
			expect(product.createdAt).toBeInstanceOf(Date);
		});

		it("creates a product with all optional fields", async () => {
			const product = await controller.createProduct({
				localProductId: "prod-2",
				title: "Full Product",
				price: 19.99,
				shippingPrice: 3.0,
				quantity: 50,
				parentSku: "PARENT-001",
				tags: ["electronics", "gadgets"],
			});

			expect(product.quantity).toBe(50);
			expect(product.parentSku).toBe("PARENT-001");
			expect(product.tags).toEqual(["electronics", "gadgets"]);
		});
	});

	// ── updateProduct ──────────────────────────────────────────────────────────

	describe("updateProduct", () => {
		it("updates product title and price", async () => {
			const product = await controller.createProduct({
				localProductId: "prod-1",
				title: "Original",
				price: 10,
				shippingPrice: 2,
			});

			const updated = await controller.updateProduct(product.id, {
				title: "Updated",
				price: 20,
			});

			expect(updated?.title).toBe("Updated");
			expect(updated?.price).toBe(20);
		});

		it("returns null for non-existent product", async () => {
			const result = await controller.updateProduct("non-existent", {
				title: "Test",
			});
			expect(result).toBeNull();
		});

		it("updates product tags", async () => {
			const product = await controller.createProduct({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
				shippingPrice: 2,
			});

			const updated = await controller.updateProduct(product.id, {
				tags: ["new-tag"],
			});

			expect(updated?.tags).toEqual(["new-tag"]);
		});

		it("updates wishProductId on sync", async () => {
			const product = await controller.createProduct({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
				shippingPrice: 2,
			});

			const updated = await controller.updateProduct(product.id, {
				wishProductId: "wish-123",
			});

			expect(updated?.wishProductId).toBe("wish-123");
		});

		it("updates review status", async () => {
			const product = await controller.createProduct({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
				shippingPrice: 2,
			});

			const updated = await controller.updateProduct(product.id, {
				reviewStatus: "approved",
			});

			expect(updated?.reviewStatus).toBe("approved");
		});
	});

	// ── disableProduct ─────────────────────────────────────────────────────────

	describe("disableProduct", () => {
		it("disables an active product", async () => {
			const product = await controller.createProduct({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
				shippingPrice: 2,
			});

			const disabled = await controller.disableProduct(product.id);

			expect(disabled?.status).toBe("disabled");
		});

		it("returns null for non-existent product", async () => {
			const result = await controller.disableProduct("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getProduct ─────────────────────────────────────────────────────────────

	describe("getProduct", () => {
		it("returns a product by id", async () => {
			const product = await controller.createProduct({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
				shippingPrice: 2,
			});

			const found = await controller.getProduct(product.id);
			expect(found?.id as string).toBe(product.id);
		});

		it("returns null for non-existent product", async () => {
			const result = await controller.getProduct("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getProductByLocalId ────────────────────────────────────────────────────

	describe("getProductByLocalId", () => {
		it("finds a product by local product id", async () => {
			await controller.createProduct({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
				shippingPrice: 2,
			});

			const found = await controller.getProductByLocalId("prod-1");
			expect(found?.localProductId).toBe("prod-1");
		});

		it("returns null when no product exists for local id", async () => {
			const result = await controller.getProductByLocalId("unknown");
			expect(result).toBeNull();
		});
	});

	// ── listProducts ───────────────────────────────────────────────────────────

	describe("listProducts", () => {
		it("returns all products", async () => {
			await controller.createProduct({
				localProductId: "p1",
				title: "A",
				price: 10,
				shippingPrice: 2,
			});
			await controller.createProduct({
				localProductId: "p2",
				title: "B",
				price: 20,
				shippingPrice: 3,
			});

			const products = await controller.listProducts();
			expect(products).toHaveLength(2);
		});

		it("filters products by status", async () => {
			const product = await controller.createProduct({
				localProductId: "p1",
				title: "A",
				price: 10,
				shippingPrice: 2,
			});
			await controller.disableProduct(product.id);

			const disabled = await controller.listProducts({
				status: "disabled",
			});
			expect(disabled).toHaveLength(1);
		});

		it("paginates with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createProduct({
					localProductId: `p-${i}`,
					title: `Item ${i}`,
					price: 10 + i,
					shippingPrice: 2,
				});
			}

			const page = await controller.listProducts({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── receiveOrder ───────────────────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates a new order", async () => {
			const order = await controller.receiveOrder({
				wishOrderId: "wish-order-1",
				items: [{ sku: "SKU-1", qty: 1 }],
				orderTotal: 12.99,
				shippingTotal: 2.0,
				wishFee: 1.5,
				customerName: "John Doe",
			});

			expect(order.id).toBeDefined();
			expect(order.wishOrderId).toBe("wish-order-1");
			expect(order.status).toBe("pending");
			expect(order.orderTotal).toBe(12.99);
			expect(order.customerName).toBe("John Doe");
			expect(order.createdAt).toBeInstanceOf(Date);
		});

		it("creates an order with ship-by and deliver-by dates", async () => {
			const shipBy = new Date("2026-04-01");
			const deliverBy = new Date("2026-04-15");

			const order = await controller.receiveOrder({
				wishOrderId: "wish-order-2",
				items: [],
				orderTotal: 10,
				shippingTotal: 0,
				wishFee: 1,
				shipByDate: shipBy,
				deliverByDate: deliverBy,
			});

			expect(order.shipByDate).toEqual(shipBy);
			expect(order.deliverByDate).toEqual(deliverBy);
		});

		it("creates an order with minimal fields", async () => {
			const order = await controller.receiveOrder({
				wishOrderId: "wish-order-3",
				items: [],
				orderTotal: 5,
				shippingTotal: 0,
				wishFee: 0.5,
			});

			expect(order.customerName).toBeUndefined();
			expect(order.shippingAddress).toEqual({});
		});
	});

	// ── getOrder ───────────────────────────────────────────────────────────────

	describe("getOrder", () => {
		it("returns an order by id", async () => {
			const order = await controller.receiveOrder({
				wishOrderId: "wish-order-1",
				items: [],
				orderTotal: 10,
				shippingTotal: 0,
				wishFee: 1,
			});

			const found = await controller.getOrder(order.id);
			expect(found?.id as string).toBe(order.id);
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.getOrder("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── shipOrder ──────────────────────────────────────────────────────────────

	describe("shipOrder", () => {
		it("marks order as shipped with tracking", async () => {
			const order = await controller.receiveOrder({
				wishOrderId: "wish-order-1",
				items: [],
				orderTotal: 10,
				shippingTotal: 2,
				wishFee: 1,
			});

			const shipped = await controller.shipOrder(order.id, "TRACK123", "USPS");

			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("TRACK123");
			expect(shipped?.carrier).toBe("USPS");
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.shipOrder("non-existent", "TRACK", "UPS");
			expect(result).toBeNull();
		});
	});

	// ── listOrders ─────────────────────────────────────────────────────────────

	describe("listOrders", () => {
		it("returns all orders", async () => {
			await controller.receiveOrder({
				wishOrderId: "o-1",
				items: [],
				orderTotal: 10,
				shippingTotal: 0,
				wishFee: 1,
			});
			await controller.receiveOrder({
				wishOrderId: "o-2",
				items: [],
				orderTotal: 20,
				shippingTotal: 0,
				wishFee: 2,
			});

			const orders = await controller.listOrders();
			expect(orders).toHaveLength(2);
		});

		it("filters orders by status", async () => {
			const order = await controller.receiveOrder({
				wishOrderId: "o-1",
				items: [],
				orderTotal: 10,
				shippingTotal: 2,
				wishFee: 1,
			});
			await controller.shipOrder(order.id, "TRACK", "UPS");

			const shipped = await controller.listOrders({ status: "shipped" });
			expect(shipped).toHaveLength(1);
		});
	});

	// ── getChannelStats ────────────────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("returns empty stats when no data", async () => {
			const stats = await controller.getChannelStats();

			expect(stats.totalProducts).toBe(0);
			expect(stats.activeProducts).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
			expect(stats.pendingShipments).toBe(0);
			expect(stats.disabledProducts).toBe(0);
		});

		it("computes stats from products and orders", async () => {
			await controller.createProduct({
				localProductId: "p1",
				title: "Item",
				price: 10,
				shippingPrice: 2,
			});

			await controller.receiveOrder({
				wishOrderId: "o-1",
				items: [],
				orderTotal: 25,
				shippingTotal: 2,
				wishFee: 1,
			});

			const stats = await controller.getChannelStats();
			expect(stats.totalProducts).toBe(1);
			expect(stats.activeProducts).toBe(1);
			expect(stats.totalOrders).toBe(1);
			expect(stats.totalRevenue).toBe(25);
			expect(stats.pendingShipments).toBe(1);
		});

		it("counts disabled products", async () => {
			const product = await controller.createProduct({
				localProductId: "p1",
				title: "Item",
				price: 10,
				shippingPrice: 2,
			});
			await controller.disableProduct(product.id);

			const stats = await controller.getChannelStats();
			expect(stats.disabledProducts).toBe(1);
			expect(stats.activeProducts).toBe(0);
		});
	});

	// ── getPendingShipments ────────────────────────────────────────────────────

	describe("getPendingShipments", () => {
		it("returns approved orders awaiting shipment", async () => {
			const order = await controller.receiveOrder({
				wishOrderId: "o-1",
				items: [],
				orderTotal: 10,
				shippingTotal: 2,
				wishFee: 1,
			});

			// getPendingShipments looks for "approved" status orders
			// Manually set the status by re-upserting
			const approvedOrder: Record<string, unknown> = {
				...order,
				status: "approved",
			};
			await mockData.upsert("wishOrder", order.id, approvedOrder);

			const pending = await controller.getPendingShipments();
			expect(pending).toHaveLength(1);
			expect(pending[0]?.wishOrderId).toBe("o-1");
		});

		it("returns empty array when no pending shipments", async () => {
			const pending = await controller.getPendingShipments();
			expect(pending).toEqual([]);
		});
	});
});
