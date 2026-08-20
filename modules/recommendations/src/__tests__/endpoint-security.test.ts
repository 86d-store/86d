import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRecommendationController } from "../service-impl";

/**
 * Security tests for recommendations module endpoints.
 *
 * These tests verify:
 * - Manual rules: inactive rules are excluded from getForProduct results
 * - Co-occurrence canonical ordering: (A,B) and (B,A) resolve to the same pair
 * - Personalization: only recommends products the customer hasn't interacted with
 * - Purchase recording: generates pairs for all product combinations
 * - Deletion safety: deleting a non-existent rule returns false
 * - Interaction tracking: stores data correctly and requires a customer or session ID
 */

describe("recommendations endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createRecommendationController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createRecommendationController(mockData);
	});

	// ── Manual Rules ────────────────────────────────────────────────

	describe("manual rules", () => {
		it("inactive rules are excluded from getForProduct", async () => {
			const sourceId = "prod-source";
			const targetId = "prod-target";

			await controller.createRule({
				name: "Inactive Rule",
				strategy: "manual",
				sourceProductId: sourceId,
				targetProductIds: [targetId],
				isActive: false,
			});

			const results = await controller.getForProduct(sourceId, {
				strategy: "manual",
			});

			expect(results.find((r) => r.productId === targetId)).toBeUndefined();
		});

		it("active rules appear in getForProduct results", async () => {
			const sourceId = "prod-source";
			const targetId = "prod-target";

			await controller.createRule({
				name: "Active Rule",
				strategy: "manual",
				sourceProductId: sourceId,
				targetProductIds: [targetId],
				isActive: true,
			});

			const results = await controller.getForProduct(sourceId, {
				strategy: "manual",
			});

			expect(results.find((r) => r.productId === targetId)).toBeDefined();
		});

		it("deactivating a rule removes it from getForProduct", async () => {
			const sourceId = "prod-source";
			const targetId = "prod-target";

			const rule = await controller.createRule({
				name: "Rule to Deactivate",
				strategy: "manual",
				sourceProductId: sourceId,
				targetProductIds: [targetId],
				isActive: true,
			});

			// Confirm it's visible first
			const before = await controller.getForProduct(sourceId, {
				strategy: "manual",
			});
			expect(before.find((r) => r.productId === targetId)).toBeDefined();

			// Deactivate
			await controller.updateRule(rule.id, { isActive: false });

			const after = await controller.getForProduct(sourceId, {
				strategy: "manual",
			});
			expect(after.find((r) => r.productId === targetId)).toBeUndefined();
		});

		it("listRules filter by isActive works correctly", async () => {
			await controller.createRule({
				name: "Active",
				strategy: "manual",
				targetProductIds: ["prod-1"],
				isActive: true,
			});
			await controller.createRule({
				name: "Inactive",
				strategy: "manual",
				targetProductIds: ["prod-2"],
				isActive: false,
			});

			const activeRules = await controller.listRules({ isActive: true });
			const inactiveRules = await controller.listRules({ isActive: false });

			expect(activeRules.every((r) => r.isActive)).toBe(true);
			expect(inactiveRules.every((r) => !r.isActive)).toBe(true);
		});
	});

	// ── Co-occurrence Canonical Ordering ────────────────────────────

	describe("co-occurrence canonical ordering", () => {
		it("(A,B) and (B,A) produce the same co-occurrence pair", async () => {
			const prodA = "aaa-product";
			const prodB = "bbb-product";

			// Record purchase with A before B
			await controller.recordPurchase([prodA, prodB]);

			// Record purchase with B before A
			await controller.recordPurchase([prodB, prodA]);

			// Both sides should reflect a count of 2 on the same underlying record
			const forA = await controller.getCoOccurrences(prodA);
			const forB = await controller.getCoOccurrences(prodB);

			expect(forA).toHaveLength(1);
			expect(forB).toHaveLength(1);
			expect(forA[0].count).toBe(2);
			expect(forB[0].count).toBe(2);
		});

		it("co-occurrences are retrievable from either product's perspective", async () => {
			const prodA = "aaa-prod";
			const prodB = "bbb-prod";

			await controller.recordPurchase([prodA, prodB]);

			const fromA = await controller.getCoOccurrences(prodA);
			const fromB = await controller.getCoOccurrences(prodB);

			expect(fromA).toHaveLength(1);
			expect(fromB).toHaveLength(1);
			// Both point to the same products
			const pairA = fromA[0];
			expect([pairA.productId1, pairA.productId2]).toContain(prodA);
			expect([pairA.productId1, pairA.productId2]).toContain(prodB);
		});

		it("single-product purchase records no pairs", async () => {
			const count = await controller.recordPurchase(["only-product"]);
			expect(count).toBe(0);
		});
	});

	// ── Purchase Pair Generation ─────────────────────────────────────

	describe("recordPurchase pair generation", () => {
		it("three products generate three pairs", async () => {
			const pairs = await controller.recordPurchase([
				"prod-a",
				"prod-b",
				"prod-c",
			]);
			expect(pairs).toBe(3);
		});

		it("four products generate six pairs", async () => {
			const pairs = await controller.recordPurchase([
				"prod-1",
				"prod-2",
				"prod-3",
				"prod-4",
			]);
			expect(pairs).toBe(6);
		});

		it("repeated purchases increment co-occurrence count", async () => {
			await controller.recordPurchase(["prod-x", "prod-y"]);
			await controller.recordPurchase(["prod-x", "prod-y"]);
			await controller.recordPurchase(["prod-x", "prod-y"]);

			const entries = await controller.getCoOccurrences("prod-x");
			expect(entries).toHaveLength(1);
			expect(entries[0].count).toBe(3);
		});
	});

	// ── Deletion Safety ──────────────────────────────────────────────

	describe("deletion safety", () => {
		it("deleting a non-existent rule returns false", async () => {
			const result = await controller.deleteRule("nonexistent-id");
			expect(result).toBe(false);
		});

		it("deleting an existing rule returns true", async () => {
			const rule = await controller.createRule({
				name: "To Delete",
				strategy: "manual",
				targetProductIds: ["prod-1"],
			});

			const result = await controller.deleteRule(rule.id);
			expect(result).toBe(true);
		});

		it("deleted rule is no longer retrievable", async () => {
			const rule = await controller.createRule({
				name: "Temporary",
				strategy: "manual",
				targetProductIds: ["prod-1"],
			});

			await controller.deleteRule(rule.id);

			const found = await controller.getRule(rule.id);
			expect(found).toBeNull();
		});

		it("getRule returns null for non-existent ID", async () => {
			const result = await controller.getRule("does-not-exist");
			expect(result).toBeNull();
		});

		it("updateRule returns null for non-existent ID", async () => {
			const result = await controller.updateRule("does-not-exist", {
				name: "Updated",
			});
			expect(result).toBeNull();
		});
	});

	// ── Interaction Tracking ─────────────────────────────────────────

	describe("interaction tracking", () => {
		it("stores interaction data correctly with customerId", async () => {
			const interaction = await controller.trackInteraction({
				productId: "prod-1",
				customerId: "cust-1",
				type: "view",
				productName: "Widget",
				productSlug: "widget",
				productPrice: 1999,
				productCategory: "Gadgets",
			});

			expect(interaction.productId).toBe("prod-1");
			expect(interaction.customerId).toBe("cust-1");
			expect(interaction.type).toBe("view");
			expect(interaction.productName).toBe("Widget");
			expect(interaction.productSlug).toBe("widget");
			expect(interaction.productPrice).toBe(1999);
			expect(interaction.productCategory).toBe("Gadgets");
			expect(interaction.id).toBeDefined();
			expect(interaction.createdAt).toBeInstanceOf(Date);
		});

		it("stores interaction with sessionId when no customerId provided", async () => {
			const interaction = await controller.trackInteraction({
				productId: "prod-2",
				sessionId: "sess-abc",
				type: "add_to_cart",
				productName: "Gadget",
				productSlug: "gadget",
			});

			expect(interaction.sessionId).toBe("sess-abc");
			expect(interaction.customerId).toBeUndefined();
		});

		it("throws if neither customerId nor sessionId is provided", async () => {
			await expect(
				controller.trackInteraction({
					productId: "prod-3",
					type: "view",
					productName: "Thing",
					productSlug: "thing",
				}),
			).rejects.toThrow("Either customerId or sessionId is required");
		});

		it("multiple interactions for same product are all stored", async () => {
			await controller.trackInteraction({
				productId: "popular-prod",
				sessionId: "sess-1",
				type: "view",
				productName: "Popular",
				productSlug: "popular",
			});
			await controller.trackInteraction({
				productId: "popular-prod",
				sessionId: "sess-2",
				type: "view",
				productName: "Popular",
				productSlug: "popular",
			});

			const stats = await controller.getStats();
			expect(stats.totalInteractions).toBe(2);
		});
	});

	// ── Click Recording (Impression Boundary) ───────────────────────

	describe("click recording", () => {
		it("rejects a click for a productId not in the served impression", async () => {
			const impression = await controller.recordImpression({
				surface: "trending",
				productIds: ["prod-a", "prod-b"],
				strategies: ["trending"],
			});

			const click = await controller.recordClick({
				impressionId: impression.id,
				productId: "prod-not-served",
				position: 0,
			});

			expect(click).toBeNull();
		});

		it("accepts a click for any productId that was in the impression", async () => {
			const impression = await controller.recordImpression({
				surface: "for_product",
				productIds: ["prod-x", "prod-y", "prod-z"],
				strategies: ["manual"],
			});

			const click = await controller.recordClick({
				impressionId: impression.id,
				productId: "prod-z",
				position: 2,
				strategy: "manual",
			});

			expect(click).not.toBeNull();
			expect(click?.productId).toBe("prod-z");
			expect(click?.position).toBe(2);
			expect(click?.strategy).toBe("manual");
		});

		it("returns null for a nonexistent impression ID", async () => {
			const click = await controller.recordClick({
				impressionId: "does-not-exist",
				productId: "prod-a",
				position: 0,
			});

			expect(click).toBeNull();
		});

		it("each click is stored independently and counts toward CTR", async () => {
			const i1 = await controller.recordImpression({
				surface: "trending",
				productIds: ["prod-a"],
				strategies: ["trending"],
			});
			const i2 = await controller.recordImpression({
				surface: "trending",
				productIds: ["prod-a"],
				strategies: ["trending"],
			});
			// Third impression with no click
			await controller.recordImpression({
				surface: "trending",
				productIds: ["prod-a"],
				strategies: ["trending"],
			});

			await controller.recordClick({
				impressionId: i1.id,
				productId: "prod-a",
				position: 0,
			});
			await controller.recordClick({
				impressionId: i2.id,
				productId: "prod-a",
				position: 0,
			});

			const analytics = await controller.getAnalytics();
			expect(analytics.totalImpressions).toBe(3);
			expect(analytics.totalClicks).toBe(2);
			// 2 of 3 impressions clicked → 66% (rounded)
			expect(analytics.clickThroughRate).toBe(67);
		});

		it("inherits surface from impression when strategy is not given", async () => {
			const impression = await controller.recordImpression({
				surface: "trending",
				productIds: ["prod-b"],
				strategies: ["trending"],
			});

			const click = await controller.recordClick({
				impressionId: impression.id,
				productId: "prod-b",
				position: 0,
			});

			expect(click?.surface).toBe("trending");
		});
	});

	// ── Personalized Recommendations ────────────────────────────────

	describe("getPersonalized", () => {
		it("returns empty array for customer with no interactions", async () => {
			const results = await controller.getPersonalized("unknown-customer");
			expect(results).toHaveLength(0);
		});

		it("does not recommend products the customer has already interacted with", async () => {
			const customerId = "cust-shopper";

			// Customer interacted with prod-A
			await controller.trackInteraction({
				productId: "prod-a",
				customerId,
				type: "view",
				productName: "Product A",
				productSlug: "product-a",
				productCategory: "Widgets",
			});

			// Another user interacted with prod-A and prod-B (same category)
			await controller.trackInteraction({
				productId: "prod-a",
				sessionId: "other-session",
				type: "purchase",
				productName: "Product A",
				productSlug: "product-a",
				productCategory: "Widgets",
			});
			await controller.trackInteraction({
				productId: "prod-b",
				sessionId: "other-session",
				type: "purchase",
				productName: "Product B",
				productSlug: "product-b",
				productCategory: "Widgets",
			});

			const results = await controller.getPersonalized(customerId);

			// prod-b can be recommended, prod-a must NOT be (customer already saw it)
			const recommendedIds = results.map((r) => r.productId);
			expect(recommendedIds).not.toContain("prod-a");
		});

		it("recommends products in matching categories", async () => {
			const customerId = "cust-category-fan";

			// Customer viewed a Gadgets product
			await controller.trackInteraction({
				productId: "prod-owned",
				customerId,
				type: "view",
				productName: "My Gadget",
				productSlug: "my-gadget",
				productCategory: "Gadgets",
			});

			// Another user purchased a different Gadgets product
			await controller.trackInteraction({
				productId: "prod-new",
				sessionId: "other-sess",
				type: "purchase",
				productName: "New Gadget",
				productSlug: "new-gadget",
				productCategory: "Gadgets",
			});

			// And also a completely different category product
			await controller.trackInteraction({
				productId: "prod-unrelated",
				sessionId: "other-sess",
				type: "purchase",
				productName: "Shirt",
				productSlug: "shirt",
				productCategory: "Apparel",
			});

			const results = await controller.getPersonalized(customerId);
			const recommendedIds = results.map((r) => r.productId);

			expect(recommendedIds).toContain("prod-new");
			expect(recommendedIds).not.toContain("prod-unrelated");
		});

		it("all personalized results use personalized strategy", async () => {
			const customerId = "cust-strat";

			await controller.trackInteraction({
				productId: "prod-x",
				customerId,
				type: "view",
				productName: "X",
				productSlug: "x",
				productCategory: "Things",
			});
			await controller.trackInteraction({
				productId: "prod-y",
				sessionId: "sess-y",
				type: "purchase",
				productName: "Y",
				productSlug: "y",
				productCategory: "Things",
			});

			const results = await controller.getPersonalized(customerId);
			for (const r of results) {
				expect(r.strategy).toBe("personalized");
			}
		});
	});
});
