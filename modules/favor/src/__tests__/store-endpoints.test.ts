import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFavorController } from "../service-impl";

/**
 * Store endpoint integration tests for the favor module.
 *
 * These tests simulate the business logic executed by store-facing endpoints:
 *
 * 1. check-availability: returns whether Favor delivery is available in a zip code
 * 2. create-delivery: creates a new delivery (admin only)
 * 3. get-delivery: retrieves delivery status and tracking info (admin only)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ────────────────────────────────────────────

async function simulateCheckAvailability(data: DataService, zipCode: string) {
	const controller = createFavorController(data);
	const result = await controller.checkAvailability(zipCode);
	return {
		available: result.available,
		deliveryFee: result.area?.deliveryFee,
		estimatedMinutes: result.area?.estimatedMinutes,
		minOrderAmount: result.area?.minOrderAmount,
	};
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
		specialInstructions?: string;
	},
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createFavorController(data);
	const delivery = await controller.createDelivery({
		orderId: body.orderId,
		pickupAddress: body.pickupAddress,
		dropoffAddress: body.dropoffAddress,
		fee: body.fee,
		tip: body.tip,
		specialInstructions: body.specialInstructions,
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
	const controller = createFavorController(data);
	const delivery = await controller.getDelivery(deliveryId);
	if (!delivery) {
		return { error: "Delivery not found", status: 404 };
	}
	return {
		id: delivery.id,
		orderId: delivery.orderId,
		status: delivery.status,
		trackingUrl: delivery.trackingUrl,
		runnerName: delivery.runnerName,
		estimatedArrival: delivery.estimatedArrival,
		fee: delivery.fee,
		tip: delivery.tip,
	};
}

// ── Tests: check-availability ──────────────────────────────────────────

describe("store endpoint: check-availability", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns available when zip code is in a configured service area", async () => {
		const ctrl = createFavorController(data);
		await ctrl.createServiceArea({
			name: "Austin Metro",
			zipCodes: ["78701", "78702", "78703"],
			deliveryFee: 399,
			estimatedMinutes: 30,
			minOrderAmount: 2000,
		});

		const result = await simulateCheckAvailability(data, "78702");

		expect(result.available).toBe(true);
		expect(result.deliveryFee).toBe(399);
		expect(result.estimatedMinutes).toBe(30);
		expect(result.minOrderAmount).toBe(2000);
	});

	it("returns not available when zip code is not covered", async () => {
		const ctrl = createFavorController(data);
		await ctrl.createServiceArea({
			name: "Austin Metro",
			zipCodes: ["78701", "78702"],
			deliveryFee: 299,
			estimatedMinutes: 25,
		});

		const result = await simulateCheckAvailability(data, "90210");

		expect(result.available).toBe(false);
		expect(result.deliveryFee).toBeUndefined();
		expect(result.estimatedMinutes).toBeUndefined();
	});

	it("returns not available when no service areas are configured", async () => {
		const result = await simulateCheckAvailability(data, "78701");

		expect(result.available).toBe(false);
	});

	it("returns the correct area details when multiple service areas exist", async () => {
		const ctrl = createFavorController(data);
		await ctrl.createServiceArea({
			name: "Downtown",
			zipCodes: ["78701"],
			deliveryFee: 199,
			estimatedMinutes: 20,
			minOrderAmount: 1500,
		});
		await ctrl.createServiceArea({
			name: "North Austin",
			zipCodes: ["78729", "78750"],
			deliveryFee: 499,
			estimatedMinutes: 45,
			minOrderAmount: 2500,
		});

		const downtown = await simulateCheckAvailability(data, "78701");
		expect(downtown.available).toBe(true);
		expect(downtown.deliveryFee).toBe(199);
		expect(downtown.estimatedMinutes).toBe(20);

		const north = await simulateCheckAvailability(data, "78750");
		expect(north.available).toBe(true);
		expect(north.deliveryFee).toBe(499);
		expect(north.estimatedMinutes).toBe(45);
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
			pickupAddress: { street: "123 Main" },
			dropoffAddress: { street: "456 Oak" },
			fee: 499,
		});

		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("creates a delivery for an admin user", async () => {
		const result = await simulateCreateDelivery(data, true, {
			orderId: "ord_1",
			pickupAddress: { street: "123 Main St", city: "Austin" },
			dropoffAddress: { street: "456 Oak Ave", city: "Austin" },
			fee: 499,
			tip: 100,
		});

		expect("delivery" in result).toBe(true);
		if ("delivery" in result) {
			expect(result.delivery.orderId).toBe("ord_1");
			expect(result.delivery.status).toBe("pending");
			expect(result.delivery.fee).toBe(499);
			expect(result.delivery.tip).toBe(100);
		}
	});

	it("applies default tip of 0 when not specified", async () => {
		const result = await simulateCreateDelivery(data, true, {
			orderId: "ord_2",
			pickupAddress: { street: "789 Pine" },
			dropoffAddress: { street: "321 Maple" },
			fee: 299,
		});

		expect("delivery" in result).toBe(true);
		if ("delivery" in result) {
			expect(result.delivery.tip).toBe(0);
		}
	});

	it("stores special instructions when provided", async () => {
		const result = await simulateCreateDelivery(data, true, {
			orderId: "ord_3",
			pickupAddress: { street: "1 Baker St" },
			dropoffAddress: { street: "2 Elm St" },
			fee: 399,
			specialInstructions: "Leave at the door",
		});

		expect("delivery" in result).toBe(true);
		if ("delivery" in result) {
			expect(result.delivery).toMatchObject({
				orderId: "ord_3",
				specialInstructions: "Leave at the door",
			});
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
		const ctrl = createFavorController(data);
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

	it("returns tracking url when set on the delivery", async () => {
		const ctrl = createFavorController(data);
		const created = await ctrl.createDelivery({
			orderId: "ord_5",
			pickupAddress: { street: "5 Main St" },
			dropoffAddress: { street: "10 Oak Ave" },
			fee: 499,
		});
		await ctrl.updateDeliveryStatus(created.id, "assigned", {
			trackingUrl: "https://favor.com/track/abc123",
		});

		const result = await simulateGetDelivery(data, true, created.id);

		if ("trackingUrl" in result) {
			expect(result.trackingUrl).toBe("https://favor.com/track/abc123");
		}
	});
});
