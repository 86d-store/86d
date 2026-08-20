import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFaqControllers } from "../service-impl";

describe("createFaqControllers", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFaqControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFaqControllers(mockData);
	});

	// --- Category CRUD ---

	describe("createCategory", () => {
		it("creates a category with required fields", async () => {
			const cat = await controller.createCategory({
				name: "Shipping",
				slug: "shipping",
			});

			expect(cat.name).toBe("Shipping");
			expect(cat.slug).toBe("shipping");
			expect(cat.isVisible).toBe(true);
			expect(cat.position).toBe(0);
			expect(cat.id).toBeTruthy();
			expect(cat.createdAt).toBeInstanceOf(Date);
		});

		it("creates a category with optional fields", async () => {
			const cat = await controller.createCategory({
				name: "Returns",
				slug: "returns",
				description: "Everything about returns",
				icon: "ArrowLeft",
				position: 5,
			});

			expect(cat.description).toBe("Everything about returns");
			expect(cat.icon).toBe("ArrowLeft");
			expect(cat.position).toBe(5);
		});

		it("assigns unique IDs to each category", async () => {
			const a = await controller.createCategory({
				name: "A",
				slug: "a",
			});
			const b = await controller.createCategory({
				name: "B",
				slug: "b",
			});

			expect(a.id).not.toBe(b.id);
		});
	});

	describe("getCategory", () => {
		it("returns a category by ID", async () => {
			const created = await controller.createCategory({
				name: "Payments",
				slug: "payments",
			});

			const found = await controller.getCategory(created.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Payments");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getCategory("does-not-exist");
			expect(found).toBeNull();
		});
	});

	describe("getCategoryBySlug", () => {
		it("returns a category by slug", async () => {
			await controller.createCategory({
				name: "Orders",
				slug: "orders",
			});

			const found = await controller.getCategoryBySlug("orders");
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Orders");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getCategoryBySlug("nope");
			expect(found).toBeNull();
		});
	});

	describe("listCategories", () => {
		it("returns all categories sorted by position", async () => {
			await controller.createCategory({
				name: "C",
				slug: "c",
				position: 3,
			});
			await controller.createCategory({
				name: "A",
				slug: "a",
				position: 1,
			});
			await controller.createCategory({
				name: "B",
				slug: "b",
				position: 2,
			});

			const cats = await controller.listCategories();
			expect(cats).toHaveLength(3);
			expect(cats[0].name).toBe("A");
			expect(cats[1].name).toBe("B");
			expect(cats[2].name).toBe("C");
		});

		it("filters to visible-only when requested", async () => {
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
			expect(all).toHaveLength(2);

			const visibleOnly = await controller.listCategories({
				visibleOnly: true,
			});
			expect(visibleOnly).toHaveLength(1);
			expect(visibleOnly[0].name).toBe("Visible");
		});
	});

	describe("updateCategory", () => {
		it("updates category fields", async () => {
			const cat = await controller.createCategory({
				name: "Old Name",
				slug: "old-name",
			});

			const updated = await controller.updateCategory(cat.id, {
				name: "New Name",
				slug: "new-name",
				description: "Updated desc",
			});

			expect(updated.name).toBe("New Name");
			expect(updated.slug).toBe("new-name");
			expect(updated.description).toBe("Updated desc");
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				cat.updatedAt.getTime(),
			);
		});

		it("throws when category not found", async () => {
			await expect(
				controller.updateCategory("missing", { name: "X" }),
			).rejects.toThrow("FAQ category missing not found");
		});
	});

	describe("deleteCategory", () => {
		it("deletes a category", async () => {
			const cat = await controller.createCategory({
				name: "ToDelete",
				slug: "to-delete",
			});

			await controller.deleteCategory(cat.id);
			const found = await controller.getCategory(cat.id);
			expect(found).toBeNull();
		});

		it("cascades deletion to items in the category", async () => {
			const cat = await controller.createCategory({
				name: "Parent",
				slug: "parent",
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

			await controller.deleteCategory(cat.id);

			const items = await controller.listItems({ categoryId: cat.id });
			expect(items).toHaveLength(0);
		});
	});

	// --- Item CRUD ---

	describe("createItem", () => {
		it("creates an item with required fields", async () => {
			const cat = await controller.createCategory({
				name: "General",
				slug: "general",
			});

			const item = await controller.createItem({
				categoryId: cat.id,
				question: "How do I return a product?",
				answer: "Visit your order page and click Return.",
				slug: "how-to-return",
			});

			expect(item.question).toBe("How do I return a product?");
			expect(item.answer).toBe("Visit your order page and click Return.");
			expect(item.slug).toBe("how-to-return");
			expect(item.categoryId).toBe(cat.id);
			expect(item.isVisible).toBe(true);
			expect(item.helpfulCount).toBe(0);
			expect(item.notHelpfulCount).toBe(0);
		});

		it("creates an item with optional fields", async () => {
			const cat = await controller.createCategory({
				name: "Shipping",
				slug: "shipping",
			});

			const item = await controller.createItem({
				categoryId: cat.id,
				question: "How long does shipping take?",
				answer: "3-5 business days.",
				slug: "shipping-time",
				position: 10,
				tags: ["shipping", "delivery", "time"],
			});

			expect(item.position).toBe(10);
			expect(item.tags).toEqual(["shipping", "delivery", "time"]);
		});
	});

	describe("getItem", () => {
		it("returns an item by ID", async () => {
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

			const found = await controller.getItem(item.id);
			expect(found).not.toBeNull();
			expect(found?.question).toBe("Q?");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getItem("nope");
			expect(found).toBeNull();
		});
	});

	describe("getItemBySlug", () => {
		it("returns an item by slug", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "What is this?",
				answer: "A FAQ module.",
				slug: "what-is-this",
			});

			const found = await controller.getItemBySlug("what-is-this");
			expect(found).not.toBeNull();
			expect(found?.question).toBe("What is this?");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getItemBySlug("nope");
			expect(found).toBeNull();
		});
	});

	describe("listItems", () => {
		it("lists all items sorted by position", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});

			await controller.createItem({
				categoryId: cat.id,
				question: "Third",
				answer: "A3",
				slug: "third",
				position: 3,
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "First",
				answer: "A1",
				slug: "first",
				position: 1,
			});
			await controller.createItem({
				categoryId: cat.id,
				question: "Second",
				answer: "A2",
				slug: "second",
				position: 2,
			});

			const items = await controller.listItems({ categoryId: cat.id });
			expect(items).toHaveLength(3);
			expect(items[0].question).toBe("First");
			expect(items[1].question).toBe("Second");
			expect(items[2].question).toBe("Third");
		});

		it("filters by category", async () => {
			const catA = await controller.createCategory({
				name: "A",
				slug: "a",
			});
			const catB = await controller.createCategory({
				name: "B",
				slug: "b",
			});

			await controller.createItem({
				categoryId: catA.id,
				question: "In A",
				answer: "A",
				slug: "in-a",
			});
			await controller.createItem({
				categoryId: catB.id,
				question: "In B",
				answer: "B",
				slug: "in-b",
			});

			const itemsA = await controller.listItems({
				categoryId: catA.id,
			});
			expect(itemsA).toHaveLength(1);
			expect(itemsA[0].question).toBe("In A");
		});

		it("filters to visible-only when requested", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});

			await controller.createItem({
				categoryId: cat.id,
				question: "Visible",
				answer: "V",
				slug: "visible",
			});
			const hidden = await controller.createItem({
				categoryId: cat.id,
				question: "Hidden",
				answer: "H",
				slug: "hidden",
			});
			await controller.updateItem(hidden.id, { isVisible: false });

			const visibleOnly = await controller.listItems({
				categoryId: cat.id,
				visibleOnly: true,
			});
			expect(visibleOnly).toHaveLength(1);
			expect(visibleOnly[0].question).toBe("Visible");
		});
	});

	describe("updateItem", () => {
		it("updates item fields", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "Old Q?",
				answer: "Old A",
				slug: "old-q",
			});

			const updated = await controller.updateItem(item.id, {
				question: "New Q?",
				answer: "New A",
				tags: ["updated"],
			});

			expect(updated.question).toBe("New Q?");
			expect(updated.answer).toBe("New A");
			expect(updated.tags).toEqual(["updated"]);
		});

		it("throws when item not found", async () => {
			await expect(
				controller.updateItem("missing", { question: "X?" }),
			).rejects.toThrow("FAQ item missing not found");
		});
	});

	describe("deleteItem", () => {
		it("deletes an item", async () => {
			const cat = await controller.createCategory({
				name: "Cat",
				slug: "cat",
			});
			const item = await controller.createItem({
				categoryId: cat.id,
				question: "ToDelete",
				answer: "D",
				slug: "to-delete",
			});

			await controller.deleteItem(item.id);
			const found = await controller.getItem(item.id);
			expect(found).toBeNull();
		});
	});

	// --- Search ---

	describe("search", () => {
		let catId: string;

		beforeEach(async () => {
			const cat = await controller.createCategory({
				name: "General",
				slug: "general",
			});
			catId = cat.id;

			await controller.createItem({
				categoryId: catId,
				question: "How do I track my order?",
				answer: "Go to your orders page and click Track.",
				slug: "track-order",
				tags: ["orders", "tracking"],
			});
			await controller.createItem({
				categoryId: catId,
				question: "What is your return policy?",
				answer: "You can return items within 30 days of purchase.",
				slug: "return-policy",
				tags: ["returns", "refund"],
			});
			await controller.createItem({
				categoryId: catId,
				question: "How do I change my shipping address?",
				answer: "Edit your address in account settings before order ships.",
				slug: "change-address",
				tags: ["shipping", "address"],
			});
		});

		it("finds items matching question text", async () => {
			const results = await controller.search("track my order");
			expect(results.length).toBeGreaterThan(0);
			expect(results[0].slug).toBe("track-order");
		});

		it("finds items matching answer text", async () => {
			const results = await controller.search("30 days");
			expect(results.length).toBeGreaterThan(0);
			expect(results[0].slug).toBe("return-policy");
		});

		it("finds items matching tags", async () => {
			const results = await controller.search("refund");
			expect(results.length).toBeGreaterThan(0);
			expect(results[0].slug).toBe("return-policy");
		});

		it("returns empty array for no matches", async () => {
			const results = await controller.search("cryptocurrency");
			expect(results).toHaveLength(0);
		});

		it("returns empty array for empty query", async () => {
			const results = await controller.search("");
			expect(results).toHaveLength(0);
		});

		it("respects limit parameter", async () => {
			const results = await controller.search("order", { limit: 1 });
			expect(results).toHaveLength(1);
		});

		it("filters by category", async () => {
			const cat2 = await controller.createCategory({
				name: "Other",
				slug: "other",
			});
			await controller.createItem({
				categoryId: cat2.id,
				question: "Other order question?",
				answer: "Other answer about orders.",
				slug: "other-order",
				tags: ["orders"],
			});

			const results = await controller.search("order", {
				categoryId: catId,
			});
			const slugs = results.map((r) => r.slug);
			expect(slugs).not.toContain("other-order");
		});

		it("ranks question matches higher than answer matches", async () => {
			const results = await controller.search("return");
			// "return policy" should rank higher because "return" is in the question
			expect(results[0].slug).toBe("return-policy");
		});
	});

	// --- Vote ---

	describe("vote", () => {
		it("increments helpful count", async () => {
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
			expect(voted.notHelpfulCount).toBe(0);
		});

		it("increments not-helpful count", async () => {
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

			const voted = await controller.vote(item.id, false);
			expect(voted.helpfulCount).toBe(0);
			expect(voted.notHelpfulCount).toBe(1);
		});

		it("accumulates votes correctly", async () => {
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
			await controller.vote(item.id, true);
			const final = await controller.vote(item.id, false);

			expect(final.helpfulCount).toBe(2);
			expect(final.notHelpfulCount).toBe(1);
		});

		it("throws when item not found", async () => {
			await expect(controller.vote("missing", true)).rejects.toThrow(
				"FAQ item missing not found",
			);
		});
	});

	// --- Stats ---

	describe("getStats", () => {
		it("returns zeros for empty FAQ", async () => {
			const stats = await controller.getStats();
			expect(stats.totalCategories).toBe(0);
			expect(stats.totalItems).toBe(0);
			expect(stats.totalHelpful).toBe(0);
			expect(stats.totalNotHelpful).toBe(0);
		});

		it("returns correct counts after adding data", async () => {
			const cat1 = await controller.createCategory({
				name: "C1",
				slug: "c1",
			});
			const cat2 = await controller.createCategory({
				name: "C2",
				slug: "c2",
			});

			const item1 = await controller.createItem({
				categoryId: cat1.id,
				question: "Q1?",
				answer: "A1",
				slug: "q1",
			});
			await controller.createItem({
				categoryId: cat2.id,
				question: "Q2?",
				answer: "A2",
				slug: "q2",
			});

			await controller.vote(item1.id, true);
			await controller.vote(item1.id, true);
			await controller.vote(item1.id, false);

			const stats = await controller.getStats();
			expect(stats.totalCategories).toBe(2);
			expect(stats.totalItems).toBe(2);
			expect(stats.totalHelpful).toBe(2);
			expect(stats.totalNotHelpful).toBe(1);
		});
	});
});
