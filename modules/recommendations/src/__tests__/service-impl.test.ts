import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRecommendationController } from "../service-impl";

describe("createRecommendationController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createRecommendationController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createRecommendationController(mockData);
	});

	// ============================================================
	// Rules
	// ============================================================

	describe("createRule", () => {
		it("creates a manual recommendation rule", async () => {
			const rule = await controller.createRule({
				name: "Summer Cross-Sell",
				strategy: "manual",
				sourceProductId: "prod_1",
				targetProductIds: ["prod_2", "prod_3"],
			});

			expect(rule.id).toBeDefined();
			expect(rule.name).toBe("Summer Cross-Sell");
			expect(rule.strategy).toBe("manual");
			expect(rule.sourceProductId).toBe("prod_1");
			expect(rule.targetProductIds).toEqual(["prod_2", "prod_3"]);
			expect(rule.weight).toBe(1);
			expect(rule.isActive).toBe(true);
			expect(rule.createdAt).toBeInstanceOf(Date);
		});

		it("creates a rule with custom weight and active state", async () => {
			const rule = await controller.createRule({
				name: "Priority Cross-Sell",
				strategy: "manual",
				targetProductIds: ["prod_5"],
				weight: 10,
				isActive: false,
			});

			expect(rule.weight).toBe(10);
			expect(rule.isActive).toBe(false);
		});

		it("creates rules with different strategies", async () => {
			const manual = await controller.createRule({
				name: "Manual",
				strategy: "manual",
				targetProductIds: ["p1"],
			});
			const bought = await controller.createRule({
				name: "Bought Together",
				strategy: "bought_together",
				targetProductIds: ["p2"],
			});

			expect(manual.strategy).toBe("manual");
			expect(bought.strategy).toBe("bought_together");
		});
	});

	describe("updateRule", () => {
		it("updates a rule's name and weight", async () => {
			const rule = await controller.createRule({
				name: "Original",
				strategy: "manual",
				targetProductIds: ["prod_1"],
			});

			const updated = await controller.updateRule(rule.id, {
				name: "Updated",
				weight: 5,
			});

			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("Updated");
			expect(updated?.weight).toBe(5);
			expect(updated?.strategy).toBe("manual");
		});

		it("updates isActive flag", async () => {
			const rule = await controller.createRule({
				name: "Test",
				strategy: "manual",
				targetProductIds: ["prod_1"],
			});

			const updated = await controller.updateRule(rule.id, {
				isActive: false,
			});

			expect(updated?.isActive).toBe(false);
		});

		it("updates targetProductIds", async () => {
			const rule = await controller.createRule({
				name: "Test",
				strategy: "manual",
				targetProductIds: ["prod_1"],
			});

			const updated = await controller.updateRule(rule.id, {
				targetProductIds: ["prod_2", "prod_3", "prod_4"],
			});

			expect(updated?.targetProductIds).toEqual(["prod_2", "prod_3", "prod_4"]);
		});

		it("returns null for non-existent rule", async () => {
			const result = await controller.updateRule("nonexistent", {
				name: "No",
			});
			expect(result).toBeNull();
		});

		it("sets updatedAt to current time", async () => {
			const rule = await controller.createRule({
				name: "Test",
				strategy: "manual",
				targetProductIds: ["prod_1"],
			});

			const updated = await controller.updateRule(rule.id, {
				name: "Changed",
			});

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				rule.updatedAt.getTime(),
			);
		});
	});

	describe("deleteRule", () => {
		it("deletes an existing rule", async () => {
			const rule = await controller.createRule({
				name: "To Delete",
				strategy: "manual",
				targetProductIds: ["prod_1"],
			});

			const deleted = await controller.deleteRule(rule.id);
			expect(deleted).toBe(true);

			const found = await controller.getRule(rule.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent rule", async () => {
			const deleted = await controller.deleteRule("nonexistent");
			expect(deleted).toBe(false);
		});
	});

	describe("getRule", () => {
		it("retrieves a rule by id", async () => {
			const rule = await controller.createRule({
				name: "Find Me",
				strategy: "manual",
				targetProductIds: ["prod_1"],
			});

			const found = await controller.getRule(rule.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Find Me");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getRule("nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("listRules", () => {
		it("lists all rules sorted by newest first", async () => {
			const r1 = await controller.createRule({
				name: "First",
				strategy: "manual",
				targetProductIds: ["p1"],
			});
			// Backdate the first rule
			await mockData.upsert("recommendationRule", r1.id, {
				...r1,
				createdAt: new Date(Date.now() - 60_000),
			} as Record<string, unknown>);

			await controller.createRule({
				name: "Second",
				strategy: "bought_together",
				targetProductIds: ["p2"],
			});

			const rules = await controller.listRules();
			expect(rules).toHaveLength(2);
			expect(rules[0].name).toBe("Second");
			expect(rules[1].name).toBe("First");
		});

		it("filters by strategy", async () => {
			await controller.createRule({
				name: "Manual",
				strategy: "manual",
				targetProductIds: ["p1"],
			});
			await controller.createRule({
				name: "Bought",
				strategy: "bought_together",
				targetProductIds: ["p2"],
			});

			const manualRules = await controller.listRules({
				strategy: "manual",
			});
			expect(manualRules).toHaveLength(1);
			expect(manualRules[0].name).toBe("Manual");
		});

		it("filters by isActive", async () => {
			await controller.createRule({
				name: "Active",
				strategy: "manual",
				targetProductIds: ["p1"],
				isActive: true,
			});
			await controller.createRule({
				name: "Inactive",
				strategy: "manual",
				targetProductIds: ["p2"],
				isActive: false,
			});

			const active = await controller.listRules({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createRule({
					name: `Rule ${i}`,
					strategy: "manual",
					targetProductIds: [`p${i}`],
				});
			}

			const page = await controller.listRules({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	describe("countRules", () => {
		it("counts all rules", async () => {
			await controller.createRule({
				name: "R1",
				strategy: "manual",
				targetProductIds: ["p1"],
			});
			await controller.createRule({
				name: "R2",
				strategy: "manual",
				targetProductIds: ["p2"],
			});

			const count = await controller.countRules();
			expect(count).toBe(2);
		});

		it("counts filtered rules", async () => {
			await controller.createRule({
				name: "Active",
				strategy: "manual",
				targetProductIds: ["p1"],
				isActive: true,
			});
			await controller.createRule({
				name: "Inactive",
				strategy: "manual",
				targetProductIds: ["p2"],
				isActive: false,
			});

			const count = await controller.countRules({ isActive: true });
			expect(count).toBe(1);
		});

		it("returns 0 when no rules", async () => {
			const count = await controller.countRules();
			expect(count).toBe(0);
		});
	});

	// ============================================================
	// Co-occurrences
	// ============================================================

	describe("recordPurchase", () => {
		it("records co-occurrences for product pairs", async () => {
			const pairs = await controller.recordPurchase([
				"prod_a",
				"prod_b",
				"prod_c",
			]);
			// 3 products → 3 pairs: (a,b), (a,c), (b,c)
			expect(pairs).toBe(3);
		});

		it("increments count for existing pairs", async () => {
			await controller.recordPurchase(["prod_a", "prod_b"]);
			await controller.recordPurchase(["prod_a", "prod_b"]);

			const coOccurrences = await controller.getCoOccurrences("prod_a");
			expect(coOccurrences).toHaveLength(1);
			expect(coOccurrences[0].count).toBe(2);
		});

		it("returns 0 for fewer than 2 products", async () => {
			const pairs = await controller.recordPurchase(["prod_a"]);
			expect(pairs).toBe(0);
		});

		it("handles canonical ordering (A,B == B,A)", async () => {
			await controller.recordPurchase(["prod_b", "prod_a"]);
			await controller.recordPurchase(["prod_a", "prod_b"]);

			const coOccurrences = await controller.getCoOccurrences("prod_a");
			expect(coOccurrences).toHaveLength(1);
			expect(coOccurrences[0].count).toBe(2);
		});

		it("handles 4 products correctly", async () => {
			const pairs = await controller.recordPurchase(["p1", "p2", "p3", "p4"]);
			// 4 products → 6 pairs: (1,2),(1,3),(1,4),(2,3),(2,4),(3,4)
			expect(pairs).toBe(6);
		});
	});

	describe("getCoOccurrences", () => {
		it("returns co-occurrences sorted by count descending", async () => {
			// prod_a bought with prod_b 3 times
			for (let i = 0; i < 3; i++) {
				await controller.recordPurchase(["prod_a", "prod_b"]);
			}
			// prod_a bought with prod_c once
			await controller.recordPurchase(["prod_a", "prod_c"]);

			const co = await controller.getCoOccurrences("prod_a");
			expect(co).toHaveLength(2);
			expect(co[0].count).toBe(3);
			expect(co[1].count).toBe(1);
		});

		it("returns empty when no co-occurrences", async () => {
			const co = await controller.getCoOccurrences("prod_lonely");
			expect(co).toHaveLength(0);
		});

		it("respects take parameter", async () => {
			await controller.recordPurchase(["prod_a", "prod_b"]);
			await controller.recordPurchase(["prod_a", "prod_c"]);
			await controller.recordPurchase(["prod_a", "prod_d"]);

			const co = await controller.getCoOccurrences("prod_a", { take: 2 });
			expect(co).toHaveLength(2);
		});

		it("finds co-occurrences where product is id2", async () => {
			// prod_a < prod_z (canonical: prod_a is id1, prod_z is id2)
			await controller.recordPurchase(["prod_a", "prod_z"]);

			const co = await controller.getCoOccurrences("prod_z");
			expect(co).toHaveLength(1);
		});
	});

	// ============================================================
	// Interactions
	// ============================================================

	describe("trackInteraction", () => {
		it("tracks a view interaction for a customer", async () => {
			const interaction = await controller.trackInteraction({
				productId: "prod_1",
				customerId: "cust_1",
				type: "view",
				productName: "Test Product",
				productSlug: "test-product",
			});

			expect(interaction.id).toBeDefined();
			expect(interaction.productId).toBe("prod_1");
			expect(interaction.customerId).toBe("cust_1");
			expect(interaction.type).toBe("view");
			expect(interaction.createdAt).toBeInstanceOf(Date);
		});

		it("tracks a purchase interaction", async () => {
			const interaction = await controller.trackInteraction({
				productId: "prod_1",
				customerId: "cust_1",
				type: "purchase",
				productName: "Test Product",
				productSlug: "test-product",
				productPrice: 2999,
			});

			expect(interaction.type).toBe("purchase");
			expect(interaction.productPrice).toBe(2999);
		});

		it("tracks an add_to_cart interaction", async () => {
			const interaction = await controller.trackInteraction({
				productId: "prod_1",
				sessionId: "sess_1",
				type: "add_to_cart",
				productName: "Test Product",
				productSlug: "test-product",
			});

			expect(interaction.type).toBe("add_to_cart");
			expect(interaction.sessionId).toBe("sess_1");
		});

		it("stores product image, category, and price", async () => {
			const interaction = await controller.trackInteraction({
				productId: "prod_1",
				customerId: "cust_1",
				type: "view",
				productName: "Fancy Widget",
				productSlug: "fancy-widget",
				productImage: "/img/widget.jpg",
				productPrice: 4999,
				productCategory: "Electronics",
			});

			expect(interaction.productImage).toBe("/img/widget.jpg");
			expect(interaction.productPrice).toBe(4999);
			expect(interaction.productCategory).toBe("Electronics");
		});

		it("throws when no identifier provided", async () => {
			await expect(
				controller.trackInteraction({
					productId: "prod_1",
					type: "view",
					productName: "Test",
					productSlug: "test",
				}),
			).rejects.toThrow("Either customerId or sessionId is required");
		});
	});

	// ============================================================
	// getForProduct
	// ============================================================

	describe("getForProduct", () => {
		it("returns manual recommendations from active rules", async () => {
			// Create interaction data for target product so it has a name
			await controller.trackInteraction({
				productId: "prod_target",
				customerId: "cust_x",
				type: "view",
				productName: "Target Product",
				productSlug: "target-product",
				productImage: "/img/target.jpg",
				productPrice: 1999,
			});

			await controller.createRule({
				name: "Cross-sell",
				strategy: "manual",
				sourceProductId: "prod_source",
				targetProductIds: ["prod_target"],
				weight: 5,
			});

			const recs = await controller.getForProduct("prod_source", {
				strategy: "manual",
			});

			expect(recs).toHaveLength(1);
			expect(recs[0].productId).toBe("prod_target");
			expect(recs[0].productName).toBe("Target Product");
			expect(recs[0].score).toBe(5);
			expect(recs[0].strategy).toBe("manual");
		});

		it("excludes inactive rules", async () => {
			await controller.createRule({
				name: "Disabled",
				strategy: "manual",
				sourceProductId: "prod_1",
				targetProductIds: ["prod_2"],
				isActive: false,
			});

			const recs = await controller.getForProduct("prod_1", {
				strategy: "manual",
			});
			expect(recs).toHaveLength(0);
		});

		it("returns bought_together recommendations from co-occurrence data", async () => {
			// Track interactions for product info
			await controller.trackInteraction({
				productId: "prod_related",
				customerId: "cust_1",
				type: "purchase",
				productName: "Related Product",
				productSlug: "related-product",
			});

			// Record purchases
			await controller.recordPurchase(["prod_main", "prod_related"]);
			await controller.recordPurchase(["prod_main", "prod_related"]);

			const recs = await controller.getForProduct("prod_main", {
				strategy: "bought_together",
			});

			expect(recs).toHaveLength(1);
			expect(recs[0].productId).toBe("prod_related");
			expect(recs[0].score).toBe(2);
			expect(recs[0].strategy).toBe("bought_together");
		});

		it("combines manual and bought_together when no strategy filter", async () => {
			await controller.trackInteraction({
				productId: "prod_manual_target",
				customerId: "cust_1",
				type: "view",
				productName: "Manual Target",
				productSlug: "manual-target",
			});
			await controller.trackInteraction({
				productId: "prod_co_target",
				customerId: "cust_1",
				type: "view",
				productName: "Co Target",
				productSlug: "co-target",
			});

			await controller.createRule({
				name: "Manual Rule",
				strategy: "manual",
				sourceProductId: "prod_source",
				targetProductIds: ["prod_manual_target"],
				weight: 10,
			});
			await controller.recordPurchase(["prod_source", "prod_co_target"]);

			const recs = await controller.getForProduct("prod_source");
			expect(recs.length).toBeGreaterThanOrEqual(2);
			// Manual (weight=10) should be first
			expect(recs[0].strategy).toBe("manual");
		});

		it("respects take limit", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.trackInteraction({
					productId: `prod_t${i}`,
					customerId: "cust_1",
					type: "view",
					productName: `Target ${i}`,
					productSlug: `target-${i}`,
				});
				await controller.createRule({
					name: `Rule ${i}`,
					strategy: "manual",
					sourceProductId: "prod_source",
					targetProductIds: [`prod_t${i}`],
				});
			}

			const recs = await controller.getForProduct("prod_source", {
				take: 3,
			});
			expect(recs).toHaveLength(3);
		});

		it("returns empty for product with no recommendations", async () => {
			const recs = await controller.getForProduct("prod_lonely");
			expect(recs).toHaveLength(0);
		});

		it("deduplicates when same product appears in manual and co-occurrence", async () => {
			await controller.trackInteraction({
				productId: "prod_dup",
				customerId: "cust_1",
				type: "view",
				productName: "Duplicate",
				productSlug: "duplicate",
			});

			await controller.createRule({
				name: "Manual",
				strategy: "manual",
				sourceProductId: "prod_src",
				targetProductIds: ["prod_dup"],
				weight: 5,
			});
			await controller.recordPurchase(["prod_src", "prod_dup"]);

			const recs = await controller.getForProduct("prod_src");
			// Should appear only once (from manual, since it comes first)
			const dupEntries = recs.filter((r) => r.productId === "prod_dup");
			expect(dupEntries).toHaveLength(1);
		});
	});

	// ============================================================
	// getTrending
	// ============================================================

	describe("getTrending", () => {
		it("returns products sorted by weighted interaction score", async () => {
			// Product A: 3 views (score=3) + 1 purchase (score=3) = 6
			for (let i = 0; i < 3; i++) {
				await controller.trackInteraction({
					productId: "prod_popular",
					customerId: `cust_${i}`,
					type: "view",
					productName: "Popular",
					productSlug: "popular",
				});
			}
			await controller.trackInteraction({
				productId: "prod_popular",
				customerId: "cust_buyer",
				type: "purchase",
				productName: "Popular",
				productSlug: "popular",
			});

			// Product B: 1 view (score=1)
			await controller.trackInteraction({
				productId: "prod_quiet",
				customerId: "cust_0",
				type: "view",
				productName: "Quiet",
				productSlug: "quiet",
			});

			const trending = await controller.getTrending();
			expect(trending).toHaveLength(2);
			expect(trending[0].productId).toBe("prod_popular");
			expect(trending[0].score).toBe(6);
			expect(trending[0].strategy).toBe("trending");
			expect(trending[1].productId).toBe("prod_quiet");
			expect(trending[1].score).toBe(1);
		});

		it("weights add_to_cart as 2", async () => {
			await controller.trackInteraction({
				productId: "prod_cart",
				customerId: "cust_1",
				type: "add_to_cart",
				productName: "Cart Item",
				productSlug: "cart-item",
			});

			const trending = await controller.getTrending();
			expect(trending[0].score).toBe(2);
		});

		it("filters by since date", async () => {
			// Old interaction
			const old = await controller.trackInteraction({
				productId: "prod_old",
				customerId: "cust_1",
				type: "view",
				productName: "Old",
				productSlug: "old",
			});
			// Backdate it
			await mockData.upsert("productInteraction", old.id, {
				...old,
				createdAt: new Date(Date.now() - 30 * 86_400_000), // 30 days ago
			} as Record<string, unknown>);

			// Recent interaction
			await controller.trackInteraction({
				productId: "prod_new",
				customerId: "cust_1",
				type: "view",
				productName: "New",
				productSlug: "new",
			});

			const trending = await controller.getTrending({
				since: new Date(Date.now() - 7 * 86_400_000),
			});
			expect(trending).toHaveLength(1);
			expect(trending[0].productId).toBe("prod_new");
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.trackInteraction({
					productId: `prod_${i}`,
					customerId: "cust_1",
					type: "view",
					productName: `Product ${i}`,
					productSlug: `product-${i}`,
				});
			}

			const trending = await controller.getTrending({ take: 5 });
			expect(trending).toHaveLength(5);
		});

		it("returns empty when no interactions", async () => {
			const trending = await controller.getTrending();
			expect(trending).toHaveLength(0);
		});

		it("includes product image and price", async () => {
			await controller.trackInteraction({
				productId: "prod_visual",
				customerId: "cust_1",
				type: "view",
				productName: "Visual",
				productSlug: "visual",
				productImage: "/img/visual.jpg",
				productPrice: 9999,
			});

			const trending = await controller.getTrending();
			expect(trending[0].productImage).toBe("/img/visual.jpg");
			expect(trending[0].productPrice).toBe(9999);
		});
	});

	// ============================================================
	// getPersonalized
	// ============================================================

	describe("getPersonalized", () => {
		it("recommends products from same categories customer has interacted with", async () => {
			// Customer interacted with Electronics
			await controller.trackInteraction({
				productId: "prod_owned",
				customerId: "cust_1",
				type: "purchase",
				productName: "Laptop",
				productSlug: "laptop",
				productCategory: "Electronics",
			});

			// Another product in Electronics (from another customer)
			await controller.trackInteraction({
				productId: "prod_suggest",
				customerId: "cust_2",
				type: "view",
				productName: "Tablet",
				productSlug: "tablet",
				productCategory: "Electronics",
			});

			// Product in a different category
			await controller.trackInteraction({
				productId: "prod_irrelevant",
				customerId: "cust_3",
				type: "view",
				productName: "T-Shirt",
				productSlug: "t-shirt",
				productCategory: "Clothing",
			});

			const recs = await controller.getPersonalized("cust_1");
			expect(recs).toHaveLength(1);
			expect(recs[0].productId).toBe("prod_suggest");
			expect(recs[0].strategy).toBe("personalized");
		});

		it("excludes products customer already interacted with", async () => {
			await controller.trackInteraction({
				productId: "prod_1",
				customerId: "cust_1",
				type: "view",
				productName: "P1",
				productSlug: "p1",
				productCategory: "Tech",
			});
			await controller.trackInteraction({
				productId: "prod_1",
				customerId: "cust_2",
				type: "view",
				productName: "P1",
				productSlug: "p1",
				productCategory: "Tech",
			});

			const recs = await controller.getPersonalized("cust_1");
			expect(recs).toHaveLength(0);
		});

		it("falls back to co-occurrence when no category data", async () => {
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

			// Interaction for prod_b so it has a name
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
		});

		it("returns empty for customer with no interactions", async () => {
			const recs = await controller.getPersonalized("cust_new");
			expect(recs).toHaveLength(0);
		});

		it("sorts by score descending", async () => {
			// Customer likes Electronics
			await controller.trackInteraction({
				productId: "prod_owned",
				customerId: "cust_1",
				type: "purchase",
				productName: "My Laptop",
				productSlug: "my-laptop",
				productCategory: "Electronics",
			});

			// Candidate A: 3 purchases (score=9)
			for (let i = 0; i < 3; i++) {
				await controller.trackInteraction({
					productId: "prod_hot",
					customerId: `cust_other_${i}`,
					type: "purchase",
					productName: "Hot Product",
					productSlug: "hot-product",
					productCategory: "Electronics",
				});
			}

			// Candidate B: 1 view (score=1)
			await controller.trackInteraction({
				productId: "prod_cold",
				customerId: "cust_other_99",
				type: "view",
				productName: "Cold Product",
				productSlug: "cold-product",
				productCategory: "Electronics",
			});

			const recs = await controller.getPersonalized("cust_1");
			expect(recs).toHaveLength(2);
			expect(recs[0].productId).toBe("prod_hot");
			expect(recs[0].score).toBe(9);
			expect(recs[1].productId).toBe("prod_cold");
		});

		it("respects take limit", async () => {
			await controller.trackInteraction({
				productId: "prod_owned",
				customerId: "cust_1",
				type: "view",
				productName: "Owned",
				productSlug: "owned",
				productCategory: "Cat",
			});

			for (let i = 0; i < 10; i++) {
				await controller.trackInteraction({
					productId: `prod_c${i}`,
					customerId: "cust_other",
					type: "view",
					productName: `Candidate ${i}`,
					productSlug: `candidate-${i}`,
					productCategory: "Cat",
				});
			}

			const recs = await controller.getPersonalized("cust_1", { take: 3 });
			expect(recs).toHaveLength(3);
		});
	});

	// ============================================================
	// getStats
	// ============================================================

	describe("getStats", () => {
		it("returns zeroes when empty", async () => {
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

		it("returns correct counts", async () => {
			await controller.createRule({
				name: "Active Rule",
				strategy: "manual",
				targetProductIds: ["p1"],
				isActive: true,
			});
			await controller.createRule({
				name: "Inactive Rule",
				strategy: "manual",
				targetProductIds: ["p2"],
				isActive: false,
			});
			await controller.recordPurchase(["prod_a", "prod_b", "prod_c"]);
			await controller.trackInteraction({
				productId: "prod_1",
				customerId: "cust_1",
				type: "view",
				productName: "Test",
				productSlug: "test",
			});

			const stats = await controller.getStats();
			expect(stats.totalRules).toBe(2);
			expect(stats.activeRules).toBe(1);
			expect(stats.totalCoOccurrences).toBe(3); // 3 pairs from 3 products
			expect(stats.totalInteractions).toBe(1);
			expect(stats.embeddingsCount).toBe(0);
			expect(stats.aiConfigured).toBe(false);
		});
	});

	// ============================================================
	// AI — no provider (graceful degradation)
	// ============================================================

	describe("generateProductEmbedding (no provider)", () => {
		it("returns null when no embedding provider configured", async () => {
			const result = await controller.generateProductEmbedding(
				"prod_1",
				"Awesome laptop",
			);
			expect(result).toBeNull();
		});
	});

	describe("getAISimilar (no provider)", () => {
		it("returns empty array when no embedding provider configured", async () => {
			const results = await controller.getAISimilar("prod_1");
			expect(results).toHaveLength(0);
		});
	});
});

// ============================================================
// AI — with mock embedding provider
// ============================================================

describe("createRecommendationController (with AI)", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let aiController: ReturnType<typeof createRecommendationController>;

	const mockEmbeddingProvider = {
		generateEmbedding: vi.fn(),
		generateEmbeddings: vi.fn(),
	};

	beforeEach(() => {
		mockData = createMockDataService();
		mockEmbeddingProvider.generateEmbedding.mockReset();
		mockEmbeddingProvider.generateEmbeddings.mockReset();
		aiController = createRecommendationController(
			mockData,
			undefined,
			mockEmbeddingProvider,
		);
	});

	describe("generateProductEmbedding", () => {
		it("generates and stores an embedding for a product", async () => {
			const vec = [0.1, 0.2, 0.3];
			mockEmbeddingProvider.generateEmbedding.mockResolvedValue(vec);

			const result = await aiController.generateProductEmbedding(
				"prod_1",
				"Premium leather wallet",
				{ productName: "Leather Wallet", productSlug: "leather-wallet" },
			);

			expect(result).not.toBeNull();
			expect(result?.productId).toBe("prod_1");
			expect(result?.embedding).toEqual(vec);
			expect(result?.text).toBe("Premium leather wallet");
			expect(mockEmbeddingProvider.generateEmbedding).toHaveBeenCalledWith(
				"Premium leather wallet",
			);
		});

		it("returns null when embedding API fails", async () => {
			mockEmbeddingProvider.generateEmbedding.mockResolvedValue(null);

			const result = await aiController.generateProductEmbedding(
				"prod_1",
				"Some product",
			);

			expect(result).toBeNull();
		});

		it("updates existing embedding for same product", async () => {
			mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1, 0.2]);

			const first = await aiController.generateProductEmbedding(
				"prod_1",
				"First description",
			);

			mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.3, 0.4]);
			const second = await aiController.generateProductEmbedding(
				"prod_1",
				"Updated description",
			);

			expect(first?.id).toBe(second?.id);
			expect(second?.text).toBe("Updated description");
		});
	});

	describe("getAISimilar", () => {
		it("returns products ranked by cosine similarity", async () => {
			// Source product: [1, 0, 0]
			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([1, 0, 0]);
			await aiController.generateProductEmbedding(
				"prod_source",
				"Source product",
			);

			// Similar product: [0.9, 0.1, 0]  (high similarity)
			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([
				0.9, 0.1, 0,
			]);
			await aiController.generateProductEmbedding(
				"prod_similar",
				"Similar product",
				{ productName: "Similar", productSlug: "similar" },
			);

			// Dissimilar product: [0, 0, 1]  (orthogonal, zero similarity)
			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([0, 0, 1]);
			await aiController.generateProductEmbedding(
				"prod_different",
				"Different product",
				{ productName: "Different", productSlug: "different" },
			);

			const results = await aiController.getAISimilar("prod_source");

			expect(results).toHaveLength(1); // Only the similar one (>0 similarity)
			expect(results[0].productId).toBe("prod_similar");
			expect(results[0].strategy).toBe("ai_similar");
			expect(results[0].score).toBeGreaterThan(0.9);
		});

		it("returns empty when source product has no embedding", async () => {
			const results = await aiController.getAISimilar("prod_no_embedding");
			expect(results).toHaveLength(0);
		});

		it("excludes the source product from results", async () => {
			mockEmbeddingProvider.generateEmbedding.mockResolvedValue([1, 0, 0]);
			await aiController.generateProductEmbedding("prod_only", "Only product");

			const results = await aiController.getAISimilar("prod_only");
			expect(results).toHaveLength(0);
		});

		it("respects take limit", async () => {
			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([1, 0, 0]);
			await aiController.generateProductEmbedding("prod_src", "Source");

			for (let i = 0; i < 5; i++) {
				mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([
					0.9 - i * 0.1,
					0.1 + i * 0.1,
					0,
				]);
				await aiController.generateProductEmbedding(
					`prod_${i}`,
					`Product ${i}`,
					{ productName: `Product ${i}`, productSlug: `product-${i}` },
				);
			}

			const results = await aiController.getAISimilar("prod_src", { take: 2 });
			expect(results).toHaveLength(2);
			// First result should have highest similarity
			expect(results[0].score).toBeGreaterThan(results[1].score);
		});

		it("looks up product info from interactions when not on embedding", async () => {
			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([1, 0]);
			await aiController.generateProductEmbedding("prod_src", "Source");

			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([0.9, 0.1]);
			await aiController.generateProductEmbedding(
				"prod_target",
				"Target product",
			);

			// Track an interaction for the target product with metadata
			await aiController.trackInteraction({
				productId: "prod_target",
				customerId: "cust_1",
				type: "view",
				productName: "Nice Widget",
				productSlug: "nice-widget",
				productImage: "/img/widget.jpg",
				productPrice: 2999,
			});

			const results = await aiController.getAISimilar("prod_src");
			expect(results).toHaveLength(1);
			expect(results[0].productName).toBe("Nice Widget");
			expect(results[0].productSlug).toBe("nice-widget");
			expect(results[0].productImage).toBe("/img/widget.jpg");
			expect(results[0].productPrice).toBe(2999);
		});
	});

	describe("getForProduct with ai_similar strategy", () => {
		it("includes AI similar results when strategy is ai_similar", async () => {
			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([1, 0]);
			await aiController.generateProductEmbedding("prod_src", "Source");

			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([0.9, 0.1]);
			await aiController.generateProductEmbedding("prod_ai_match", "AI match", {
				productName: "AI Match",
				productSlug: "ai-match",
			});

			const recs = await aiController.getForProduct("prod_src", {
				strategy: "ai_similar",
			});

			expect(recs).toHaveLength(1);
			expect(recs[0].strategy).toBe("ai_similar");
			expect(recs[0].productId).toBe("prod_ai_match");
		});

		it("includes AI similar alongside other strategies when no filter", async () => {
			// Set up AI embeddings
			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([1, 0]);
			await aiController.generateProductEmbedding("prod_src", "Source");

			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([0.9, 0.1]);
			await aiController.generateProductEmbedding("prod_ai_match", "AI match", {
				productName: "AI Match",
				productSlug: "ai-match",
			});

			// Set up manual rule
			await aiController.trackInteraction({
				productId: "prod_manual_target",
				customerId: "cust_1",
				type: "view",
				productName: "Manual Target",
				productSlug: "manual-target",
			});
			await aiController.createRule({
				name: "Manual Rec",
				strategy: "manual",
				sourceProductId: "prod_src",
				targetProductIds: ["prod_manual_target"],
				weight: 10,
			});

			const recs = await aiController.getForProduct("prod_src");

			const strategies = [...new Set(recs.map((r) => r.strategy))];
			expect(strategies).toContain("manual");
			expect(strategies).toContain("ai_similar");
		});

		it("does not duplicate products already found by other strategies", async () => {
			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([1, 0]);
			await aiController.generateProductEmbedding("prod_src", "Source");

			mockEmbeddingProvider.generateEmbedding.mockResolvedValueOnce([0.9, 0.1]);
			await aiController.generateProductEmbedding(
				"prod_overlap",
				"Overlap product",
				{ productName: "Overlap", productSlug: "overlap" },
			);

			// Also add as manual recommendation
			await aiController.trackInteraction({
				productId: "prod_overlap",
				customerId: "cust_1",
				type: "view",
				productName: "Overlap",
				productSlug: "overlap",
			});
			await aiController.createRule({
				name: "Manual for Overlap",
				strategy: "manual",
				sourceProductId: "prod_src",
				targetProductIds: ["prod_overlap"],
				weight: 5,
			});

			const recs = await aiController.getForProduct("prod_src");
			const overlapEntries = recs.filter((r) => r.productId === "prod_overlap");
			expect(overlapEntries).toHaveLength(1);
		});
	});

	describe("getStats with AI", () => {
		it("reports aiConfigured as true and tracks embeddings count", async () => {
			mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1, 0.2]);
			await aiController.generateProductEmbedding("prod_1", "Product 1");
			await aiController.generateProductEmbedding("prod_2", "Product 2");

			const stats = await aiController.getStats();
			expect(stats.aiConfigured).toBe(true);
			expect(stats.embeddingsCount).toBe(2);
		});
	});
});

// ============================================================
// Impressions, clicks, analytics
// ============================================================

describe("recommendation impressions and clicks", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createRecommendationController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createRecommendationController(mockData);
	});

	describe("recordImpression", () => {
		it("persists an impression with surface, productIds, and strategies", async () => {
			const impression = await controller.recordImpression({
				surface: "for_product",
				sourceProductId: "src",
				customerId: "cust_1",
				productIds: ["a", "b", "c"],
				strategies: ["manual", "bought_together"],
			});

			expect(impression.id).toBeDefined();
			expect(impression.surface).toBe("for_product");
			expect(impression.sourceProductId).toBe("src");
			expect(impression.customerId).toBe("cust_1");
			expect(impression.productIds).toEqual(["a", "b", "c"]);
			expect(impression.strategies).toEqual(["manual", "bought_together"]);
			expect(impression.servedAt).toBeInstanceOf(Date);
		});
	});

	describe("recordClick", () => {
		it("returns null when impression does not exist", async () => {
			const click = await controller.recordClick({
				impressionId: "missing",
				productId: "a",
				position: 0,
			});
			expect(click).toBeNull();
		});

		it("returns null when productId is not in the impression", async () => {
			const impression = await controller.recordImpression({
				surface: "trending",
				productIds: ["a", "b"],
				strategies: ["trending"],
			});

			const click = await controller.recordClick({
				impressionId: impression.id,
				productId: "not-in-impression",
				position: 0,
			});
			expect(click).toBeNull();
		});

		it("persists a click and inherits surface from impression when not given", async () => {
			const impression = await controller.recordImpression({
				surface: "trending",
				productIds: ["a", "b"],
				strategies: ["trending"],
			});

			const click = await controller.recordClick({
				impressionId: impression.id,
				productId: "b",
				position: 1,
			});
			expect(click).not.toBeNull();
			expect(click?.surface).toBe("trending");
			expect(click?.position).toBe(1);
			expect(click?.productId).toBe("b");
		});
	});

	describe("getAnalytics", () => {
		it("returns zeroes when there is no data", async () => {
			const analytics = await controller.getAnalytics();
			expect(analytics.totalImpressions).toBe(0);
			expect(analytics.totalClicks).toBe(0);
			expect(analytics.clickThroughRate).toBe(0);
			expect(analytics.avgClickPosition).toBe(0);
			expect(analytics.bySurface).toEqual([]);
		});

		it("computes CTR as the percent of impressions that had at least one click", async () => {
			const i1 = await controller.recordImpression({
				surface: "for_product",
				productIds: ["a", "b"],
				strategies: ["manual"],
			});
			const i2 = await controller.recordImpression({
				surface: "for_product",
				productIds: ["c", "d"],
				strategies: ["manual"],
			});
			await controller.recordImpression({
				surface: "for_product",
				productIds: ["e", "f"],
				strategies: ["manual"],
			});

			// Two clicks on i1 should still count as one impression with clicks
			await controller.recordClick({
				impressionId: i1.id,
				productId: "a",
				position: 0,
			});
			await controller.recordClick({
				impressionId: i1.id,
				productId: "b",
				position: 1,
			});
			await controller.recordClick({
				impressionId: i2.id,
				productId: "c",
				position: 0,
			});

			const analytics = await controller.getAnalytics();
			expect(analytics.totalImpressions).toBe(3);
			expect(analytics.totalClicks).toBe(3);
			// 2 of 3 impressions had at least one click → 67%
			expect(analytics.clickThroughRate).toBe(67);
			// avg position = (0+1+0)/3 = 0.3
			expect(analytics.avgClickPosition).toBe(0.3);
		});

		it("groups stats by surface", async () => {
			const t1 = await controller.recordImpression({
				surface: "trending",
				productIds: ["a"],
				strategies: ["trending"],
			});
			await controller.recordImpression({
				surface: "trending",
				productIds: ["b"],
				strategies: ["trending"],
			});
			const p1 = await controller.recordImpression({
				surface: "personalized",
				productIds: ["c"],
				strategies: ["personalized"],
			});

			await controller.recordClick({
				impressionId: t1.id,
				productId: "a",
				position: 0,
			});
			await controller.recordClick({
				impressionId: p1.id,
				productId: "c",
				position: 0,
			});

			const analytics = await controller.getAnalytics();
			const trending = analytics.bySurface.find(
				(s) => s.surface === "trending",
			);
			const personalized = analytics.bySurface.find(
				(s) => s.surface === "personalized",
			);

			expect(trending).toBeDefined();
			expect(trending?.impressions).toBe(2);
			expect(trending?.clicks).toBe(1);
			expect(trending?.clickThroughRate).toBe(50);

			expect(personalized).toBeDefined();
			expect(personalized?.impressions).toBe(1);
			expect(personalized?.clicks).toBe(1);
			expect(personalized?.clickThroughRate).toBe(100);
		});
	});

	describe("getStats includes click metrics", () => {
		it("rolls up totals into the existing stats payload", async () => {
			const i = await controller.recordImpression({
				surface: "for_product",
				productIds: ["a", "b"],
				strategies: ["manual"],
			});
			await controller.recordClick({
				impressionId: i.id,
				productId: "a",
				position: 2,
			});

			const stats = await controller.getStats();
			expect(stats.totalImpressions).toBe(1);
			expect(stats.totalClicks).toBe(1);
			expect(stats.clickThroughRate).toBe(100);
			expect(stats.avgClickPosition).toBe(2);
		});
	});
});
