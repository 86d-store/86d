import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGoogleShoppingController } from "../service-impl";

describe("google-shopping controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createGoogleShoppingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGoogleShoppingController(mockData);
	});

	// ── createFeedItem ────────────────────────────────────────────────

	describe("createFeedItem", () => {
		it("creates a feed item with defaults", async () => {
			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 19.99,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
			});

			expect(item.id).toBeTruthy();
			expect(item.localProductId).toBe("prod-1");
			expect(item.title).toBe("Widget");
			expect(item.status).toBe("pending");
			expect(item.condition).toBe("new");
			expect(item.availability).toBe("in-stock");
			expect(item.price).toBe(19.99);
			expect(item.disapprovalReasons).toEqual([]);
			expect(item.createdAt).toBeInstanceOf(Date);
			expect(item.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a feed item with all fields", async () => {
			const expires = new Date("2026-12-31");
			const item = await controller.createFeedItem({
				localProductId: "prod-2",
				googleProductId: "google-123",
				title: "Gadget",
				description: "A great gadget",
				status: "active",
				disapprovalReasons: [],
				googleCategory: "Electronics > Gadgets",
				condition: "refurbished",
				availability: "preorder",
				price: 49.99,
				salePrice: 39.99,
				link: "https://example.com/gadget",
				imageLink: "https://example.com/gadget.jpg",
				gtin: "0123456789012",
				mpn: "GAD-001",
				brand: "Acme",
				expiresAt: expires,
			});

			expect(item.googleProductId).toBe("google-123");
			expect(item.description).toBe("A great gadget");
			expect(item.status).toBe("active");
			expect(item.condition).toBe("refurbished");
			expect(item.availability).toBe("preorder");
			expect(item.salePrice).toBe(39.99);
			expect(item.gtin).toBe("0123456789012");
			expect(item.mpn).toBe("GAD-001");
			expect(item.brand).toBe("Acme");
			expect(item.expiresAt).toEqual(expires);
		});

		it("each feed item gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 10; i++) {
				const item = await controller.createFeedItem({
					localProductId: `prod-${i}`,
					title: `Product ${i}`,
					price: 10,
					link: `https://example.com/${i}`,
					imageLink: `https://example.com/${i}.jpg`,
				});
				ids.add(item.id);
			}
			expect(ids.size).toBe(10);
		});
	});

	// ── updateFeedItem ────────────────────────────────────────────────

	describe("updateFeedItem", () => {
		it("updates specific fields without touching others", async () => {
			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Original",
				price: 10,
				link: "https://example.com/1",
				imageLink: "https://example.com/1.jpg",
				brand: "Acme",
			});

			const updated = await controller.updateFeedItem(item.id, {
				title: "Updated Title",
			});

			expect(updated?.title).toBe("Updated Title");
			expect(updated?.brand).toBe("Acme");
			expect(updated?.price).toBe(10);
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.updateFeedItem("non-existent", {
				title: "Nope",
			});
			expect(result).toBeNull();
		});

		it("updates status to disapproved with reasons", async () => {
			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://example.com/1",
				imageLink: "https://example.com/1.jpg",
			});

			const updated = await controller.updateFeedItem(item.id, {
				status: "disapproved",
				disapprovalReasons: ["Missing GTIN", "Invalid price"],
			});

			expect(updated?.status).toBe("disapproved");
			expect(updated?.disapprovalReasons).toEqual([
				"Missing GTIN",
				"Invalid price",
			]);
		});

		it("updates updatedAt timestamp", async () => {
			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://example.com/1",
				imageLink: "https://example.com/1.jpg",
			});

			const updated = await controller.updateFeedItem(item.id, {
				price: 15,
			});

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				item.updatedAt.getTime(),
			);
		});
	});

	// ── deleteFeedItem ────────────────────────────────────────────────

	describe("deleteFeedItem", () => {
		it("deletes existing item and returns true", async () => {
			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://example.com/1",
				imageLink: "https://example.com/1.jpg",
			});

			expect(await controller.deleteFeedItem(item.id)).toBe(true);
			expect(await controller.getFeedItem(item.id)).toBeNull();
		});

		it("returns false for non-existent id", async () => {
			expect(await controller.deleteFeedItem("non-existent")).toBe(false);
		});

		it("double deletion returns false", async () => {
			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://example.com/1",
				imageLink: "https://example.com/1.jpg",
			});

			expect(await controller.deleteFeedItem(item.id)).toBe(true);
			expect(await controller.deleteFeedItem(item.id)).toBe(false);
		});
	});

	// ── getFeedItem / getFeedItemByProduct ─────────────────────────────

	describe("getFeedItem / getFeedItemByProduct", () => {
		it("returns null for empty string id", async () => {
			expect(await controller.getFeedItem("")).toBeNull();
		});

		it("finds feed item by local product id", async () => {
			await controller.createFeedItem({
				localProductId: "prod-abc",
				title: "Product ABC",
				price: 25,
				link: "https://example.com/abc",
				imageLink: "https://example.com/abc.jpg",
			});

			const found = await controller.getFeedItemByProduct("prod-abc");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Product ABC");
		});

		it("returns null for non-existent product id", async () => {
			expect(await controller.getFeedItemByProduct("missing")).toBeNull();
		});
	});

	// ── listFeedItems ─────────────────────────────────────────────────

	describe("listFeedItems", () => {
		it("returns empty array when no items exist", async () => {
			const items = await controller.listFeedItems();
			expect(items).toHaveLength(0);
		});

		it("filters by status", async () => {
			await controller.createFeedItem({
				localProductId: "p1",
				title: "Active",
				price: 10,
				link: "https://example.com/1",
				imageLink: "https://example.com/1.jpg",
				status: "active",
			});
			await controller.createFeedItem({
				localProductId: "p2",
				title: "Pending",
				price: 10,
				link: "https://example.com/2",
				imageLink: "https://example.com/2.jpg",
			});

			const active = await controller.listFeedItems({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Active");
		});

		it("paginates correctly", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createFeedItem({
					localProductId: `p-${i}`,
					title: `Product ${i}`,
					price: 10,
					link: `https://example.com/${i}`,
					imageLink: `https://example.com/${i}.jpg`,
				});
			}

			const page1 = await controller.listFeedItems({ take: 2, skip: 0 });
			const page2 = await controller.listFeedItems({ take: 2, skip: 2 });
			const page3 = await controller.listFeedItems({ take: 2, skip: 4 });

			expect(page1).toHaveLength(2);
			expect(page2).toHaveLength(2);
			expect(page3).toHaveLength(1);
		});
	});

	// ── submitFeed ────────────────────────────────────────────────────

	describe("submitFeed", () => {
		it("creates a feed submission with correct counts", async () => {
			await controller.createFeedItem({
				localProductId: "p1",
				title: "Active 1",
				price: 10,
				link: "https://example.com/1",
				imageLink: "https://example.com/1.jpg",
				status: "active",
			});
			await controller.createFeedItem({
				localProductId: "p2",
				title: "Active 2",
				price: 20,
				link: "https://example.com/2",
				imageLink: "https://example.com/2.jpg",
				status: "active",
			});
			await controller.createFeedItem({
				localProductId: "p3",
				title: "Disapproved",
				price: 30,
				link: "https://example.com/3",
				imageLink: "https://example.com/3.jpg",
				status: "disapproved",
			});

			const submission = await controller.submitFeed();
			expect(submission.totalProducts).toBe(3);
			expect(submission.approvedProducts).toBe(2);
			expect(submission.disapprovedProducts).toBe(1);
			expect(submission.status).toBe("pending");
		});

		it("creates submission with zero products when feed is empty", async () => {
			const submission = await controller.submitFeed();
			expect(submission.totalProducts).toBe(0);
			expect(submission.approvedProducts).toBe(0);
			expect(submission.disapprovedProducts).toBe(0);
		});
	});

	// ── getLastSubmission / listSubmissions ────────────────────────────

	describe("getLastSubmission / listSubmissions", () => {
		it("returns null when no submissions exist", async () => {
			expect(await controller.getLastSubmission()).toBeNull();
		});

		it("returns the most recent submission", async () => {
			await controller.submitFeed();
			await controller.submitFeed();
			const last = await controller.getLastSubmission();
			expect(last).not.toBeNull();
			expect(last?.id).toBeTruthy();
		});

		it("lists submissions with pagination", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.submitFeed();
			}
			const subs = await controller.listSubmissions({ take: 2 });
			expect(subs).toHaveLength(2);
		});
	});

	// ── receiveOrder ──────────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates an order with defaults", async () => {
			const order = await controller.receiveOrder({
				googleOrderId: "goog-123",
				items: [{ sku: "A", qty: 1 }],
				subtotal: 100,
				shippingCost: 10,
				tax: 8,
				total: 118,
				shippingAddress: { city: "Portland" },
			});

			expect(order.id).toBeTruthy();
			expect(order.googleOrderId).toBe("goog-123");
			expect(order.status).toBe("pending");
			expect(order.items).toHaveLength(1);
			expect(order.total).toBe(118);
			expect(order.shippingAddress).toEqual({ city: "Portland" });
		});

		it("creates an order with specified status", async () => {
			const order = await controller.receiveOrder({
				googleOrderId: "goog-456",
				status: "confirmed",
				items: [],
				subtotal: 50,
				shippingCost: 5,
				tax: 4,
				total: 59,
				shippingAddress: {},
			});

			expect(order.status).toBe("confirmed");
		});
	});

	// ── getOrder / updateOrderStatus ──────────────────────────────────

	describe("getOrder / updateOrderStatus", () => {
		it("returns null for non-existent order", async () => {
			expect(await controller.getOrder("missing")).toBeNull();
		});

		it("updates order status with tracking info", async () => {
			const order = await controller.receiveOrder({
				googleOrderId: "goog-789",
				items: [],
				subtotal: 100,
				shippingCost: 10,
				tax: 8,
				total: 118,
				shippingAddress: {},
			});

			const updated = await controller.updateOrderStatus(
				order.id,
				"shipped",
				"TRACK-123",
				"UPS",
			);

			expect(updated?.status).toBe("shipped");
			expect(updated?.trackingNumber).toBe("TRACK-123");
			expect(updated?.carrier).toBe("UPS");
		});

		it("returns null when updating non-existent order", async () => {
			const result = await controller.updateOrderStatus("missing", "shipped");
			expect(result).toBeNull();
		});

		it("updates status without tracking info", async () => {
			const order = await controller.receiveOrder({
				googleOrderId: "goog-000",
				items: [],
				subtotal: 10,
				shippingCost: 0,
				tax: 0,
				total: 10,
				shippingAddress: {},
			});

			const updated = await controller.updateOrderStatus(order.id, "cancelled");
			expect(updated?.status).toBe("cancelled");
			expect(updated?.trackingNumber).toBeUndefined();
		});
	});

	// ── listOrders ────────────────────────────────────────────────────

	describe("listOrders", () => {
		it("returns empty array when no orders exist", async () => {
			const orders = await controller.listOrders();
			expect(orders).toHaveLength(0);
		});

		it("filters orders by status", async () => {
			await controller.receiveOrder({
				googleOrderId: "o1",
				items: [],
				subtotal: 10,
				shippingCost: 0,
				tax: 0,
				total: 10,
				shippingAddress: {},
			});

			const o2 = await controller.receiveOrder({
				googleOrderId: "o2",
				items: [],
				subtotal: 20,
				shippingCost: 0,
				tax: 0,
				total: 20,
				shippingAddress: {},
			});
			await controller.updateOrderStatus(o2.id, "shipped");

			const pending = await controller.listOrders({ status: "pending" });
			expect(pending).toHaveLength(1);

			const shipped = await controller.listOrders({ status: "shipped" });
			expect(shipped).toHaveLength(1);
		});
	});

	// ── getChannelStats ───────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("returns zero stats when empty", async () => {
			const stats = await controller.getChannelStats();
			expect(stats.totalFeedItems).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("counts feed items by status and calculates revenue", async () => {
			await controller.createFeedItem({
				localProductId: "p1",
				title: "Active",
				price: 10,
				link: "https://example.com/1",
				imageLink: "https://example.com/1.jpg",
				status: "active",
			});
			await controller.createFeedItem({
				localProductId: "p2",
				title: "Pending",
				price: 20,
				link: "https://example.com/2",
				imageLink: "https://example.com/2.jpg",
			});
			await controller.createFeedItem({
				localProductId: "p3",
				title: "Disapproved",
				price: 30,
				link: "https://example.com/3",
				imageLink: "https://example.com/3.jpg",
				status: "disapproved",
			});

			await controller.receiveOrder({
				googleOrderId: "o1",
				items: [],
				subtotal: 100,
				shippingCost: 10,
				tax: 8,
				total: 118,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				googleOrderId: "o2",
				items: [],
				subtotal: 50,
				shippingCost: 5,
				tax: 4,
				total: 59,
				shippingAddress: {},
			});

			const stats = await controller.getChannelStats();
			expect(stats.totalFeedItems).toBe(3);
			expect(stats.active).toBe(1);
			expect(stats.pending).toBe(1);
			expect(stats.disapproved).toBe(1);
			expect(stats.totalOrders).toBe(2);
			expect(stats.totalRevenue).toBe(177);
		});
	});

	// ── getDiagnostics ────────────────────────────────────────────────

	describe("getDiagnostics", () => {
		it("returns empty diagnostics when no items exist", async () => {
			const diag = await controller.getDiagnostics();
			expect(diag.statusBreakdown).toEqual([]);
			expect(diag.disapprovalReasons).toEqual([]);
		});

		it("counts statuses and disapproval reasons", async () => {
			await controller.createFeedItem({
				localProductId: "p1",
				title: "OK",
				price: 10,
				link: "https://example.com/1",
				imageLink: "https://example.com/1.jpg",
				status: "active",
			});
			const item = await controller.createFeedItem({
				localProductId: "p2",
				title: "Bad",
				price: 20,
				link: "https://example.com/2",
				imageLink: "https://example.com/2.jpg",
				status: "disapproved",
			});
			await controller.updateFeedItem(item.id, {
				disapprovalReasons: ["Missing GTIN", "Invalid image"],
			});
			await controller.createFeedItem({
				localProductId: "p3",
				title: "Also bad",
				price: 30,
				link: "https://example.com/3",
				imageLink: "https://example.com/3.jpg",
				status: "disapproved",
			});
			const item3 = await controller.getFeedItemByProduct("p3");
			await controller.updateFeedItem(item3?.id as string, {
				disapprovalReasons: ["Missing GTIN"],
			});

			const diag = await controller.getDiagnostics();

			expect(diag.statusBreakdown).toHaveLength(2);
			const disapprovedCount = diag.statusBreakdown.find(
				(s) => s.status === "disapproved",
			);
			expect(disapprovedCount?.count).toBe(2);

			const gtinReason = diag.disapprovalReasons.find(
				(r) => r.reason === "Missing GTIN",
			);
			expect(gtinReason?.count).toBe(2);
		});

		it("sorts by count descending", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.createFeedItem({
					localProductId: `active-${i}`,
					title: `Active ${i}`,
					price: 10,
					link: `https://example.com/a${i}`,
					imageLink: `https://example.com/a${i}.jpg`,
					status: "active",
				});
			}
			await controller.createFeedItem({
				localProductId: "pending-0",
				title: "Pending",
				price: 10,
				link: "https://example.com/p0",
				imageLink: "https://example.com/p0.jpg",
			});

			const diag = await controller.getDiagnostics();
			expect(diag.statusBreakdown[0].status).toBe("active");
			expect(diag.statusBreakdown[0].count).toBe(3);
		});
	});
});
