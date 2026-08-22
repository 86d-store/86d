import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createInventoryController } from "../service-impl";

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
// setStock
// ---------------------------------------------------------------------------

describe("setStock", () => {
	it("creates a new inventory record with computed available", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const item = await ctrl.setStock({ productId: "p1", quantity: 10 });

		expect(item.productId).toBe("p1");
		expect(item.quantity).toBe(10);
		expect(item.reserved).toBe(0);
		expect(item.available).toBe(10);
		expect(item.allowBackorder).toBe(false);
	});

	it("updates an existing record without resetting reserved count", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 20 });
		// Simulate a reservation
		await ctrl.reserve({ productId: "p1", quantity: 5 });
		// Now update quantity
		const updated = await ctrl.setStock({ productId: "p1", quantity: 30 });

		expect(updated.quantity).toBe(30);
		expect(updated.reserved).toBe(5);
		expect(updated.available).toBe(25);
	});

	it("stores optional fields (variantId, locationId, lowStockThreshold)", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const item = await ctrl.setStock({
			productId: "p1",
			variantId: "v1",
			locationId: "warehouse-1",
			quantity: 5,
			lowStockThreshold: 2,
			allowBackorder: true,
		});

		expect(item.variantId).toBe("v1");
		expect(item.locationId).toBe("warehouse-1");
		expect(item.lowStockThreshold).toBe(2);
		expect(item.allowBackorder).toBe(true);
	});

	it("creates separate records for same product with different variants", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", variantId: "v1", quantity: 5 });
		await ctrl.setStock({ productId: "p1", variantId: "v2", quantity: 10 });

		const v1 = await ctrl.getStock({ productId: "p1", variantId: "v1" });
		const v2 = await ctrl.getStock({ productId: "p1", variantId: "v2" });
		expect(v1?.quantity).toBe(5);
		expect(v2?.quantity).toBe(10);
	});

	it("creates separate records for same product at different locations", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({
			productId: "p1",
			locationId: "warehouse-a",
			quantity: 20,
		});
		await ctrl.setStock({
			productId: "p1",
			locationId: "warehouse-b",
			quantity: 30,
		});

		const a = await ctrl.getStock({
			productId: "p1",
			locationId: "warehouse-a",
		});
		const b = await ctrl.getStock({
			productId: "p1",
			locationId: "warehouse-b",
		});
		expect(a?.quantity).toBe(20);
		expect(b?.quantity).toBe(30);
	});

	it("preserves createdAt on update", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const original = await ctrl.setStock({
			productId: "p1",
			quantity: 5,
		});
		const updated = await ctrl.setStock({ productId: "p1", quantity: 15 });
		expect(updated.createdAt).toEqual(original.createdAt);
	});

	it("sets quantity to zero", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const item = await ctrl.setStock({ productId: "p1", quantity: 0 });
		expect(item.quantity).toBe(0);
		expect(item.available).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// getStock
// ---------------------------------------------------------------------------

describe("getStock", () => {
	it("returns null for an untracked product", async () => {
		const ctrl = createInventoryController(createMockDataService());
		expect(await ctrl.getStock({ productId: "p99" })).toBeNull();
	});

	it("returns the item with available computed", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 8 });
		await ctrl.reserve({ productId: "p1", quantity: 3 });
		const item = await ctrl.getStock({ productId: "p1" });

		expect(item?.quantity).toBe(8);
		expect(item?.reserved).toBe(3);
		expect(item?.available).toBe(5);
	});

	it("returns null for correct product but wrong variant", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", variantId: "v1", quantity: 5 });
		expect(
			await ctrl.getStock({ productId: "p1", variantId: "v2" }),
		).toBeNull();
	});

	it("returns correct item for product + variant + location combo", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({
			productId: "p1",
			variantId: "v1",
			locationId: "loc1",
			quantity: 7,
		});
		const item = await ctrl.getStock({
			productId: "p1",
			variantId: "v1",
			locationId: "loc1",
		});
		expect(item?.quantity).toBe(7);
	});
});

// ---------------------------------------------------------------------------
// adjustStock
// ---------------------------------------------------------------------------

