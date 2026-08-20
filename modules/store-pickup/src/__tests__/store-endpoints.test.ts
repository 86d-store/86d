import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createStorePickupController } from "../service-impl";

/**
 * Store endpoint integration tests for the store-pickup module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-locations: returns only active locations
 * 2. available-windows: returns availability with capacity, respects blackouts,
 *    empty for inactive location
 * 3. schedule-pickup: successful scheduling, validates day-of-week match,
 *    prevents duplicate, respects capacity
 * 4. order-pickup: returns pickup for order, returns null for unknown
 * 5. cancel-pickup: cancels scheduled pickup, throws on already cancelled,
 *    throws on picked_up
 */

type DataService = ReturnType<typeof createMockDataService>;

// 2026-03-09 is a Monday (dayOfWeek = 1)
const MONDAY_DATE = "2026-03-09";
// 2026-03-10 is a Tuesday (dayOfWeek = 2)
const TUESDAY_DATE = "2026-03-10";

const makeLocation = (overrides?: Record<string, unknown>) => ({
	name: "Downtown Store",
	address: "123 Main St",
	city: "Portland",
	state: "OR",
	postalCode: "97201",
	country: "US",
	...overrides,
});

const makeWindow = (
	locationId: string,
	overrides?: Record<string, unknown>,
) => ({
	locationId,
	dayOfWeek: 1, // Monday
	startTime: "09:00",
	endTime: "12:00",
	capacity: 5,
	...overrides,
});

// ── Simulate store-facing endpoint logic ───────────────────────────

async function simulateListLocationsStore(data: DataService) {
	const controller = createStorePickupController(data);
	const locations = await controller.listLocations({ active: true });
	return { locations };
}

async function simulateAvailableWindows(
	data: DataService,
	params: { locationId: string; date: string },
) {
	const controller = createStorePickupController(data);
	const windows = await controller.getAvailableWindows(params);
	return { windows };
}

async function simulateSchedulePickup(
	data: DataService,
	body: {
		locationId: string;
		windowId: string;
		orderId: string;
		scheduledDate: string;
		customerId?: string;
		notes?: string;
	},
) {
	const controller = createStorePickupController(data);
	try {
		const pickup = await controller.schedulePickup(body);
		return { pickup };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Scheduling failed";
		return { error: msg, status: 400 };
	}
}

async function simulateOrderPickup(data: DataService, orderId: string) {
	const controller = createStorePickupController(data);
	const pickup = await controller.getOrderPickup(orderId);
	return { pickup };
}

async function simulateCancelPickup(data: DataService, pickupId: string) {
	const controller = createStorePickupController(data);
	try {
		const cancelled = await controller.cancelPickup(pickupId);
		if (!cancelled) {
			return { error: "Pickup not found", status: 404 };
		}
		return { pickup: cancelled };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Cancel failed";
		return { error: msg, status: 400 };
	}
}

// ── Helpers ────────────────────────────────────────────────────────

async function seedActiveAndInactiveLocations(data: DataService) {
	const controller = createStorePickupController(data);
	const active1 = await controller.createLocation(
		makeLocation({ name: "Active Downtown", active: true }),
	);
	const active2 = await controller.createLocation(
		makeLocation({ name: "Active Uptown", active: true }),
	);
	const inactive = await controller.createLocation(
		makeLocation({ name: "Closed Eastside", active: false }),
	);
	return { active1, active2, inactive };
}

async function seedLocationWithWindow(data: DataService) {
	const controller = createStorePickupController(data);
	const location = await controller.createLocation(makeLocation());
	const window = await controller.createWindow(
		makeWindow(location.id, { capacity: 3 }),
	);
	return { controller, location, window };
}

// ── Tests ──────────────────────────────────────────────────────────

describe("store endpoint: list locations", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active locations", async () => {
		const { active1, active2 } = await seedActiveAndInactiveLocations(data);

		const result = await simulateListLocationsStore(data);

		expect(result.locations).toHaveLength(2);
		const names = result.locations.map((l) => l.name);
		expect(names).toContain(active1.name);
		expect(names).toContain(active2.name);
		expect(names).not.toContain("Closed Eastside");
	});

	it("returns empty when no locations are active", async () => {
		const controller = createStorePickupController(data);
		await controller.createLocation(makeLocation({ active: false }));

		const result = await simulateListLocationsStore(data);

		expect(result.locations).toHaveLength(0);
	});
});

