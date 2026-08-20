import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { FaqCategory, FaqItem } from "../service";
import { createFaqControllers } from "../service-impl";

/**
 * Store endpoint integration tests for the FAQ module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-categories: only visible categories, ordered by position
 * 2. get-category: by slug, only visible; returns items in category
 * 3. get-item: by slug, only visible
 * 4. search: query matching question/answer/tags, category filter, limit
 * 5. vote: increments helpful/not-helpful counts
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListCategories(data: DataService) {
	const controller = createFaqControllers(data);
	const categories = await controller.listCategories({ visibleOnly: true });
	return { categories };
}

async function simulateGetCategory(data: DataService, slug: string) {
	const controller = createFaqControllers(data);
	const category = await controller.getCategoryBySlug(slug);
	if (!category?.isVisible) {
		return { error: "Category not found", status: 404 };
	}
	const items = await controller.listItems({
		categoryId: category.id,
		visibleOnly: true,
	});
	return { category, items };
}

async function simulateGetItem(data: DataService, slug: string) {
	const controller = createFaqControllers(data);
	const item = await controller.getItemBySlug(slug);
	if (!item?.isVisible) {
		return { error: "Item not found", status: 404 };
	}
	return { item };
}

async function simulateSearch(
	data: DataService,
	query: { q: string; categoryId?: string; limit?: number },
) {
	const controller = createFaqControllers(data);
	const items = await controller.search(query.q, {
		categoryId: query.categoryId,
		limit: query.limit ?? 20,
	});
	return { items };
}

async function simulateVote(
	data: DataService,
	itemId: string,
	helpful: boolean,
) {
	const controller = createFaqControllers(data);
	try {
		const item = await controller.vote(itemId, helpful);
		if (!item) return { error: "Item not found", status: 404 };
		return { item };
	} catch {
		return { error: "Item not found", status: 404 };
	}
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list categories — visible only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only visible categories", async () => {
		const ctrl = createFaqControllers(data);
		await ctrl.createCategory({ name: "Shipping", slug: "shipping" });
		const hidden = await ctrl.createCategory({
			name: "Hidden",
			slug: "hidden",
		});
		await ctrl.updateCategory(hidden.id, { isVisible: false });

		const result = await simulateListCategories(data);

		expect(result.categories).toHaveLength(1);
		expect((result.categories[0] as FaqCategory).name).toBe("Shipping");
	});

	it("returns empty when no visible categories exist", async () => {
		const result = await simulateListCategories(data);
		expect(result.categories).toHaveLength(0);
	});

	it("returns categories ordered by position", async () => {
		const ctrl = createFaqControllers(data);
		await ctrl.createCategory({
			name: "Returns",
			slug: "returns",
			position: 2,
		});
		await ctrl.createCategory({
			name: "Shipping",
			slug: "shipping",
			position: 1,
		});
		await ctrl.createCategory({
			name: "Payments",
			slug: "payments",
			position: 3,
		});

		const result = await simulateListCategories(data);
		const names = (result.categories as FaqCategory[]).map((c) => c.name);
		expect(names).toEqual(["Shipping", "Returns", "Payments"]);
	});
});

describe("store endpoint: get category — slug lookup with items", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns category and its visible items", async () => {
		const ctrl = createFaqControllers(data);
		const cat = await ctrl.createCategory({
			name: "Shipping",
			slug: "shipping",
		});
		await ctrl.createItem({
			categoryId: cat.id,
			question: "How fast?",
			answer: "2-3 days",
			slug: "how-fast",
		});
		const hiddenItem = await ctrl.createItem({
			categoryId: cat.id,
			question: "Hidden Q",
			answer: "Hidden A",
			slug: "hidden-q",
		});
		await ctrl.updateItem(hiddenItem.id, { isVisible: false });

		const result = await simulateGetCategory(data, "shipping");

		expect("category" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(1);
			expect((result.items[0] as FaqItem).question).toBe("How fast?");
		}
	});

	it("returns 404 for hidden category", async () => {
		const ctrl = createFaqControllers(data);
		const secret = await ctrl.createCategory({
			name: "Secret",
			slug: "secret",
		});
		await ctrl.updateCategory(secret.id, { isVisible: false });

		const result = await simulateGetCategory(data, "secret");
		expect(result).toEqual({ error: "Category not found", status: 404 });
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetCategory(data, "nonexistent");
		expect(result).toEqual({ error: "Category not found", status: 404 });
	});
});

describe("store endpoint: get item — slug lookup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns a visible FAQ item", async () => {
		const ctrl = createFaqControllers(data);
		const cat = await ctrl.createCategory({ name: "General", slug: "general" });
		await ctrl.createItem({
			categoryId: cat.id,
			question: "What is your return policy?",
			answer: "30 days full refund.",
			slug: "return-policy",
		});

		const result = await simulateGetItem(data, "return-policy");

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.question).toBe("What is your return policy?");
		}
	});

	it("returns 404 for hidden item", async () => {
		const ctrl = createFaqControllers(data);
		const cat = await ctrl.createCategory({ name: "General", slug: "general" });
		const secretItem = await ctrl.createItem({
			categoryId: cat.id,
			question: "Secret",
			answer: "Hidden",
			slug: "secret",
		});
		await ctrl.updateItem(secretItem.id, { isVisible: false });

		const result = await simulateGetItem(data, "secret");
		expect(result).toEqual({ error: "Item not found", status: 404 });
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetItem(data, "ghost");
		expect(result).toEqual({ error: "Item not found", status: 404 });
	});
});

describe("store endpoint: search FAQs", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("finds items matching the query in question text", async () => {
		const ctrl = createFaqControllers(data);
		const cat = await ctrl.createCategory({ name: "General", slug: "general" });
		await ctrl.createItem({
			categoryId: cat.id,
			question: "How do I return an item?",
			answer: "Visit our returns page.",
			slug: "return-item",
		});
		await ctrl.createItem({
			categoryId: cat.id,
			question: "What payment methods do you accept?",
			answer: "Visa, Mastercard, PayPal.",
			slug: "payment-methods",
		});

		const result = await simulateSearch(data, { q: "return" });

		expect(result.items).toHaveLength(1);
		expect((result.items[0] as FaqItem).question).toContain("return");
	});

	it("returns empty for non-matching query", async () => {
		const ctrl = createFaqControllers(data);
		const cat = await ctrl.createCategory({ name: "General", slug: "general" });
		await ctrl.createItem({
			categoryId: cat.id,
			question: "Shipping info",
			answer: "We ship worldwide.",
			slug: "shipping-info",
		});

		const result = await simulateSearch(data, { q: "cryptocurrency" });

		expect(result.items).toHaveLength(0);
	});

	it("respects limit", async () => {
		const ctrl = createFaqControllers(data);
		const cat = await ctrl.createCategory({ name: "General", slug: "general" });
		for (let i = 0; i < 5; i++) {
			await ctrl.createItem({
				categoryId: cat.id,
				question: `Shipping question ${i}`,
				answer: "Answer",
				slug: `shipping-q-${i}`,
			});
		}

		const result = await simulateSearch(data, { q: "shipping", limit: 2 });

		expect(result.items).toHaveLength(2);
	});
});

describe("store endpoint: vote on FAQ item", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("increments helpful count on positive vote", async () => {
		const ctrl = createFaqControllers(data);
		const cat = await ctrl.createCategory({ name: "General", slug: "general" });
		const item = await ctrl.createItem({
			categoryId: cat.id,
			question: "Helpful?",
			answer: "Yes!",
			slug: "helpful",
		});

		const result = await simulateVote(data, item.id, true);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.helpfulCount).toBe(1);
			expect(result.item.notHelpfulCount).toBe(0);
		}
	});

	it("increments not-helpful count on negative vote", async () => {
		const ctrl = createFaqControllers(data);
		const cat = await ctrl.createCategory({ name: "General", slug: "general" });
		const item = await ctrl.createItem({
			categoryId: cat.id,
			question: "Useful?",
			answer: "Maybe not.",
			slug: "useful",
		});

		const result = await simulateVote(data, item.id, false);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.helpfulCount).toBe(0);
			expect(result.item.notHelpfulCount).toBe(1);
		}
	});

	it("accumulates votes over multiple calls", async () => {
		const ctrl = createFaqControllers(data);
		const cat = await ctrl.createCategory({ name: "General", slug: "general" });
		const item = await ctrl.createItem({
			categoryId: cat.id,
			question: "Popular Q",
			answer: "Great A",
			slug: "popular",
		});

		await simulateVote(data, item.id, true);
		await simulateVote(data, item.id, true);
		const result = await simulateVote(data, item.id, false);

		expect("item" in result).toBe(true);
		if ("item" in result) {
			expect(result.item.helpfulCount).toBe(2);
			expect(result.item.notHelpfulCount).toBe(1);
		}
	});

	it("returns 404 for nonexistent item", async () => {
		const result = await simulateVote(data, "ghost_id", true);
		expect(result).toEqual({ error: "Item not found", status: 404 });
	});
});
