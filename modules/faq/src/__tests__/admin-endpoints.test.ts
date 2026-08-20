import { describe, expect, it, vi } from "vitest";
import { createCategory } from "../admin/endpoints/create-category";
import { createItem } from "../admin/endpoints/create-item";
import { deleteCategory } from "../admin/endpoints/delete-category";
import { deleteItem } from "../admin/endpoints/delete-item";
import { getItem } from "../admin/endpoints/get-item";
import { listCategories } from "../admin/endpoints/list-categories";
import { listItems } from "../admin/endpoints/list-items";
import { getStats } from "../admin/endpoints/stats";
import { updateCategory } from "../admin/endpoints/update-category";
import { updateItem } from "../admin/endpoints/update-item";
import type { FaqCategory, FaqController, FaqItem } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeCategory(overrides: Partial<FaqCategory> = {}): FaqCategory {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "General",
		slug: "general",
		position: 0,
		isVisible: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeItem(
	categoryId: string,
	overrides: Partial<FaqItem> = {},
): FaqItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		categoryId,
		question: "What is 86d?",
		answer: "A commerce framework.",
		slug: "what-is-86d",
		position: 0,
		isVisible: true,
		helpfulCount: 0,
		notHelpfulCount: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(overrides: Partial<FaqController> = {}): FaqController {
	return {
		createCategory: vi.fn().mockResolvedValue(makeCategory()),
		getCategory: vi.fn().mockResolvedValue(null),
		getCategoryBySlug: vi.fn().mockResolvedValue(null),
		listCategories: vi.fn().mockResolvedValue([]),
		updateCategory: vi.fn().mockResolvedValue(null),
		deleteCategory: vi.fn().mockResolvedValue(undefined),
		createItem: vi.fn().mockResolvedValue(makeItem("cat_1")),
		getItem: vi.fn().mockResolvedValue(null),
		getItemBySlug: vi.fn().mockResolvedValue(null),
		listItems: vi.fn().mockResolvedValue([]),
		updateItem: vi.fn().mockResolvedValue(null),
		deleteItem: vi.fn().mockResolvedValue(undefined),
		search: vi.fn().mockResolvedValue([]),
		vote: vi.fn().mockResolvedValue(undefined),
		getStats: vi.fn().mockResolvedValue({
			totalCategories: 0,
			totalItems: 0,
			totalHelpful: 0,
			totalNotHelpful: 0,
		}),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: FaqController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { faq: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const createCategoryHandler = extractHandler(createCategory);
const createItemHandler = extractHandler(createItem);
const deleteCategoryHandler = extractHandler(deleteCategory);
const deleteItemHandler = extractHandler(deleteItem);
const getItemHandler = extractHandler(getItem);
const listCategoriesHandler = extractHandler(listCategories);
const listItemsHandler = extractHandler(listItems);
const getStatsHandler = extractHandler(getStats);
const updateCategoryHandler = extractHandler(updateCategory);
const updateItemHandler = extractHandler(updateItem);

// ── admin POST /faq/categories/create ────────────────────────────────────────

describe("admin POST /faq/categories/create", () => {
	it("creates a category and returns it", async () => {
		const category = makeCategory({ name: "Returns", slug: "returns" });
		const ctrl = makeController({
			createCategory: vi.fn().mockResolvedValue(category),
		});
		const result = (await call(createCategoryHandler, {
			body: { name: "Returns", slug: "returns" },
			controller: ctrl,
		})) as { category: FaqCategory };
		expect(result.category.name).toBe("Returns");
		expect(result.category.slug).toBe("returns");
		expect(ctrl.createCategory).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Returns", slug: "returns" }),
		);
	});

	it("forwards optional fields to controller", async () => {
		const ctrl = makeController();
		await call(createCategoryHandler, {
			body: {
				name: "Shipping",
				slug: "shipping",
				description: "Shipping questions",
				icon: "truck",
				position: 2,
			},
			controller: ctrl,
		});
		expect(ctrl.createCategory).toHaveBeenCalledWith(
			expect.objectContaining({
				description: "Shipping questions",
				icon: "truck",
				position: 2,
			}),
		);
	});
});

// ── admin POST /faq/items/create ─────────────────────────────────────────────

describe("admin POST /faq/items/create", () => {
	it("creates an item and returns it", async () => {
		const item = makeItem("cat_1", {
			question: "How do I return?",
			slug: "how-do-i-return",
		});
		const ctrl = makeController({
			createItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(createItemHandler, {
			body: {
				categoryId: "cat_1",
				question: "How do I return?",
				answer: "Go to settings.",
				slug: "how-do-i-return",
			},
			controller: ctrl,
		})) as { item: FaqItem };
		expect(result.item.question).toBe("How do I return?");
		expect(result.item.slug).toBe("how-do-i-return");
		expect(ctrl.createItem).toHaveBeenCalledWith(
			expect.objectContaining({
				categoryId: "cat_1",
				question: "How do I return?",
				answer: "Go to settings.",
				slug: "how-do-i-return",
			}),
		);
	});

	it("forwards optional tags to controller", async () => {
		const ctrl = makeController();
		await call(createItemHandler, {
			body: {
				categoryId: "cat_2",
				question: "Can I track?",
				answer: "Yes.",
				slug: "can-i-track",
				tags: ["tracking", "shipping"],
			},
			controller: ctrl,
		});
		expect(ctrl.createItem).toHaveBeenCalledWith(
			expect.objectContaining({ tags: ["tracking", "shipping"] }),
		);
	});
});

// ── admin DELETE /faq/categories/:id/delete ───────────────────────────────────

describe("admin DELETE /faq/categories/:id/delete", () => {
	it("deletes a category and returns success", async () => {
		const ctrl = makeController({
			deleteCategory: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteCategoryHandler, {
			params: { id: "cat_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteCategory).toHaveBeenCalledWith("cat_1");
	});

	it("always returns success regardless of existence", async () => {
		const result = (await call(deleteCategoryHandler, {
			params: { id: "nonexistent" },
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── admin DELETE /faq/items/:id/delete ───────────────────────────────────────

describe("admin DELETE /faq/items/:id/delete", () => {
	it("deletes an item and returns success", async () => {
		const ctrl = makeController({
			deleteItem: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteItemHandler, {
			params: { id: "item_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteItem).toHaveBeenCalledWith("item_1");
	});
});

// ── admin GET /faq/items/:id ──────────────────────────────────────────────────

describe("admin GET /faq/items/:id", () => {
	it("returns 404 when item not found", async () => {
		const result = (await call(getItemHandler, {
			params: { id: "nonexistent" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("FAQ item not found");
	});

	it("returns item when found", async () => {
		const item = makeItem("cat_1", { id: "item_99" });
		const ctrl = makeController({
			getItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(getItemHandler, {
			params: { id: "item_99" },
			controller: ctrl,
		})) as { item: FaqItem };
		expect(result.item.id).toBe("item_99");
		expect(ctrl.getItem).toHaveBeenCalledWith("item_99");
	});
});

// ── admin GET /faq/categories ─────────────────────────────────────────────────

describe("admin GET /faq/categories", () => {
	it("returns empty list when no categories", async () => {
		const result = (await call(listCategoriesHandler)) as {
			categories: FaqCategory[];
		};
		expect(result.categories).toHaveLength(0);
	});

	it("returns categories with item counts", async () => {
		const cat = makeCategory({ id: "cat_1" });
		const items = [makeItem("cat_1"), makeItem("cat_1")];
		const ctrl = makeController({
			listCategories: vi.fn().mockResolvedValue([cat]),
			listItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(listCategoriesHandler, {
			controller: ctrl,
		})) as { categories: Array<FaqCategory & { itemCount: number }> };
		expect(result.categories).toHaveLength(1);
		expect(result.categories[0].id).toBe("cat_1");
		expect(result.categories[0].itemCount).toBe(2);
	});

	it("calls listItems for each category to compute counts", async () => {
		const cats = [makeCategory({ id: "cat_a" }), makeCategory({ id: "cat_b" })];
		const ctrl = makeController({
			listCategories: vi.fn().mockResolvedValue(cats),
			listItems: vi.fn().mockResolvedValue([]),
		});
		await call(listCategoriesHandler, { controller: ctrl });
		expect(ctrl.listItems).toHaveBeenCalledTimes(2);
	});
});

// ── admin GET /faq/items ──────────────────────────────────────────────────────

describe("admin GET /faq/items", () => {
	it("returns empty list when no items", async () => {
		const result = (await call(listItemsHandler)) as { items: FaqItem[] };
		expect(result.items).toHaveLength(0);
	});

	it("returns all items", async () => {
		const items = [makeItem("cat_1"), makeItem("cat_1")];
		const ctrl = makeController({
			listItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(listItemsHandler, {
			controller: ctrl,
		})) as { items: FaqItem[] };
		expect(result.items).toHaveLength(2);
	});

	it("filters by categoryId when provided", async () => {
		const ctrl = makeController();
		await call(listItemsHandler, {
			query: { categoryId: "cat_5" },
			controller: ctrl,
		});
		expect(ctrl.listItems).toHaveBeenCalledWith(
			expect.objectContaining({ categoryId: "cat_5" }),
		);
	});
});

// ── admin GET /faq/stats ──────────────────────────────────────────────────────

describe("admin GET /faq/stats", () => {
	it("returns stats from controller", async () => {
		const stats = {
			totalCategories: 4,
			totalItems: 22,
			totalHelpful: 180,
			totalNotHelpful: 12,
		};
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(getStatsHandler, {
			controller: ctrl,
		})) as { stats: typeof stats };
		expect(result.stats.totalCategories).toBe(4);
		expect(result.stats.totalItems).toBe(22);
		expect(result.stats.totalHelpful).toBe(180);
		expect(result.stats.totalNotHelpful).toBe(12);
	});

	it("returns zero-state stats when empty", async () => {
		const result = (await call(getStatsHandler)) as {
			stats: { totalCategories: number; totalItems: number };
		};
		expect(result.stats.totalCategories).toBe(0);
		expect(result.stats.totalItems).toBe(0);
	});
});

// ── admin PUT /faq/categories/:id ─────────────────────────────────────────────

describe("admin PUT /faq/categories/:id", () => {
	it("returns updated category on success", async () => {
		const updated = makeCategory({ id: "cat_1", name: "Updated Name" });
		const ctrl = makeController({
			updateCategory: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateCategoryHandler, {
			params: { id: "cat_1" },
			body: { name: "Updated Name" },
			controller: ctrl,
		})) as { category: FaqCategory };
		expect(result.category.name).toBe("Updated Name");
		expect(ctrl.updateCategory).toHaveBeenCalledWith(
			"cat_1",
			expect.objectContaining({ name: "Updated Name" }),
		);
	});

	it("forwards isVisible toggle to controller", async () => {
		const ctrl = makeController({
			updateCategory: vi.fn().mockResolvedValue(makeCategory()),
		});
		await call(updateCategoryHandler, {
			params: { id: "cat_2" },
			body: { isVisible: false },
			controller: ctrl,
		});
		expect(ctrl.updateCategory).toHaveBeenCalledWith(
			"cat_2",
			expect.objectContaining({ isVisible: false }),
		);
	});
});

// ── admin PUT /faq/items/:id/update ──────────────────────────────────────────

describe("admin PUT /faq/items/:id/update", () => {
	it("returns updated item on success", async () => {
		const updated = makeItem("cat_1", {
			id: "item_1",
			question: "New question?",
		});
		const ctrl = makeController({
			updateItem: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateItemHandler, {
			params: { id: "item_1" },
			body: { question: "New question?" },
			controller: ctrl,
		})) as { item: FaqItem };
		expect(result.item.question).toBe("New question?");
		expect(ctrl.updateItem).toHaveBeenCalledWith(
			"item_1",
			expect.objectContaining({ question: "New question?" }),
		);
	});

	it("forwards tags update to controller", async () => {
		const ctrl = makeController({
			updateItem: vi.fn().mockResolvedValue(makeItem("cat_1")),
		});
		await call(updateItemHandler, {
			params: { id: "item_2" },
			body: { tags: ["faq", "help"] },
			controller: ctrl,
		});
		expect(ctrl.updateItem).toHaveBeenCalledWith(
			"item_2",
			expect.objectContaining({ tags: ["faq", "help"] }),
		);
	});
});
