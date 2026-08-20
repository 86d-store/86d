import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFaqControllers } from "../service-impl";

describe("faq controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFaqControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFaqControllers(mockData);
	});

	// ── Category edge cases ──────────────────────────────────────────

	describe("category — edge cases", () => {
		it("deleteCategory with no items does not throw", async () => {
			const cat = await controller.createCategory({
				name: "Empty",
				slug: "empty",
			});
			await controller.deleteCategory(cat.id);
			const found = await controller.getCategory(cat.id);
			expect(found).toBeNull();
		});

		it("updateCategory preserves unmodified fields", async () => {
			const cat = await controller.createCategory({
				name: "Original",
				slug: "original",
				description: "Keep me",
				icon: "Star",
				position: 5,
			});

			const updated = await controller.updateCategory(cat.id, {
				name: "Changed",
			});
			expect(updated.name).toBe("Changed");
			expect(updated.slug).toBe("original");
			expect(updated.description).toBe("Keep me");
			expect(updated.icon).toBe("Star");
			expect(updated.position).toBe(5);
		});

		it("creates categories with same position and sorts stably", async () => {
			await controller.createCategory({
				name: "A",
				slug: "a",
				position: 0,
			});
			await controller.createCategory({
				name: "B",
				slug: "b",
				position: 0,
			});

			const cats = await controller.listCategories();
			expect(cats).toHaveLength(2);
		});

		it("listCategories returns empty for no categories", async () => {
			const cats = await controller.listCategories();
			expect(cats).toHaveLength(0);
		});
	});

	// ── Item edge cases ──────────────────────────────────────────────

	describe("item — edge cases", () => {
		it("updateItem preserves unmodified fields", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Original Q?",
				answer: "Original A",
				slug: "original",
				tags: ["keep"],
				position: 3,
			});

			const updated = await controller.updateItem(item.id, {
				question: "New Q?",
			});
			expect(updated.question).toBe("New Q?");
			expect(updated.answer).toBe("Original A");
			expect(updated.slug).toBe("original");
			expect(updated.tags).toEqual(["keep"]);
			expect(updated.position).toBe(3);
		});

		it("moves item between categories", async () => {
			const cat1 = await controller.createCategory({
				name: "Cat1",
				slug: "cat1",
			});
			const cat2 = await controller.createCategory({
				name: "Cat2",
				slug: "cat2",
			});
			const item = await controller.createItem({
				categoryId: cat1.id,
				question: "Movable",
				answer: "A",
				slug: "movable",
			});

			await controller.updateItem(item.id, { categoryId: cat2.id });

			const cat1Items = await controller.listItems({ categoryId: cat1.id });
			const cat2Items = await controller.listItems({ categoryId: cat2.id });
			expect(cat1Items).toHaveLength(0);
			expect(cat2Items).toHaveLength(1);
			expect(cat2Items[0].question).toBe("Movable");
		});

		it("listItems returns empty when no items", async () => {
			const items = await controller.listItems();
			expect(items).toHaveLength(0);
		});

		it("createItem with empty tags array", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Q?",
				answer: "A",
				slug: "q",
				tags: [],
			});
			expect(item.tags).toEqual([]);
		});
	});

	// ── Search edge cases ────────────────────────────────────────────

	describe("search — edge cases", () => {
		let catId: string;

		beforeEach(async () => {
			const cat = await controller.createCategory({
				name: "General",
				slug: "general",
			});
			catId = cat.id;
		});

		it("returns empty for whitespace-only query", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "Something?",
				answer: "Answer",
				slug: "something",
			});
			const results = await controller.search("   ");
			expect(results).toHaveLength(0);
		});

		it("excludes hidden items from search", async () => {
			const item = await controller.createItem({
				categoryId: catId,
				question: "Hidden question?",
				answer: "Hidden answer",
				slug: "hidden",
			});
			await controller.updateItem(item.id, { isVisible: false });

			const results = await controller.search("hidden");
			expect(results).toHaveLength(0);
		});

		it("case-insensitive search", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "How do I RETURN items?",
				answer: "Use the returns page",
				slug: "return",
			});

			const results = await controller.search("return");
			expect(results).toHaveLength(1);
		});

		it("single character words are skipped in word matching", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "How do I get a refund?",
				answer: "Contact support",
				slug: "refund",
			});

			// "I" is a single char, should be skipped, but "refund" should match
			const results = await controller.search("I refund");
			expect(results.length).toBeGreaterThan(0);
		});

		it("search with default limit of 20", async () => {
			for (let i = 0; i < 25; i++) {
				await controller.createItem({
					categoryId: catId,
					question: `Order question ${i}?`,
					answer: `Answer about orders ${i}`,
					slug: `order-${i}`,
				});
			}

			const results = await controller.search("order");
			expect(results.length).toBeLessThanOrEqual(20);
		});
	});

	// ── Vote edge cases ──────────────────────────────────────────────

	describe("vote — edge cases", () => {
		it("multiple votes accumulate independently", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Q?",
				answer: "A",
				slug: "q",
			});

			for (let i = 0; i < 5; i++) {
				await controller.vote(item.id, true);
			}
			for (let i = 0; i < 3; i++) {
				await controller.vote(item.id, false);
			}

			const updated = await controller.getItem(item.id);
			expect(updated?.helpfulCount).toBe(5);
			expect(updated?.notHelpfulCount).toBe(3);
		});
	});

	// ── Stats edge cases ─────────────────────────────────────────────

	describe("getStats — edge cases", () => {
		it("stats reflect votes across multiple items", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			const item1 = await controller.createItem({
				categoryId: cat.id,
				question: "Q1?",
				answer: "A1",
				slug: "q1",
			});
			const item2 = await controller.createItem({
				categoryId: cat.id,
				question: "Q2?",
				answer: "A2",
				slug: "q2",
			});

			await controller.vote(item1.id, true);
			await controller.vote(item1.id, true);
			await controller.vote(item2.id, false);
			await controller.vote(item2.id, true);

			const stats = await controller.getStats();
			expect(stats.totalCategories).toBe(1);
			expect(stats.totalItems).toBe(2);
			expect(stats.totalHelpful).toBe(3);
			expect(stats.totalNotHelpful).toBe(1);
		});

		it("stats after deleting items", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Q?",
				answer: "A",
				slug: "q",
			});
			await controller.vote(item.id, true);
			await controller.deleteItem(item.id);

			const stats = await controller.getStats();
			expect(stats.totalItems).toBe(0);
			expect(stats.totalHelpful).toBe(0);
		});
	});
});

