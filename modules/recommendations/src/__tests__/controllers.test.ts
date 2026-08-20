import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRecommendationController } from "../service-impl";

describe("recommendation controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createRecommendationController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createRecommendationController(mockData);
	});

	// ── recordPurchase edge cases ─────────────────────────────────────

	describe("recordPurchase — boundary conditions", () => {
		it("returns 0 for empty product list", async () => {
			const pairs = await controller.recordPurchase([]);
			expect(pairs).toBe(0);
		});

		it("returns 0 for single product", async () => {
			const pairs = await controller.recordPurchase(["prod_only"]);
			expect(pairs).toBe(0);
		});

		it("generates exactly n*(n-1)/2 pairs for n products", async () => {
			const twoProducts = await controller.recordPurchase(["a", "b"]);
			expect(twoProducts).toBe(1);

			const threeProducts = await controller.recordPurchase(["x", "y", "z"]);
			expect(threeProducts).toBe(3);

			const fiveProducts = await controller.recordPurchase([
				"p1",
				"p2",
				"p3",
				"p4",
				"p5",
			]);
			expect(fiveProducts).toBe(10);
		});

		it("canonical ordering stores smaller id as productId1", async () => {
			// "banana" < "cherry" lexicographically
			await controller.recordPurchase(["cherry", "banana"]);

			const co = await controller.getCoOccurrences("banana");
			expect(co).toHaveLength(1);
			expect(co[0].productId1).toBe("banana");
			expect(co[0].productId2).toBe("cherry");
		});

		it("repeated purchases increment count for same pair", async () => {
			await controller.recordPurchase(["prod_a", "prod_b"]);
			await controller.recordPurchase(["prod_b", "prod_a"]);
			await controller.recordPurchase(["prod_a", "prod_b"]);

			const co = await controller.getCoOccurrences("prod_a");
			expect(co).toHaveLength(1);
			expect(co[0].count).toBe(3);
		});

		it("mixed overlapping purchases accumulate correctly", async () => {
			// Purchase 1: (a,b), (a,c), (b,c) — all count=1
			await controller.recordPurchase(["prod_a", "prod_b", "prod_c"]);
			// Purchase 2: (a,b) — now count=2
			await controller.recordPurchase(["prod_a", "prod_b"]);

			const coA = await controller.getCoOccurrences("prod_a");
			// a appears in (a,b) count=2 and (a,c) count=1
			expect(coA).toHaveLength(2);
			const abPair = coA.find(
				(c) => c.productId1 === "prod_a" && c.productId2 === "prod_b",
			);
			const acPair = coA.find(
				(c) => c.productId1 === "prod_a" && c.productId2 === "prod_c",
			);
			expect(abPair?.count).toBe(2);
			expect(acPair?.count).toBe(1);
		});
	});

	// ── getCoOccurrences — product in id2 position ───────────────────

	describe("getCoOccurrences — bidirectional lookup", () => {
		it("finds co-occurrences when product is in productId2 position", async () => {
			// "aaa" < "zzz" so aaa is stored as productId1, zzz as productId2
			await controller.recordPurchase(["zzz", "aaa"]);

			const coForZzz = await controller.getCoOccurrences("zzz");
			expect(coForZzz).toHaveLength(1);
			expect(coForZzz[0].productId1).toBe("aaa");
			expect(coForZzz[0].productId2).toBe("zzz");
		});

		it("combines results from both id1 and id2 positions", async () => {
			// "mid" with "aaa" => (aaa, mid)
			// "mid" with "zzz" => (mid, zzz)
			await controller.recordPurchase(["mid", "aaa"]);
			await controller.recordPurchase(["mid", "zzz"]);

			const co = await controller.getCoOccurrences("mid");
			expect(co).toHaveLength(2);
		});
	});

	// ── trackInteraction — identifier requirements ──────────────────

	describe("trackInteraction — identifier requirements", () => {
		it("throws when neither customerId nor sessionId is provided", async () => {
			await expect(
				controller.trackInteraction({
					productId: "prod_1",
					type: "view",
					productName: "Test",
					productSlug: "test",
				}),
			).rejects.toThrow("Either customerId or sessionId is required");
		});

		it("succeeds with only customerId", async () => {
			const interaction = await controller.trackInteraction({
				productId: "prod_1",
				customerId: "cust_1",
				type: "view",
				productName: "Product",
				productSlug: "product",
			});
			expect(interaction.customerId).toBe("cust_1");
			expect(interaction.sessionId).toBeUndefined();
		});

		it("succeeds with only sessionId", async () => {
			const interaction = await controller.trackInteraction({
				productId: "prod_1",
				sessionId: "sess_1",
				type: "add_to_cart",
				productName: "Product",
				productSlug: "product",
			});
			expect(interaction.sessionId).toBe("sess_1");
			expect(interaction.customerId).toBeUndefined();
		});

		it("succeeds with both customerId and sessionId", async () => {
			const interaction = await controller.trackInteraction({
				productId: "prod_1",
				customerId: "cust_1",
				sessionId: "sess_1",
				type: "purchase",
				productName: "Product",
				productSlug: "product",
			});
			expect(interaction.customerId).toBe("cust_1");
			expect(interaction.sessionId).toBe("sess_1");
		});
	});

	// ── Rule CRUD lifecycle ─────────────────────────────────────────

	describe("rule CRUD lifecycle", () => {
		it("full create-read-update-delete cycle", async () => {
			// Create
			const rule = await controller.createRule({
				name: "Lifecycle Rule",
				strategy: "manual",
				sourceProductId: "prod_src",
				targetProductIds: ["prod_t1", "prod_t2"],
				weight: 3,
			});
			expect(rule.id).toBeDefined();
			expect(rule.isActive).toBe(true);

			// Read
			const fetched = await controller.getRule(rule.id);
			expect(fetched?.name).toBe("Lifecycle Rule");
			expect(fetched?.weight).toBe(3);

			// Update
			const updated = await controller.updateRule(rule.id, {
				name: "Updated Lifecycle Rule",
				weight: 7,
				isActive: false,
			});
			expect(updated?.name).toBe("Updated Lifecycle Rule");
			expect(updated?.weight).toBe(7);
			expect(updated?.isActive).toBe(false);
			// Preserved fields
			expect(updated?.sourceProductId).toBe("prod_src");
			expect(updated?.targetProductIds).toEqual(["prod_t1", "prod_t2"]);

			// Delete
			const deleted = await controller.deleteRule(rule.id);
			expect(deleted).toBe(true);

			// Verify gone
			const gone = await controller.getRule(rule.id);
			expect(gone).toBeNull();
		});

		it("delete returns false for already-deleted rule", async () => {
			const rule = await controller.createRule({
				name: "Temp",
				strategy: "manual",
				targetProductIds: ["p1"],
			});
			await controller.deleteRule(rule.id);

			const secondDelete = await controller.deleteRule(rule.id);
			expect(secondDelete).toBe(false);
		});

		it("update returns null for already-deleted rule", async () => {
			const rule = await controller.createRule({
				name: "Temp",
				strategy: "manual",
				targetProductIds: ["p1"],
			});
			await controller.deleteRule(rule.id);

			const result = await controller.updateRule(rule.id, {
				name: "Should Fail",
			});
			expect(result).toBeNull();
		});
	});

	// ── getForProduct — combined strategies ─────────────────────────

	describe("getForProduct — combined strategies", () => {
		it("combines manual rules and bought_together co-occurrences", async () => {
			// Set up interaction data for target products
			await controller.trackInteraction({
				productId: "manual_target",
				customerId: "cust_x",
				type: "view",
				productName: "Manual Target",
				productSlug: "manual-target",
			});
			await controller.trackInteraction({
				productId: "co_target",
				customerId: "cust_x",
				type: "view",
				productName: "Co Target",
				productSlug: "co-target",
			});

			// Create manual rule with high weight
			await controller.createRule({
				name: "Manual",
				strategy: "manual",
				sourceProductId: "source_prod",
				targetProductIds: ["manual_target"],
				weight: 10,
			});

			// Create co-occurrence
			await controller.recordPurchase(["source_prod", "co_target"]);

			// No filter: both strategies
			const all = await controller.getForProduct("source_prod");
			expect(all.length).toBe(2);
			// Sorted by score: manual (10) > co-occurrence (1)
			expect(all[0].strategy).toBe("manual");
			expect(all[0].score).toBe(10);
			expect(all[1].strategy).toBe("bought_together");
			expect(all[1].score).toBe(1);
		});

		it("strategy filter 'manual' returns only manual results", async () => {
			await controller.createRule({
				name: "Manual Rule",
				strategy: "manual",
				sourceProductId: "src",
				targetProductIds: ["manual_t"],
				weight: 5,
			});
			await controller.recordPurchase(["src", "co_t"]);

			const manualOnly = await controller.getForProduct("src", {
				strategy: "manual",
			});
			expect(manualOnly.every((r) => r.strategy === "manual")).toBe(true);
		});

		it("strategy filter 'bought_together' returns only co-occurrence results", async () => {
			await controller.createRule({
				name: "Manual Rule",
				strategy: "manual",
				sourceProductId: "src",
				targetProductIds: ["manual_t"],
			});
			await controller.recordPurchase(["src", "co_t"]);

			const coOnly = await controller.getForProduct("src", {
				strategy: "bought_together",
			});
			expect(coOnly.every((r) => r.strategy === "bought_together")).toBe(true);
		});

		it("deduplicates when same product appears via manual and co-occurrence", async () => {
			await controller.trackInteraction({
				productId: "dup_prod",
				customerId: "cust_1",
				type: "view",
				productName: "Dup",
				productSlug: "dup",
			});

			await controller.createRule({
				name: "Manual",
				strategy: "manual",
				sourceProductId: "src",
				targetProductIds: ["dup_prod"],
				weight: 5,
			});
			await controller.recordPurchase(["src", "dup_prod"]);

			const recs = await controller.getForProduct("src");
			const dupEntries = recs.filter((r) => r.productId === "dup_prod");
			// Manual comes first and bought_together skips duplicates
			expect(dupEntries).toHaveLength(1);
			expect(dupEntries[0].strategy).toBe("manual");
		});

		it("inactive rules are excluded from getForProduct", async () => {
			await controller.createRule({
				name: "Inactive",
				strategy: "manual",
				sourceProductId: "src",
				targetProductIds: ["target"],
				isActive: false,
			});

			const recs = await controller.getForProduct("src", {
				strategy: "manual",
			});
			expect(recs).toHaveLength(0);
		});
	});

	// ── getTrending — weight calculations ───────────────────────────

	describe("getTrending — weight calculations", () => {
		it("purchase=3, add_to_cart=2, view=1 weights are correct", async () => {
			// Product with one of each type: score = 3+2+1 = 6
			await controller.trackInteraction({
				productId: "prod_mixed",
				customerId: "c1",
				type: "purchase",
				productName: "Mixed",
				productSlug: "mixed",
			});
			await controller.trackInteraction({
				productId: "prod_mixed",
				customerId: "c2",
				type: "add_to_cart",
				productName: "Mixed",
				productSlug: "mixed",
			});
			await controller.trackInteraction({
				productId: "prod_mixed",
				customerId: "c3",
				type: "view",
				productName: "Mixed",
				productSlug: "mixed",
			});

			const trending = await controller.getTrending();
			expect(trending).toHaveLength(1);
			expect(trending[0].score).toBe(6);
			expect(trending[0].strategy).toBe("trending");
		});

		it("multiple purchases accumulate weighted scores", async () => {
			// 3 purchases = score of 9
			for (let i = 0; i < 3; i++) {
				await controller.trackInteraction({
					productId: "hot_item",
					customerId: `cust_${i}`,
					type: "purchase",
					productName: "Hot Item",
					productSlug: "hot-item",
				});
			}

			const trending = await controller.getTrending();
			expect(trending[0].score).toBe(9);
		});

		it("ranks products by weighted score descending", async () => {
			// Product A: 2 purchases (score=6)
			await controller.trackInteraction({
				productId: "prod_a",
				customerId: "c1",
				type: "purchase",
				productName: "A",
				productSlug: "a",
			});
			await controller.trackInteraction({
				productId: "prod_a",
				customerId: "c2",
				type: "purchase",
				productName: "A",
				productSlug: "a",
			});

			// Product B: 4 views (score=4)
			for (let i = 0; i < 4; i++) {
				await controller.trackInteraction({
					productId: "prod_b",
					customerId: `cx_${i}`,
					type: "view",
					productName: "B",
					productSlug: "b",
				});
			}

			// Product C: 1 add_to_cart + 1 view (score=3)
			await controller.trackInteraction({
				productId: "prod_c",
				customerId: "c5",
				type: "add_to_cart",
				productName: "C",
				productSlug: "c",
			});
			await controller.trackInteraction({
				productId: "prod_c",
				customerId: "c6",
				type: "view",
				productName: "C",
				productSlug: "c",
			});

			const trending = await controller.getTrending();
			expect(trending).toHaveLength(3);
			expect(trending[0].productId).toBe("prod_a");
			expect(trending[0].score).toBe(6);
			expect(trending[1].productId).toBe("prod_b");
			expect(trending[1].score).toBe(4);
			expect(trending[2].productId).toBe("prod_c");
			expect(trending[2].score).toBe(3);
		});

		it("excludes interactions older than since date", async () => {
			const old = await controller.trackInteraction({
				productId: "old_prod",
				customerId: "cust_1",
				type: "purchase",
				productName: "Old Product",
				productSlug: "old-product",
			});
			// Backdate to 30 days ago
			await mockData.upsert("productInteraction", old.id, {
				...old,
				createdAt: new Date(Date.now() - 30 * 86_400_000),
			} as Record<string, unknown>);

			await controller.trackInteraction({
				productId: "new_prod",
				customerId: "cust_2",
				type: "view",
				productName: "New Product",
				productSlug: "new-product",
			});

			const trending = await controller.getTrending({
				since: new Date(Date.now() - 7 * 86_400_000),
			});
			expect(trending).toHaveLength(1);
			expect(trending[0].productId).toBe("new_prod");
		});
	});

	// ── getPersonalized — category-based and fallback ────────────────

	describe("getPersonalized — category-based and fallback", () => {
		it("returns empty for unknown customer with no interactions", async () => {
			const recs = await controller.getPersonalized("cust_unknown");
			expect(recs).toHaveLength(0);
		});

		it("excludes products the customer already interacted with", async () => {
			// Customer viewed both products in the same category
			await controller.trackInteraction({
				productId: "prod_seen",
				customerId: "cust_1",
				type: "view",
				productName: "Seen",
				productSlug: "seen",
				productCategory: "Electronics",
			});
			await controller.trackInteraction({
				productId: "prod_also_seen",
				customerId: "cust_1",
				type: "view",
				productName: "Also Seen",
				productSlug: "also-seen",
				productCategory: "Electronics",
			});

			// Another product in Electronics from another customer
			await controller.trackInteraction({
				productId: "prod_unseen",
				customerId: "cust_2",
				type: "view",
				productName: "Unseen",
				productSlug: "unseen",
				productCategory: "Electronics",
			});

			const recs = await controller.getPersonalized("cust_1");
			expect(recs).toHaveLength(1);
			expect(recs[0].productId).toBe("prod_unseen");
		});

		it("recommends products from matching categories only", async () => {
			// Customer interacted with Electronics
			await controller.trackInteraction({
				productId: "cust_prod",
				customerId: "cust_1",
				type: "purchase",
				productName: "Laptop",
				productSlug: "laptop",
				productCategory: "Electronics",
			});

			// Electronics product from another customer
			await controller.trackInteraction({
				productId: "tablet",
				customerId: "cust_2",
				type: "view",
				productName: "Tablet",
				productSlug: "tablet",
				productCategory: "Electronics",
			});

			// Clothing product (different category)
			await controller.trackInteraction({
				productId: "shirt",
				customerId: "cust_3",
				type: "view",
				productName: "Shirt",
				productSlug: "shirt",
				productCategory: "Clothing",
			});

			const recs = await controller.getPersonalized("cust_1");
			expect(recs).toHaveLength(1);
			expect(recs[0].productId).toBe("tablet");
			expect(recs[0].strategy).toBe("personalized");
		});

		it("falls back to co-occurrence when no category data available", async () => {
			// Customer purchased prod_a (no category)
			await controller.trackInteraction({
				productId: "prod_a",
				customerId: "cust_1",
				type: "purchase",
				productName: "Product A",
				productSlug: "product-a",
			});

			// prod_a frequently bought with prod_b
			await controller.recordPurchase(["prod_a", "prod_b"]);
			await controller.recordPurchase(["prod_a", "prod_b"]);

			// Interaction data for prod_b
			await controller.trackInteraction({
				productId: "prod_b",
				customerId: "cust_2",
				type: "view",
				productName: "Product B",
				productSlug: "product-b",
			});

			const recs = await controller.getPersonalized("cust_1");
			expect(recs).toHaveLength(1);
			expect(recs[0].productId).toBe("prod_b");
			expect(recs[0].score).toBe(2);
			expect(recs[0].strategy).toBe("personalized");
		});

		it("co-occurrence fallback excludes already-interacted products", async () => {
			// Customer purchased both prod_a and prod_b
			await controller.trackInteraction({
				productId: "prod_a",
				customerId: "cust_1",
				type: "purchase",
				productName: "A",
				productSlug: "a",
			});
			await controller.trackInteraction({
				productId: "prod_b",
				customerId: "cust_1",
				type: "view",
				productName: "B",
				productSlug: "b",
			});

			// Co-occurrence: a-b (but customer already has both)
			await controller.recordPurchase(["prod_a", "prod_b"]);
			// Co-occurrence: a-c (customer hasn't seen c)
			await controller.recordPurchase(["prod_a", "prod_c"]);

			const recs = await controller.getPersonalized("cust_1");
			// Should only recommend prod_c, not prod_b
			const productIds = recs.map((r) => r.productId);
			expect(productIds).not.toContain("prod_b");
			expect(productIds).toContain("prod_c");
		});

		it("uses weighted scores in category-based personalization", async () => {
			// Customer interacted with category "Tech"
			await controller.trackInteraction({
				productId: "owned",
				customerId: "cust_1",
				type: "purchase",
				productName: "Owned",
				productSlug: "owned",
				productCategory: "Tech",
			});

			// Candidate A: 2 purchases in Tech (score=6)
			for (let i = 0; i < 2; i++) {
				await controller.trackInteraction({
					productId: "high_score",
					customerId: `other_${i}`,
					type: "purchase",
					productName: "High Score",
					productSlug: "high-score",
					productCategory: "Tech",
				});
			}

			// Candidate B: 1 view in Tech (score=1)
			await controller.trackInteraction({
				productId: "low_score",
				customerId: "other_99",
				type: "view",
				productName: "Low Score",
				productSlug: "low-score",
				productCategory: "Tech",
			});

			const recs = await controller.getPersonalized("cust_1");
			expect(recs).toHaveLength(2);
			expect(recs[0].productId).toBe("high_score");
			expect(recs[0].score).toBe(6);
			expect(recs[1].productId).toBe("low_score");
			expect(recs[1].score).toBe(1);
		});
	});

	// ── Stats accuracy with mixed data ──────────────────────────────

	describe("getStats — accuracy with mixed data", () => {
		it("returns all zeroes when empty", async () => {
			const stats = await controller.getStats();
			expect(stats).toEqual({
				totalRules: 0,
				activeRules: 0,
				totalCoOccurrences: 0,
				totalInteractions: 0,
				embeddingsCount: 0,
				aiConfigured: false,
				totalImpressions: 0,
				totalClicks: 0,
				clickThroughRate: 0,
				avgClickPosition: 0,
			});
		});

		it("counts rules, co-occurrences, and interactions correctly", async () => {
			// 3 rules: 2 active, 1 inactive
			await controller.createRule({
				name: "Active 1",
				strategy: "manual",
				targetProductIds: ["p1"],
				isActive: true,
			});
			await controller.createRule({
				name: "Active 2",
				strategy: "bought_together",
				targetProductIds: ["p2"],
				isActive: true,
			});
			await controller.createRule({
				name: "Inactive",
				strategy: "manual",
				targetProductIds: ["p3"],
				isActive: false,
			});

			// 3 co-occurrences from 3-product purchase
			await controller.recordPurchase(["prod_a", "prod_b", "prod_c"]);

			// 2 interactions
			await controller.trackInteraction({
				productId: "prod_1",
				customerId: "cust_1",
				type: "view",
				productName: "P1",
				productSlug: "p1",
			});
			await controller.trackInteraction({
				productId: "prod_2",
				sessionId: "sess_1",
				type: "add_to_cart",
				productName: "P2",
				productSlug: "p2",
			});

			const stats = await controller.getStats();
			expect(stats.totalRules).toBe(3);
			expect(stats.activeRules).toBe(2);
			expect(stats.totalCoOccurrences).toBe(3);
			expect(stats.totalInteractions).toBe(2);
		});

		it("stats update after deleting rules", async () => {
			const rule = await controller.createRule({
				name: "Temp Rule",
				strategy: "manual",
				targetProductIds: ["p1"],
			});

			let stats = await controller.getStats();
			expect(stats.totalRules).toBe(1);
			expect(stats.activeRules).toBe(1);

			await controller.deleteRule(rule.id);

			stats = await controller.getStats();
			expect(stats.totalRules).toBe(0);
			expect(stats.activeRules).toBe(0);
		});

		it("stats reflect deactivated rules correctly", async () => {
			const rule = await controller.createRule({
				name: "Will Deactivate",
				strategy: "manual",
				targetProductIds: ["p1"],
				isActive: true,
			});

			let stats = await controller.getStats();
			expect(stats.activeRules).toBe(1);

			await controller.updateRule(rule.id, { isActive: false });

			stats = await controller.getStats();
			expect(stats.totalRules).toBe(1);
			expect(stats.activeRules).toBe(0);
		});
	});

	// ── Cross-method interaction scenarios ───────────────────────────

	describe("cross-method interactions", () => {
		it("co-occurrences created by recordPurchase appear in getForProduct bought_together", async () => {
			// Record multiple purchases to build up co-occurrence data
			await controller.recordPurchase(["src", "related_1"]);
			await controller.recordPurchase(["src", "related_1"]);
			await controller.recordPurchase(["src", "related_2"]);

			const recs = await controller.getForProduct("src", {
				strategy: "bought_together",
			});
			expect(recs).toHaveLength(2);
			// related_1 has count=2, related_2 has count=1
			expect(recs[0].productId).toBe("related_1");
			expect(recs[0].score).toBe(2);
			expect(recs[1].productId).toBe("related_2");
			expect(recs[1].score).toBe(1);
		});

		it("trackInteraction data enriches recommendation product info", async () => {
			// Track interaction to populate product metadata
			await controller.trackInteraction({
				productId: "target",
				customerId: "cust_x",
				type: "view",
				productName: "Wireless Headphones",
				productSlug: "wireless-headphones",
				productImage: "/img/headphones.jpg",
				productPrice: 7999,
			});

			await controller.createRule({
				name: "Cross Sell",
				strategy: "manual",
				sourceProductId: "source",
				targetProductIds: ["target"],
				weight: 5,
			});

			const recs = await controller.getForProduct("source", {
				strategy: "manual",
			});
			expect(recs).toHaveLength(1);
			expect(recs[0].productName).toBe("Wireless Headphones");
			expect(recs[0].productSlug).toBe("wireless-headphones");
			expect(recs[0].productImage).toBe("/img/headphones.jpg");
			expect(recs[0].productPrice).toBe(7999);
		});

		it("getForProduct uses productId as fallback name when no interaction data exists", async () => {
			await controller.createRule({
				name: "Rule",
				strategy: "manual",
				sourceProductId: "src",
				targetProductIds: ["no_interaction_data"],
				weight: 1,
			});

			const recs = await controller.getForProduct("src", {
				strategy: "manual",
			});
			expect(recs).toHaveLength(1);
			// Falls back to productId when no interaction data
			expect(recs[0].productName).toBe("no_interaction_data");
			expect(recs[0].productSlug).toBe("no_interaction_data");
		});

		it("listRules and countRules agree on counts", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createRule({
					name: `Rule ${i}`,
					strategy: i < 3 ? "manual" : "bought_together",
					targetProductIds: [`p${i}`],
					isActive: i < 4,
				});
			}

			const allRules = await controller.listRules();
			const allCount = await controller.countRules();
			expect(allRules).toHaveLength(allCount);

			const manualRules = await controller.listRules({
				strategy: "manual",
			});
			const manualCount = await controller.countRules({
				strategy: "manual",
			});
			expect(manualRules).toHaveLength(manualCount);
			expect(manualCount).toBe(3);

			const activeRules = await controller.listRules({ isActive: true });
			const activeCount = await controller.countRules({ isActive: true });
			expect(activeRules).toHaveLength(activeCount);
			expect(activeCount).toBe(4);
		});
	});
});
