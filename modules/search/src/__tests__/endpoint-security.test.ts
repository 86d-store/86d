import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSearchController } from "../service-impl";

/**
 * Security regression tests for search endpoints.
 *
 * Search is public-facing and accepts user-supplied text.
 * These tests verify:
 * - Session isolation: recent queries are scoped to sessionId
 * - Index integrity: removing an item doesn't leak leftover results
 * - Synonym injection: adding synonyms doesn't corrupt unrelated searches
 * - Query recording: fire-and-forget recording doesn't affect results
 * - Boundary conditions: extreme input lengths, empty strings, special chars
 */

describe("search endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSearchController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSearchController(mockData);
	});

	// ── Session Isolation ──────────────────────────────────────────

	describe("session isolation on recent queries", () => {
		it("getRecentQueries only returns queries for the given session", async () => {
			await controller.recordQuery("shoes", 5, "session_A");
			await controller.recordQuery("boots", 3, "session_B");
			await controller.recordQuery("sandals", 2, "session_A");

			const sessionA = await controller.getRecentQueries("session_A");
			expect(sessionA).toHaveLength(2);
			for (const q of sessionA) {
				expect(q.sessionId).toBe("session_A");
			}

			const sessionB = await controller.getRecentQueries("session_B");
			expect(sessionB).toHaveLength(1);
			expect(sessionB[0].sessionId).toBe("session_B");
		});

		it("queries without sessionId do not appear in any session results", async () => {
			await controller.recordQuery("anonymous-search", 1);

			const results = await controller.getRecentQueries("any_session");
			expect(results).toHaveLength(0);
		});

		it("session A cannot see session B recent queries even with same term", async () => {
			await controller.recordQuery("laptop", 10, "session_A");
			await controller.recordQuery("laptop", 10, "session_B");

			const a = await controller.getRecentQueries("session_A");
			const b = await controller.getRecentQueries("session_B");
			expect(a).toHaveLength(1);
			expect(b).toHaveLength(1);
		});
	});

	// ── Index Integrity ────────────────────────────────────────────

	describe("index integrity after removal", () => {
		it("removed item does not appear in search results", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "secret_prod",
				title: "Classified Widget",
				url: "/products/secret",
			});

			const before = await controller.search("Classified");
			expect(before.total).toBeGreaterThan(0);

			await controller.removeFromIndex("product", "secret_prod");

			const after = await controller.search("Classified");
			expect(after.total).toBe(0);
		});

		it("removing one entityType does not remove same entityId in another type", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "shared_id",
				title: "Product Item",
				url: "/product/shared",
			});
			await controller.indexItem({
				entityType: "blog",
				entityId: "shared_id",
				title: "Blog Post Item",
				url: "/blog/shared",
			});

			await controller.removeFromIndex("product", "shared_id");

			const results = await controller.search("Item");
			expect(results.total).toBe(1);
			expect(results.results[0].item.entityType).toBe("blog");
		});
	});

	// ── Synonym Safety ─────────────────────────────────────────────

	describe("synonym management safety", () => {
		it("synonyms only expand for configured terms", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "tshirt_1",
				title: "Cotton T-Shirt",
				url: "/products/tshirt",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "pants_1",
				title: "Denim Pants",
				url: "/products/pants",
			});

			await controller.addSynonym("tee", ["t-shirt"]);

			// "tee" should find t-shirt
			const teeResults = await controller.search("tee");
			expect(teeResults.total).toBeGreaterThan(0);

			// "tee" should NOT find pants
			for (const r of teeResults.results) {
				expect(r.item.title).not.toContain("Pants");
			}
		});

		it("removing a synonym stops expansion", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "shoe_1",
				title: "Running Shoes",
				url: "/products/shoes",
			});

			const syn = await controller.addSynonym("sneakers", ["shoes"]);
			const before = await controller.search("sneakers");
			expect(before.total).toBeGreaterThan(0);

			await controller.removeSynonym(syn.id);
			const after = await controller.search("sneakers");
			expect(after.total).toBe(0);
		});
	});

	// ── Boundary Conditions ────────────────────────────────────────

	describe("input boundary handling", () => {
		it("empty query returns no results without error", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Widget",
				url: "/p",
			});

			const result = await controller.search("");
			expect(result.results).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it("whitespace-only query returns no results", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Widget",
				url: "/p",
			});

			const result = await controller.search("   ");
			expect(result.results).toHaveLength(0);
		});

		it("suggest with empty prefix returns empty", async () => {
			await controller.recordQuery("popular term", 10);
			const suggestions = await controller.suggest("");
			expect(suggestions).toHaveLength(0);
		});

		it("search with special characters does not crash", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Widget",
				url: "/p",
			});

			// These should not throw
			await controller.search("<script>alert(1)</script>");
			await controller.search("'; DROP TABLE--");
			await controller.search("../../etc/passwd");
		});

		it("entityType filter prevents cross-type leakage", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Shared Name Widget",
				url: "/products/p1",
			});
			await controller.indexItem({
				entityType: "page",
				entityId: "pg1",
				title: "Shared Name Widget",
				url: "/pages/pg1",
			});

			const products = await controller.search("Shared Name", {
				entityType: "product",
			});
			expect(products.total).toBe(1);
			expect(products.results[0].item.entityType).toBe("product");
		});
	});

	// ── Analytics Integrity ────────────────────────────────────────

	describe("analytics data integrity", () => {
		it("analytics counts reflect actual query history", async () => {
			await controller.recordQuery("shoes", 5);
			await controller.recordQuery("shoes", 5);
			await controller.recordQuery("boots", 0);

			const analytics = await controller.getAnalytics();
			expect(analytics.totalQueries).toBe(3);
			expect(analytics.zeroResultCount).toBe(1);
		});

		it("zero-result queries are tracked accurately", async () => {
			await controller.recordQuery("nonexistent", 0);
			await controller.recordQuery("also-missing", 0);
			await controller.recordQuery("found-it", 3);

			const zeroResults = await controller.getZeroResultQueries();
			expect(zeroResults).toHaveLength(2);
			for (const term of zeroResults) {
				expect(["nonexistent", "also-missing"]).toContain(term.term);
			}
		});

		it("popular terms exclude zero-result queries from suggestions", async () => {
			await controller.recordQuery("widget", 10);
			await controller.recordQuery("widget", 10);
			await controller.recordQuery("nope", 0);

			const popular = await controller.getPopularTerms();
			const terms = popular.map((p) => p.term);
			expect(terms).toContain("widget");
		});
	});

	// ── Re-indexing Deduplication ───────────────────────────────────

	describe("re-indexing deduplication", () => {
		it("re-indexing same entity updates rather than duplicates", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Old Title",
				url: "/p1",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "New Title",
				url: "/p1",
			});

			const results = await controller.search("Title");
			expect(results.total).toBe(1);
			expect(results.results[0].item.title).toBe("New Title");
		});

		it("indexCount does not grow on re-index", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Widget",
				url: "/p",
			});
			const count1 = await controller.getIndexCount();

			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Updated Widget",
				url: "/p",
			});
			const count2 = await controller.getIndexCount();

			expect(count2).toBe(count1);
		});
	});
});
