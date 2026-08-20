import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { DeliverySlotsController } from "../service";
import { createDeliverySlotsController } from "../service-impl";

// 2026-03-09 is a Monday (dayOfWeek = 1)
const MONDAY_DATE = "2026-03-09";
// 2026-03-10 is a Tuesday (dayOfWeek = 2)
const TUESDAY_DATE = "2026-03-10";
// 2026-03-15 is a Sunday (dayOfWeek = 0)
const SUNDAY_DATE = "2026-03-15";

const makeSchedule = (overrides?: Record<string, unknown>) => ({
	name: "Morning Delivery",
	dayOfWeek: 1, // Monday
	startTime: "08:00",
	endTime: "12:00",
	capacity: 10,
	...overrides,
});

const makeBooking = (
	scheduleId: string,
	overrides?: Record<string, unknown>,
) => ({
	scheduleId,
	deliveryDate: MONDAY_DATE,
	orderId: "order_1",
	...overrides,
});

describe("createDeliverySlotsController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: DeliverySlotsController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDeliverySlotsController(mockData);
	});

	// ── Schedule CRUD ─────────────────────────────────────────────

	describe("createSchedule", () => {
		it("creates a schedule with defaults", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			expect(schedule.id).toBeDefined();
			expect(schedule.name).toBe("Morning Delivery");
			expect(schedule.dayOfWeek).toBe(1);
			expect(schedule.startTime).toBe("08:00");
			expect(schedule.endTime).toBe("12:00");
			expect(schedule.capacity).toBe(10);
			expect(schedule.surchargeInCents).toBe(0);
			expect(schedule.active).toBe(true);
			expect(schedule.sortOrder).toBe(0);
		});

		it("creates a schedule with surcharge", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ surchargeInCents: 500 }),
			);
			expect(schedule.surchargeInCents).toBe(500);
		});

		it("creates a schedule with custom active state", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ active: false }),
			);
			expect(schedule.active).toBe(false);
		});

		it("creates a schedule with custom sort order", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ sortOrder: 5 }),
			);
			expect(schedule.sortOrder).toBe(5);
		});

		it("trims whitespace from name", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ name: "  Evening Slot  " }),
			);
			expect(schedule.name).toBe("Evening Slot");
		});

		it("throws for empty name", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ name: "" })),
			).rejects.toThrow("Schedule name is required");
		});

		it("throws for whitespace-only name", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ name: "   " })),
			).rejects.toThrow("Schedule name is required");
		});

		it("throws for invalid day of week (-1)", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ dayOfWeek: -1 })),
			).rejects.toThrow("Day of week must be an integer from 0");
		});

		it("throws for invalid day of week (7)", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ dayOfWeek: 7 })),
			).rejects.toThrow("Day of week must be an integer from 0");
		});

		it("throws for non-integer day of week", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ dayOfWeek: 1.5 })),
			).rejects.toThrow("Day of week must be an integer from 0");
		});

		it("throws for invalid start time", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ startTime: "25:00" })),
			).rejects.toThrow("Start time must be in HH:MM 24-hour format");
		});

		it("throws for invalid end time", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ endTime: "noon" })),
			).rejects.toThrow("End time must be in HH:MM 24-hour format");
		});

		it("throws when start time equals end time", async () => {
			await expect(
				controller.createSchedule(
					makeSchedule({ startTime: "10:00", endTime: "10:00" }),
				),
			).rejects.toThrow("Start time must be before end time");
		});

		it("throws when start time is after end time", async () => {
			await expect(
				controller.createSchedule(
					makeSchedule({ startTime: "14:00", endTime: "12:00" }),
				),
			).rejects.toThrow("Start time must be before end time");
		});

		it("throws for zero capacity", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ capacity: 0 })),
			).rejects.toThrow("Capacity must be a positive integer");
		});

		it("throws for negative capacity", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ capacity: -5 })),
			).rejects.toThrow("Capacity must be a positive integer");
		});

		it("throws for non-integer capacity", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ capacity: 2.5 })),
			).rejects.toThrow("Capacity must be a positive integer");
		});

		it("throws for negative surcharge", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ surchargeInCents: -100 })),
			).rejects.toThrow("Surcharge cannot be negative");
		});

		it("allows Sunday (dayOfWeek = 0)", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 0 }),
			);
			expect(schedule.dayOfWeek).toBe(0);
		});

		it("allows Saturday (dayOfWeek = 6)", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 6 }),
			);
			expect(schedule.dayOfWeek).toBe(6);
		});
	});

	describe("updateSchedule", () => {
		it("updates name", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const updated = await controller.updateSchedule(schedule.id, {
				name: "Afternoon Delivery",
			});
			expect(updated?.name).toBe("Afternoon Delivery");
		});

		it("updates day of week", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const updated = await controller.updateSchedule(schedule.id, {
				dayOfWeek: 5,
			});
			expect(updated?.dayOfWeek).toBe(5);
		});

		it("updates time window", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const updated = await controller.updateSchedule(schedule.id, {
				startTime: "14:00",
				endTime: "18:00",
			});
			expect(updated?.startTime).toBe("14:00");
			expect(updated?.endTime).toBe("18:00");
		});

		it("updates capacity", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const updated = await controller.updateSchedule(schedule.id, {
				capacity: 20,
			});
			expect(updated?.capacity).toBe(20);
		});

		it("updates surcharge", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const updated = await controller.updateSchedule(schedule.id, {
				surchargeInCents: 299,
			});
			expect(updated?.surchargeInCents).toBe(299);
		});

		it("updates active state", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const updated = await controller.updateSchedule(schedule.id, {
				active: false,
			});
			expect(updated?.active).toBe(false);
		});

		it("updates sort order", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const updated = await controller.updateSchedule(schedule.id, {
				sortOrder: 10,
			});
			expect(updated?.sortOrder).toBe(10);
		});

		it("returns null for non-existent schedule", async () => {
			const result = await controller.updateSchedule("nonexistent", {
				name: "Test",
			});
			expect(result).toBeNull();
		});

		it("throws for empty name", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await expect(
				controller.updateSchedule(schedule.id, { name: "" }),
			).rejects.toThrow("Schedule name cannot be empty");
		});

		it("throws for invalid day of week", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await expect(
				controller.updateSchedule(schedule.id, { dayOfWeek: 7 }),
			).rejects.toThrow("Day of week must be an integer from 0");
		});

		it("throws for invalid start time", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await expect(
				controller.updateSchedule(schedule.id, { startTime: "bad" }),
			).rejects.toThrow("Start time must be in HH:MM 24-hour format");
		});

		it("throws when updated times make start >= end", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await expect(
				controller.updateSchedule(schedule.id, { startTime: "14:00" }),
			).rejects.toThrow("Start time must be before end time");
		});

		it("throws for negative surcharge", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await expect(
				controller.updateSchedule(schedule.id, { surchargeInCents: -1 }),
			).rejects.toThrow("Surcharge cannot be negative");
		});

		it("updates updatedAt timestamp", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const updated = await controller.updateSchedule(schedule.id, {
				name: "New Name",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				schedule.updatedAt.getTime(),
			);
		});
	});

	describe("getSchedule", () => {
		it("returns a schedule by ID", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const fetched = await controller.getSchedule(schedule.id);
			expect(fetched?.id).toBe(schedule.id);
			expect(fetched?.name).toBe(schedule.name);
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getSchedule("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("listSchedules", () => {
		it("lists all schedules", async () => {
			await controller.createSchedule(makeSchedule());
			await controller.createSchedule(
				makeSchedule({
					name: "Afternoon",
					startTime: "13:00",
					endTime: "17:00",
				}),
			);
			const list = await controller.listSchedules();
			expect(list).toHaveLength(2);
		});

		it("filters by day of week", async () => {
			await controller.createSchedule(makeSchedule()); // Monday
			await controller.createSchedule(
				makeSchedule({ name: "Tuesday Slot", dayOfWeek: 2 }),
			);
			const monday = await controller.listSchedules({ dayOfWeek: 1 });
			expect(monday).toHaveLength(1);
			expect(monday[0].name).toBe("Morning Delivery");
		});

		it("filters by active status", async () => {
			await controller.createSchedule(makeSchedule());
			await controller.createSchedule(
				makeSchedule({ name: "Inactive", active: false }),
			);
			const active = await controller.listSchedules({ active: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Morning Delivery");
		});

		it("supports take/skip pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createSchedule(
					makeSchedule({ name: `Slot ${i}`, sortOrder: i }),
				);
			}
			const page = await controller.listSchedules({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty when no schedules exist", async () => {
			const list = await controller.listSchedules();
			expect(list).toHaveLength(0);
		});
	});

	describe("deleteSchedule", () => {
		it("deletes an existing schedule", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const result = await controller.deleteSchedule(schedule.id);
			expect(result).toBe(true);
			const fetched = await controller.getSchedule(schedule.id);
			expect(fetched).toBeNull();
		});

		it("returns false for non-existent schedule", async () => {
			const result = await controller.deleteSchedule("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── Booking management ────────────────────────────────────────

	describe("bookSlot", () => {
		it("creates a booking", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking = await controller.bookSlot(makeBooking(schedule.id));
			expect(booking.id).toBeDefined();
			expect(booking.scheduleId).toBe(schedule.id);
			expect(booking.deliveryDate).toBe(MONDAY_DATE);
			expect(booking.orderId).toBe("order_1");
			expect(booking.scheduleName).toBe("Morning Delivery");
			expect(booking.startTime).toBe("08:00");
			expect(booking.endTime).toBe("12:00");
			expect(booking.surchargeInCents).toBe(0);
			expect(booking.status).toBe("confirmed");
		});

		it("stores customer ID", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking = await controller.bookSlot(
				makeBooking(schedule.id, { customerId: "cust_1" }),
			);
			expect(booking.customerId).toBe("cust_1");
		});

		it("stores delivery instructions", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking = await controller.bookSlot(
				makeBooking(schedule.id, {
					instructions: "Leave at back door",
				}),
			);
			expect(booking.instructions).toBe("Leave at back door");
		});

		it("snapshots the surcharge at booking time", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ surchargeInCents: 500 }),
			);
			const booking = await controller.bookSlot(makeBooking(schedule.id));
			// Update the surcharge after booking
			await controller.updateSchedule(schedule.id, {
				surchargeInCents: 999,
			});
			const fetched = await controller.getBooking(booking.id);
			expect(fetched?.surchargeInCents).toBe(500);
		});

		it("throws for non-existent schedule", async () => {
			await expect(
				controller.bookSlot(makeBooking("nonexistent")),
			).rejects.toThrow("Delivery schedule not found");
		});

		it("throws for inactive schedule", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ active: false }),
			);
			await expect(
				controller.bookSlot(makeBooking(schedule.id)),
			).rejects.toThrow("Delivery schedule is not available");
		});

		it("throws for empty order ID", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await expect(
				controller.bookSlot(makeBooking(schedule.id, { orderId: "" })),
			).rejects.toThrow("Order ID is required");
		});

		it("throws for invalid date format", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await expect(
				controller.bookSlot(
					makeBooking(schedule.id, { deliveryDate: "March 9" }),
				),
			).rejects.toThrow("Delivery date must be in YYYY-MM-DD format");
		});

		it("throws when date does not match schedule day of week", async () => {
			const schedule = await controller.createSchedule(makeSchedule()); // Monday
			await expect(
				controller.bookSlot(
					makeBooking(schedule.id, { deliveryDate: TUESDAY_DATE }),
				),
			).rejects.toThrow(
				"Delivery date does not match the schedule's day of week",
			);
		});

		it("throws when order already has a confirmed booking", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await controller.bookSlot(makeBooking(schedule.id));
			await expect(
				controller.bookSlot(makeBooking(schedule.id)),
			).rejects.toThrow("Order already has a confirmed delivery booking");
		});

		it("allows booking after previous booking was cancelled", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking1 = await controller.bookSlot(makeBooking(schedule.id));
			await controller.cancelBooking(booking1.id);
			const booking2 = await controller.bookSlot(makeBooking(schedule.id));
			expect(booking2.id).toBeDefined();
			expect(booking2.status).toBe("confirmed");
		});

		it("throws when slot is at capacity", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 2 }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_1" }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_2" }),
			);
			await expect(
				controller.bookSlot(makeBooking(schedule.id, { orderId: "order_3" })),
			).rejects.toThrow("Delivery slot is fully booked");
		});

		it("cancelled bookings do not count toward capacity", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 1 }),
			);
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_1" }),
			);
			await controller.cancelBooking(b1.id);
			const b2 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_2" }),
			);
			expect(b2.status).toBe("confirmed");
		});

		it("throws when date is a blackout date", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await controller.createBlackout({ date: MONDAY_DATE });
			await expect(
				controller.bookSlot(makeBooking(schedule.id)),
			).rejects.toThrow("Delivery is not available on this date");
		});

		it("allows different orders on the same slot", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 5 }),
			);
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_1" }),
			);
			const b2 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_2" }),
			);
			expect(b1.id).not.toBe(b2.id);
		});
	});

	describe("cancelBooking", () => {
		it("cancels an existing booking", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking = await controller.bookSlot(makeBooking(schedule.id));
			const cancelled = await controller.cancelBooking(booking.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null for non-existent booking", async () => {
			const result = await controller.cancelBooking("nonexistent");
			expect(result).toBeNull();
		});

		it("throws when booking is already cancelled", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking = await controller.bookSlot(makeBooking(schedule.id));
			await controller.cancelBooking(booking.id);
			await expect(controller.cancelBooking(booking.id)).rejects.toThrow(
				"Booking is already cancelled",
			);
		});
	});

	describe("getBooking", () => {
		it("returns a booking by ID", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking = await controller.bookSlot(makeBooking(schedule.id));
			const fetched = await controller.getBooking(booking.id);
			expect(fetched?.id).toBe(booking.id);
			expect(fetched?.scheduleName).toBe("Morning Delivery");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getBooking("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("getOrderBooking", () => {
		it("returns the confirmed booking for an order", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await controller.bookSlot(makeBooking(schedule.id));
			const booking = await controller.getOrderBooking("order_1");
			expect(booking).not.toBeNull();
			expect(booking?.orderId).toBe("order_1");
			expect(booking?.status).toBe("confirmed");
		});

		it("returns null for order with no booking", async () => {
			const result = await controller.getOrderBooking("order_1");
			expect(result).toBeNull();
		});

		it("returns null when all bookings for order are cancelled", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking = await controller.bookSlot(makeBooking(schedule.id));
			await controller.cancelBooking(booking.id);
			const result = await controller.getOrderBooking("order_1");
			expect(result).toBeNull();
		});
	});

	describe("listBookings", () => {
		it("lists all bookings", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_1" }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_2" }),
			);
			const list = await controller.listBookings();
			expect(list).toHaveLength(2);
		});

		it("filters by delivery date", async () => {
			const monSchedule = await controller.createSchedule(makeSchedule());
			const sunSchedule = await controller.createSchedule(
				makeSchedule({ name: "Sunday", dayOfWeek: 0 }),
			);
			await controller.bookSlot(
				makeBooking(monSchedule.id, { orderId: "order_1" }),
			);
			await controller.bookSlot(
				makeBooking(sunSchedule.id, {
					orderId: "order_2",
					deliveryDate: SUNDAY_DATE,
				}),
			);
			const monday = await controller.listBookings({
				deliveryDate: MONDAY_DATE,
			});
			expect(monday).toHaveLength(1);
		});

		it("filters by status", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_1" }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_2" }),
			);
			await controller.cancelBooking(b1.id);
			const confirmed = await controller.listBookings({
				status: "confirmed",
			});
			expect(confirmed).toHaveLength(1);
		});

		it("supports take/skip pagination", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 10 }),
			);
			for (let i = 0; i < 5; i++) {
				await controller.bookSlot(
					makeBooking(schedule.id, { orderId: `order_${i}` }),
				);
			}
			const page = await controller.listBookings({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty when no bookings exist", async () => {
			const list = await controller.listBookings();
			expect(list).toHaveLength(0);
		});
	});

	// ── Availability ──────────────────────────────────────────────

	describe("getAvailableSlots", () => {
		it("returns available slots for a date", async () => {
			await controller.createSchedule(makeSchedule());
			await controller.createSchedule(
				makeSchedule({
					name: "Afternoon",
					startTime: "13:00",
					endTime: "17:00",
					sortOrder: 1,
				}),
			);
			const slots = await controller.getAvailableSlots({
				date: MONDAY_DATE,
			});
			expect(slots).toHaveLength(2);
			expect(slots[0].schedule.name).toBe("Morning Delivery");
			expect(slots[0].available).toBe(true);
			expect(slots[0].remaining).toBe(10);
		});

		it("returns empty for a day with no schedules", async () => {
			await controller.createSchedule(makeSchedule()); // Monday
			const slots = await controller.getAvailableSlots({
				date: TUESDAY_DATE,
			});
			expect(slots).toHaveLength(0);
		});

		it("excludes inactive schedules", async () => {
			await controller.createSchedule(makeSchedule());
			await controller.createSchedule(
				makeSchedule({
					name: "Inactive",
					active: false,
					startTime: "13:00",
					endTime: "17:00",
				}),
			);
			const slots = await controller.getAvailableSlots({
				date: MONDAY_DATE,
			});
			expect(slots).toHaveLength(1);
		});

		it("shows correct remaining capacity", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 3 }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_1" }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_2" }),
			);
			const slots = await controller.getAvailableSlots({
				date: MONDAY_DATE,
			});
			expect(slots[0].booked).toBe(2);
			expect(slots[0].remaining).toBe(1);
			expect(slots[0].available).toBe(true);
		});

		it("marks fully booked slots as unavailable", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 1 }),
			);
			await controller.bookSlot(makeBooking(schedule.id));
			const slots = await controller.getAvailableSlots({
				date: MONDAY_DATE,
			});
			expect(slots[0].remaining).toBe(0);
			expect(slots[0].available).toBe(false);
		});

		it("returns empty for a blackout date", async () => {
			await controller.createSchedule(makeSchedule());
			await controller.createBlackout({ date: MONDAY_DATE });
			const slots = await controller.getAvailableSlots({
				date: MONDAY_DATE,
			});
			expect(slots).toHaveLength(0);
		});

		it("throws for invalid date format", async () => {
			await expect(
				controller.getAvailableSlots({ date: "invalid" }),
			).rejects.toThrow("Date must be in YYYY-MM-DD format");
		});
	});

	describe("getSlotBookingCount", () => {
		it("returns the confirmed booking count", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 5 }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_1" }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_2" }),
			);
			const count = await controller.getSlotBookingCount(
				schedule.id,
				MONDAY_DATE,
			);
			expect(count).toBe(2);
		});

		it("does not count cancelled bookings", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 5 }),
			);
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_1" }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_2" }),
			);
			await controller.cancelBooking(b1.id);
			const count = await controller.getSlotBookingCount(
				schedule.id,
				MONDAY_DATE,
			);
			expect(count).toBe(1);
		});

		it("returns zero for no bookings", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const count = await controller.getSlotBookingCount(
				schedule.id,
				MONDAY_DATE,
			);
			expect(count).toBe(0);
		});
	});

	// ── Blackout dates ────────────────────────────────────────────

	describe("createBlackout", () => {
		it("creates a blackout date", async () => {
			const blackout = await controller.createBlackout({
				date: "2026-12-25",
			});
			expect(blackout.id).toBeDefined();
			expect(blackout.date).toBe("2026-12-25");
		});

		it("stores reason", async () => {
			const blackout = await controller.createBlackout({
				date: "2026-12-25",
				reason: "Christmas Day",
			});
			expect(blackout.reason).toBe("Christmas Day");
		});

		it("throws for invalid date format", async () => {
			await expect(
				controller.createBlackout({ date: "Dec 25" }),
			).rejects.toThrow("Blackout date must be in YYYY-MM-DD format");
		});

		it("throws for duplicate blackout date", async () => {
			await controller.createBlackout({ date: "2026-12-25" });
			await expect(
				controller.createBlackout({ date: "2026-12-25" }),
			).rejects.toThrow("Blackout already exists for this date");
		});
	});

	describe("deleteBlackout", () => {
		it("deletes an existing blackout", async () => {
			const blackout = await controller.createBlackout({
				date: "2026-12-25",
			});
			const result = await controller.deleteBlackout(blackout.id);
			expect(result).toBe(true);
		});

		it("returns false for non-existent blackout", async () => {
			const result = await controller.deleteBlackout("nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("listBlackouts", () => {
		it("lists all blackout dates", async () => {
			await controller.createBlackout({ date: "2026-12-25" });
			await controller.createBlackout({ date: "2026-01-01" });
			const list = await controller.listBlackouts();
			expect(list).toHaveLength(2);
		});

		it("returns empty when no blackouts exist", async () => {
			const list = await controller.listBlackouts();
			expect(list).toHaveLength(0);
		});
	});

	describe("isBlackoutDate", () => {
		it("returns true for a blackout date", async () => {
			await controller.createBlackout({ date: "2026-12-25" });
			const result = await controller.isBlackoutDate("2026-12-25");
			expect(result).toBe(true);
		});

		it("returns false for a normal date", async () => {
			const result = await controller.isBlackoutDate("2026-12-25");
			expect(result).toBe(false);
		});

		it("throws for invalid date format", async () => {
			await expect(controller.isBlackoutDate("invalid")).rejects.toThrow(
				"Date must be in YYYY-MM-DD format",
			);
		});
	});

	// ── Analytics ─────────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns summary with zero values when empty", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalSchedules).toBe(0);
			expect(summary.activeSchedules).toBe(0);
			expect(summary.totalBookings).toBe(0);
			expect(summary.confirmedBookings).toBe(0);
			expect(summary.cancelledBookings).toBe(0);
			expect(summary.totalSurchargeRevenue).toBe(0);
			expect(summary.blackoutDates).toBe(0);
		});

		it("returns accurate counts", async () => {
			const s1 = await controller.createSchedule(makeSchedule());
			await controller.createSchedule(
				makeSchedule({
					name: "Afternoon",
					startTime: "13:00",
					endTime: "17:00",
					surchargeInCents: 500,
				}),
			);
			await controller.createSchedule(
				makeSchedule({ name: "Inactive", active: false }),
			);

			const b1 = await controller.bookSlot(
				makeBooking(s1.id, { orderId: "order_1" }),
			);
			await controller.bookSlot(makeBooking(s1.id, { orderId: "order_2" }));
			await controller.cancelBooking(b1.id);

			await controller.createBlackout({ date: "2026-12-25" });

			const summary = await controller.getSummary();
			expect(summary.totalSchedules).toBe(3);
			expect(summary.activeSchedules).toBe(2);
			expect(summary.totalBookings).toBe(2);
			expect(summary.confirmedBookings).toBe(1);
			expect(summary.cancelledBookings).toBe(1);
			expect(summary.blackoutDates).toBe(1);
		});

		it("calculates surcharge revenue from confirmed bookings only", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ surchargeInCents: 300, capacity: 5 }),
			);
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_1" }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "order_2" }),
			);
			await controller.cancelBooking(b1.id);

			const summary = await controller.getSummary();
			expect(summary.totalSurchargeRevenue).toBe(300);
		});
	});
});