describe("adjustStock", () => {
	it("increases stock with a positive delta", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		const updated = await ctrl.adjustStock({ productId: "p1", delta: 5 });

		expect(updated?.quantity).toBe(15);
		expect(updated?.available).toBe(15);
	});

	it("decreases stock with a negative delta (floors at 0)", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 3 });
		const updated = await ctrl.adjustStock({ productId: "p1", delta: -10 });

		expect(updated?.quantity).toBe(0);
	});

	it("returns null for a missing item", async () => {
		const ctrl = createInventoryController(createMockDataService());
		expect(await ctrl.adjustStock({ productId: "nope", delta: 1 })).toBeNull();
	});

	it("adjusts stock with variant and location keys", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({
			productId: "p1",
			variantId: "v1",
			locationId: "loc1",
			quantity: 10,
		});
		const updated = await ctrl.adjustStock({
			productId: "p1",
			variantId: "v1",
			locationId: "loc1",
			delta: -3,
		});
		expect(updated?.quantity).toBe(7);
	});

	it("adjusting by zero leaves quantity unchanged", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		const updated = await ctrl.adjustStock({ productId: "p1", delta: 0 });
		expect(updated?.quantity).toBe(10);
	});

	it("preserves reserved count when adjusting quantity", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		await ctrl.reserve({ productId: "p1", quantity: 4 });
		const updated = await ctrl.adjustStock({ productId: "p1", delta: 5 });
		expect(updated?.quantity).toBe(15);
		expect(updated?.reserved).toBe(4);
		expect(updated?.available).toBe(11);
	});
});

// ---------------------------------------------------------------------------
// reserve
// ---------------------------------------------------------------------------

describe("reserve", () => {
	it("reserves stock successfully", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		const item = await ctrl.reserve({ productId: "p1", quantity: 3 });

		expect(item?.reserved).toBe(3);
		expect(item?.available).toBe(7);
	});

	it("returns null when insufficient stock and backorder disabled", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 2 });
		const result = await ctrl.reserve({ productId: "p1", quantity: 5 });

		expect(result).toBeNull();
	});

	it("allows reservation when backorder enabled even with 0 available", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 0, allowBackorder: true });
		const item = await ctrl.reserve({ productId: "p1", quantity: 3 });

		expect(item?.reserved).toBe(3);
	});

	it("returns null for missing item", async () => {
		const ctrl = createInventoryController(createMockDataService());
		expect(await ctrl.reserve({ productId: "nope", quantity: 1 })).toBeNull();
	});

	it("reserves exact available amount successfully", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 5 });
		const item = await ctrl.reserve({ productId: "p1", quantity: 5 });

		expect(item?.reserved).toBe(5);
		expect(item?.available).toBe(0);
	});

	it("fails partial reservation after some stock already reserved", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		await ctrl.reserve({ productId: "p1", quantity: 8 });
		const result = await ctrl.reserve({ productId: "p1", quantity: 5 });

		expect(result).toBeNull();
	});

	it("allows multiple sequential reservations within capacity", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		await ctrl.reserve({ productId: "p1", quantity: 3 });
		const second = await ctrl.reserve({ productId: "p1", quantity: 4 });

		expect(second?.reserved).toBe(7);
		expect(second?.available).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// release
// ---------------------------------------------------------------------------

describe("release", () => {
	it("releases a reservation", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		await ctrl.reserve({ productId: "p1", quantity: 4 });
		const released = await ctrl.release({ productId: "p1", quantity: 2 });

		expect(released?.reserved).toBe(2);
		expect(released?.available).toBe(8);
	});

	it("floors reserved at 0 (over-release is safe)", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 5 });
		const released = await ctrl.release({ productId: "p1", quantity: 99 });

		expect(released?.reserved).toBe(0);
	});

	it("returns null for missing item", async () => {
		const ctrl = createInventoryController(createMockDataService());
		expect(await ctrl.release({ productId: "nope", quantity: 1 })).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// deduct
// ---------------------------------------------------------------------------

describe("deduct", () => {
	it("deducts both quantity and reserved", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		await ctrl.reserve({ productId: "p1", quantity: 3 });
		const deducted = await ctrl.deduct({ productId: "p1", quantity: 3 });

		expect(deducted?.quantity).toBe(7);
		expect(deducted?.reserved).toBe(0);
		expect(deducted?.available).toBe(7);
	});

	it("floors both fields at 0", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 2 });
		const deducted = await ctrl.deduct({ productId: "p1", quantity: 10 });

		expect(deducted?.quantity).toBe(0);
		expect(deducted?.reserved).toBe(0);
	});

	it("returns null for missing item", async () => {
		const ctrl = createInventoryController(createMockDataService());
		expect(await ctrl.deduct({ productId: "nope", quantity: 1 })).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// isInStock
// ---------------------------------------------------------------------------

describe("isInStock", () => {
	it("returns true for an untracked product (not managed = always in stock)", async () => {
		const ctrl = createInventoryController(createMockDataService());
		expect(await ctrl.isInStock({ productId: "untracked" })).toBe(true);
	});

	it("returns true when available >= requested quantity", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 5 });
		expect(await ctrl.isInStock({ productId: "p1", quantity: 5 })).toBe(true);
	});

	it("returns false when available < requested quantity", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 3 });
		expect(await ctrl.isInStock({ productId: "p1", quantity: 5 })).toBe(false);
	});

	it("returns true when backorder enabled regardless of stock", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 0, allowBackorder: true });
		expect(await ctrl.isInStock({ productId: "p1", quantity: 100 })).toBe(true);
	});

	it("defaults quantity to 1 when not specified", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 1 });
		expect(await ctrl.isInStock({ productId: "p1" })).toBe(true);
	});

	it("returns false when available is 0 and no backorder", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 5 });
		await ctrl.reserve({ productId: "p1", quantity: 5 });
		expect(await ctrl.isInStock({ productId: "p1" })).toBe(false);
	});

	it("checks stock for specific variant", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", variantId: "v1", quantity: 3 });
		await ctrl.setStock({ productId: "p1", variantId: "v2", quantity: 0 });
		expect(await ctrl.isInStock({ productId: "p1", variantId: "v1" })).toBe(
			true,
		);
		expect(await ctrl.isInStock({ productId: "p1", variantId: "v2" })).toBe(
			false,
		);
	});
});

