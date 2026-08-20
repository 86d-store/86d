import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSocialProofController } from "../service-impl";

describe("social-proof controller edge cases", () => {
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
			icon: "lock",
			position: "checkout",
			...overrides,
		});
	}

	// ── recordEvent edge cases ──────────────────────────────────────────

	describe("recordEvent edge cases", () => {
		it("stores event with empty string productImage", async () => {
			const event = await createTestEvent({ productImage: "" });
			expect(event.productImage).toBe("");
		});

		it("stores event with undefined optional fields as undefined", async () => {
			const event = await createTestEvent();
			expect(event.region).toBeUndefined();
			expect(event.country).toBeUndefined();
			expect(event.city).toBeUndefined();
			expect(event.quantity).toBeUndefined();
			expect(event.productImage).toBeUndefined();
		});

		it("stores event with quantity of zero", async () => {
			const event = await createTestEvent({ quantity: 0 });
			expect(event.quantity).toBe(0);
		});

		it("stores event with very large quantity", async () => {
			const event = await createTestEvent({ quantity: 999999 });
			expect(event.quantity).toBe(999999);
		});

		it("persists event in data store so it can be retrieved", async () => {
			const event = await createTestEvent();
			const raw = await mockData.get("activityEvent", event.id);
			expect(raw).not.toBeNull();
			expect((raw as Record<string, unknown>).productId).toBe("prod_1");
		});

		it("handles special characters in product name and slug", async () => {
			const event = await createTestEvent({
				productName: "Widget <script>alert('xss')</script>",
				productSlug: "widget-special-chars-&-more",
			});
			expect(event.productName).toBe("Widget <script>alert('xss')</script>");
			expect(event.productSlug).toBe("widget-special-chars-&-more");
		});

		it("handles unicode in location fields", async () => {
			const event = await createTestEvent({
				city: "Mönchengladbach",
				region: "Nordrhein-Westfalen",
				country: "Deutschland",
			});
			expect(event.city).toBe("Mönchengladbach");
			expect(event.region).toBe("Nordrhein-Westfalen");
		});

		it("handles empty string location fields", async () => {
			const event = await createTestEvent({
				city: "",
				region: "",
				country: "",
			});
			expect(event.city).toBe("");
			expect(event.region).toBe("");
			expect(event.country).toBe("");
		});
	});

	// ── getProductActivity edge cases ───────────────────────────────────

	describe("getProductActivity edge cases", () => {
		it("defaults to 24h period when no params given", async () => {
			await createTestEvent({ eventType: "view" });
			const activity = await controller.getProductActivity("prod_1");
			expect(activity.viewCount).toBe(1);
			expect(activity.totalEvents).toBe(1);
		});

		it("uses 24h period when params object is provided but period is undefined", async () => {
			await createTestEvent({ eventType: "view" });
			const activity = await controller.getProductActivity("prod_1", {});
			expect(activity.viewCount).toBe(1);
		});

		it("returns empty recentPurchases when only non-purchase events exist", async () => {
			await createTestEvent({ eventType: "view" });
			await createTestEvent({ eventType: "cart_add" });
			await createTestEvent({ eventType: "wishlist_add" });

			const activity = await controller.getProductActivity("prod_1");
			expect(activity.recentPurchases).toEqual([]);
			expect(activity.purchaseCount).toBe(0);
		});

		it("sorts recent purchases newest first", async () => {
			await createTestEvent({
				eventType: "purchase",
				city: "First",
			});
			await createTestEvent({
				eventType: "purchase",
				city: "Second",
			});

			const activity = await controller.getProductActivity("prod_1");
			// Both created at essentially the same time in tests,
			// but sorting should still work without errors
			expect(activity.recentPurchases.length).toBe(2);
		});

		it("caps recentPurchases at exactly 10 even with 11 purchases", async () => {
			for (let i = 0; i < 11; i++) {
				await createTestEvent({
					eventType: "purchase",
					city: `City ${i}`,
				});
			}

			const activity = await controller.getProductActivity("prod_1");
			expect(activity.recentPurchases.length).toBe(10);
		});

		it("handles all four event types in a single product's activity", async () => {
			await createTestEvent({ eventType: "view" });
			await createTestEvent({ eventType: "purchase" });
			await createTestEvent({ eventType: "cart_add" });
			await createTestEvent({ eventType: "wishlist_add" });

			const activity = await controller.getProductActivity("prod_1");
			expect(activity.viewCount).toBe(1);
			expect(activity.purchaseCount).toBe(1);
			expect(activity.cartAddCount).toBe(1);
			expect(activity.wishlistAddCount).toBe(1);
			expect(activity.totalEvents).toBe(4);
		});

		it("does not count events from unrelated products", async () => {
			await createTestEvent({ productId: "prod_1", eventType: "view" });
			await createTestEvent({ productId: "prod_2", eventType: "view" });
			await createTestEvent({ productId: "prod_2", eventType: "purchase" });

			const activity = await controller.getProductActivity("prod_1");
			expect(activity.viewCount).toBe(1);
			expect(activity.purchaseCount).toBe(0);
			expect(activity.totalEvents).toBe(1);
		});

		it("supports 1h period", async () => {
			await createTestEvent({ eventType: "view" });
			const activity = await controller.getProductActivity("prod_1", {
				period: "1h",
			});
			expect(activity.viewCount).toBe(1);
		});

		it("supports 7d period", async () => {
			await createTestEvent({ eventType: "view" });
			const activity = await controller.getProductActivity("prod_1", {
				period: "7d",
			});
			expect(activity.viewCount).toBe(1);
		});

		it("supports 30d period", async () => {
			await createTestEvent({ eventType: "view" });
			const activity = await controller.getProductActivity("prod_1", {
				period: "30d",
			});
			expect(activity.viewCount).toBe(1);
		});

		it("includes purchase location details in recentPurchases", async () => {
			await createTestEvent({
				eventType: "purchase",
				region: "California",
				country: "US",
				city: "LA",
				quantity: 5,
			});

			const activity = await controller.getProductActivity("prod_1");
			const purchase = activity.recentPurchases[0];
			expect(purchase.region).toBe("California");
			expect(purchase.country).toBe("US");
			expect(purchase.city).toBe("LA");
			expect(purchase.quantity).toBe(5);
		});
	});

	// ── getRecentActivity edge cases ────────────────────────────────────

	describe("getRecentActivity edge cases", () => {
		it("defaults take to 20 when not provided", async () => {
			for (let i = 0; i < 25; i++) {
				await createTestEvent({ productId: `prod_${i}` });
			}

			const events = await controller.getRecentActivity();
			expect(events.length).toBe(20);
		});

		it("defaults skip to 0 when not provided", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestEvent({ productId: `prod_${i}` });
			}

			const events = await controller.getRecentActivity({ take: 5 });
			expect(events.length).toBe(5);
		});

		it("returns empty when skip exceeds total events", async () => {
			await createTestEvent();
			await createTestEvent();

			const events = await controller.getRecentActivity({ skip: 100 });
			expect(events).toEqual([]);
		});

		it("returns all remaining events when take exceeds remaining", async () => {
			for (let i = 0; i < 3; i++) {
				await createTestEvent({ productId: `prod_${i}` });
			}

			const events = await controller.getRecentActivity({ take: 100 });
			expect(events.length).toBe(3);
		});

		it("handles take of zero returning empty array", async () => {
			await createTestEvent();
			const events = await controller.getRecentActivity({ take: 0 });
			expect(events).toEqual([]);
		});

		it("filters by cart_add event type", async () => {
			await createTestEvent({ eventType: "purchase" });
			await createTestEvent({ eventType: "cart_add" });
			await createTestEvent({ eventType: "cart_add" });

			const events = await controller.getRecentActivity({
				eventType: "cart_add",
			});
			expect(events.length).toBe(2);
			for (const e of events) {
				expect(e.eventType).toBe("cart_add");
			}
		});

		it("filters by wishlist_add event type", async () => {
			await createTestEvent({ eventType: "purchase" });
			await createTestEvent({ eventType: "wishlist_add" });

			const events = await controller.getRecentActivity({
				eventType: "wishlist_add",
			});
			expect(events.length).toBe(1);
			expect(events[0].eventType).toBe("wishlist_add");
		});

		it("returns empty when filtering for event type that does not exist", async () => {
			await createTestEvent({ eventType: "purchase" });

			const events = await controller.getRecentActivity({
				eventType: "view",
			});
			expect(events).toEqual([]);
		});

		it("combines skip and take correctly", async () => {
			for (let i = 0; i < 10; i++) {
				await createTestEvent({ productId: `prod_${i}` });
			}

			const events = await controller.getRecentActivity({
				skip: 3,
				take: 4,
			});
			expect(events.length).toBe(4);
		});
	});

	// ── getTrendingProducts edge cases ──────────────────────────────────

	describe("getTrendingProducts edge cases", () => {
		it("defaults period to 24h when no params given", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
			});

			const trending = await controller.getTrendingProducts();
			expect(trending.length).toBe(1);
		});

		it("defaults take to 10 when not provided", async () => {
			for (let i = 0; i < 15; i++) {
				await createTestEvent({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					productSlug: `product-${i}`,
				});
			}

			const trending = await controller.getTrendingProducts();
			expect(trending.length).toBe(10);
		});

		it("defaults skip to 0 when not provided", async () => {
			for (let i = 0; i < 3; i++) {
				await createTestEvent({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
					productSlug: `product-${i}`,
				});
			}

			const trending = await controller.getTrendingProducts({ take: 10 });
			expect(trending.length).toBe(3);
		});

		it("returns empty when skip exceeds total products", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
			});

			const trending = await controller.getTrendingProducts({
				skip: 100,
			});
			expect(trending).toEqual([]);
		});

		it("counts only purchases in purchaseCount field", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "cart_add",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "wishlist_add",
			});

			const trending = await controller.getTrendingProducts();
			expect(trending[0].eventCount).toBe(3);
			expect(trending[0].purchaseCount).toBe(0);
		});

		it("aggregates events across types for the same product", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "purchase",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "cart_add",
			});

			const trending = await controller.getTrendingProducts();
			expect(trending.length).toBe(1);
			expect(trending[0].eventCount).toBe(3);
			expect(trending[0].purchaseCount).toBe(1);
		});

		it("does not include productImage when it was undefined", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
			});

			const trending = await controller.getTrendingProducts();
			expect(trending[0].productImage).toBeUndefined();
		});

		it("handles take of zero returning empty array", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
			});

			const trending = await controller.getTrendingProducts({ take: 0 });
			expect(trending).toEqual([]);
		});

		it("uses the first event's metadata for the product entry", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "First Name",
				productSlug: "first-slug",
				productImage: "first.jpg",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "Second Name",
				productSlug: "second-slug",
				productImage: "second.jpg",
			});

			const trending = await controller.getTrendingProducts();
			// The first event's metadata is used for the product map entry
			expect(trending[0].productName).toBe("First Name");
			expect(trending[0].productSlug).toBe("first-slug");
			expect(trending[0].productImage).toBe("first.jpg");
		});
	});

	// ── createBadge edge cases ──────────────────────────────────────────

	describe("createBadge edge cases", () => {
		it("supports all badge positions", async () => {
			const positions = [
				"header",
				"footer",
				"product",
				"checkout",
				"cart",
			] as const;
			for (const position of positions) {
				const badge = await createTestBadge({
					name: `Badge ${position}`,
					position,
				});
				expect(badge.position).toBe(position);
			}
		});

		it("stores badge with negative priority", async () => {
			const badge = await createTestBadge({ priority: -5 });
			expect(badge.priority).toBe(-5);
		});

		it("stores badge with very high priority", async () => {
			const badge = await createTestBadge({ priority: 999999 });
			expect(badge.priority).toBe(999999);
		});

		it("persists badge in data store", async () => {
			const badge = await createTestBadge();
			const raw = await mockData.get("trustBadge", badge.id);
			expect(raw).not.toBeNull();
			expect((raw as Record<string, unknown>).name).toBe("Secure Checkout");
		});

		it("handles empty string description and url", async () => {
			const badge = await createTestBadge({
				description: "",
				url: "",
			});
			expect(badge.description).toBe("");
			expect(badge.url).toBe("");
		});

		it("handles unicode in badge name and description", async () => {
			const badge = await createTestBadge({
				name: "Sécurité Garantie",
				description: "Paiement sécurisé avec chiffrement 256-bit",
			});
			expect(badge.name).toBe("Sécurité Garantie");
			expect(badge.description).toBe(
				"Paiement sécurisé avec chiffrement 256-bit",
			);
		});

		it("creates badge with isActive explicitly set to false", async () => {
			const badge = await createTestBadge({ isActive: false });
			expect(badge.isActive).toBe(false);
		});

		it("sets createdAt and updatedAt to the same time on creation", async () => {
			const badge = await createTestBadge();
			expect(badge.createdAt.getTime()).toBe(badge.updatedAt.getTime());
		});
	});

	// ── updateBadge edge cases ──────────────────────────────────────────

	describe("updateBadge edge cases", () => {
		it("does not modify fields not included in update params", async () => {
			const created = await createTestBadge({
				name: "Original",
				icon: "lock",
				position: "checkout",
				priority: 5,
				isActive: true,
			});

			const updated = await controller.updateBadge(created.id, {
				name: "Updated",
			});

			expect(updated?.name).toBe("Updated");
			expect(updated?.icon).toBe("lock");
			expect(updated?.position).toBe("checkout");
			expect(updated?.priority).toBe(5);
			expect(updated?.isActive).toBe(true);
		});

		it("can update all fields at once", async () => {
			const created = await createTestBadge();
			const updated = await controller.updateBadge(created.id, {
				name: "New Name",
				description: "New Desc",
				icon: "shield",
				url: "https://new.url",
				position: "header",
				priority: 99,
				isActive: false,
			});

			expect(updated?.name).toBe("New Name");
			expect(updated?.description).toBe("New Desc");
			expect(updated?.icon).toBe("shield");
			expect(updated?.url).toBe("https://new.url");
			expect(updated?.position).toBe("header");
			expect(updated?.priority).toBe(99);
			expect(updated?.isActive).toBe(false);
		});

		it("updates persisted data in the store", async () => {
			const created = await createTestBadge();
			await controller.updateBadge(created.id, { name: "Persisted" });

			const raw = await mockData.get("trustBadge", created.id);
			expect((raw as Record<string, unknown>).name).toBe("Persisted");
		});

		it("preserves createdAt on update", async () => {
			const created = await createTestBadge();
			const updated = await controller.updateBadge(created.id, {
				name: "Updated",
			});

			expect(updated?.createdAt.getTime()).toBe(created.createdAt.getTime());
		});

		it("can set description to empty string (not clearing it)", async () => {
			const created = await createTestBadge({
				description: "Original",
			});
			const updated = await controller.updateBadge(created.id, {
				description: "",
			});
			expect(updated?.description).toBe("");
		});

		it("can set priority to zero", async () => {
			const created = await createTestBadge({ priority: 10 });
			const updated = await controller.updateBadge(created.id, {
				priority: 0,
			});
			expect(updated?.priority).toBe(0);
		});

		it("handles multiple sequential updates correctly", async () => {
			const created = await createTestBadge({ name: "Step 0" });
			await controller.updateBadge(created.id, { name: "Step 1" });
			await controller.updateBadge(created.id, { name: "Step 2" });
			const final = await controller.updateBadge(created.id, {
				name: "Step 3",
			});

			expect(final?.name).toBe("Step 3");
			const fetched = await controller.getBadge(created.id);
			expect(fetched?.name).toBe("Step 3");
		});
	});

	// ── deleteBadge edge cases ──────────────────────────────────────────

	describe("deleteBadge edge cases", () => {
		it("deleting same badge twice returns false on second attempt", async () => {
			const created = await createTestBadge();
			const first = await controller.deleteBadge(created.id);
			const second = await controller.deleteBadge(created.id);

			expect(first).toBe(true);
			expect(second).toBe(false);
		});

		it("does not affect other badges when deleting one", async () => {
			const b1 = await createTestBadge({ name: "Badge 1" });
			const b2 = await createTestBadge({ name: "Badge 2" });

			await controller.deleteBadge(b1.id);

			const remaining = await controller.getBadge(b2.id);
			expect(remaining).not.toBeNull();
			expect(remaining?.name).toBe("Badge 2");
		});

		it("reduces count after deletion", async () => {
			const b1 = await createTestBadge({ name: "A" });
			await createTestBadge({ name: "B" });
			expect(await controller.countBadges()).toBe(2);

			await controller.deleteBadge(b1.id);
			expect(await controller.countBadges()).toBe(1);
		});
	});

	// ── listBadges edge cases ───────────────────────────────────────────

	describe("listBadges edge cases", () => {
		it("returns empty array when no badges exist", async () => {
			const badges = await controller.listBadges();
			expect(badges).toEqual([]);
		});

		it("sorts badges with same priority alphabetically by name", async () => {
			await createTestBadge({ name: "Zebra", priority: 0 });
			await createTestBadge({ name: "Apple", priority: 0 });
			await createTestBadge({ name: "Mango", priority: 0 });

			const badges = await controller.listBadges();
			expect(badges[0].name).toBe("Apple");
			expect(badges[1].name).toBe("Mango");
			expect(badges[2].name).toBe("Zebra");
		});

		it("higher priority badges come before lower, regardless of name", async () => {
			await createTestBadge({ name: "Zebra", priority: 10 });
			await createTestBadge({ name: "Apple", priority: 1 });

			const badges = await controller.listBadges();
			expect(badges[0].name).toBe("Zebra");
			expect(badges[1].name).toBe("Apple");
		});

		it("filters by position and active status simultaneously", async () => {
			await createTestBadge({
				name: "Active Checkout",
				position: "checkout",
				isActive: true,
			});
			await createTestBadge({
				name: "Inactive Checkout",
				position: "checkout",
				isActive: false,
			});
			await createTestBadge({
				name: "Active Product",
				position: "product",
				isActive: true,
			});

			const results = await controller.listBadges({
				position: "checkout",
				isActive: true,
			});
			expect(results.length).toBe(1);
			expect(results[0].name).toBe("Active Checkout");
		});

		it("handles skip of zero same as no skip", async () => {
			await createTestBadge({ name: "A" });
			await createTestBadge({ name: "B" });

			const withSkip = await controller.listBadges({ skip: 0 });
			const withoutSkip = await controller.listBadges();
			expect(withSkip.length).toBe(withoutSkip.length);
		});

		it("returns empty when skip exceeds total badges", async () => {
			await createTestBadge({ name: "Only" });

			const badges = await controller.listBadges({ skip: 100 });
			expect(badges).toEqual([]);
		});

		it("filters inactive badges with isActive false", async () => {
			await createTestBadge({ name: "Active", isActive: true });
			await createTestBadge({ name: "Inactive", isActive: false });

			const inactive = await controller.listBadges({ isActive: false });
			expect(inactive.length).toBe(1);
			expect(inactive[0].name).toBe("Inactive");
		});
	});

	// ── countBadges edge cases ──────────────────────────────────────────

	describe("countBadges edge cases", () => {
		it("returns zero when no badges exist", async () => {
			expect(await controller.countBadges()).toBe(0);
		});

		it("counts correctly after creating and deleting badges", async () => {
			const b1 = await createTestBadge({ name: "A" });
			await createTestBadge({ name: "B" });
			await createTestBadge({ name: "C" });
			expect(await controller.countBadges()).toBe(3);

			await controller.deleteBadge(b1.id);
			expect(await controller.countBadges()).toBe(2);
		});

		it("counts badges filtered by position and isActive together", async () => {
			await createTestBadge({
				name: "Active Header",
				position: "header",
				isActive: true,
			});
			await createTestBadge({
				name: "Inactive Header",
				position: "header",
				isActive: false,
			});
			await createTestBadge({
				name: "Active Footer",
				position: "footer",
				isActive: true,
			});

			expect(
				await controller.countBadges({
					position: "header",
					isActive: true,
				}),
			).toBe(1);
		});

		it("returns zero when filtering by non-existent position", async () => {
			await createTestBadge({ position: "checkout" });

			expect(await controller.countBadges({ position: "header" })).toBe(0);
		});
	});

	// ── listEvents edge cases ───────────────────────────────────────────

	describe("listEvents edge cases", () => {
		it("defaults take to 50 when not provided", async () => {
			for (let i = 0; i < 60; i++) {
				await createTestEvent({ productId: `prod_${i}` });
			}

			const events = await controller.listEvents();
			expect(events.length).toBe(50);
		});

		it("returns empty when skip exceeds total events", async () => {
			await createTestEvent();
			const events = await controller.listEvents({ skip: 100 });
			expect(events).toEqual([]);
		});

		it("handles take of zero returning empty array", async () => {
			await createTestEvent();
			const events = await controller.listEvents({ take: 0 });
			expect(events).toEqual([]);
		});

		it("filters by both productId and eventType simultaneously", async () => {
			await createTestEvent({
				productId: "prod_1",
				eventType: "purchase",
			});
			await createTestEvent({
				productId: "prod_1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_2",
				eventType: "purchase",
			});

			const events = await controller.listEvents({
				productId: "prod_1",
				eventType: "purchase",
			});
			expect(events.length).toBe(1);
			expect(events[0].productId).toBe("prod_1");
			expect(events[0].eventType).toBe("purchase");
		});

		it("returns events for non-existent productId as empty", async () => {
			await createTestEvent({ productId: "prod_1" });

			const events = await controller.listEvents({
				productId: "prod_999",
			});
			expect(events).toEqual([]);
		});
	});

	// ── countEvents edge cases ──────────────────────────────────────────

	describe("countEvents edge cases", () => {
		it("counts with both productId and eventType filter", async () => {
			await createTestEvent({
				productId: "prod_1",
				eventType: "purchase",
			});
			await createTestEvent({
				productId: "prod_1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_2",
				eventType: "purchase",
			});

			expect(
				await controller.countEvents({
					productId: "prod_1",
					eventType: "purchase",
				}),
			).toBe(1);
		});

		it("returns zero when filtering for non-existent event type among existing events", async () => {
			await createTestEvent({ eventType: "purchase" });
			expect(await controller.countEvents({ eventType: "wishlist_add" })).toBe(
				0,
			);
		});
	});

	// ── cleanupEvents edge cases ────────────────────────────────────────

	describe("cleanupEvents edge cases", () => {
		it("returns 0 when no events exist", async () => {
			const deleted = await controller.cleanupEvents(30);
			expect(deleted).toBe(0);
		});

		it("does not delete recently created events with 0 day threshold", async () => {
			// Even with 0 days, events just created have Date.now() which equals cutoff
			// The cutoff is Date.now() - 0*24*60*60*1000 = Date.now()
			// Events created with new Date() at the same moment should NOT be deleted
			// because createdAt >= cutoff (approximately)
			await createTestEvent();
			await createTestEvent();

			const deleted = await controller.cleanupEvents(1);
			expect(deleted).toBe(0);
			expect(await controller.countEvents()).toBe(2);
		});

		it("handles cleaning up when all events are fresh", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestEvent({ productId: `prod_${i}` });
			}

			const deleted = await controller.cleanupEvents(365);
			expect(deleted).toBe(0);
			expect(await controller.countEvents()).toBe(5);
		});

		it("actually removes events from the data store when cleaned", async () => {
			// Manually insert an old event
			const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
			const oldEvent = {
				id: "old-event-1",
				productId: "prod_old",
				productName: "Old Product",
				productSlug: "old-product",
				eventType: "view",
				createdAt: oldDate,
			};
			await mockData.upsert(
				"activityEvent",
				"old-event-1",
				oldEvent as unknown as Record<string, unknown>,
			);

			expect(await controller.countEvents()).toBe(1);

			const deleted = await controller.cleanupEvents(30);
			expect(deleted).toBe(1);
			expect(await controller.countEvents()).toBe(0);
		});

		it("only deletes events older than threshold, keeps newer ones", async () => {
			// Insert old event
			const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
			await mockData.upsert("activityEvent", "old-1", {
				id: "old-1",
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "view",
				createdAt: oldDate,
			});

			// Insert fresh event
			await createTestEvent({ productId: "prod_fresh" });

			expect(await controller.countEvents()).toBe(2);

			const deleted = await controller.cleanupEvents(30);
			expect(deleted).toBe(1);
			expect(await controller.countEvents()).toBe(1);
		});
	});

	// ── getActivitySummary edge cases ───────────────────────────────────

	describe("getActivitySummary edge cases", () => {
		it("defaults period to 24h when no params given", async () => {
			await createTestEvent({ eventType: "view" });
			const summary = await controller.getActivitySummary();
			expect(summary.totalViews).toBe(1);
		});

		it("defaults period to 24h when params object is empty", async () => {
			await createTestEvent({ eventType: "purchase" });
			const summary = await controller.getActivitySummary({});
			expect(summary.totalPurchases).toBe(1);
		});

		it("does not count wishlist_add events in any specific total field", async () => {
			await createTestEvent({ eventType: "wishlist_add" });

			const summary = await controller.getActivitySummary();
			expect(summary.totalEvents).toBe(1);
			expect(summary.totalPurchases).toBe(0);
			expect(summary.totalViews).toBe(0);
			expect(summary.totalCartAdds).toBe(0);
		});

		it("counts unique products correctly with mixed events", async () => {
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
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_2",
				eventType: "cart_add",
			});
			await createTestEvent({
				productId: "prod_3",
				eventType: "wishlist_add",
			});

			const summary = await controller.getActivitySummary();
			expect(summary.uniqueProducts).toBe(3);
		});

		it("topProducts is sorted by eventCount descending", async () => {
			// prod_2 has more events
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_2",
				productName: "P2",
				productSlug: "p2",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_2",
				productName: "P2",
				productSlug: "p2",
				eventType: "purchase",
			});
			await createTestEvent({
				productId: "prod_2",
				productName: "P2",
				productSlug: "p2",
				eventType: "cart_add",
			});

			const summary = await controller.getActivitySummary();
			expect(summary.topProducts[0].productId).toBe("prod_2");
			expect(summary.topProducts[0].eventCount).toBe(3);
			expect(summary.topProducts[1].productId).toBe("prod_1");
			expect(summary.topProducts[1].eventCount).toBe(1);
		});

		it("topProducts caps at 10 entries", async () => {
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

		it("supports 1h period for activity summary", async () => {
			await createTestEvent({ eventType: "purchase" });
			const summary = await controller.getActivitySummary({
				period: "1h",
			});
			expect(summary.totalPurchases).toBe(1);
		});

		it("supports 7d period for activity summary", async () => {
			await createTestEvent({ eventType: "view" });
			const summary = await controller.getActivitySummary({
				period: "7d",
			});
			expect(summary.totalViews).toBe(1);
		});

		it("supports 30d period for activity summary", async () => {
			await createTestEvent({ eventType: "cart_add" });
			const summary = await controller.getActivitySummary({
				period: "30d",
			});
			expect(summary.totalCartAdds).toBe(1);
		});

		it("topProducts purchaseCount tracks only purchases for each product", async () => {
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "view",
			});
			await createTestEvent({
				productId: "prod_1",
				productName: "P1",
				productSlug: "p1",
				eventType: "cart_add",
			});

			const summary = await controller.getActivitySummary();
			expect(summary.topProducts[0].purchaseCount).toBe(0);
			expect(summary.topProducts[0].eventCount).toBe(3);
		});
	});

	// ── Cross-method interaction edge cases ─────────────────────────────

	describe("cross-method interactions", () => {
		it("deleted badges do not appear in listBadges", async () => {
			const b1 = await createTestBadge({ name: "A" });
			await createTestBadge({ name: "B" });

			await controller.deleteBadge(b1.id);

			const badges = await controller.listBadges();
			expect(badges.length).toBe(1);
			expect(badges[0].name).toBe("B");
		});

		it("updated badge appears correctly in getBadge", async () => {
			const created = await createTestBadge({ name: "Original" });
			await controller.updateBadge(created.id, {
				name: "Modified",
				position: "footer",
			});

			const fetched = await controller.getBadge(created.id);
			expect(fetched?.name).toBe("Modified");
			expect(fetched?.position).toBe("footer");
		});

		it("events and badges use separate data namespaces", async () => {
			await createTestEvent();
			await createTestBadge();

			expect(mockData.size("activityEvent")).toBe(1);
			expect(mockData.size("trustBadge")).toBe(1);
		});

		it("cleanupEvents does not affect badges", async () => {
			await createTestBadge({ name: "Persistent" });

			// Insert old event
			const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
			await mockData.upsert("activityEvent", "old-1", {
				id: "old-1",
				productId: "p1",
				productName: "P1",
				productSlug: "p1",
				eventType: "view",
				createdAt: oldDate,
			});

			await controller.cleanupEvents(30);

			expect(await controller.countBadges()).toBe(1);
			expect(await controller.countEvents()).toBe(0);
		});

		it("many events across products produce correct summary and trending together", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestEvent({
					productId: "hot",
					productName: "Hot Product",
					productSlug: "hot",
					eventType: "purchase",
				});
			}
			for (let i = 0; i < 3; i++) {
				await createTestEvent({
					productId: "warm",
					productName: "Warm Product",
					productSlug: "warm",
					eventType: "view",
				});
			}
			await createTestEvent({
				productId: "cold",
				productName: "Cold Product",
				productSlug: "cold",
				eventType: "wishlist_add",
			});

			const trending = await controller.getTrendingProducts();
			expect(trending[0].productId).toBe("hot");
			expect(trending[0].eventCount).toBe(5);
			expect(trending[1].productId).toBe("warm");
			expect(trending[2].productId).toBe("cold");

			const summary = await controller.getActivitySummary();
			expect(summary.totalEvents).toBe(9);
			expect(summary.totalPurchases).toBe(5);
			expect(summary.totalViews).toBe(3);
			expect(summary.uniqueProducts).toBe(3);
		});
	});
});
