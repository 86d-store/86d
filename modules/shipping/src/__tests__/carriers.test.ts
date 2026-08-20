import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createShippingController } from "../service-impl";

// ---------------------------------------------------------------------------
// createCarrier / getCarrier
// ---------------------------------------------------------------------------

describe("createCarrier", () => {
	it("creates a carrier with defaults", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
		});

		expect(carrier.name).toBe("FedEx");
		expect(carrier.code).toBe("fedex");
		expect(carrier.isActive).toBe(true);
		expect(carrier.id).toBeTruthy();
	});

	it("normalizes code to lowercase", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "UPS",
			code: "UPS",
		});
		expect(carrier.code).toBe("ups");
	});

	it("accepts tracking URL template", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
			trackingUrlTemplate:
				"https://www.fedex.com/fedextrack/?trknbr={tracking}",
		});
		expect(carrier.trackingUrlTemplate).toBe(
			"https://www.fedex.com/fedextrack/?trknbr={tracking}",
		);
	});

	it("creates inactive carrier", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "Draft Carrier",
			code: "draft",
			isActive: false,
		});
		expect(carrier.isActive).toBe(false);
	});

	it("sets timestamps", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "Test",
			code: "test",
		});
		expect(carrier.createdAt).toBeInstanceOf(Date);
		expect(carrier.updatedAt).toBeInstanceOf(Date);
	});
});

describe("getCarrier", () => {
	it("returns null for missing carrier", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.getCarrier("nope")).toBeNull();
	});

	it("returns carrier when it exists", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "UPS",
			code: "ups",
		});
		const fetched = await ctrl.getCarrier(carrier.id);
		expect(fetched?.name).toBe("UPS");
		expect(fetched?.code).toBe("ups");
	});
});

// ---------------------------------------------------------------------------
// listCarriers
// ---------------------------------------------------------------------------

describe("listCarriers", () => {
	it("lists all carriers", async () => {
		const ctrl = createShippingController(createMockDataService());
		await ctrl.createCarrier({ name: "FedEx", code: "fedex" });
		await ctrl.createCarrier({ name: "UPS", code: "ups" });
		await ctrl.createCarrier({ name: "USPS", code: "usps" });
		expect(await ctrl.listCarriers()).toHaveLength(3);
	});

	it("filters by activeOnly", async () => {
		const ctrl = createShippingController(createMockDataService());
		await ctrl.createCarrier({ name: "Active", code: "active" });
		await ctrl.createCarrier({
			name: "Inactive",
			code: "inactive",
			isActive: false,
		});
		const active = await ctrl.listCarriers({ activeOnly: true });
		expect(active).toHaveLength(1);
		expect(active[0].name).toBe("Active");
	});

	it("returns empty array when no carriers exist", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.listCarriers()).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// updateCarrier
// ---------------------------------------------------------------------------

describe("updateCarrier", () => {
	it("updates carrier name", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "Old Name",
			code: "old",
		});
		const updated = await ctrl.updateCarrier(carrier.id, {
			name: "New Name",
		});
		expect(updated?.name).toBe("New Name");
		expect(updated?.code).toBe("old");
	});

	it("updates carrier code (lowercased)", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "Carrier",
			code: "old",
		});
		const updated = await ctrl.updateCarrier(carrier.id, { code: "NEW" });
		expect(updated?.code).toBe("new");
	});

	it("updates tracking URL template", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
		});
		const updated = await ctrl.updateCarrier(carrier.id, {
			trackingUrlTemplate: "https://track.fedex.com/{tracking}",
		});
		expect(updated?.trackingUrlTemplate).toBe(
			"https://track.fedex.com/{tracking}",
		);
	});

	it("toggles active status", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
		});
		const deactivated = await ctrl.updateCarrier(carrier.id, {
			isActive: false,
		});
		expect(deactivated?.isActive).toBe(false);
	});

	it("returns null for missing carrier", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.updateCarrier("nope", { name: "Fail" })).toBeNull();
	});

	it("preserves fields not included in update", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
			trackingUrlTemplate: "https://track.fedex.com/{tracking}",
		});
		const updated = await ctrl.updateCarrier(carrier.id, {
			name: "FedEx Ground",
		});
		expect(updated?.code).toBe("fedex");
		expect(updated?.trackingUrlTemplate).toBe(
			"https://track.fedex.com/{tracking}",
		);
	});

	it("updates the updatedAt timestamp", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
		});
		const updated = await ctrl.updateCarrier(carrier.id, {
			name: "Updated",
		});
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			carrier.updatedAt.getTime(),
		);
	});
});

// ---------------------------------------------------------------------------
// deleteCarrier
// ---------------------------------------------------------------------------

describe("deleteCarrier", () => {
	it("deletes an existing carrier", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
		});
		expect(await ctrl.deleteCarrier(carrier.id)).toBe(true);
		expect(await ctrl.getCarrier(carrier.id)).toBeNull();
	});

	it("returns false for missing carrier", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.deleteCarrier("nope")).toBe(false);
	});

	it("double delete returns false", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
		});
		await ctrl.deleteCarrier(carrier.id);
		expect(await ctrl.deleteCarrier(carrier.id)).toBe(false);
	});
});
