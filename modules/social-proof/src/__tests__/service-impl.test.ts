import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSocialProofController } from "../service-impl";

describe("createSocialProofController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSocialProofController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSocialProofController(mockData);
	});

	async function createTestEvent(
		overrides: Partial<Parameters<typeof controller.recordEvent>[0]> = {},
	) {
		return controller.recordEvent({
			productId: "prod_1",
			productName: "Test Product",
			productSlug: "test-product",
			eventType: "purchase",
			...overrides,
		});
	}

	async function createTestBadge(
		overrides: Partial<Parameters<typeof controller.createBadge>[0]> = {},
	) {
		return controller.createBadge({
			name: "Secure Checkout",
			icon: "🔒",
			position: "checkout",
			...overrides,
		});
	}

	// --- recordEvent ---

	describe("recordEvent", () => {
		it("creates an activity event with required fields", async () => {
			const event = await createTestEvent();
			expect(event.id).toBeDefined();
			expect(event.productId).toBe("prod_1");
			expect(event.productName).toBe("Test Product");
			expect(event.productSlug).toBe("test-product");
			expect(event.eventType).toBe("purchase");
			expect(event.createdAt).toBeInstanceOf(Date);
		});

		it("creates an event with optional location fields", async () => {
			const event = await createTestEvent({
				region: "California",
				country: "US",
				city: "San Francisco",
				quantity: 2,
			});
			expect(event.region).toBe("California");
			expect(event.country).toBe("US");
			expect(event.city).toBe("San Francisco");
			expect(event.quantity).toBe(2);
		});

		it("creates an event with product image", async () => {
			const event = await createTestEvent({
				productImage: "https://example.com/image.jpg",
			});
			expect(event.productImage).toBe("https://example.com/image.jpg");
		});

		it("creates multiple events with unique IDs", async () => {
			const e1 = await createTestEvent();
			const e2 = await createTestEvent();
			expect(e1.id).not.toBe(e2.id);
		});

		it("supports all event types", async () => {
			const purchase = await createTestEvent({ eventType: "purchase" });
			const view = await createTestEvent({ eventType: "view" });
			const cartAdd = await createTestEvent({ eventType: "cart_add" });
			const wishlist = await createTestEvent({
				eventType: "wishlist_add",
			});

			expect(purchase.eventType).toBe("purchase");
			expect(view.eventType).toBe("view");
			expect(cartAdd.eventType).toBe("cart_add");
			expect(wishlist.eventType).toBe("wishlist_add");
		});
	});

	// --- getProductActivity ---

	describe("getProductActivity", () => {
		it("returns aggregated activity for a product", async () => {
			await createTestEvent({ eventType: "view" });
			await createTestEvent({ eventType: "view" });
			await createTestEvent({ eventType: "purchase" });
			await createTestEvent({ eventType: "cart_add" });
			await createTestEvent({ eventType: "wishlist_add" });

			const activity = await controller.getProductActivity("prod_1");
			expect(activity.productId).toBe("prod_1");
			expect(activity.viewCount).toBe(2);
			expect(activity.purchaseCount).toBe(1);
			expect(activity.cartAddCount).toBe(1);
			expect(activity.wishlistAddCount).toBe(1);
			expect(activity.totalEvents).toBe(5);
		});

		it("includes recent purchases with location", async () => {
			await createTestEvent({
				eventType: "purchase",
				city: "New York",
				country: "US",
				quantity: 3,
			});

			const activity = await controller.getProductActivity("prod_1");
			expect(activity.recentPurchases.length).toBe(1);
			expect(activity.recentPurchases[0].city).toBe("New York");
			expect(activity.recentPurchases[0].quantity).toBe(3);
		});

		it("limits recent purchases to 10", async () => {
			for (let i = 0; i < 15; i++) {
				await createTestEvent({
					eventType: "purchase",
					city: `City ${i}`,
				});
			}

			const activity = await controller.getProductActivity("prod_1");
			expect(activity.recentPurchases.length).toBe(10);
		});

		it("returns zero counts for product with no events", async () => {
			const activity = await controller.getProductActivity("prod_99");
			expect(activity.viewCount).toBe(0);
			expect(activity.purchaseCount).toBe(0);
			expect(activity.cartAddCount).toBe(0);
			expect(activity.totalEvents).toBe(0);
		});

		it("only includes events from specified period", async () => {
			await createTestEvent({ eventType: "view" });

			// Default is 24h which includes events just created
			const activity = await controller.getProductActivity("prod_1", {
				period: "24h",
			});
			expect(activity.viewCount).toBe(1);
		});

		it("does not mix events from different products", async () => {
			await createTestEvent({
				productId: "prod_1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_2",
				eventType: "view",
			});

			const activity = await controller.getProductActivity("prod_1");
			expect(activity.viewCount).toBe(1);
			expect(activity.totalEvents).toBe(1);
		});
	});

	// --- getRecentActivity ---

	describe("getRecentActivity", () => {
		it("returns recent events sorted by date descending", async () => {
			await createTestEvent({ productId: "prod_1" });
			await createTestEvent({ productId: "prod_2" });
			await createTestEvent({ productId: "prod_3" });

			const events = await controller.getRecentActivity();
			expect(events.length).toBe(3);
		});

		it("filters by event type", async () => {
			await createTestEvent({ eventType: "purchase" });
			await createTestEvent({ eventType: "view" });
			await createTestEvent({ eventType: "view" });

			const purchases = await controller.getRecentActivity({
				eventType: "purchase",
			});
			expect(purchases.length).toBe(1);
			expect(purchases[0].eventType).toBe("purchase");
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 10; i++) {
				await createTestEvent({ productId: `prod_${i}` });
			}

			const events = await controller.getRecentActivity({ take: 3 });
			expect(events.length).toBe(3);
		});

		it("respects skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestEvent({ productId: `prod_${i}` });
			}

			const events = await controller.getRecentActivity({
				skip: 2,
				take: 10,
			});
			expect(events.length).toBe(3);
		});

		it("returns empty array when no events exist", async () => {
			const events = await controller.getRecentActivity();
			expect(events).toEqual([]);
		});
	});

	// --- getTrendingProducts ---

	describe("getTrendingProducts", () => {
		it("returns products sorted by event count descending", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "Product 1",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "Product 1",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "Product 1",
			});
			await createTestEvent({
				productId: "prod_2",
				productName: "Product 2",
			});

			const trending = await controller.getTrendingProducts();
			expect(trending.length).toBe(2);
			expect(trending[0].productId).toBe("prod_1");
			expect(trending[0].eventCount).toBe(3);
			expect(trending[1].productId).toBe("prod_2");
			expect(trending[1].eventCount).toBe(1);
		});

		it("tracks purchase count separately", async () => {
			await createTestEvent({
				productId: "prod_1",
				eventType: "purchase",
			});
			await createTestEvent({
				productId: "prod_1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_1",
				eventType: "view",
			});

			const trending = await controller.getTrendingProducts();
			expect(trending[0].eventCount).toBe(3);
			expect(trending[0].purchaseCount).toBe(1);
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestEvent({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					productSlug: `product-${i}`,
				});
			}

			const trending = await controller.getTrendingProducts({ take: 2 });
			expect(trending.length).toBe(2);
		});

		it("respects skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestEvent({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					productSlug: `product-${i}`,
				});
			}

			const trending = await controller.getTrendingProducts({
				skip: 3,
				take: 10,
			});
			expect(trending.length).toBe(2);
		});

		it("returns empty array when no events exist", async () => {
			const trending = await controller.getTrendingProducts();
			expect(trending).toEqual([]);
		});

		it("includes product metadata", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "My Product",
				productSlug: "my-product",
				productImage: "https://example.com/img.jpg",
			});

			const trending = await controller.getTrendingProducts();
			expect(trending[0].productName).toBe("My Product");
			expect(trending[0].productSlug).toBe("my-product");
			expect(trending[0].productImage).toBe("https://example.com/img.jpg");
		});
	});

	// --- createBadge ---

	describe("createBadge", () => {
		it("creates a badge with required fields", async () => {
			const badge = await createTestBadge();
			expect(badge.id).toBeDefined();
			expect(badge.name).toBe("Secure Checkout");
			expect(badge.icon).toBe("🔒");
			expect(badge.position).toBe("checkout");
			expect(badge.isActive).toBe(true);
			expect(badge.priority).toBe(0);
			expect(badge.createdAt).toBeInstanceOf(Date);
			expect(badge.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a badge with all optional fields", async () => {
			const badge = await createTestBadge({
				description: "SSL encrypted",
				url: "https://example.com/security",
				priority: 10,
				isActive: false,
			});
			expect(badge.description).toBe("SSL encrypted");
			expect(badge.url).toBe("https://example.com/security");
			expect(badge.priority).toBe(10);
			expect(badge.isActive).toBe(false);
		});

		it("creates multiple badges with unique IDs", async () => {
			const b1 = await createTestBadge({ name: "Badge 1" });
			const b2 = await createTestBadge({ name: "Badge 2" });
			expect(b1.id).not.toBe(b2.id);
		});

		it("defaults isActive to true", async () => {
			const badge = await createTestBadge();
			expect(badge.isActive).toBe(true);
		});

		it("defaults priority to 0", async () => {
			const badge = await createTestBadge();
			expect(badge.priority).toBe(0);
		});
	});

	// --- getBadge ---

	describe("getBadge", () => {
		it("returns a badge by ID", async () => {
			const created = await createTestBadge();
			const found = await controller.getBadge(created.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Secure Checkout");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getBadge("non-existent");
			expect(found).toBeNull();
		});
	});

	// --- updateBadge ---

	describe("updateBadge", () => {
		it("updates badge name", async () => {
			const created = await createTestBadge();
			const updated = await controller.updateBadge(created.id, {
				name: "Updated Badge",
			});
			expect(updated?.name).toBe("Updated Badge");
			expect(updated?.icon).toBe("🔒");
		});

		it("updates badge position and priority", async () => {
			const created = await createTestBadge();
			const updated = await controller.updateBadge(created.id, {
				position: "product",
				priority: 5,
			});
			expect(updated?.position).toBe("product");
			expect(updated?.priority).toBe(5);
		});

		it("clears optional fields with null", async () => {
			const created = await createTestBadge({
				description: "Some description",
				url: "https://example.com",
			});
			const updated = await controller.updateBadge(created.id, {
				description: null,
				url: null,
			});
			expect(updated?.description).toBeUndefined();
			expect(updated?.url).toBeUndefined();
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.updateBadge("non-existent", {
				name: "X",
			});
			expect(result).toBeNull();
		});

		it("sets updatedAt to a new timestamp", async () => {
			const created = await createTestBadge();
			const updated = await controller.updateBadge(created.id, {
				name: "Updated",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("toggles isActive", async () => {
			const created = await createTestBadge({ isActive: true });
			const updated = await controller.updateBadge(created.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});
	});

	// --- deleteBadge ---

	describe("deleteBadge", () => {
		it("deletes a badge by ID", async () => {
			const created = await createTestBadge();
			const deleted = await controller.deleteBadge(created.id);
			expect(deleted).toBe(true);
			const found = await controller.getBadge(created.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent ID", async () => {
			const deleted = await controller.deleteBadge("non-existent");
			expect(deleted).toBe(false);
		});
	});

	// --- listBadges ---

	describe("listBadges", () => {
		it("lists all badges", async () => {
			await createTestBadge({ name: "Badge 1" });
			await createTestBadge({ name: "Badge 2" });
			await createTestBadge({ name: "Badge 3" });

			const badges = await controller.listBadges();
			expect(badges.length).toBe(3);
		});

		it("filters by position", async () => {
			await createTestBadge({ name: "Checkout", position: "checkout" });
			await createTestBadge({ name: "Product", position: "product" });
			await createTestBadge({ name: "Footer", position: "footer" });

			const checkout = await controller.listBadges({
				position: "checkout",
			});
			expect(checkout.length).toBe(1);
			expect(checkout[0].position).toBe("checkout");
		});

		it("filters by active status", async () => {
			await createTestBadge({ name: "Active", isActive: true });
			await createTestBadge({ name: "Inactive", isActive: false });

			const active = await controller.listBadges({ isActive: true });
			expect(active.length).toBe(1);
			expect(active[0].isActive).toBe(true);
		});

		it("sorts by priority descending then name", async () => {
			await createTestBadge({ name: "Low Priority", priority: 1 });
			await createTestBadge({ name: "High Priority", priority: 10 });
			await createTestBadge({ name: "Medium Priority", priority: 5 });

			const badges = await controller.listBadges();
			expect(badges[0].name).toBe("High Priority");
			expect(badges[1].name).toBe("Medium Priority");
			expect(badges[2].name).toBe("Low Priority");
		});

		it("respects take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestBadge({ name: `Badge ${i}` });
			}

			const page = await controller.listBadges({ take: 2, skip: 1 });
			expect(page.length).toBe(2);
		});
	});

	// --- countBadges ---

	describe("countBadges", () => {
		it("counts all badges", async () => {
			await createTestBadge({ name: "A" });
			await createTestBadge({ name: "B" });
			expect(await controller.countBadges()).toBe(2);
		});

		it("counts filtered badges", async () => {
			await createTestBadge({ name: "Active", isActive: true });
			await createTestBadge({ name: "Inactive", isActive: false });
			expect(await controller.countBadges({ isActive: true })).toBe(1);
		});

		it("counts by position", async () => {
			await createTestBadge({ name: "Checkout", position: "checkout" });
			await createTestBadge({ name: "Product", position: "product" });
			expect(await controller.countBadges({ position: "checkout" })).toBe(1);
		});
	});

	// --- listEvents ---

	describe("listEvents", () => {
		it("lists all events sorted by date descending", async () => {
			await createTestEvent({ productId: "prod_1" });
			await createTestEvent({ productId: "prod_2" });
			await createTestEvent({ productId: "prod_3" });

			const events = await controller.listEvents();
			expect(events.length).toBe(3);
		});

		it("filters by productId", async () => {
			await createTestEvent({ productId: "prod_1" });
			await createTestEvent({ productId: "prod_2" });
			await createTestEvent({ productId: "prod_1" });

			const events = await controller.listEvents({
				productId: "prod_1",
			});
			expect(events.length).toBe(2);
		});

		it("filters by eventType", async () => {
			await createTestEvent({ eventType: "purchase" });
			await createTestEvent({ eventType: "view" });
			await createTestEvent({ eventType: "view" });

			const purchases = await controller.listEvents({
				eventType: "purchase",
			});
			expect(purchases.length).toBe(1);
		});

		it("respects take and skip", async () => {
			for (let i = 0; i < 10; i++) {
				await createTestEvent({ productId: `prod_${i}` });
			}

			const page = await controller.listEvents({ take: 3, skip: 2 });
			expect(page.length).toBe(3);
		});

		it("returns empty array when no events exist", async () => {
			const events = await controller.listEvents();
			expect(events).toEqual([]);
		});
	});

	// --- countEvents ---

	describe("countEvents", () => {
		it("counts all events", async () => {
			await createTestEvent();
			await createTestEvent();
			await createTestEvent();
			expect(await controller.countEvents()).toBe(3);
		});

		it("counts events filtered by productId", async () => {
			await createTestEvent({ productId: "prod_1" });
			await createTestEvent({ productId: "prod_2" });
			await createTestEvent({ productId: "prod_1" });

			expect(await controller.countEvents({ productId: "prod_1" })).toBe(2);
		});

		it("counts events filtered by eventType", async () => {
			await createTestEvent({ eventType: "purchase" });
			await createTestEvent({ eventType: "view" });
			expect(await controller.countEvents({ eventType: "purchase" })).toBe(1);
		});

		it("returns 0 when no events exist", async () => {
			expect(await controller.countEvents()).toBe(0);
		});
	});

	// --- cleanupEvents ---

	describe("cleanupEvents", () => {
		it("deletes events older than specified days", async () => {
			// Create events (they'll be created with current timestamp)
			await createTestEvent({ productId: "prod_1" });
			await createTestEvent({ productId: "prod_2" });

			// Clean up events older than 30 days — none should be deleted
			const deleted = await controller.cleanupEvents(30);
			expect(deleted).toBe(0);

			// All events should still exist
			expect(await controller.countEvents()).toBe(2);
		});

		it("returns count of deleted events", async () => {
			await createTestEvent();
			await createTestEvent();

			// No events older than 1 day since they were just created
			const deleted = await controller.cleanupEvents(1);
			expect(deleted).toBe(0);
		});
	});

	// --- getActivitySummary ---

	describe("getActivitySummary", () => {
		it("returns aggregated summary", async () => {
			await createTestEvent({
				productId: "prod_1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_1",
				eventType: "purchase",
			});
			await createTestEvent({
				productId: "prod_2",
				eventType: "cart_add",
			});
			await createTestEvent({
				productId: "prod_2",
				eventType: "view",
			});

			const summary = await controller.getActivitySummary();
			expect(summary.totalEvents).toBe(4);
			expect(summary.totalPurchases).toBe(1);
			expect(summary.totalViews).toBe(2);
			expect(summary.totalCartAdds).toBe(1);
			expect(summary.uniqueProducts).toBe(2);
		});

		it("returns top products sorted by event count", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "Product 1",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "Product 1",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "Product 1",
			});
			await createTestEvent({
				productId: "prod_2",
				productName: "Product 2",
			});

			const summary = await controller.getActivitySummary();
			expect(summary.topProducts.length).toBe(2);
			expect(summary.topProducts[0].productName).toBe("Product 1");
			expect(summary.topProducts[0].eventCount).toBe(3);
			expect(summary.topProducts[1].productName).toBe("Product 2");
			expect(summary.topProducts[1].eventCount).toBe(1);
		});

		it("limits top products to 10", async () => {
			for (let i = 0; i < 15; i++) {
				await createTestEvent({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					productSlug: `product-${i}`,
				});
			}

			const summary = await controller.getActivitySummary();
			expect(summary.topProducts.length).toBe(10);
		});

		it("returns zeros when no events exist", async () => {
			const summary = await controller.getActivitySummary();
			expect(summary.totalEvents).toBe(0);
			expect(summary.totalPurchases).toBe(0);
			expect(summary.totalViews).toBe(0);
			expect(summary.totalCartAdds).toBe(0);
			expect(summary.uniqueProducts).toBe(0);
			expect(summary.topProducts).toEqual([]);
		});

		it("includes purchase counts in top products", async () => {
			await createTestEvent({
				productId: "prod_1",
				eventType: "purchase",
			});
			await createTestEvent({
				productId: "prod_1",
				eventType: "view",
			});

			const summary = await controller.getActivitySummary();
			expect(summary.topProducts[0].purchaseCount).toBe(1);
			expect(summary.topProducts[0].eventCount).toBe(2);
		});
	});
});