// ---------------------------------------------------------------------------
// getLowStockItems
// ---------------------------------------------------------------------------

describe("getLowStockItems", () => {
	it("returns items at or below threshold", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 2, lowStockThreshold: 5 });
		await ctrl.setStock({
			productId: "p2",
			quantity: 10,
			lowStockThreshold: 5,
		});
		await ctrl.setStock({ productId: "p3", quantity: 5 }); // no threshold
		const low = await ctrl.getLowStockItems();

		expect(low).toHaveLength(1);
		expect(low[0].productId).toBe("p1");
	});

	it("returns empty array when all stock levels are sufficient", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({
			productId: "p1",
			quantity: 20,
			lowStockThreshold: 5,
		});
		expect(await ctrl.getLowStockItems()).toHaveLength(0);
	});

	it("includes items at exactly the threshold boundary", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({
			productId: "p1",
			quantity: 5,
			lowStockThreshold: 5,
		});
		const low = await ctrl.getLowStockItems();
		expect(low).toHaveLength(1);
	});

	it("accounts for reservations when computing low stock", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({
			productId: "p1",
			quantity: 10,
			lowStockThreshold: 5,
		});
		await ctrl.reserve({ productId: "p1", quantity: 7 });
		const low = await ctrl.getLowStockItems();
		expect(low).toHaveLength(1);
		expect(low[0].available).toBe(3);
	});

	it("filters by locationId when provided", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({
			productId: "p1",
			locationId: "warehouse-a",
			quantity: 1,
			lowStockThreshold: 5,
		});
		await ctrl.setStock({
			productId: "p2",
			locationId: "warehouse-b",
			quantity: 1,
			lowStockThreshold: 5,
		});
		const low = await ctrl.getLowStockItems({
			locationId: "warehouse-a",
		});
		expect(low).toHaveLength(1);
		expect(low[0].productId).toBe("p1");
	});

	it("returns empty when no items have threshold set", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 0 });
		await ctrl.setStock({ productId: "p2", quantity: 0 });
		expect(await ctrl.getLowStockItems()).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// listItems
// ---------------------------------------------------------------------------

