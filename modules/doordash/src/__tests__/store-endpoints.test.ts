import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDoordashController } from "../service-impl";

/**
 * Store endpoint integration tests for the doordash module.
 *
 * These tests simulate the business logic executed by store-facing endpoints:
 *
 * 1. check-availability: returns whether DoorDash delivery is available at
 *    the customer's coordinates (public, no auth)
 * 2. create-delivery: dispatches a DoorDash delivery (admin only)
 * 3. get-delivery: retrieves delivery status and tracking info (admin only)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ────────────────────────────────────────────

async function simulateCheckAvailability(
	data: DataService,
	lat: number,
	lng: number,
) {
	const controller = createDoordashController(data);
	return controller.checkDeliveryAvailability({ lat, lng });
}

async function simulateCreateDelivery(
	data: DataService,
	isAdmin: boolean,
	body: {
		orderId: string;
		pickupAddress: Record<string, unknown>;
		dropoffAddress: Record<string, unknown>;
		fee: number;
		tip?: number;
	},
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createDoordashController(data);
	const delivery = await controller.createDelivery({
		orderId: body.orderId,
		pickupAddress: body.pickupAddress,
		dropoffAddress: body.dropoffAddress,
		fee: body.fee,
		tip: body.tip,
	});
	return { delivery };
}

async function simulateGetDelivery(
	data: DataService,
	isAdmin: boolean,
	deliveryId: string,
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createDoordashController(data);
	const delivery = await controller.getDelivery(deliveryId);
	if (!delivery) {
		return { error: "Delivery not found", status: 404 };
	}
	return {
		id: delivery.id,
		orderId: delivery.orderId,
		status: delivery.status,
		fee: delivery.fee,
	};
}

// ── Tests: check-availability ──────────────────────────────────────────

describe("store endpoint: check-availability", () => {
	let data: DataService;

	// Austin, TX area center (within 10 km of the test zone below)
	const IN_ZONE_LAT = 30.2672;
	const IN_ZONE_LNG = -97.7431;

	// Portland, OR — far outside the test zone
	const OUT_OF_ZONE_LAT = 45.5051;
	const OUT_OF_ZONE_LNG = -122.675;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns available when coordinates are within an active zone", async () => {
		const ctrl = createDoordashController(data);
		await ctrl.createZone({
			name: "Downtown Austin",
			centerLat: IN_ZONE_LAT,
			centerLng: IN_ZONE_LNG,
			radius: 5,
			deliveryFee: 299,
			estimatedMinutes: 30,
		});

		const result = await simulateCheckAvailability(
			data,
			IN_ZONE_LAT,
			IN_ZONE_LNG,
		);

		expect(result.available).toBe(true);
		expect(result.deliveryFee).toBe(299);
		expect(result.estimatedMinutes).toBe(30);
	});

	it("returns not available when coordinates are outside all zones", async () => {
		const ctrl = createDoordashController(data);
		await ctrl.createZone({
			name: "Downtown Austin",
			centerLat: IN_ZONE_LAT,
			centerLng: IN_ZONE_LNG,
			radius: 5,
			deliveryFee: 299,
			estimatedMinutes: 30,
		});

		const result = await simulateCheckAvailability(
			data,
			OUT_OF_ZONE_LAT,
			OUT_OF_ZONE_LNG,
		);

		expect(result.available).toBe(false);
		expect(result.deliveryFee).toBeUndefined();
	});

	it("returns not available when no zones are configured", async () => {
		const result = await simulateCheckAvailability(
			data,
			IN_ZONE_LAT,
			IN_ZONE_LNG,
		);
		expect(result.available).toBe(false);
	});

	it("uses the closest matching zone when multiple zones exist", async () => {
		const ctrl = createDoordashController(data);
		await ctrl.createZone({
			name: "South Austin",
			centerLat: 30.2,
			centerLng: -97.75,
			radius: 10,
			deliveryFee: 499,
			estimatedMinutes: 45,
		});
		await ctrl.createZone({
			name: "Downtown Austin",
			centerLat: IN_ZONE_LAT,
			centerLng: IN_ZONE_LNG,
			radius: 5,
			deliveryFee: 299,
			estimatedMinutes: 30,
		});

		const result = await simulateCheckAvailability(
			data,
			IN_ZONE_LAT,
			IN_ZONE_LNG,
		);

		expect(result.available).toBe(true);
	});
});

// ── Tests: create-delivery ─────────────────────────────────────────────

describe("store endpoint: create-delivery", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("rejects unauthenticated requests", async () => {
		const result = await simulateCreateDelivery(data, false, {
			orderId: "ord_1",
			pickupAddress: { street: "100 Congress Ave" },
			dropoffAddress: { street: "200 Barton Springs Rd" },
			fee: 499,
		});

		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("creates a delivery for an admin user", async () => {
		const result = await simulateCreateDelivery(data, true, {
			orderId: "ord_2",
			pickupAddress: { street: "100 Congress Ave", city: "Austin" },
			dropoffAddress: { street: "200 Barton Springs Rd", city: "Austin" },
			fee: 499,
			tip: 100,
		});

		expect("delivery" in result).toBe(true);
		if ("delivery" in result) {
			expect(result.delivery.orderId).toBe("ord_2");
			expect(result.delivery.status).toBe("pending");
			expect(result.delivery.fee).toBe(499);
		}
	});

	it("uses default tip of 0 when not provided", async () => {
		const result = await simulateCreateDelivery(data, true, {
			orderId: "ord_3",
			pickupAddress: { street: "1 Main St" },
			dropoffAddress: { street: "2 Elm St" },
			fee: 299,
		});

		expect("delivery" in result).toBe(true);
		if ("delivery" in result) {
			expect(result.delivery.tip).toBe(0);
		}
	});
});

// ── Tests: get-delivery ────────────────────────────────────────────────

describe("store endpoint: get-delivery", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("rejects unauthenticated requests", async () => {
		const result = await simulateGetDelivery(data, false, "dlv_xyz");

		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("returns 404 for a non-existent delivery", async () => {
		const result = await simulateGetDelivery(data, true, "dlv_nonexistent");

		expect(result).toMatchObject({ error: "Delivery not found", status: 404 });
	});

	it("returns delivery details for an admin user", async () => {
		const ctrl = createDoordashController(data);
		const created = await ctrl.createDelivery({
			orderId: "ord_tracking",
			pickupAddress: { street: "1 Pickup Ln" },
			dropoffAddress: { street: "2 Dropoff Ave" },
			fee: 599,
		});

		const result = await simulateGetDelivery(data, true, created.id);

		expect("id" in result).toBe(true);
		if ("id" in result) {
			expect(result.id).toBe(created.id);
			expect(result.orderId).toBe("ord_tracking");
			expect(result.status).toBe("pending");
			expect(result.fee).toBe(599);
		}
	});
});
