import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createBrandController } from "../service-impl";

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
// brand.created
// ---------------------------------------------------------------------------

describe("brand.created event", () => {
	it("emits when a brand is created", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("brand.created");
		expect(events.emitted[0].payload).toEqual({
			brandId: brand.id,
			name: "Nike",
			slug: "nike",
		});
	});

	it("includes all payload fields", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		await ctrl.createBrand({
			name: "Adidas",
			slug: "adidas",
			description: "Sports brand",
		});

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.name).toBe("Adidas");
		expect(payload.slug).toBe("adidas");
		expect(payload.brandId).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// brand.updated
// ---------------------------------------------------------------------------

describe("brand.updated event", () => {
	it("emits when a brand is updated", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		events.emitted.length = 0;

		await ctrl.updateBrand(brand.id, { name: "Nike Inc." });

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("brand.updated");
		expect(events.emitted[0].payload).toEqual({
			brandId: brand.id,
			name: "Nike Inc.",
			slug: "nike",
		});
	});

	it("does not emit when brand does not exist", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		await ctrl.updateBrand("nonexistent", { name: "Test" });

		expect(
			events.emitted.filter((e) => e.type === "brand.updated"),
		).toHaveLength(0);
	});

	it("reflects slug change in payload", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		events.emitted.length = 0;

		await ctrl.updateBrand(brand.id, { slug: "nike-updated" });

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.slug).toBe("nike-updated");
	});
});

// ---------------------------------------------------------------------------
// brand.deleted
// ---------------------------------------------------------------------------

describe("brand.deleted event", () => {
	it("emits when a brand is deleted", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		events.emitted.length = 0;

		await ctrl.deleteBrand(brand.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("brand.deleted");
		expect(events.emitted[0].payload).toEqual({ brandId: brand.id });
	});

	it("does not emit when brand does not exist", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		await ctrl.deleteBrand("nonexistent");

		expect(
			events.emitted.filter((e) => e.type === "brand.deleted"),
		).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// brand.product.assigned
// ---------------------------------------------------------------------------

describe("brand.product.assigned event", () => {
	it("emits when a product is assigned", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		events.emitted.length = 0;

		await ctrl.assignProduct({ brandId: brand.id, productId: "p1" });

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("brand.product.assigned");
		expect(events.emitted[0].payload).toEqual({
			brandId: brand.id,
			productId: "p1",
		});
	});

	it("emits when product is reassigned from another brand", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand1 = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		const brand2 = await ctrl.createBrand({ name: "Adidas", slug: "adidas" });
		await ctrl.assignProduct({ brandId: brand1.id, productId: "p1" });
		events.emitted.length = 0;

		await ctrl.assignProduct({ brandId: brand2.id, productId: "p1" });

		const assigned = events.emitted.filter(
			(e) => e.type === "brand.product.assigned",
		);
		expect(assigned).toHaveLength(1);
		expect(assigned[0].payload).toEqual({
			brandId: brand2.id,
			productId: "p1",
		});
	});

	it("emits for idempotent reassignment to same brand", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		events.emitted.length = 0;

		// First assignment
		await ctrl.assignProduct({ brandId: brand.id, productId: "p1" });
		// Re-assign to same brand (idempotent, returns existing)
		await ctrl.assignProduct({ brandId: brand.id, productId: "p1" });

		// Only one event — second call is idempotent (returns existing without re-emitting)
		const assigned = events.emitted.filter(
			(e) => e.type === "brand.product.assigned",
		);
		expect(assigned).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// brand.product.unassigned
// ---------------------------------------------------------------------------

describe("brand.product.unassigned event", () => {
	it("emits when a product is unassigned", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		await ctrl.assignProduct({ brandId: brand.id, productId: "p1" });
		events.emitted.length = 0;

		await ctrl.unassignProduct({ brandId: brand.id, productId: "p1" });

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("brand.product.unassigned");
		expect(events.emitted[0].payload).toEqual({
			brandId: brand.id,
			productId: "p1",
		});
	});

	it("does not emit when product was not assigned", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		events.emitted.length = 0;

		await ctrl.unassignProduct({ brandId: brand.id, productId: "p1" });

		expect(
			events.emitted.filter((e) => e.type === "brand.product.unassigned"),
		).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// No events without emitter
// ---------------------------------------------------------------------------

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createBrandController(createMockDataService());

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		await ctrl.updateBrand(brand.id, { name: "Nike Inc." });
		await ctrl.assignProduct({ brandId: brand.id, productId: "p1" });
		await ctrl.unassignProduct({ brandId: brand.id, productId: "p1" });
		await expect(ctrl.deleteBrand(brand.id)).resolves.toBeUndefined();

		// No errors thrown — graceful no-op
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle events
// ---------------------------------------------------------------------------

describe("full lifecycle event sequence", () => {
	it("emits events in correct order across create → assign → unassign → delete", async () => {
		const events = createMockEvents();
		const ctrl = createBrandController(createMockDataService(), events);

		const brand = await ctrl.createBrand({ name: "Nike", slug: "nike" });
		await ctrl.assignProduct({ brandId: brand.id, productId: "p1" });
		await ctrl.assignProduct({ brandId: brand.id, productId: "p2" });
		await ctrl.unassignProduct({ brandId: brand.id, productId: "p1" });
		await ctrl.updateBrand(brand.id, { name: "Nike Updated" });
		await ctrl.deleteBrand(brand.id);

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"brand.created",
			"brand.product.assigned",
			"brand.product.assigned",
			"brand.product.unassigned",
			"brand.updated",
			"brand.deleted",
		]);
	});
});
