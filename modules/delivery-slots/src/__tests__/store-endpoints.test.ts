import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDeliverySlotsController } from "../service-impl";

/**
 * Store endpoint integration tests for the delivery-slots module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-available-slots: returns available delivery slots for a date
 * 2. book-slot: books a delivery slot for an order
 * 3. cancel-booking: cancels a delivery booking
 * 4. get-order-booking: returns the booking for a specific order
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGetAvailableSlots(
	data: DataService,
	query: { date: string },
) {
	const controller = createDeliverySlotsController(data);
	const slots = await controller.getAvailableSlots({ date: query.date });
	return { slots };
}

async function simulateBookSlot(
	data: DataService,
	body: {
		scheduleId: string;
		deliveryDate: string;
		orderId: string;
		customerId?: string;
		instructions?: string;
	},
) {
	const controller = createDeliverySlotsController(data);
	try {
		const booking = await controller.bookSlot(body);
		return { booking };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Booking failed";
		return { error: msg, status: 400 };
	}
}

async function simulateCancelBooking(data: DataService, bookingId: string) {
	const controller = createDeliverySlotsController(data);
	const cancelled = await controller.cancelBooking(bookingId);
	if (!cancelled) {
		return { error: "Booking not found", status: 404 };
	}
	return { booking: cancelled };
}

async function simulateGetOrderBooking(data: DataService, orderId: string) {
	const controller = createDeliverySlotsController(data);
	const booking = await controller.getOrderBooking(orderId);
	return { booking };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get available slots", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns available delivery slots for a date", async () => {
		const ctrl = createDeliverySlotsController(data);
		await ctrl.createSchedule({
			name: "Morning Delivery",
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "12:00",
			capacity: 10,
			surchargeInCents: 0,
		});

		const result = await simulateGetAvailableSlots(data, {
			date: "2026-04-06",
		});

		expect(result.slots.length).toBeGreaterThanOrEqual(1);
		expect(result.slots[0].available).toBe(true);
		expect(result.slots[0].remaining).toBe(10);
	});

	it("returns empty when no schedules match the day", async () => {
		const ctrl = createDeliverySlotsController(data);
		await ctrl.createSchedule({
			name: "Monday Only",
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "12:00",
			capacity: 5,
			surchargeInCents: 0,
		});

		const result = await simulateGetAvailableSlots(data, {
			date: "2026-04-08",
		});

		expect(result.slots).toHaveLength(0);
	});

	it("shows reduced availability after bookings", async () => {
		const ctrl = createDeliverySlotsController(data);
		const schedule = await ctrl.createSchedule({
			name: "Afternoon",
			dayOfWeek: 2,
			startTime: "14:00",
			endTime: "17:00",
			capacity: 3,
			surchargeInCents: 500,
		});
		await ctrl.bookSlot({
			scheduleId: schedule.id,
			deliveryDate: "2026-04-07",
			orderId: "order_1",
		});

		const result = await simulateGetAvailableSlots(data, {
			date: "2026-04-07",
		});

		expect(result.slots).toHaveLength(1);
		expect(result.slots[0].booked).toBe(1);
		expect(result.slots[0].remaining).toBe(2);
	});
});

describe("store endpoint: book slot", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("books a delivery slot for an order", async () => {
		const ctrl = createDeliverySlotsController(data);
		const schedule = await ctrl.createSchedule({
			name: "Morning",
			dayOfWeek: 1,
			startTime: "09:00",
			endTime: "12:00",
			capacity: 5,
			surchargeInCents: 0,
		});

		const result = await simulateBookSlot(data, {
			scheduleId: schedule.id,
			deliveryDate: "2026-04-06",
			orderId: "order_1",
			customerId: "cust_1",
			instructions: "Leave at door",
		});

		expect("booking" in result).toBe(true);
		if ("booking" in result) {
			expect(result.booking.orderId).toBe("order_1");
			expect(result.booking.status).toBe("confirmed");
			expect(result.booking.instructions).toBe("Leave at door");
		}
	});

	it("includes surcharge in booking", async () => {
		const ctrl = createDeliverySlotsController(data);
		const schedule = await ctrl.createSchedule({
			name: "Express",
			dayOfWeek: 1,
			startTime: "08:00",
			endTime: "10:00",
			capacity: 3,
			surchargeInCents: 999,
		});

		const result = await simulateBookSlot(data, {
			scheduleId: schedule.id,
			deliveryDate: "2026-04-06",
			orderId: "order_1",
		});

		expect("booking" in result).toBe(true);
		if ("booking" in result) {
			expect(result.booking.surchargeInCents).toBe(999);
		}
	});
});

describe("store endpoint: cancel booking", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("cancels an existing booking", async () => {
		const ctrl = createDeliverySlotsController(data);
		const schedule = await ctrl.createSchedule({
			name: "Afternoon",
			dayOfWeek: 1,
			startTime: "14:00",
			endTime: "17:00",
			capacity: 5,
			surchargeInCents: 0,
		});
		const booking = await ctrl.bookSlot({
			scheduleId: schedule.id,
			deliveryDate: "2026-04-06",
			orderId: "order_1",
		});

		const result = await simulateCancelBooking(data, booking.id);

		expect("booking" in result).toBe(true);
		if ("booking" in result) {
			expect(result.booking.status).toBe("cancelled");
		}
	});

	it("returns 404 for nonexistent booking", async () => {
		const result = await simulateCancelBooking(data, "ghost_booking");

		expect(result).toEqual({ error: "Booking not found", status: 404 });
	});
});

describe("store endpoint: get order booking", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns the booking for an order", async () => {
		const ctrl = createDeliverySlotsController(data);
		const schedule = await ctrl.createSchedule({
			name: "Evening",
			dayOfWeek: 3,
			startTime: "18:00",
			endTime: "21:00",
			capacity: 5,
			surchargeInCents: 0,
		});
		await ctrl.bookSlot({
			scheduleId: schedule.id,
			deliveryDate: "2026-04-08",
			orderId: "order_42",
		});

		const result = await simulateGetOrderBooking(data, "order_42");

		expect(result.booking).not.toBeNull();
		expect(result.booking?.orderId).toBe("order_42");
	});

	it("returns null for order with no booking", async () => {
		const result = await simulateGetOrderBooking(data, "order_no_booking");

		expect(result.booking).toBeNull();
	});
});