describe("listItems", () => {
	it("lists all items", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 5 });
		await ctrl.setStock({ productId: "p2", quantity: 10 });
		const items = await ctrl.listItems();
		expect(items).toHaveLength(2);
	});

	it("filters by productId", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 5 });
		await ctrl.setStock({ productId: "p2", quantity: 10 });
		const items = await ctrl.listItems({ productId: "p1" });
		expect(items).toHaveLength(1);
		expect(items[0].productId).toBe("p1");
	});

	it("respects take/skip pagination", async () => {
		const ctrl = createInventoryController(createMockDataService());
		for (let i = 1; i <= 5; i++) {
			await ctrl.setStock({ productId: `p${i}`, quantity: i });
		}
		const page = await ctrl.listItems({ take: 2, skip: 2 });
		expect(page).toHaveLength(2);
	});

	it("filters by locationId", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({
			productId: "p1",
			locationId: "loc-a",
			quantity: 5,
		});
		await ctrl.setStock({
			productId: "p2",
			locationId: "loc-b",
			quantity: 10,
		});
		await ctrl.setStock({
			productId: "p3",
			locationId: "loc-a",
			quantity: 15,
		});
		const items = await ctrl.listItems({ locationId: "loc-a" });
		expect(items).toHaveLength(2);
	});

	it("returns empty array when no items tracked", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const items = await ctrl.listItems();
		expect(items).toEqual([]);
	});

	it("all returned items have computed available field", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		await ctrl.reserve({ productId: "p1", quantity: 3 });
		const items = await ctrl.listItems();
		expect(items[0].available).toBe(7);
	});
});

// ---------------------------------------------------------------------------
// full lifecycle
// ---------------------------------------------------------------------------

