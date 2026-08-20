import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDeliverySlotsController } from "../service-impl";

/**
 * Security regression tests for delivery-slots endpoints.
 *
 * Delivery slots have store endpoints (booking requires auth) and admin CRUD.
 * Security focuses on:
 * - Inactive schedules cannot be booked
 * - Blackout dates block all bookings
 * - Capacity limits are enforced (no overbooking)
 * - Day-of-week validation prevents booking on wrong days
 * - Duplicate booking prevention per order
 * - Already-cancelled bookings cannot be cancelled again
 */

describe("delivery-slots endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createDeliverySlotsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDeliverySlotsController(mockData);
	});

	// Helper: find next date matching a specific day of week (timezone-safe)
	function nextDayOfWeek(dow: number): string {
		const d = new Date();
		const diff = (dow - d.getDay() + 7) % 7 || 7;
		d.setDate(d.getDate() + diff);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	describe("inactive schedule protection", () => {
		it("cannot book an inactive schedule", async () => {
			const schedule = await controller.createSchedule({
				name: "Disabled Slot",
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 10,
				active: false,
			});

			const monday = nextDayOfWeek(1);
			await expect(
				controller.bookSlot({
					scheduleId: schedule.id,
					deliveryDate: monday,
					orderId: "order_1",
				}),
			).rejects.toThrow("not available");
		});

		it("inactive schedules are excluded from available slots", async () => {
			await controller.createSchedule({
				name: "Active",
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 10,
				active: true,
			});
			await controller.createSchedule({
				name: "Inactive",
				dayOfWeek: 1,
				startTime: "13:00",
				endTime: "17:00",
				capacity: 10,
				active: false,
			});

			const monday = nextDayOfWeek(1);
			const slots = await controller.getAvailableSlots({ date: monday });
			expect(slots).toHaveLength(1);
			expect(slots[0].schedule.name).toBe("Active");
		});
	});

	describe("blackout date enforcement", () => {
		it("bookSlot rejects booking on blackout date", async () => {
			const schedule = await controller.createSchedule({
				name: "Normal Slot",
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 10,
			});

			const tuesday = nextDayOfWeek(2);
			await controller.createBlackout({ date: tuesday, reason: "Holiday" });

			await expect(
				controller.bookSlot({
					scheduleId: schedule.id,
					deliveryDate: tuesday,
					orderId: "order_1",
				}),
			).rejects.toThrow("not available on this date");
		});

		it("getAvailableSlots returns empty for blackout dates", async () => {
			await controller.createSchedule({
				name: "Slot",
				dayOfWeek: 3,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 10,
			});

			const wednesday = nextDayOfWeek(3);
			await controller.createBlackout({ date: wednesday });

			const slots = await controller.getAvailableSlots({ date: wednesday });
			expect(slots).toHaveLength(0);
		});

		it("duplicate blackout for same date is prevented", async () => {
			const date = nextDayOfWeek(4);
			await controller.createBlackout({ date });

			await expect(controller.createBlackout({ date })).rejects.toThrow(
				"already exists",
			);
		});
	});

	describe("capacity enforcement", () => {
		it("bookSlot rejects when capacity is full", async () => {
			const schedule = await controller.createSchedule({
				name: "Small Slot",
				dayOfWeek: 5,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 2,
			});

			const friday = nextDayOfWeek(5);

			await controller.bookSlot({
				scheduleId: schedule.id,
				deliveryDate: friday,
				orderId: "order_1",
			});
			await controller.bookSlot({
				scheduleId: schedule.id,
				deliveryDate: friday,
				orderId: "order_2",
			});

			await expect(
				controller.bookSlot({
					scheduleId: schedule.id,
					deliveryDate: friday,
					orderId: "order_3",
				}),
			).rejects.toThrow("fully booked");
		});

		it("cancelled bookings free up capacity", async () => {
			const schedule = await controller.createSchedule({
				name: "Slot",
				dayOfWeek: 5,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 1,
			});

			const friday = nextDayOfWeek(5);

			const booking = await controller.bookSlot({
				scheduleId: schedule.id,
				deliveryDate: friday,
				orderId: "order_1",
			});

			await controller.cancelBooking(booking.id);

			// Should now be bookable again
			const newBooking = await controller.bookSlot({
				scheduleId: schedule.id,
				deliveryDate: friday,
				orderId: "order_2",
			});
			expect(newBooking.status).toBe("confirmed");
		});

		it("getAvailableSlots reports remaining correctly", async () => {
			const schedule = await controller.createSchedule({
				name: "Slot",
				dayOfWeek: 6,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 3,
			});

			const saturday = nextDayOfWeek(6);
			await controller.bookSlot({
				scheduleId: schedule.id,
				deliveryDate: saturday,
				orderId: "order_1",
			});

			const slots = await controller.getAvailableSlots({ date: saturday });
			expect(slots).toHaveLength(1);
			expect(slots[0].booked).toBe(1);
			expect(slots[0].remaining).toBe(2);
			expect(slots[0].available).toBe(true);
		});
	});

	describe("day-of-week validation", () => {
		it("bookSlot rejects date that doesn't match schedule day", async () => {
			const schedule = await controller.createSchedule({
				name: "Monday Only",
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 10,
			});

			const tuesday = nextDayOfWeek(2);
			await expect(
				controller.bookSlot({
					scheduleId: schedule.id,
					deliveryDate: tuesday,
					orderId: "order_1",
				}),
			).rejects.toThrow("does not match");
		});
	});

	describe("duplicate order booking prevention", () => {
		it("rejects booking if order already has confirmed delivery", async () => {
			const schedule = await controller.createSchedule({
				name: "Slot",
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 10,
			});

			const monday = nextDayOfWeek(1);
			await controller.bookSlot({
				scheduleId: schedule.id,
				deliveryDate: monday,
				orderId: "order_1",
			});

			await expect(
				controller.bookSlot({
					scheduleId: schedule.id,
					deliveryDate: monday,
					orderId: "order_1",
				}),
			).rejects.toThrow("already has a confirmed");
		});
	});

	describe("cancellation safety", () => {
		it("cancelling already-cancelled booking throws", async () => {
			const schedule = await controller.createSchedule({
				name: "Slot",
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "12:00",
				capacity: 10,
			});

			const monday = nextDayOfWeek(1);
			const booking = await controller.bookSlot({
				scheduleId: schedule.id,
				deliveryDate: monday,
				orderId: "order_1",
			});

			await controller.cancelBooking(booking.id);

			await expect(controller.cancelBooking(booking.id)).rejects.toThrow(
				"already cancelled",
			);
		});

		it("cancelling non-existent booking returns null", async () => {
			const result = await controller.cancelBooking("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("input validation", () => {
		it("rejects invalid day of week in createSchedule", async () => {
			await expect(
				controller.createSchedule({
					name: "Invalid",
					dayOfWeek: 7,
					startTime: "09:00",
					endTime: "12:00",
					capacity: 10,
				}),
			).rejects.toThrow("Day of week");
		});

		it("rejects start time >= end time", async () => {
			await expect(
				controller.createSchedule({
					name: "Invalid",
					dayOfWeek: 1,
					startTime: "12:00",
					endTime: "09:00",
					capacity: 10,
				}),
			).rejects.toThrow("Start time must be before end time");
		});

		it("rejects zero capacity", async () => {
			await expect(
				controller.createSchedule({
					name: "Invalid",
					dayOfWeek: 1,
					startTime: "09:00",
					endTime: "12:00",
					capacity: 0,
				}),
			).rejects.toThrow("Capacity must be a positive integer");
		});

		it("rejects negative surcharge", async () => {
			await expect(
				controller.createSchedule({
					name: "Invalid",
					dayOfWeek: 1,
					startTime: "09:00",
					endTime: "12:00",
					capacity: 10,
					surchargeInCents: -100,
				}),
			).rejects.toThrow("Surcharge cannot be negative");
		});
	});
});