describe("store endpoint: available windows", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns availability with capacity info per window", async () => {
		const { location, window } = await seedLocationWithWindow(data);

		const result = await simulateAvailableWindows(data, {
			locationId: location.id,
			date: MONDAY_DATE,
		});

		expect(result.windows).toHaveLength(1);
		expect(result.windows[0].window.id).toBe(window.id);
		expect(result.windows[0].available).toBe(true);
		expect(result.windows[0].remaining).toBe(3);
		expect(result.windows[0].booked).toBe(0);
		expect(result.windows[0].date).toBe(MONDAY_DATE);
	});

	it("shows reduced capacity after bookings", async () => {
		const { controller, location, window } = await seedLocationWithWindow(data);
		await controller.schedulePickup({
			locationId: location.id,
			windowId: window.id,
			orderId: "order_booked_1",
			scheduledDate: MONDAY_DATE,
		});

		const result = await simulateAvailableWindows(data, {
			locationId: location.id,
			date: MONDAY_DATE,
		});

		expect(result.windows).toHaveLength(1);
		expect(result.windows[0].booked).toBe(1);
		expect(result.windows[0].remaining).toBe(2);
		expect(result.windows[0].available).toBe(true);
	});

	it("respects blackout dates and returns empty", async () => {
		const { controller, location } = await seedLocationWithWindow(data);
		await controller.createBlackout({
			locationId: location.id,
			date: MONDAY_DATE,
			reason: "Holiday closure",
		});

		const result = await simulateAvailableWindows(data, {
			locationId: location.id,
			date: MONDAY_DATE,
		});

		expect(result.windows).toHaveLength(0);
	});

	it("returns empty for inactive location", async () => {
		const controller = createStorePickupController(data);
		const location = await controller.createLocation(
			makeLocation({ active: false }),
		);
		await controller.createWindow(makeWindow(location.id));

		const result = await simulateAvailableWindows(data, {
			locationId: location.id,
			date: MONDAY_DATE,
		});

		expect(result.windows).toHaveLength(0);
	});

	it("returns empty when no windows match the day of week", async () => {
		const { location } = await seedLocationWithWindow(data);

		const result = await simulateAvailableWindows(data, {
			locationId: location.id,
			date: TUESDAY_DATE,
		});

		expect(result.windows).toHaveLength(0);
	});
});

describe("store endpoint: schedule pickup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("successfully schedules a pickup", async () => {
		const { location, window } = await seedLocationWithWindow(data);

		const result = await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_100",
			scheduledDate: MONDAY_DATE,
			customerId: "cust_1",
			notes: "Ring the bell",
		});

		expect("pickup" in result).toBe(true);
		if ("pickup" in result) {
			expect(result.pickup.orderId).toBe("order_100");
			expect(result.pickup.status).toBe("scheduled");
			expect(result.pickup.locationId).toBe(location.id);
			expect(result.pickup.windowId).toBe(window.id);
			expect(result.pickup.scheduledDate).toBe(MONDAY_DATE);
			expect(result.pickup.customerId).toBe("cust_1");
			expect(result.pickup.notes).toBe("Ring the bell");
			expect(result.pickup.locationName).toBe("Downtown Store");
			expect(result.pickup.startTime).toBe("09:00");
			expect(result.pickup.endTime).toBe("12:00");
		}
	});

	it("rejects when scheduled date does not match window day of week", async () => {
		const { location, window } = await seedLocationWithWindow(data);

		const result = await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_200",
			scheduledDate: TUESDAY_DATE,
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe(
				"Scheduled date does not match the window's day of week",
			);
		}
	});

	it("prevents duplicate active pickup for the same order", async () => {
		const { location, window } = await seedLocationWithWindow(data);

		await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_300",
			scheduledDate: MONDAY_DATE,
		});

		const result = await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_300",
			scheduledDate: MONDAY_DATE,
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Order already has an active pickup scheduled");
		}
	});

	it("allows rescheduling after cancellation", async () => {
		const { controller, location, window } = await seedLocationWithWindow(data);

		const first = await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_350",
			scheduledDate: MONDAY_DATE,
		});
		expect("pickup" in first).toBe(true);
		if ("pickup" in first) {
			await controller.cancelPickup(first.pickup.id);
		}

		const second = await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_350",
			scheduledDate: MONDAY_DATE,
		});

		expect("pickup" in second).toBe(true);
		if ("pickup" in second) {
			expect(second.pickup.status).toBe("scheduled");
		}
	});

	it("respects capacity and rejects when fully booked", async () => {
		const { location, window } = await seedLocationWithWindow(data);

		for (let i = 0; i < 3; i++) {
			const res = await simulateSchedulePickup(data, {
				locationId: location.id,
				windowId: window.id,
				orderId: `order_cap_${i}`,
				scheduledDate: MONDAY_DATE,
			});
			expect("pickup" in res).toBe(true);
		}

		const result = await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_cap_overflow",
			scheduledDate: MONDAY_DATE,
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Pickup window is fully booked");
		}
	});

	it("rejects when location is inactive", async () => {
		const controller = createStorePickupController(data);
		const location = await controller.createLocation(
			makeLocation({ active: false }),
		);
		const window = await controller.createWindow(makeWindow(location.id));

		const result = await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_inactive",
			scheduledDate: MONDAY_DATE,
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Pickup location is not available");
		}
	});

	it("rejects when date is blacked out", async () => {
		const { controller, location, window } = await seedLocationWithWindow(data);
		await controller.createBlackout({
			locationId: location.id,
			date: MONDAY_DATE,
		});

		const result = await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_blackout",
			scheduledDate: MONDAY_DATE,
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe(
				"Pickup is not available at this location on this date",
			);
		}
	});
});