describe("full lifecycle", () => {
	it("set → reserve → release → deduct lifecycle", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 20 });

		// Reserve 8
		await ctrl.reserve({ productId: "p1", quantity: 8 });
		let stock = await ctrl.getStock({ productId: "p1" });
		expect(stock?.reserved).toBe(8);
		expect(stock?.available).toBe(12);

		// Release 3
		await ctrl.release({ productId: "p1", quantity: 3 });
		stock = await ctrl.getStock({ productId: "p1" });
		expect(stock?.reserved).toBe(5);
		expect(stock?.available).toBe(15);

		// Deduct 5 (fulfillment)
		await ctrl.deduct({ productId: "p1", quantity: 5 });
		stock = await ctrl.getStock({ productId: "p1" });
		expect(stock?.quantity).toBe(15);
		expect(stock?.reserved).toBe(0);
		expect(stock?.available).toBe(15);
	});

	it("adjust → reserve → check isInStock", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.setStock({ productId: "p1", quantity: 5 });
		await ctrl.adjustStock({ productId: "p1", delta: 10 });
		await ctrl.reserve({ productId: "p1", quantity: 12 });

		expect(await ctrl.isInStock({ productId: "p1", quantity: 3 })).toBe(true);
		expect(await ctrl.isInStock({ productId: "p1", quantity: 5 })).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// event emission
// ---------------------------------------------------------------------------

describe("event emission", () => {
	it("emits inventory.updated on setStock", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);
		await ctrl.setStock({ productId: "p1", quantity: 10 });

		const updated = events.emitted.filter(
			(e) => e.type === "inventory.updated",
		);
		expect(updated).toHaveLength(1);
		expect(updated[0].payload).toMatchObject({
			productId: "p1",
			quantity: 10,
			available: 10,
		});
	});

	it("emits inventory.updated on adjustStock", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		events.emitted.length = 0; // clear setStock events

		await ctrl.adjustStock({ productId: "p1", delta: -3 });

		const updated = events.emitted.filter(
			(e) => e.type === "inventory.updated",
		);
		expect(updated).toHaveLength(1);
		expect(updated[0].payload).toMatchObject({ quantity: 7, available: 7 });
	});

	it("emits inventory.updated on reserve", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		events.emitted.length = 0;

		await ctrl.reserve({ productId: "p1", quantity: 3 });

		const updated = events.emitted.filter(
			(e) => e.type === "inventory.updated",
		);
		expect(updated).toHaveLength(1);
		expect(updated[0].payload).toMatchObject({
			reserved: 3,
			available: 7,
		});
	});

	it("emits inventory.updated on release", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		await ctrl.reserve({ productId: "p1", quantity: 5 });
		events.emitted.length = 0;

		await ctrl.release({ productId: "p1", quantity: 2 });

		const updated = events.emitted.filter(
			(e) => e.type === "inventory.updated",
		);
		expect(updated).toHaveLength(1);
		expect(updated[0].payload).toMatchObject({
			reserved: 3,
			available: 7,
		});
	});

	it("emits inventory.updated on deduct", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);
		await ctrl.setStock({ productId: "p1", quantity: 10 });
		await ctrl.reserve({ productId: "p1", quantity: 5 });
		events.emitted.length = 0;

		await ctrl.deduct({ productId: "p1", quantity: 5 });

		const updated = events.emitted.filter(
			(e) => e.type === "inventory.updated",
		);
		expect(updated).toHaveLength(1);
		expect(updated[0].payload).toMatchObject({
			quantity: 5,
			reserved: 0,
			available: 5,
		});
	});

	it("emits inventory.low when stock drops below threshold", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);
		await ctrl.setStock({
			productId: "p1",
			quantity: 10,
			lowStockThreshold: 5,
		});
		events.emitted.length = 0;

		await ctrl.adjustStock({ productId: "p1", delta: -7 });

		const low = events.emitted.filter((e) => e.type === "inventory.low");
		expect(low).toHaveLength(1);
		expect(low[0].payload).toMatchObject({
			productId: "p1",
			quantity: 3,
			available: 3,
			lowStockThreshold: 5,
		});
	});

	it("emits inventory.low when stock is at exactly the threshold", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);

		await ctrl.setStock({
			productId: "p1",
			quantity: 5,
			lowStockThreshold: 5,
		});

		const low = events.emitted.filter((e) => e.type === "inventory.low");
		expect(low).toHaveLength(1);
	});

	it("does not emit inventory.low when stock is above threshold", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);

		await ctrl.setStock({
			productId: "p1",
			quantity: 20,
			lowStockThreshold: 5,
		});

		const low = events.emitted.filter((e) => e.type === "inventory.low");
		expect(low).toHaveLength(0);
	});

	it("does not emit inventory.low when no threshold is set", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);

		await ctrl.setStock({ productId: "p1", quantity: 0 });

		const low = events.emitted.filter((e) => e.type === "inventory.low");
		expect(low).toHaveLength(0);
	});

	it("emits inventory.low on reserve when available drops below threshold", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);
		await ctrl.setStock({
			productId: "p1",
			quantity: 10,
			lowStockThreshold: 5,
		});
		events.emitted.length = 0;

		await ctrl.reserve({ productId: "p1", quantity: 7 });

		const low = events.emitted.filter((e) => e.type === "inventory.low");
		expect(low).toHaveLength(1);
		expect(low[0].payload).toMatchObject({ available: 3 });
	});

	it("emits inventory.low on deduct when quantity drops below threshold", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);
		await ctrl.setStock({
			productId: "p1",
			quantity: 10,
			lowStockThreshold: 5,
		});
		await ctrl.reserve({ productId: "p1", quantity: 8 });
		events.emitted.length = 0;

		await ctrl.deduct({ productId: "p1", quantity: 8 });

		const low = events.emitted.filter((e) => e.type === "inventory.low");
		expect(low).toHaveLength(1);
		expect(low[0].payload).toMatchObject({
			quantity: 2,
			available: 2,
		});
	});

	it("does not emit events when no events emitter is provided", async () => {
		const ctrl = createInventoryController(createMockDataService());
		// Should not throw
		await ctrl.setStock({
			productId: "p1",
			quantity: 2,
			lowStockThreshold: 5,
		});
		await ctrl.adjustStock({ productId: "p1", delta: -1 });
		await expect(
			ctrl.reserve({ productId: "p1", quantity: 1 }),
		).resolves.toBeUndefined();
	});

	it("includes variantId and locationId in event payloads", async () => {
		const events = createMockEvents();
		const ctrl = createInventoryController(createMockDataService(), events);

		await ctrl.setStock({
			productId: "p1",
			variantId: "v1",
			locationId: "loc1",
			quantity: 3,
			lowStockThreshold: 5,
		});

		const low = events.emitted.filter((e) => e.type === "inventory.low");
		expect(low).toHaveLength(1);
		expect(low[0].payload).toMatchObject({
			productId: "p1",
			variantId: "v1",
			locationId: "loc1",
		});
	});

	it("emits inventory.back-in-stock when stock transitions from 0 to >0 via setStock", async () => {
		const events = createMockEvents();
		const ds = createMockDataService();
		const ctrl = createInventoryController(ds, events);

		// Set stock to 0 first
		await ctrl.setStock({ productId: "p1", quantity: 0 });

		// Add a subscriber
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
			productName: "Widget",
		});

		events.emitted.length = 0;

		// Restock
		await ctrl.setStock({ productId: "p1", quantity: 10 });

		// Wait for fire-and-forget async
		await new Promise((r) => setTimeout(r, 50));

		const backInStock = events.emitted.filter(
			(e) => e.type === "inventory.back-in-stock",
		);
		expect(backInStock).toHaveLength(1);
		const payload = backInStock[0].payload as {
			productId: string;
			available: number;
			subscribers: Array<{ email: string; productName?: string }>;
		};
		expect(payload.productId).toBe("p1");
		expect(payload.available).toBe(10);
		expect(payload.subscribers).toHaveLength(1);
		expect(payload.subscribers[0].email).toBe("test@example.com");
		expect(payload.subscribers[0].productName).toBe("Widget");
	});

	it("emits inventory.back-in-stock when stock transitions from 0 to >0 via adjustStock", async () => {
		const events = createMockEvents();
		const ds = createMockDataService();
		const ctrl = createInventoryController(ds, events);

		// Set stock to 0
		await ctrl.setStock({ productId: "p1", quantity: 0 });
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "user@example.com",
		});
		events.emitted.length = 0;

		// Restock via adjust
		await ctrl.adjustStock({ productId: "p1", delta: 5 });

		await new Promise((r) => setTimeout(r, 50));

		const backInStock = events.emitted.filter(
			(e) => e.type === "inventory.back-in-stock",
		);
		expect(backInStock).toHaveLength(1);
	});

	it("does not emit inventory.back-in-stock when stock stays above 0", async () => {
		const events = createMockEvents();
		const ds = createMockDataService();
		const ctrl = createInventoryController(ds, events);

		await ctrl.setStock({ productId: "p1", quantity: 10 });
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "user@example.com",
		});
		events.emitted.length = 0;

		await ctrl.setStock({ productId: "p1", quantity: 20 });

		await new Promise((r) => setTimeout(r, 50));

		const backInStock = events.emitted.filter(
			(e) => e.type === "inventory.back-in-stock",
		);
		expect(backInStock).toHaveLength(0);
	});

	it("does not emit inventory.back-in-stock when no subscribers exist", async () => {
		const events = createMockEvents();
		const ds = createMockDataService();
		const ctrl = createInventoryController(ds, events);

		await ctrl.setStock({ productId: "p1", quantity: 0 });
		events.emitted.length = 0;

		await ctrl.setStock({ productId: "p1", quantity: 10 });

		await new Promise((r) => setTimeout(r, 50));

		const backInStock = events.emitted.filter(
			(e) => e.type === "inventory.back-in-stock",
		);
		expect(backInStock).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// back-in-stock subscriptions
// ---------------------------------------------------------------------------

describe("subscribeBackInStock", () => {
	it("creates a new subscription", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const sub = await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
			productName: "Widget",
		});

		expect(sub.productId).toBe("p1");
		expect(sub.email).toBe("test@example.com");
		expect(sub.productName).toBe("Widget");
		expect(sub.status).toBe("active");
		expect(sub.subscribedAt).toBeInstanceOf(Date);
	});

	it("returns existing active subscription without duplicating", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const sub1 = await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
		});
		const sub2 = await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
		});

		expect(sub1.id).toBe(sub2.id);
	});

	it("normalizes email to lowercase", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const sub = await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "Test@EXAMPLE.com",
		});

		expect(sub.email).toBe("test@example.com");
	});

	it("creates separate subscriptions for different products", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const sub1 = await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
		});
		const sub2 = await ctrl.subscribeBackInStock({
			productId: "p2",
			email: "test@example.com",
		});

		expect(sub1.id).not.toBe(sub2.id);
	});

	it("creates separate subscriptions for different variants", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const sub1 = await ctrl.subscribeBackInStock({
			productId: "p1",
			variantId: "v1",
			email: "test@example.com",
		});
		const sub2 = await ctrl.subscribeBackInStock({
			productId: "p1",
			variantId: "v2",
			email: "test@example.com",
		});

		expect(sub1.id).not.toBe(sub2.id);
	});

	it("stores optional customerId", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const sub = await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
			customerId: "cust_123",
		});

		expect(sub.customerId).toBe("cust_123");
	});
});

