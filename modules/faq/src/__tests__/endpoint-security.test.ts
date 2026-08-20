import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFaqControllers } from "../service-impl";

/**
 * Endpoint-security tests for the FAQ module.
 *
 * These tests verify data-integrity invariants that, if broken, could
 * expose stale/orphaned data or leak items across categories:
 *
 * 1. Category isolation: items scoped to their owning categoryId
 * 2. Ordering integrity: position sorting is consistent across operations
 * 3. Slug uniqueness: slug lookups return the correct entity
 * 4. Published vs draft filtering: hidden items excluded from public queries
 * 5. Search scoping: search respects visibility and category boundaries
 * 6. Cascade delete: deleting a category removes all its items
 * 7. Vote integrity: votes accumulate correctly, no cross-item leakage
 */

describe("faq endpoint security", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFaqControllers>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createFaqControllers(data);
	});

	// -- Category Isolation ---------------------------------------------------

	describe("category isolation", () => {
		it("listItems with categoryId returns only items in that category", async () => {
			const catA = await controller.createCategory({
				name: "Shipping",
				slug: "shipping",
			});
			const catB = await controller.createCategory({
				name: "Returns",
				slug: "returns",
			});

			await controller.createItem({
				categoryId: catA.id,
				question: "How long does shipping take?",
				answer: "3-5 days",
				slug: "shipping-time",
			});
			await controller.createItem({
				categoryId: catB.id,
				question: "How do I return an item?",
				answer: "Visit your orders page",
				slug: "return-item",
			});

			const shippingItems = await controller.listItems({ categoryId: catA.id });
			expect(shippingItems).toHaveLength(1);
			expect(shippingItems[0]?.slug).toBe("shipping-time");
		});

		it("deleting a category does not remove items from other categories", async () => {
			const catA = await controller.createCategory({ name: "A", slug: "a" });
			const catB = await controller.createCategory({ name: "B", slug: "b" });

			await controller.createItem({
				categoryId: catA.id,
				question: "Q in A",
				answer: "A",
				slug: "q-in-a",
			});
			await controller.createItem({
				categoryId: catB.id,
				question: "Q in B",
				answer: "B",
				slug: "q-in-b",
			});

			await controller.deleteCategory(catA.id);

			const bItems = await controller.listItems({ categoryId: catB.id });
			expect(bItems).toHaveLength(1);
			expect(bItems[0]?.question).toBe("Q in B");
		});

		it("moving an item to another category updates isolation correctly", async () => {
			const catA = await controller.createCategory({ name: "A", slug: "a" });
			const catB = await controller.createCategory({ name: "B", slug: "b" });

			const item = await controller.createItem({
				categoryId: catA.id,
				question: "Moveable FAQ",
				answer: "This will move",
				slug: "moveable",
			});

			await controller.updateItem(item.id, { categoryId: catB.id });

			const aItems = await controller.listItems({ categoryId: catA.id });
			const bItems = await controller.listItems({ categoryId: catB.id });
			expect(aItems).toHaveLength(0);
			expect(bItems).toHaveLength(1);
			expect(bItems[0]?.slug).toBe("moveable");
		});
	});

	// -- Ordering Integrity ---------------------------------------------------

	describe("ordering integrity", () => {
		it("categories are returned sorted by position", async () => {
			await controller.createCategory({
				name: "Third",
				slug: "third",
				position: 30,
			});
			await controller.createCategory({
				name: "First",
				slug: "first",
				position: 10,
			});
			await controller.createCategory({
				name: "Second",
				slug: "second",
				position: 20,
			});

			const cats = await controller.listCategories();
			expect(cats.map((c) => c.name)).toEqual(["First", "Second", "Third"]);
		});

		it("items are returned sorted by position within a category", async () => {
			const cat = await controller.createCategory({
				name: "General",
				slug: "general",
			});

			await controller.createItem({
				categoryId: cat.id,
				question: "Z-last",
				answer: "last",
				slug: "z-last",
				position: 99,
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "A-first",
				answer: "first",
				slug: "a-first",
				position: 1,
			});

			const items = await controller.listItems({ categoryId: cat.id });
			expect(items[0]?.question).toBe("A-first");
			expect(items[1]?.question).toBe("Z-last");
		});

		it("updating an item position reorders correctly", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });

			const itemA = await controller.createItem({
				categoryId: cat.id,
				question: "Was first",
				answer: "A",
				slug: "was-first",
				position: 1,
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "Was second",
				answer: "B",
				slug: "was-second",
				position: 2,
			});

			await controller.updateItem(itemA.id, { position: 10 });

			const items = await controller.listItems({ categoryId: cat.id });
			expect(items[0]?.slug).toBe("was-second");
			expect(items[1]?.slug).toBe("was-first");
		});
	});

	// -- Slug Uniqueness ------------------------------------------------------

	describe("slug uniqueness", () => {
		it("getCategoryBySlug returns the correct category among many", async () => {
			await controller.createCategory({ name: "Alpha", slug: "alpha" });
			await controller.createCategory({ name: "Beta", slug: "beta" });
			await controller.createCategory({ name: "Gamma", slug: "gamma" });

			const found = await controller.getCategoryBySlug("beta");
			expect(found?.name).toBe("Beta");
		});

		it("getItemBySlug returns the correct item among many", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });

			await controller.createItem({
				categoryId: cat.id,
				question: "First",
				answer: "A1",
				slug: "first-faq",
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "Second",
				answer: "A2",
				slug: "second-faq",
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "Third",
				answer: "A3",
				slug: "third-faq",
			});

			const found = await controller.getItemBySlug("second-faq");
			expect(found?.question).toBe("Second");
		});

		it("updating a category slug makes the old slug unreachable", async () => {
			const cat = await controller.createCategory({
				name: "Old",
				slug: "old-slug",
			});
			await controller.updateCategory(cat.id, { slug: "new-slug" });

			const byOldSlug = await controller.getCategoryBySlug("old-slug");
			const byNewSlug = await controller.getCategoryBySlug("new-slug");
			expect(byOldSlug).toBeNull();
			expect(byNewSlug?.name).toBe("Old");
		});

		it("updating an item slug makes the old slug unreachable", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Q?",
				answer: "A",
				slug: "old-item-slug",
			});

			await controller.updateItem(item.id, { slug: "new-item-slug" });

			const byOld = await controller.getItemBySlug("old-item-slug");
			const byNew = await controller.getItemBySlug("new-item-slug");
			expect(byOld).toBeNull();
			expect(byNew?.question).toBe("Q?");
		});
	});

	// -- Published vs Draft (Visibility) Filtering ----------------------------

	describe("visibility filtering", () => {
		it("listCategories visibleOnly excludes hidden categories", async () => {
			await controller.createCategory({
				name: "Visible",
				slug: "visible",
			});
			const hidden = await controller.createCategory({
				name: "Hidden",
				slug: "hidden",
			});
			await controller.updateCategory(hidden.id, { isVisible: false });

			const all = await controller.listCategories();
			const publicOnly = await controller.listCategories({ visibleOnly: true });

			expect(all).toHaveLength(2);
			expect(publicOnly).toHaveLength(1);
			expect(publicOnly[0]?.slug).toBe("visible");
		});

		it("listItems visibleOnly excludes hidden items", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });

			await controller.createItem({
				categoryId: cat.id,
				question: "Public FAQ",
				answer: "Visible answer",
				slug: "public-faq",
			});
			const draft = await controller.createItem({
				categoryId: cat.id,
				question: "Draft FAQ",
				answer: "Hidden answer",
				slug: "draft-faq",
			});
			await controller.updateItem(draft.id, { isVisible: false });

			const publicItems = await controller.listItems({
				categoryId: cat.id,
				visibleOnly: true,
			});
			expect(publicItems).toHaveLength(1);
			expect(publicItems[0]?.slug).toBe("public-faq");
		});

		it("search only returns visible items, not hidden ones", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });

			await controller.createItem({
				categoryId: cat.id,
				question: "How to reset password?",
				answer: "Click forgot password",
				slug: "reset-password",
			});
			const hidden = await controller.createItem({
				categoryId: cat.id,
				question: "How to reset admin password?",
				answer: "Use CLI reset tool",
				slug: "reset-admin-password",
			});
			await controller.updateItem(hidden.id, { isVisible: false });

			const results = await controller.search("reset password");
			expect(results).toHaveLength(1);
			expect(results[0]?.slug).toBe("reset-password");
		});
	});

	// -- Search Scoping -------------------------------------------------------

	describe("search scoping", () => {
		it("search respects categoryId filter", async () => {
			const catA = await controller.createCategory({
				name: "Billing",
				slug: "billing",
			});
			const catB = await controller.createCategory({
				name: "Tech",
				slug: "tech",
			});

			await controller.createItem({
				categoryId: catA.id,
				question: "How do I pay?",
				answer: "Use credit card or PayPal",
				slug: "how-pay",
				tags: ["payment"],
			});
			await controller.createItem({
				categoryId: catB.id,
				question: "How do I pay for API access?",
				answer: "Use the developer portal",
				slug: "api-pay",
				tags: ["payment", "api"],
			});

			const billingResults = await controller.search("pay", {
				categoryId: catA.id,
			});
			expect(billingResults).toHaveLength(1);
			expect(billingResults[0]?.slug).toBe("how-pay");
		});

		it("search with empty query returns no results", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });
			await controller.createItem({
				categoryId: cat.id,
				question: "Some question",
				answer: "Some answer",
				slug: "some-q",
			});

			const results = await controller.search("   ");
			expect(results).toHaveLength(0);
		});

		it("search limit caps the number of returned results", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });

			for (let i = 0; i < 5; i++) {
				await controller.createItem({
					categoryId: cat.id,
					question: `Shipping question ${i}`,
					answer: `Shipping answer ${i}`,
					slug: `shipping-q-${i}`,
					tags: ["shipping"],
				});
			}

			const limited = await controller.search("shipping", { limit: 2 });
			expect(limited).toHaveLength(2);
		});

		it("search matches tags accurately", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });

			await controller.createItem({
				categoryId: cat.id,
				question: "What cards do you accept?",
				answer: "Visa, Mastercard, Amex",
				slug: "accepted-cards",
				tags: ["payments", "credit-cards"],
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "Do you offer gift cards?",
				answer: "Yes, in $25, $50, and $100 denominations",
				slug: "gift-cards",
				tags: ["gifts", "cards"],
			});

			const results = await controller.search("credit-cards");
			expect(results).toHaveLength(1);
			expect(results[0]?.slug).toBe("accepted-cards");
		});
	});

	// -- Cascade Delete -------------------------------------------------------

	describe("cascade delete", () => {
		it("deleting a category removes all its items", async () => {
			const cat = await controller.createCategory({
				name: "Doomed",
				slug: "doomed",
			});

			await controller.createItem({
				categoryId: cat.id,
				question: "Q1?",
				answer: "A1",
				slug: "q1",
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "Q2?",
				answer: "A2",
				slug: "q2",
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "Q3?",
				answer: "A3",
				slug: "q3",
			});

			await controller.deleteCategory(cat.id);

			const remaining = await controller.listItems({ categoryId: cat.id });
			expect(remaining).toHaveLength(0);
		});

		it("cascade-deleted items are not returned by getItem", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Will be deleted",
				answer: "Gone",
				slug: "will-delete",
			});

			await controller.deleteCategory(cat.id);

			const found = await controller.getItem(item.id);
			expect(found).toBeNull();
		});

		it("cascade-deleted items are not returned by getItemBySlug", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });
			await controller.createItem({
				categoryId: cat.id,
				question: "Slug test",
				answer: "Gone",
				slug: "slug-test",
			});

			await controller.deleteCategory(cat.id);

			const found = await controller.getItemBySlug("slug-test");
			expect(found).toBeNull();
		});
	});

	// -- Vote Integrity -------------------------------------------------------

	describe("vote integrity", () => {
		it("voting on one item does not affect another item's counts", async () => {
			const cat = await controller.createCategory({ name: "Cat", slug: "cat" });

			const itemA = await controller.createItem({
				categoryId: cat.id,
				question: "Item A",
				answer: "A",
				slug: "item-a",
			});
			const itemB = await controller.createItem({
				categoryId: cat.id,
				question: "Item B",
				answer: "B",
				slug: "item-b",
			});

			await controller.vote(itemA.id, true);
			await controller.vote(itemA.id, true);
			await controller.vote(itemA.id, false);

			const freshB = await controller.getItem(itemB.id);
			expect(freshB?.helpfulCount).toBe(0);
			expect(freshB?.notHelpfulCount).toBe(0);
		});

		it("vote on non-existent item throws an error", async () => {
			await expect(controller.vote("non-existent", true)).rejects.toThrow(
				"FAQ item non-existent not found",
			);
		});
	});

	// -- Stats Integrity ------------------------------------------------------

	describe("stats integrity", () => {
		it("stats reflect accurate counts after mixed operations", async () => {
			const cat1 = await controller.createCategory({ name: "C1", slug: "c1" });
			const cat2 = await controller.createCategory({ name: "C2", slug: "c2" });

			const item1 = await controller.createItem({
				categoryId: cat1.id,
				question: "Q1",
				answer: "A1",
				slug: "q1",
			});
			await controller.createItem({
				categoryId: cat2.id,
				question: "Q2",
				answer: "A2",
				slug: "q2",
			});
			const item3 = await controller.createItem({
				categoryId: cat1.id,
				question: "Q3",
				answer: "A3",
				slug: "q3",
			});

			await controller.vote(item1.id, true);
			await controller.vote(item1.id, true);
			await controller.vote(item3.id, false);

			// Delete one item and verify stats update
			await controller.deleteItem(item3.id);

			const stats = await controller.getStats();
			expect(stats.totalCategories).toBe(2);
			expect(stats.totalItems).toBe(2);
			expect(stats.totalHelpful).toBe(2);
			expect(stats.totalNotHelpful).toBe(0);
		});
	});
});
