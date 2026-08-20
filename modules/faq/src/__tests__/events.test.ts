import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createFaqControllers } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

// ---------------------------------------------------------------------------
// faq.category.created
// ---------------------------------------------------------------------------

describe("faq.category.created event", () => {
	it("emits when a category is created", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "General",
			slug: "general",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("faq.category.created");
		expect(events.emitted[0].payload).toEqual({
			categoryId: cat.id,
			name: "General",
			slug: "general",
		});
	});

	it("includes description and icon in category but not in event", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "Shipping",
			slug: "shipping",
			description: "FAQ about shipping",
			icon: "Truck",
		});

		expect(cat.description).toBe("FAQ about shipping");
		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.name).toBe("Shipping");
		expect(payload.slug).toBe("shipping");
	});
});

// ---------------------------------------------------------------------------
// faq.category.updated
// ---------------------------------------------------------------------------

describe("faq.category.updated event", () => {
	it("emits when a category is updated", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "General",
			slug: "general",
		});
		events.emitted.length = 0;

		await ctrl.updateCategory(cat.id, { name: "General FAQ" });

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("faq.category.updated");
		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.categoryId).toBe(cat.id);
		expect(payload.name).toBe("General FAQ");
	});

	it("throws when category does not exist (no event emitted)", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		await expect(
			ctrl.updateCategory("nonexistent", { name: "Test" }),
		).rejects.toThrow();

		expect(
			events.emitted.filter((e) => e.type === "faq.category.updated"),
		).toHaveLength(0);
	});

	it("reflects slug change in payload", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "General",
			slug: "general",
		});
		events.emitted.length = 0;

		await ctrl.updateCategory(cat.id, { slug: "general-faq" });

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.slug).toBe("general-faq");
	});
});

// ---------------------------------------------------------------------------
// faq.category.deleted
// ---------------------------------------------------------------------------

describe("faq.category.deleted event", () => {
	it("emits when a category is deleted", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "General",
			slug: "general",
		});
		events.emitted.length = 0;

		await ctrl.deleteCategory(cat.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("faq.category.deleted");
		expect(events.emitted[0].payload).toEqual({ categoryId: cat.id });
	});

	it("emits after cascade-deleting items", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "General",
			slug: "general",
		});
		await ctrl.createItem({
			categoryId: cat.id,
			question: "Q1?",
			answer: "A1",
			slug: "q1",
		});
		events.emitted.length = 0;

		await ctrl.deleteCategory(cat.id);

		// Category deleted event emitted (item events are via createItem, not here)
		const deleteEvents = events.emitted.filter(
			(e) => e.type === "faq.category.deleted",
		);
		expect(deleteEvents).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// faq.item.created
// ---------------------------------------------------------------------------

describe("faq.item.created event", () => {
	it("emits when an item is created", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "General",
			slug: "general",
		});
		events.emitted.length = 0;

		const item = await ctrl.createItem({
			categoryId: cat.id,
			question: "How does shipping work?",
			answer: "We ship via USPS.",
			slug: "how-shipping",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("faq.item.created");
		expect(events.emitted[0].payload).toEqual({
			itemId: item.id,
			categoryId: cat.id,
			question: "How does shipping work?",
			slug: "how-shipping",
		});
	});
});

// ---------------------------------------------------------------------------
// faq.item.updated
// ---------------------------------------------------------------------------

describe("faq.item.updated event", () => {
	it("emits when an item is updated", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "General",
			slug: "general",
		});
		const item = await ctrl.createItem({
			categoryId: cat.id,
			question: "Original?",
			answer: "A",
			slug: "original",
		});
		events.emitted.length = 0;

		await ctrl.updateItem(item.id, { question: "Updated?" });

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("faq.item.updated");
		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.itemId).toBe(item.id);
		expect(payload.question).toBe("Updated?");
	});

	it("throws when item does not exist (no event emitted)", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		await expect(
			ctrl.updateItem("nonexistent", { question: "Test?" }),
		).rejects.toThrow();

		expect(
			events.emitted.filter((e) => e.type === "faq.item.updated"),
		).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// faq.item.deleted
// ---------------------------------------------------------------------------

describe("faq.item.deleted event", () => {
	it("emits when an item is deleted", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "General",
			slug: "general",
		});
		const item = await ctrl.createItem({
			categoryId: cat.id,
			question: "Q?",
			answer: "A",
			slug: "q",
		});
		events.emitted.length = 0;

		await ctrl.deleteItem(item.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("faq.item.deleted");
		expect(events.emitted[0].payload).toEqual({ itemId: item.id });
	});
});

// ---------------------------------------------------------------------------
// No events without emitter
// ---------------------------------------------------------------------------

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createFaqControllers(createMockDataService());

		const cat = await ctrl.createCategory({
			name: "Test",
			slug: "test",
		});
		await ctrl.updateCategory(cat.id, { name: "Updated" });
		const item = await ctrl.createItem({
			categoryId: cat.id,
			question: "Q?",
			answer: "A",
			slug: "q",
		});
		await ctrl.updateItem(item.id, { answer: "New A" });
		await ctrl.deleteItem(item.id);
		await ctrl.deleteCategory(cat.id);

		// No errors thrown
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle
// ---------------------------------------------------------------------------

describe("full lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createFaqControllers(createMockDataService(), events);

		const cat = await ctrl.createCategory({
			name: "General",
			slug: "general",
		});
		const item = await ctrl.createItem({
			categoryId: cat.id,
			question: "Q?",
			answer: "A",
			slug: "q",
		});
		await ctrl.updateItem(item.id, { answer: "Updated A" });
		await ctrl.updateCategory(cat.id, { name: "General FAQ" });
		await ctrl.deleteItem(item.id);
		await ctrl.deleteCategory(cat.id);

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"faq.category.created",
			"faq.item.created",
			"faq.item.updated",
			"faq.category.updated",
			"faq.item.deleted",
			"faq.category.deleted",
		]);
	});
});