describe("unsubscribeBackInStock", () => {
	it("removes an existing subscription", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
		});

		const removed = await ctrl.unsubscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
		});

		expect(removed).toBe(true);
	});

	it("returns false if no subscription exists", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const removed = await ctrl.unsubscribeBackInStock({
			productId: "p1",
			email: "nonexistent@example.com",
		});

		expect(removed).toBe(false);
	});
});

describe("checkBackInStockSubscription", () => {
	it("returns true for an active subscription", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
		});

		const subscribed = await ctrl.checkBackInStockSubscription({
			productId: "p1",
			email: "test@example.com",
		});

		expect(subscribed).toBe(true);
	});

	it("returns false after unsubscribing", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
		});
		await ctrl.unsubscribeBackInStock({
			productId: "p1",
			email: "test@example.com",
		});

		const subscribed = await ctrl.checkBackInStockSubscription({
			productId: "p1",
			email: "test@example.com",
		});

		expect(subscribed).toBe(false);
	});

	it("returns false for a non-existent subscription", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const subscribed = await ctrl.checkBackInStockSubscription({
			productId: "p1",
			email: "nope@example.com",
		});

		expect(subscribed).toBe(false);
	});
});

describe("getBackInStockSubscribers", () => {
	it("returns active subscribers for a product", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "a@example.com",
		});
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "b@example.com",
		});
		await ctrl.subscribeBackInStock({
			productId: "p2",
			email: "c@example.com",
		});

		const subs = await ctrl.getBackInStockSubscribers({ productId: "p1" });
		expect(subs).toHaveLength(2);
		expect(subs.map((s) => s.email).sort((a, b) => a.localeCompare(b))).toEqual(
			["a@example.com", "b@example.com"],
		);
	});
});

