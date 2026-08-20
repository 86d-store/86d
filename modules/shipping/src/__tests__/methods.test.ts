import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createShippingController } from "../service-impl";

// ---------------------------------------------------------------------------
// createMethod / getMethod
// ---------------------------------------------------------------------------

describe("createMethod", () => {
	it("creates a method with defaults", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});

		expect(method.name).toBe("Standard");
		expect(method.estimatedDaysMin).toBe(5);
		expect(method.estimatedDaysMax).toBe(7);
		expect(method.isActive).toBe(true);
		expect(method.sortOrder).toBe(0);
		expect(method.id).toBeTruthy();
	});

	it("accepts optional description", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Express",
			description: "Fast delivery",
			estimatedDaysMin: 1,
			estimatedDaysMax: 2,
		});
		expect(method.description).toBe("Fast delivery");
	});

	it("creates an inactive method", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Draft",
			estimatedDaysMin: 3,
			estimatedDaysMax: 5,
			isActive: false,
		});
		expect(method.isActive).toBe(false);
	});

	it("accepts custom sort order", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Priority",
			estimatedDaysMin: 1,
			estimatedDaysMax: 1,
			sortOrder: 10,
		});
		expect(method.sortOrder).toBe(10);
	});

	it("sets timestamps", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Test",
			estimatedDaysMin: 1,
			estimatedDaysMax: 3,
		});
		expect(method.createdAt).toBeInstanceOf(Date);
		expect(method.updatedAt).toBeInstanceOf(Date);
	});
});

describe("getMethod", () => {
	it("returns null for missing method", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.getMethod("nope")).toBeNull();
	});

	it("returns method when it exists", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});
		const fetched = await ctrl.getMethod(method.id);
		expect(fetched?.name).toBe("Standard");
		expect(fetched?.estimatedDaysMin).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// listMethods
// ---------------------------------------------------------------------------

describe("listMethods", () => {
	it("lists all methods", async () => {
		const ctrl = createShippingController(createMockDataService());
		await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});
		await ctrl.createMethod({
			name: "Express",
			estimatedDaysMin: 1,
			estimatedDaysMax: 2,
		});
		expect(await ctrl.listMethods()).toHaveLength(2);
	});

	it("filters by activeOnly", async () => {
		const ctrl = createShippingController(createMockDataService());
		await ctrl.createMethod({
			name: "Active",
			estimatedDaysMin: 3,
			estimatedDaysMax: 5,
		});
		await ctrl.createMethod({
			name: "Inactive",
			estimatedDaysMin: 1,
			estimatedDaysMax: 2,
			isActive: false,
		});
		const active = await ctrl.listMethods({ activeOnly: true });
		expect(active).toHaveLength(1);
		expect(active[0].name).toBe("Active");
	});

	it("returns empty array when no methods exist", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.listMethods()).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// updateMethod
// ---------------------------------------------------------------------------

describe("updateMethod", () => {
	it("updates method name", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Old",
			estimatedDaysMin: 3,
			estimatedDaysMax: 5,
		});
		const updated = await ctrl.updateMethod(method.id, { name: "New" });
		expect(updated?.name).toBe("New");
		expect(updated?.estimatedDaysMin).toBe(3);
	});

	it("updates estimated days", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});
		const updated = await ctrl.updateMethod(method.id, {
			estimatedDaysMin: 3,
			estimatedDaysMax: 4,
		});
		expect(updated?.estimatedDaysMin).toBe(3);
		expect(updated?.estimatedDaysMax).toBe(4);
	});

	it("updates description", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});
		const updated = await ctrl.updateMethod(method.id, {
			description: "Regular delivery",
		});
		expect(updated?.description).toBe("Regular delivery");
	});

	it("updates sort order", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});
		const updated = await ctrl.updateMethod(method.id, { sortOrder: 5 });
		expect(updated?.sortOrder).toBe(5);
	});

	it("toggles active status", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});
		const deactivated = await ctrl.updateMethod(method.id, {
			isActive: false,
		});
		expect(deactivated?.isActive).toBe(false);
		const reactivated = await ctrl.updateMethod(method.id, {
			isActive: true,
		});
		expect(reactivated?.isActive).toBe(true);
	});

	it("returns null for missing method", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.updateMethod("nope", { name: "Fail" })).toBeNull();
	});

	it("preserves fields not included in update", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			description: "Regular",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
			sortOrder: 3,
		});
		const updated = await ctrl.updateMethod(method.id, { name: "Updated" });
		expect(updated?.description).toBe("Regular");
		expect(updated?.estimatedDaysMin).toBe(5);
		expect(updated?.sortOrder).toBe(3);
	});

	it("updates the updatedAt timestamp", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});
		const updated = await ctrl.updateMethod(method.id, { name: "New" });
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			method.updatedAt.getTime(),
		);
	});
});

// ---------------------------------------------------------------------------
// deleteMethod
// ---------------------------------------------------------------------------

describe("deleteMethod", () => {
	it("deletes an existing method", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});
		expect(await ctrl.deleteMethod(method.id)).toBe(true);
		expect(await ctrl.getMethod(method.id)).toBeNull();
	});

	it("returns false for missing method", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.deleteMethod("nope")).toBe(false);
	});

	it("double delete returns false", async () => {
		const ctrl = createShippingController(createMockDataService());
		const method = await ctrl.createMethod({
			name: "Standard",
			estimatedDaysMin: 5,
			estimatedDaysMax: 7,
		});
		await ctrl.deleteMethod(method.id);
		expect(await ctrl.deleteMethod(method.id)).toBe(false);
	});
});