describe("store endpoint: order pickup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns the active pickup for an order", async () => {
		const { location, window } = await seedLocationWithWindow(data);
		await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_lookup",
			scheduledDate: MONDAY_DATE,
		});

		const result = await simulateOrderPickup(data, "order_lookup");

		expect(result.pickup).not.toBeNull();
		expect(result.pickup?.orderId).toBe("order_lookup");
		expect(result.pickup?.status).toBe("scheduled");
	});

	it("returns null for an unknown order", async () => {
		const result = await simulateOrderPickup(data, "order_ghost");

		expect(result.pickup).toBeNull();
	});

	it("returns null when the only pickup is cancelled", async () => {
		const { controller, location, window } = await seedLocationWithWindow(data);
		const scheduled = await controller.schedulePickup({
			locationId: location.id,
			windowId: window.id,
			orderId: "order_was_cancelled",
			scheduledDate: MONDAY_DATE,
		});
		await controller.cancelPickup(scheduled.id);

		const result = await simulateOrderPickup(data, "order_was_cancelled");

		expect(result.pickup).toBeNull();
	});
});

describe("store endpoint: cancel pickup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("cancels a scheduled pickup", async () => {
		const { location, window } = await seedLocationWithWindow(data);
		const { pickup } = (await simulateSchedulePickup(data, {
			locationId: location.id,
			windowId: window.id,
			orderId: "order_cancel_1",
			scheduledDate: MONDAY_DATE,
		})) as { pickup: { id: string } };

		const result = await simulateCancelPickup(data, pickup.id);

		expect("pickup" in result).toBe(true);
		if ("pickup" in result) {
			expect(result.pickup.status).toBe("cancelled");
			expect(result.pickup.cancelledAt).toBeDefined();
		}
	});

	it("cancels a preparing pickup", async () => {
		const { controller, location, window } = await seedLocationWithWindow(data);
		const scheduled = await controller.schedulePickup({
			locationId: location.id,
			windowId: window.id,
			orderId: "order_cancel_prep",
			scheduledDate: MONDAY_DATE,
		});
		await controller.updatePickupStatus(scheduled.id, "preparing");

		const result = await simulateCancelPickup(data, scheduled.id);

		expect("pickup" in result).toBe(true);
		if ("pickup" in result) {
			expect(result.pickup.status).toBe("cancelled");
		}
	});

	it("cancels a ready pickup", async () => {
		const { controller, location, window } = await seedLocationWithWindow(data);
		const scheduled = await controller.schedulePickup({
			locationId: location.id,
			windowId: window.id,
			orderId: "order_cancel_ready",
			scheduledDate: MONDAY_DATE,
		});
		await controller.updatePickupStatus(scheduled.id, "preparing");
		await controller.updatePickupStatus(scheduled.id, "ready");

		const result = await simulateCancelPickup(data, scheduled.id);

		expect("pickup" in result).toBe(true);
		if ("pickup" in result) {
			expect(result.pickup.status).toBe("cancelled");
		}
	});

	it("throws on already cancelled pickup", async () => {
		const { controller, location, window } = await seedLocationWithWindow(data);
		const scheduled = await controller.schedulePickup({
			locationId: location.id,
			windowId: window.id,
			orderId: "order_double_cancel",
			scheduledDate: MONDAY_DATE,
		});
		await controller.cancelPickup(scheduled.id);

		const result = await simulateCancelPickup(data, scheduled.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Pickup is already cancelled");
		}
	});

	it("throws on picked_up pickup", async () => {
		const { controller, location, window } = await seedLocationWithWindow(data);
		const scheduled = await controller.schedulePickup({
			locationId: location.id,
			windowId: window.id,
			orderId: "order_completed",
			scheduledDate: MONDAY_DATE,
		});
		await controller.updatePickupStatus(scheduled.id, "preparing");
		await controller.updatePickupStatus(scheduled.id, "ready");
		await controller.updatePickupStatus(scheduled.id, "picked_up");

		const result = await simulateCancelPickup(data, scheduled.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Cannot cancel a completed pickup");
		}
	});

	it("returns 404 for nonexistent pickup", async () => {
		const result = await simulateCancelPickup(data, "nonexistent_id");

		expect(result).toEqual({ error: "Pickup not found", status: 404 });
	});
});