describe("listBackInStockSubscriptions", () => {
	it("lists all subscriptions", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "a@example.com",
		});
		await ctrl.subscribeBackInStock({
			productId: "p2",
			email: "b@example.com",
		});

		const subs = await ctrl.listBackInStockSubscriptions();
		expect(subs).toHaveLength(2);
	});

	it("filters by status", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "a@example.com",
		});

		const active = await ctrl.listBackInStockSubscriptions({
			status: "active",
		});
		expect(active).toHaveLength(1);

		const notified = await ctrl.listBackInStockSubscriptions({
			status: "notified",
		});
		expect(notified).toHaveLength(0);
	});

	it("filters by productId", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "a@example.com",
		});
		await ctrl.subscribeBackInStock({
			productId: "p2",
			email: "b@example.com",
		});

		const subs = await ctrl.listBackInStockSubscriptions({
			productId: "p1",
		});
		expect(subs).toHaveLength(1);
		expect(subs[0].productId).toBe("p1");
	});
});

describe("getBackInStockStats", () => {
	it("returns correct stats", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "a@example.com",
		});
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "b@example.com",
		});
		await ctrl.subscribeBackInStock({
			productId: "p2",
			email: "c@example.com",
		});

		const stats = await ctrl.getBackInStockStats();
		expect(stats.totalActive).toBe(3);
		expect(stats.totalNotified).toBe(0);
		expect(stats.uniqueProducts).toBe(2);
	});
});

describe("markSubscribersNotified", () => {
	it("marks all active subscribers for a product as notified", async () => {
		const ctrl = createInventoryController(createMockDataService());
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "a@example.com",
		});
		await ctrl.subscribeBackInStock({
			productId: "p1",
			email: "b@example.com",
		});

		const count = await ctrl.markSubscribersNotified({ productId: "p1" });
		expect(count).toBe(2);

		const stats = await ctrl.getBackInStockStats();
		expect(stats.totalActive).toBe(0);
		expect(stats.totalNotified).toBe(2);
	});

	it("returns 0 when no subscribers exist", async () => {
		const ctrl = createInventoryController(createMockDataService());
		const count = await ctrl.markSubscribersNotified({ productId: "p1" });
		expect(count).toBe(0);
	});
});