describe("faq controllers — additional coverage", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFaqControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFaqControllers(mockData);
	});

	// ── getCategoryBySlug ────────────────────────────────────────────

	describe("getCategoryBySlug", () => {
		it("returns the category when slug exists", async () => {
			const cat = await controller.createCategory({
				name: "Shipping",
				slug: "shipping",
				description: "Shipping questions",
				icon: "Truck",
			});

			const found = await controller.getCategoryBySlug("shipping");
			expect(found).not.toBeNull();
			expect(found?.id).toBe(cat.id);
			expect(found?.name).toBe("Shipping");
			expect(found?.slug).toBe("shipping");
			expect(found?.description).toBe("Shipping questions");
			expect(found?.icon).toBe("Truck");
		});

		it("returns null when slug does not exist", async () => {
			const found = await controller.getCategoryBySlug("nonexistent");
			expect(found).toBeNull();
		});

		it("returns null when slug is empty string", async () => {
			const found = await controller.getCategoryBySlug("");
			expect(found).toBeNull();
		});

		it("distinguishes between similar slugs", async () => {
			await controller.createCategory({
				name: "Returns",
				slug: "returns",
			});
			await controller.createCategory({
				name: "Returns Policy",
				slug: "returns-policy",
			});

			const found = await controller.getCategoryBySlug("returns");
			expect(found).not.toBeNull();
			expect(found?.slug).toBe("returns");
			expect(found?.name).toBe("Returns");
		});

		it("returns the first match when multiple categories share a slug", async () => {
			await controller.createCategory({
				name: "First",
				slug: "duplicate-slug",
			});
			await controller.createCategory({
				name: "Second",
				slug: "duplicate-slug",
			});

			const found = await controller.getCategoryBySlug("duplicate-slug");
			expect(found).not.toBeNull();
			expect(found?.slug).toBe("duplicate-slug");
		});
	});

	// ── getItemBySlug ────────────────────────────────────────────────

	describe("getItemBySlug", () => {
		let catId: string;

		beforeEach(async () => {
			const cat = await controller.createCategory({
				name: "General",
				slug: "general",
			});
			catId = cat.id;
		});

		it("returns the item when slug exists", async () => {
			const item = await controller.createItem({
				categoryId: catId,
				question: "How to ship?",
				answer: "Use our shipping page",
				slug: "how-to-ship",
				tags: ["shipping", "delivery"],
			});

			const found = await controller.getItemBySlug("how-to-ship");
			expect(found).not.toBeNull();
			expect(found?.id).toBe(item.id);
			expect(found?.question).toBe("How to ship?");
			expect(found?.answer).toBe("Use our shipping page");
			expect(found?.slug).toBe("how-to-ship");
			expect(found?.tags).toEqual(["shipping", "delivery"]);
		});

		it("returns null when slug does not exist", async () => {
			const found = await controller.getItemBySlug("nonexistent-item");
			expect(found).toBeNull();
		});

		it("returns null when no items exist at all", async () => {
			const found = await controller.getItemBySlug("anything");
			expect(found).toBeNull();
		});

		it("finds item by slug regardless of category", async () => {
			const cat2 = await controller.createCategory({
				name: "Other",
				slug: "other",
			});
			await controller.createItem({
				categoryId: cat2.id,
				question: "Other Q?",
				answer: "Other A",
				slug: "other-item",
			});

			const found = await controller.getItemBySlug("other-item");
			expect(found).not.toBeNull();
			expect(found?.categoryId).toBe(cat2.id);
		});
	});

	// ── listCategories with visibleOnly ──────────────────────────────

	describe("listCategories — visibleOnly", () => {
		it("returns only visible categories when visibleOnly is true", async () => {
			const cat1 = await controller.createCategory({
				name: "Visible",
				slug: "visible",
			});
			const cat2 = await controller.createCategory({
				name: "Hidden",
				slug: "hidden",
			});

			await controller.updateCategory(cat2.id, { isVisible: false });

			const visible = await controller.listCategories({ visibleOnly: true });
			expect(visible).toHaveLength(1);
			expect(visible[0].id).toBe(cat1.id);
			expect(visible[0].name).toBe("Visible");
		});

		it("returns all categories when visibleOnly is false", async () => {
			await controller.createCategory({ name: "A", slug: "a" });
			const cat2 = await controller.createCategory({
				name: "B",
				slug: "b",
			});
			await controller.updateCategory(cat2.id, { isVisible: false });

			const all = await controller.listCategories({ visibleOnly: false });
			expect(all).toHaveLength(2);
		});

		it("returns all categories when visibleOnly is not specified", async () => {
			await controller.createCategory({ name: "A", slug: "a" });
			const cat2 = await controller.createCategory({
				name: "B",
				slug: "b",
			});
			await controller.updateCategory(cat2.id, { isVisible: false });

			const all = await controller.listCategories();
			expect(all).toHaveLength(2);
		});

		it("returns empty when all categories are hidden and visibleOnly is true", async () => {
			const cat1 = await controller.createCategory({
				name: "A",
				slug: "a",
			});
			const cat2 = await controller.createCategory({
				name: "B",
				slug: "b",
			});
			await controller.updateCategory(cat1.id, { isVisible: false });
			await controller.updateCategory(cat2.id, { isVisible: false });

			const visible = await controller.listCategories({ visibleOnly: true });
			expect(visible).toHaveLength(0);
		});

		it("respects position ordering with visibleOnly", async () => {
			await controller.createCategory({
				name: "Third",
				slug: "third",
				position: 3,
			});
			await controller.createCategory({
				name: "First",
				slug: "first",
				position: 1,
			});
			await controller.createCategory({
				name: "Second",
				slug: "second",
				position: 2,
			});

			const cats = await controller.listCategories({ visibleOnly: true });
			expect(cats).toHaveLength(3);
			expect(cats[0].name).toBe("First");
			expect(cats[1].name).toBe("Second");
			expect(cats[2].name).toBe("Third");
		});
	});

	// ── listItems with visibleOnly ───────────────────────────────────

	describe("listItems — visibleOnly", () => {
		let catId: string;

		beforeEach(async () => {
			const cat = await controller.createCategory({
				name: "General",
				slug: "general",
			});
			catId = cat.id;
		});

		it("returns only visible items when visibleOnly is true", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "Visible Q?",
				answer: "A",
				slug: "visible",
			});
			const hidden = await controller.createItem({
				categoryId: catId,
				question: "Hidden Q?",
				answer: "A",
				slug: "hidden",
			});
			await controller.updateItem(hidden.id, { isVisible: false });

			const items = await controller.listItems({
				categoryId: catId,
				visibleOnly: true,
			});
			expect(items).toHaveLength(1);
			expect(items[0].question).toBe("Visible Q?");
		});

		it("returns all items when visibleOnly is false", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "Q1?",
				answer: "A1",
				slug: "q1",
			});
			const hidden = await controller.createItem({
				categoryId: catId,
				question: "Q2?",
				answer: "A2",
				slug: "q2",
			});
			await controller.updateItem(hidden.id, { isVisible: false });

			const items = await controller.listItems({
				categoryId: catId,
				visibleOnly: false,
			});
			expect(items).toHaveLength(2);
		});

		it("visibleOnly without categoryId filters across all categories", async () => {
			const cat2 = await controller.createCategory({
				name: "Other",
				slug: "other",
			});

			await controller.createItem({
				categoryId: catId,
				question: "Q1?",
				answer: "A1",
				slug: "q1",
			});
			const hidden = await controller.createItem({
				categoryId: cat2.id,
				question: "Q2?",
				answer: "A2",
				slug: "q2",
			});
			await controller.updateItem(hidden.id, { isVisible: false });

			const items = await controller.listItems({ visibleOnly: true });
			expect(items).toHaveLength(1);
			expect(items[0].question).toBe("Q1?");
		});

		it("returns empty when all items are hidden and visibleOnly is true", async () => {
			const item1 = await controller.createItem({
				categoryId: catId,
				question: "Q1?",
				answer: "A1",
				slug: "q1",
			});
			const item2 = await controller.createItem({
				categoryId: catId,
				question: "Q2?",
				answer: "A2",
				slug: "q2",
			});
			await controller.updateItem(item1.id, { isVisible: false });
			await controller.updateItem(item2.id, { isVisible: false });

			const items = await controller.listItems({
				categoryId: catId,
				visibleOnly: true,
			});
			expect(items).toHaveLength(0);
		});
	});

	// ── search with categoryId ───────────────────────────────────────

	describe("search — categoryId filter", () => {
		let cat1Id: string;
		let cat2Id: string;

		beforeEach(async () => {
			const cat1 = await controller.createCategory({
				name: "Shipping",
				slug: "shipping",
			});
			const cat2 = await controller.createCategory({
				name: "Billing",
				slug: "billing",
			});
			cat1Id = cat1.id;
			cat2Id = cat2.id;

			await controller.createItem({
				categoryId: cat1Id,
				question: "How long does shipping take?",
				answer: "3-5 business days",
				slug: "shipping-time",
			});
			await controller.createItem({
				categoryId: cat2Id,
				question: "How do I update my billing address?",
				answer: "Go to account settings",
				slug: "billing-address",
			});
			await controller.createItem({
				categoryId: cat1Id,
				question: "Can I track my shipping?",
				answer: "Yes, use the tracking page",
				slug: "track-shipping",
			});
		});

		it("returns only items from the specified category", async () => {
			const results = await controller.search("shipping", {
				categoryId: cat1Id,
			});
			expect(results.length).toBeGreaterThan(0);
			for (const r of results) {
				expect(r.categoryId).toBe(cat1Id);
			}
		});

		it("returns empty when query matches items in a different category", async () => {
			const results = await controller.search("billing", {
				categoryId: cat1Id,
			});
			expect(results).toHaveLength(0);
		});

		it("returns results across all categories when categoryId is omitted", async () => {
			const results = await controller.search("how");
			expect(results.length).toBeGreaterThanOrEqual(2);
		});
	});

	// ── search with limit ────────────────────────────────────────────

	describe("search — limit parameter", () => {
		let catId: string;

		beforeEach(async () => {
			const cat = await controller.createCategory({
				name: "General",
				slug: "general",
			});
			catId = cat.id;

			for (let i = 0; i < 10; i++) {
				await controller.createItem({
					categoryId: catId,
					question: `Shipping question ${i}?`,
					answer: `Answer about shipping ${i}`,
					slug: `shipping-q-${i}`,
				});
			}
		});

		it("respects a custom limit smaller than result set", async () => {
			const results = await controller.search("shipping", { limit: 3 });
			expect(results).toHaveLength(3);
		});

		it("returns all matching items when limit exceeds result set", async () => {
			const results = await controller.search("shipping", { limit: 100 });
			expect(results).toHaveLength(10);
		});

		it("returns single item with limit of 1", async () => {
			const results = await controller.search("shipping", { limit: 1 });
			expect(results).toHaveLength(1);
		});

		it("uses default limit of 20 when not specified", async () => {
			const results = await controller.search("shipping");
			expect(results.length).toBeLessThanOrEqual(20);
			expect(results).toHaveLength(10);
		});
	});

	// ── search matching by tag ───────────────────────────────────────

	describe("search — tag matching", () => {
		let catId: string;

		beforeEach(async () => {
			const cat = await controller.createCategory({
				name: "General",
				slug: "general",
			});
			catId = cat.id;
		});

		it("matches items by tag content", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "What is your policy?",
				answer: "See our terms page",
				slug: "policy",
				tags: ["refund", "returns"],
			});

			const results = await controller.search("refund");
			expect(results).toHaveLength(1);
			expect(results[0].slug).toBe("policy");
		});

		it("tag match scores higher than answer-only match", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "Unrelated question?",
				answer: "Some text mentioning warranty info",
				slug: "answer-match",
			});
			await controller.createItem({
				categoryId: catId,
				question: "Another question?",
				answer: "No relevant text here",
				slug: "tag-match",
				tags: ["warranty"],
			});

			const results = await controller.search("warranty");
			expect(results).toHaveLength(2);
			expect(results[0].slug).toBe("tag-match");
		});

		it("matches partial tag content", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "How to return?",
				answer: "Follow instructions",
				slug: "return-item",
				tags: ["international-shipping"],
			});

			const results = await controller.search("international");
			expect(results).toHaveLength(1);
			expect(results[0].slug).toBe("return-item");
		});

		it("tag matching is case-insensitive", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "Unrelated?",
				answer: "Nothing relevant",
				slug: "tagged",
				tags: ["Express-Delivery"],
			});

			const results = await controller.search("express-delivery");
			expect(results).toHaveLength(1);
		});

		it("items with no tags do not cause errors in search", async () => {
			await controller.createItem({
				categoryId: catId,
				question: "No tags here?",
				answer: "Still searchable by question",
				slug: "no-tags",
			});

			const results = await controller.search("tags");
			expect(results).toHaveLength(1);
			expect(results[0].slug).toBe("no-tags");
		});
	});

	// ── updateCategory — non-existent ID ─────────────────────────────

	describe("updateCategory — non-existent ID", () => {
		it("throws with the correct error message", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			await expect(
				controller.updateCategory(fakeId, { name: "Updated" }),
			).rejects.toThrow(`FAQ category ${fakeId} not found`);
		});

		it("throws for a random UUID", async () => {
			const fakeId = crypto.randomUUID();
			await expect(
				controller.updateCategory(fakeId, { slug: "new-slug" }),
			).rejects.toThrow(`FAQ category ${fakeId} not found`);
		});

		it("does not throw for an existing category", async () => {
			const cat = await controller.createCategory({
				name: "Real",
				slug: "real",
			});
			const updated = await controller.updateCategory(cat.id, {
				name: "Still Real",
			});
			expect(updated.name).toBe("Still Real");
		});
	});

	// ── updateItem — non-existent ID ─────────────────────────────────

	describe("updateItem — non-existent ID", () => {
		it("throws with the correct error message", async () => {
			const fakeId = "11111111-1111-1111-1111-111111111111";
			await expect(
				controller.updateItem(fakeId, { question: "Updated?" }),
			).rejects.toThrow(`FAQ item ${fakeId} not found`);
		});

		it("throws for a random UUID", async () => {
			const fakeId = crypto.randomUUID();
			await expect(
				controller.updateItem(fakeId, { answer: "New answer" }),
			).rejects.toThrow(`FAQ item ${fakeId} not found`);
		});

		it("does not throw for an existing item", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Q?",
				answer: "A",
				slug: "q",
			});
			const updated = await controller.updateItem(item.id, {
				question: "Updated Q?",
			});
			expect(updated.question).toBe("Updated Q?");
		});
	});

	// ── vote — non-existent item ─────────────────────────────────────

	describe("vote — non-existent item", () => {
		it("throws with the correct error message for helpful vote", async () => {
			const fakeId = "22222222-2222-2222-2222-222222222222";
			await expect(controller.vote(fakeId, true)).rejects.toThrow(
				`FAQ item ${fakeId} not found`,
			);
		});

		it("throws with the correct error message for not-helpful vote", async () => {
			const fakeId = crypto.randomUUID();
			await expect(controller.vote(fakeId, false)).rejects.toThrow(
				`FAQ item ${fakeId} not found`,
			);
		});

		it("does not throw for an existing item", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Q?",
				answer: "A",
				slug: "q",
			});
			const voted = await controller.vote(item.id, true);
			expect(voted.helpfulCount).toBe(1);
		});
	});

	// ── deleteCategory — cascade deletion ────────────────────────────

	describe("deleteCategory — cascade deletion", () => {
		it("deletes all items belonging to the category", async () => {
			const cat = await controller.createCategory({
				name: "Doomed",
				slug: "doomed",
			});

			const item1 = await controller.createItem({
				categoryId: cat.id,
				question: "Q1?",
				answer: "A1",
				slug: "q1",
			});
			const item2 = await controller.createItem({
				categoryId: cat.id,
				question: "Q2?",
				answer: "A2",
				slug: "q2",
			});
			const item3 = await controller.createItem({
				categoryId: cat.id,
				question: "Q3?",
				answer: "A3",
				slug: "q3",
			});

			await controller.deleteCategory(cat.id);

			const foundItem1 = await controller.getItem(item1.id);
			const foundItem2 = await controller.getItem(item2.id);
			const foundItem3 = await controller.getItem(item3.id);
			expect(foundItem1).toBeNull();
			expect(foundItem2).toBeNull();
			expect(foundItem3).toBeNull();
		});

		it("does not affect items in other categories", async () => {
			const cat1 = await controller.createCategory({
				name: "Delete Me",
				slug: "delete-me",
			});
			const cat2 = await controller.createCategory({
				name: "Keep Me",
				slug: "keep-me",
			});

			await controller.createItem({
				categoryId: cat1.id,
				question: "Doomed Q?",
				answer: "Doomed A",
				slug: "doomed",
			});
			const keepItem = await controller.createItem({
				categoryId: cat2.id,
				question: "Survivor Q?",
				answer: "Survivor A",
				slug: "survivor",
			});

			await controller.deleteCategory(cat1.id);

			const found = await controller.getItem(keepItem.id);
			expect(found).not.toBeNull();
			expect(found?.question).toBe("Survivor Q?");
		});

		it("deletes the category itself after items", async () => {
			const cat = await controller.createCategory({
				name: "Ephemeral",
				slug: "ephemeral",
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "Q?",
				answer: "A",
				slug: "q",
			});

			await controller.deleteCategory(cat.id);

			const found = await controller.getCategory(cat.id);
			expect(found).toBeNull();
		});

		it("stats reflect cascade deletion correctly", async () => {
			const cat = await controller.createCategory({
				name: "Temp",
				slug: "temp",
			});
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Q?",
				answer: "A",
				slug: "q",
			});
			await controller.vote(item.id, true);
			await controller.vote(item.id, true);

			await controller.deleteCategory(cat.id);

			const stats = await controller.getStats();
			expect(stats.totalCategories).toBe(0);
			expect(stats.totalItems).toBe(0);
			expect(stats.totalHelpful).toBe(0);
		});

		it("cascade deletion handles many items efficiently", async () => {
			const cat = await controller.createCategory({
				name: "Many Items",
				slug: "many-items",
			});

			for (let i = 0; i < 20; i++) {
				await controller.createItem({
					categoryId: cat.id,
					question: `Question ${i}?`,
					answer: `Answer ${i}`,
					slug: `q-${i}`,
				});
			}

			await controller.deleteCategory(cat.id);

			const items = await controller.listItems({ categoryId: cat.id });
			expect(items).toHaveLength(0);
			const found = await controller.getCategory(cat.id);
			expect(found).toBeNull();
		});

		it("getCategoryBySlug returns null after category deletion", async () => {
			const cat = await controller.createCategory({
				name: "Slug Target",
				slug: "slug-target",
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "Q?",
				answer: "A",
				slug: "q",
			});

			await controller.deleteCategory(cat.id);

			const found = await controller.getCategoryBySlug("slug-target");
			expect(found).toBeNull();
		});
	});

	// ── search — combined filters ────────────────────────────────────

	describe("search — combined categoryId and limit", () => {
		let catId: string;

		beforeEach(async () => {
			const cat = await controller.createCategory({
				name: "Combined",
				slug: "combined",
			});
			catId = cat.id;

			for (let i = 0; i < 8; i++) {
				await controller.createItem({
					categoryId: catId,
					question: `Payment question ${i}?`,
					answer: `Payment answer ${i}`,
					slug: `payment-${i}`,
					tags: ["payment"],
				});
			}

			const otherCat = await controller.createCategory({
				name: "Other",
				slug: "other",
			});
			for (let i = 0; i < 5; i++) {
				await controller.createItem({
					categoryId: otherCat.id,
					question: `Payment other ${i}?`,
					answer: `Payment other answer ${i}`,
					slug: `payment-other-${i}`,
				});
			}
		});

		it("applies both categoryId and limit together", async () => {
			const results = await controller.search("payment", {
				categoryId: catId,
				limit: 3,
			});
			expect(results).toHaveLength(3);
			for (const r of results) {
				expect(r.categoryId).toBe(catId);
			}
		});

		it("categoryId filter reduces results below limit", async () => {
			const results = await controller.search("payment", {
				categoryId: catId,
				limit: 50,
			});
			expect(results).toHaveLength(8);
		});
	});
});
