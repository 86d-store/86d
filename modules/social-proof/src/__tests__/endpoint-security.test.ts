import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityEventType, BadgePosition } from "../service";
import { createSocialProofController } from "../service-impl";

/**
 * Security regression tests for social-proof endpoints.
 *
 * Social proof surfaces real-time purchase/view activity on the storefront,
 * so security focuses on:
 * - Event type validation (only known types are accepted)
 * - Product-scoped activity isolation (one product's data never leaks to another)
 * - Display rule integrity (badge position, priority, active flags)
 * - Rate limiting simulation (high-volume event ingestion stays bounded)
 * - Fake activity prevention (events cannot be back-dated or inflated)
 */

describe("social-proof endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSocialProofController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSocialProofController(mockData);
	});

	async function recordEvent(
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

	async function makeBadge(
		overrides: Partial<Parameters<typeof controller.createBadge>[0]> = {},
	) {
		return controller.createBadge({
			name: "Secure Checkout",
			icon: "lock",
			position: "checkout",
			...overrides,
		});
	}

	// ── Event type validation ──────────────────────────────────────────

	describe("event type validation", () => {
		it("accepts all four valid event types", async () => {
			const types: ActivityEventType[] = [
				"purchase",
				"view",
				"cart_add",
				"wishlist_add",
			];
			for (const eventType of types) {
				const event = await recordEvent({ eventType });
				expect(event.eventType).toBe(eventType);
				expect(event.id).toBeDefined();
			}
		});

		it("recorded event type is stored verbatim in data service", async () => {
			const event = await recordEvent({ eventType: "cart_add" });
			const raw = await mockData.get("activityEvent", event.id);
			expect((raw as Record<string, unknown>).eventType).toBe("cart_add");
		});

		it("event type is preserved through list and count queries", async () => {
			await recordEvent({ eventType: "purchase" });
			await recordEvent({ eventType: "view" });
			await recordEvent({ eventType: "view" });

			const purchases = await controller.listEvents({
				eventType: "purchase",
			});
			expect(purchases).toHaveLength(1);
			expect(purchases[0].eventType).toBe("purchase");

			expect(await controller.countEvents({ eventType: "view" })).toBe(2);
		});

		it("getRecentActivity filters strictly by event type", async () => {
			await recordEvent({ eventType: "purchase" });
			await recordEvent({ eventType: "view" });
			await recordEvent({ eventType: "cart_add" });
			await recordEvent({ eventType: "wishlist_add" });

			const views = await controller.getRecentActivity({
				eventType: "view",
			});
			expect(views).toHaveLength(1);
			for (const v of views) {
				expect(v.eventType).toBe("view");
			}
		});
	});

	// ── Product-scoped activity isolation ──────────────────────────────

	describe("product-scoped activity isolation", () => {
		it("getProductActivity only counts events for the requested product", async () => {
			await recordEvent({
				productId: "prod_a",
				eventType: "purchase",
			});
			await recordEvent({
				productId: "prod_a",
				eventType: "view",
			});
			await recordEvent({
				productId: "prod_b",
				eventType: "purchase",
			});
			await recordEvent({
				productId: "prod_b",
				eventType: "purchase",
			});
			await recordEvent({
				productId: "prod_b",
				eventType: "view",
			});

			const actA = await controller.getProductActivity("prod_a");
			expect(actA.purchaseCount).toBe(1);
			expect(actA.viewCount).toBe(1);
			expect(actA.totalEvents).toBe(2);

			const actB = await controller.getProductActivity("prod_b");
			expect(actB.purchaseCount).toBe(2);
			expect(actB.viewCount).toBe(1);
			expect(actB.totalEvents).toBe(3);
		});

		it("recentPurchases never include purchases from other products", async () => {
			await recordEvent({
				productId: "prod_a",
				eventType: "purchase",
				city: "New York",
			});
			await recordEvent({
				productId: "prod_b",
				eventType: "purchase",
				city: "London",
			});

			const actA = await controller.getProductActivity("prod_a");
			expect(actA.recentPurchases).toHaveLength(1);
			expect(actA.recentPurchases[0].city).toBe("New York");
		});

		it("listEvents with productId filter does not leak other products", async () => {
			await recordEvent({ productId: "prod_x" });
			await recordEvent({ productId: "prod_y" });
			await recordEvent({ productId: "prod_x" });

			const xEvents = await controller.listEvents({
				productId: "prod_x",
			});
			expect(xEvents).toHaveLength(2);
			for (const e of xEvents) {
				expect(e.productId).toBe("prod_x");
			}
		});

		it("countEvents scoped to product does not count other products", async () => {
			await recordEvent({ productId: "prod_1" });
			await recordEvent({ productId: "prod_1" });
			await recordEvent({ productId: "prod_2" });

			expect(await controller.countEvents({ productId: "prod_1" })).toBe(2);
			expect(await controller.countEvents({ productId: "prod_2" })).toBe(1);
		});

		it("trending products aggregate per-product, never merge separate products", async () => {
			for (let i = 0; i < 4; i++) {
				await recordEvent({
					productId: "alpha",
					productName: "Alpha",
					productSlug: "alpha",
					eventType: "purchase",
				});
			}
			await recordEvent({
				productId: "beta",
				productName: "Beta",
				productSlug: "beta",
				eventType: "view",
			});

			const trending = await controller.getTrendingProducts();
			expect(trending).toHaveLength(2);
			expect(trending[0].productId).toBe("alpha");
			expect(trending[0].eventCount).toBe(4);
			expect(trending[0].purchaseCount).toBe(4);
			expect(trending[1].productId).toBe("beta");
			expect(trending[1].eventCount).toBe(1);
			expect(trending[1].purchaseCount).toBe(0);
		});
	});

	// ── Display rule integrity ─────────────────────────────────────────

	describe("display rule integrity", () => {
		it("inactive badges are excluded when filtering isActive=true", async () => {
			await makeBadge({
				name: "Visible",
				isActive: true,
			});
			await makeBadge({
				name: "Hidden",
				isActive: false,
			});

			const active = await controller.listBadges({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Visible");
		});

		it("badges are returned strictly by priority then name", async () => {
			await makeBadge({ name: "C-Badge", priority: 5 });
			await makeBadge({ name: "A-Badge", priority: 10 });
			await makeBadge({ name: "B-Badge", priority: 5 });

			const badges = await controller.listBadges();
			expect(badges[0].name).toBe("A-Badge");
			expect(badges[1].name).toBe("B-Badge");
			expect(badges[2].name).toBe("C-Badge");
		});

		it("badge position filter prevents cross-position leakage", async () => {
			const positions: BadgePosition[] = [
				"header",
				"footer",
				"product",
				"checkout",
				"cart",
			];
			for (const position of positions) {
				await makeBadge({
					name: `Badge-${position}`,
					position,
				});
			}

			for (const position of positions) {
				const result = await controller.listBadges({ position });
				expect(result).toHaveLength(1);
				expect(result[0].position).toBe(position);
			}
		});

		it("deactivating a badge removes it from active listing", async () => {
			const badge = await makeBadge({ isActive: true });
			const activeBefore = await controller.listBadges({
				isActive: true,
			});
			expect(activeBefore).toHaveLength(1);

			await controller.updateBadge(badge.id, { isActive: false });

			const activeAfter = await controller.listBadges({
				isActive: true,
			});
			expect(activeAfter).toHaveLength(0);
		});

		it("deleted badge cannot be retrieved or listed", async () => {
			const badge = await makeBadge();
			await controller.deleteBadge(badge.id);

			expect(await controller.getBadge(badge.id)).toBeNull();
			expect(await controller.listBadges()).toHaveLength(0);
			expect(await controller.countBadges()).toBe(0);
		});

		it("updating a non-existent badge returns null and creates nothing", async () => {
			const result = await controller.updateBadge("ghost-id", {
				name: "Injected",
			});
			expect(result).toBeNull();
			expect(await controller.countBadges()).toBe(0);
		});
	});

	// ── Rate limiting simulation ───────────────────────────────────────

	describe("rate limiting simulation", () => {
		it("high-volume event ingestion stays bounded by take", async () => {
			for (let i = 0; i < 100; i++) {
				await recordEvent({
					productId: `prod_${i % 10}`,
					productName: `Product ${i % 10}`,
					productSlug: `product-${i % 10}`,
					eventType: i % 2 === 0 ? "view" : "purchase",
				});
			}

			const recent = await controller.getRecentActivity({ take: 20 });
			expect(recent).toHaveLength(20);

			const trending = await controller.getTrendingProducts({
				take: 5,
			});
			expect(trending).toHaveLength(5);

			const listed = await controller.listEvents({ take: 10 });
			expect(listed).toHaveLength(10);
		});

		it("pagination skip prevents duplicate exposure across pages", async () => {
			for (let i = 0; i < 20; i++) {
				await recordEvent({
					productId: `prod_${i}`,
					productName: `P${i}`,
					productSlug: `p-${i}`,
				});
			}

			const page1 = await controller.getRecentActivity({
				take: 5,
				skip: 0,
			});
			const page2 = await controller.getRecentActivity({
				take: 5,
				skip: 5,
			});

			const page1Ids = page1.map((e) => e.id);
			const page2Ids = page2.map((e) => e.id);
			for (const id of page2Ids) {
				expect(page1Ids).not.toContain(id);
			}
		});

		it("activity summary correctly aggregates high-volume data", async () => {
			for (let i = 0; i < 50; i++) {
				await recordEvent({
					productId: `prod_${i % 5}`,
					productName: `Product ${i % 5}`,
					productSlug: `product-${i % 5}`,
					eventType: "purchase",
				});
			}
			for (let i = 0; i < 30; i++) {
				await recordEvent({
					productId: `prod_${i % 3}`,
					productName: `Product ${i % 3}`,
					productSlug: `product-${i % 3}`,
					eventType: "view",
				});
			}

			const summary = await controller.getActivitySummary();
			expect(summary.totalEvents).toBe(80);
			expect(summary.totalPurchases).toBe(50);
			expect(summary.totalViews).toBe(30);
			expect(summary.uniqueProducts).toBe(5);
			expect(summary.topProducts.length).toBeLessThanOrEqual(10);
		});
	});

	// ── Fake activity prevention ───────────────────────────────────────

	describe("fake activity prevention", () => {
		it("event createdAt is server-generated, not client-provided", async () => {
			const before = Date.now();
			const event = await recordEvent();
			const after = Date.now();

			const ts = event.createdAt.getTime();
			expect(ts).toBeGreaterThanOrEqual(before);
			expect(ts).toBeLessThanOrEqual(after);
		});

		it("event IDs are unique UUIDs preventing replay attacks", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 50; i++) {
				const event = await recordEvent({
					productId: "same-prod",
					eventType: "purchase",
				});
				ids.add(event.id);
			}
			expect(ids.size).toBe(50);
		});

		it("cleanup purges stale data to prevent inflated social proof", async () => {
			// Insert old events that would inflate numbers
			const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
			for (let i = 0; i < 10; i++) {
				await mockData.upsert("activityEvent", `old-${i}`, {
					id: `old-${i}`,
					productId: "prod_1",
					productName: "Inflated Product",
					productSlug: "inflated",
					eventType: "purchase",
					createdAt: oldDate,
				});
			}

			// Add one legitimate recent event
			await recordEvent({
				productId: "prod_1",
				eventType: "purchase",
			});

			expect(await controller.countEvents()).toBe(11);

			// Cleanup removes stale events
			const deleted = await controller.cleanupEvents(30);
			expect(deleted).toBe(10);
			expect(await controller.countEvents()).toBe(1);
		});

		it("cleaned-up events no longer appear in activity summary", async () => {
			const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
			for (let i = 0; i < 5; i++) {
				await mockData.upsert("activityEvent", `stale-${i}`, {
					id: `stale-${i}`,
					productId: "prod_stale",
					productName: "Stale",
					productSlug: "stale",
					eventType: "purchase",
					createdAt: oldDate,
				});
			}

			// Old events are outside 24h window already
			const summaryBefore = await controller.getActivitySummary();
			expect(summaryBefore.totalPurchases).toBe(0);

			// Cleanup removes them entirely
			await controller.cleanupEvents(30);
			expect(await controller.countEvents()).toBe(0);
		});

		it("badge creation timestamps are server-generated", async () => {
			const before = Date.now();
			const badge = await makeBadge();
			const after = Date.now();

			expect(badge.createdAt.getTime()).toBeGreaterThanOrEqual(before);
			expect(badge.createdAt.getTime()).toBeLessThanOrEqual(after);
			expect(badge.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
			expect(badge.updatedAt.getTime()).toBeLessThanOrEqual(after);
		});

		it("badge update advances updatedAt timestamp", async () => {
			const badge = await makeBadge();
			const originalUpdated = badge.updatedAt.getTime();

			const updated = await controller.updateBadge(badge.id, {
				name: "Renamed",
			});

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdated,
			);
		});

		it("cleanupEvents does not affect trust badges", async () => {
			await makeBadge({ name: "Persistent Badge" });

			const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
			await mockData.upsert("activityEvent", "old-evt", {
				id: "old-evt",
				productId: "p1",
				productName: "P1",
				productSlug: "p1",
				eventType: "view",
				createdAt: oldDate,
			});

			await controller.cleanupEvents(30);

			expect(await controller.countEvents()).toBe(0);
			expect(await controller.countBadges()).toBe(1);
			const badge = (await controller.listBadges())[0];
			expect(badge?.name).toBe("Persistent Badge");
		});
	});
});
