import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { DeliverySlotsController } from "../service";
import { createDeliverySlotsController } from "../service-impl";

// Day-of-week reference dates (2026-03):
// Sunday    = 0 -> 2026-03-15
// Monday    = 1 -> 2026-03-16
// Tuesday   = 2 -> 2026-03-17
// Wednesday = 3 -> 2026-03-18
// Thursday  = 4 -> 2026-03-19
// Friday    = 5 -> 2026-03-20
// Saturday  = 6 -> 2026-03-21

const SUNDAY = "2026-03-15";
const MONDAY = "2026-03-16";
const TUESDAY = "2026-03-17";
const NEXT_MONDAY = "2026-03-23";

function makeSchedule(overrides?: Record<string, unknown>) {
	return {
		name: "Morning Delivery",
		dayOfWeek: 1, // Monday
		startTime: "08:00",
		endTime: "12:00",
		capacity: 10,
		...overrides,
	};
}

function makeBooking(scheduleId: string, overrides?: Record<string, unknown>) {
	return {
		scheduleId,
		deliveryDate: MONDAY,
		orderId: `order_${crypto.randomUUID().slice(0, 8)}`,
		...overrides,
	};
}

describe("delivery-slots controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: DeliverySlotsController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDeliverySlotsController(mockData);
	});

	// ── 1. Schedule validation edge cases ────────────────────────

	describe("schedule validation edge cases", () => {
		it("rejects time with missing leading zero (9:00)", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ startTime: "9:00" })),
			).rejects.toThrow("Start time must be in HH:MM 24-hour format");
		});

		it("rejects time with seconds (08:00:00)", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ startTime: "08:00:00" })),
			).rejects.toThrow("Start time must be in HH:MM 24-hour format");
		});

		it("rejects 24:00 as end time", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ endTime: "24:00" })),
			).rejects.toThrow("End time must be in HH:MM 24-hour format");
		});

		it("accepts 23:59 as a valid end time", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ endTime: "23:59" }),
			);
			expect(schedule.endTime).toBe("23:59");
		});

		it("accepts 00:00 as a valid start time", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ startTime: "00:00", endTime: "06:00" }),
			);
			expect(schedule.startTime).toBe("00:00");
		});

		it("rejects fractional capacity (1.5)", async () => {
			await expect(
				controller.createSchedule(makeSchedule({ capacity: 1.5 })),
			).rejects.toThrow("Capacity must be a positive integer");
		});

		it("allows surcharge of exactly zero", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ surchargeInCents: 0 }),
			);
			expect(schedule.surchargeInCents).toBe(0);
		});

		it("update rejects empty-string name even with whitespace", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await expect(
				controller.updateSchedule(schedule.id, { name: "   " }),
			).rejects.toThrow("Schedule name cannot be empty");
		});

		it("update validates endTime against existing startTime", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ startTime: "10:00", endTime: "14:00" }),
			);
			// Setting endTime to 09:00 should fail because startTime is 10:00
			await expect(
				controller.updateSchedule(schedule.id, { endTime: "09:00" }),
			).rejects.toThrow("Start time must be before end time");
		});

		it("update rejects zero capacity", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			await expect(
				controller.updateSchedule(schedule.id, { capacity: 0 }),
			).rejects.toThrow("Capacity must be a positive integer");
		});
	});

	// ── 2. Booking day-of-week matching ──────────────────────────

	describe("booking day-of-week matching", () => {
		it("rejects booking on Sunday for a Monday schedule", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 1 }),
			);
			await expect(
				controller.bookSlot(makeBooking(schedule.id, { deliveryDate: SUNDAY })),
			).rejects.toThrow(
				"Delivery date does not match the schedule's day of week",
			);
		});

		it("accepts booking on the correct day of week", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 0 }),
			); // Sunday
			const booking = await controller.bookSlot(
				makeBooking(schedule.id, { deliveryDate: SUNDAY }),
			);
			expect(booking.deliveryDate).toBe(SUNDAY);
		});

		it("rejects booking on Tuesday for a Monday schedule", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 1 }),
			);
			await expect(
				controller.bookSlot(
					makeBooking(schedule.id, { deliveryDate: TUESDAY }),
				),
			).rejects.toThrow(
				"Delivery date does not match the schedule's day of week",
			);
		});

		it("allows booking on a different Monday (same dayOfWeek)", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 1 }),
			);
			const booking = await controller.bookSlot(
				makeBooking(schedule.id, { deliveryDate: NEXT_MONDAY }),
			);
			expect(booking.deliveryDate).toBe(NEXT_MONDAY);
		});
	});

	// ── 3. Capacity enforcement across dates ─────────────────────

	describe("capacity enforcement across dates", () => {
		it("capacity is per-date, not global", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 1, capacity: 1 }),
			);
			// Book the first Monday
			await controller.bookSlot(
				makeBooking(schedule.id, {
					deliveryDate: MONDAY,
					orderId: "order_a",
				}),
			);
			// Booking a different Monday should still work
			const booking = await controller.bookSlot(
				makeBooking(schedule.id, {
					deliveryDate: NEXT_MONDAY,
					orderId: "order_b",
				}),
			);
			expect(booking.deliveryDate).toBe(NEXT_MONDAY);
		});

		it("filling capacity on one date does not block another date", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 1, capacity: 2 }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, {
					deliveryDate: MONDAY,
					orderId: "o1",
				}),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, {
					deliveryDate: MONDAY,
					orderId: "o2",
				}),
			);
			// MONDAY is now full
			await expect(
				controller.bookSlot(
					makeBooking(schedule.id, {
						deliveryDate: MONDAY,
						orderId: "o3",
					}),
				),
			).rejects.toThrow("Delivery slot is fully booked");

			// But NEXT_MONDAY is open
			const booking = await controller.bookSlot(
				makeBooking(schedule.id, {
					deliveryDate: NEXT_MONDAY,
					orderId: "o3",
				}),
			);
			expect(booking.status).toBe("confirmed");
		});

		it("cancelled bookings free capacity for new bookings", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 1, capacity: 1 }),
			);
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, {
					deliveryDate: MONDAY,
					orderId: "o1",
				}),
			);
			// Fully booked
			await expect(
				controller.bookSlot(
					makeBooking(schedule.id, {
						deliveryDate: MONDAY,
						orderId: "o2",
					}),
				),
			).rejects.toThrow("Delivery slot is fully booked");

			// Cancel, then rebook
			await controller.cancelBooking(b1.id);
			const b2 = await controller.bookSlot(
				makeBooking(schedule.id, {
					deliveryDate: MONDAY,
					orderId: "o2",
				}),
			);
			expect(b2.status).toBe("confirmed");
		});
	});

	// ── 4. Duplicate order booking rejection ─────────────────────

	describe("duplicate order booking rejection", () => {
		it("rejects a second booking for the same orderId", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 5 }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "dup-order" }),
			);
			await expect(
				controller.bookSlot(makeBooking(schedule.id, { orderId: "dup-order" })),
			).rejects.toThrow("Order already has a confirmed delivery booking");
		});

		it("allows rebooking after the first booking is cancelled", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "rebook-order" }),
			);
			await controller.cancelBooking(b1.id);
			const b2 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "rebook-order" }),
			);
			expect(b2.status).toBe("confirmed");
			expect(b2.id).not.toBe(b1.id);
		});

		it("same orderId can have cancelled + new confirmed booking", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "multi-booking" }),
			);
			await controller.cancelBooking(b1.id);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "multi-booking" }),
			);

			// getOrderBooking should return the confirmed one
			const active = await controller.getOrderBooking("multi-booking");
			expect(active?.status).toBe("confirmed");
			expect(active?.id).not.toBe(b1.id);
		});
	});

	// ── 5. Cancel booking edge cases ─────────────────────────────

	describe("cancel booking edge cases", () => {
		it("throws when cancelling an already-cancelled booking", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking = await controller.bookSlot(makeBooking(schedule.id));
			await controller.cancelBooking(booking.id);
			await expect(controller.cancelBooking(booking.id)).rejects.toThrow(
				"Booking is already cancelled",
			);
		});

		it("returns null for non-existent booking ID", async () => {
			const result = await controller.cancelBooking("ghost-booking");
			expect(result).toBeNull();
		});

		it("cancellation sets status to cancelled and updates timestamp", async () => {
			const schedule = await controller.createSchedule(makeSchedule());
			const booking = await controller.bookSlot(makeBooking(schedule.id));
			const cancelled = await controller.cancelBooking(booking.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				booking.updatedAt.getTime(),
			);
		});
	});

	// ── 6. Available slots calculation with bookings ─────────────

	describe("available slots calculation with bookings", () => {
		it("shows remaining capacity decreasing as bookings fill up", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 1, capacity: 3 }),
			);

			const slots0 = await controller.getAvailableSlots({
				date: MONDAY,
			});
			expect(slots0[0].remaining).toBe(3);
			expect(slots0[0].booked).toBe(0);
			expect(slots0[0].available).toBe(true);

			await controller.bookSlot(makeBooking(schedule.id, { orderId: "o1" }));
			const slots1 = await controller.getAvailableSlots({
				date: MONDAY,
			});
			expect(slots1[0].remaining).toBe(2);
			expect(slots1[0].booked).toBe(1);

			await controller.bookSlot(makeBooking(schedule.id, { orderId: "o2" }));
			await controller.bookSlot(makeBooking(schedule.id, { orderId: "o3" }));
			const slots3 = await controller.getAvailableSlots({
				date: MONDAY,
			});
			expect(slots3[0].remaining).toBe(0);
			expect(slots3[0].booked).toBe(3);
			expect(slots3[0].available).toBe(false);
		});

		it("cancelled bookings restore available capacity", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 1, capacity: 2 }),
			);
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "o1" }),
			);
			await controller.bookSlot(makeBooking(schedule.id, { orderId: "o2" }));

			const full = await controller.getAvailableSlots({ date: MONDAY });
			expect(full[0].available).toBe(false);

			await controller.cancelBooking(b1.id);

			const freed = await controller.getAvailableSlots({ date: MONDAY });
			expect(freed[0].available).toBe(true);
			expect(freed[0].remaining).toBe(1);
			expect(freed[0].booked).toBe(1);
		});

		it("multiple schedules on same day show independent capacity", async () => {
			const morning = await controller.createSchedule(
				makeSchedule({
					name: "Morning",
					dayOfWeek: 1,
					startTime: "08:00",
					endTime: "12:00",
					capacity: 2,
					sortOrder: 0,
				}),
			);
			await controller.createSchedule(
				makeSchedule({
					name: "Afternoon",
					dayOfWeek: 1,
					startTime: "13:00",
					endTime: "17:00",
					capacity: 5,
					sortOrder: 1,
				}),
			);

			// Book only the morning slot
			await controller.bookSlot(makeBooking(morning.id, { orderId: "o1" }));

			const slots = await controller.getAvailableSlots({ date: MONDAY });
			expect(slots).toHaveLength(2);

			const morningSlot = slots.find((s) => s.schedule.name === "Morning");
			const afternoonSlot = slots.find((s) => s.schedule.name === "Afternoon");

			expect(morningSlot?.booked).toBe(1);
			expect(morningSlot?.remaining).toBe(1);
			expect(afternoonSlot?.booked).toBe(0);
			expect(afternoonSlot?.remaining).toBe(5);
		});

		it("excludes inactive schedules from available slots", async () => {
			await controller.createSchedule(
				makeSchedule({
					name: "Active",
					dayOfWeek: 1,
					active: true,
				}),
			);
			await controller.createSchedule(
				makeSchedule({
					name: "Inactive",
					dayOfWeek: 1,
					active: false,
					startTime: "13:00",
					endTime: "17:00",
				}),
			);

			const slots = await controller.getAvailableSlots({ date: MONDAY });
			expect(slots).toHaveLength(1);
			expect(slots[0].schedule.name).toBe("Active");
		});

		it("getSlotBookingCount excludes cancelled bookings", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 5 }),
			);
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "o1" }),
			);
			await controller.bookSlot(makeBooking(schedule.id, { orderId: "o2" }));
			await controller.cancelBooking(b1.id);

			const count = await controller.getSlotBookingCount(schedule.id, MONDAY);
			expect(count).toBe(1);
		});
	});

	// ── 7. Blackout date interactions ────────────────────────────

	describe("blackout date interactions", () => {
		it("blackout date prevents all bookings", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ dayOfWeek: 1 }),
			);
			await controller.createBlackout({ date: MONDAY });
			await expect(
				controller.bookSlot(makeBooking(schedule.id)),
			).rejects.toThrow("Delivery is not available on this date");
		});

		it("blackout date returns empty available slots", async () => {
			await controller.createSchedule(makeSchedule({ dayOfWeek: 1 }));
			await controller.createBlackout({ date: MONDAY });
			const slots = await controller.getAvailableSlots({ date: MONDAY });
			expect(slots).toHaveLength(0);
		});

		it("blackout on one date does not affect another date", async () => {
			await controller.createSchedule(makeSchedule({ dayOfWeek: 1 }));
			await controller.createBlackout({ date: MONDAY });

			const blocked = await controller.getAvailableSlots({
				date: MONDAY,
			});
			expect(blocked).toHaveLength(0);

			const open = await controller.getAvailableSlots({
				date: NEXT_MONDAY,
			});
			expect(open).toHaveLength(1);
			expect(open[0].available).toBe(true);
		});

		it("deleting a blackout restores slot availability", async () => {
			await controller.createSchedule(makeSchedule({ dayOfWeek: 1 }));
			const blackout = await controller.createBlackout({ date: MONDAY });

			const blocked = await controller.getAvailableSlots({
				date: MONDAY,
			});
			expect(blocked).toHaveLength(0);

			await controller.deleteBlackout(blackout.id);

			const restored = await controller.getAvailableSlots({
				date: MONDAY,
			});
			expect(restored).toHaveLength(1);
		});

		it("duplicate blackout date is rejected", async () => {
			await controller.createBlackout({
				date: "2026-12-25",
				reason: "Christmas",
			});
			await expect(
				controller.createBlackout({
					date: "2026-12-25",
					reason: "Also Christmas",
				}),
			).rejects.toThrow("Blackout already exists for this date");
		});

		it("isBlackoutDate returns correct boolean values", async () => {
			await controller.createBlackout({ date: MONDAY });
			expect(await controller.isBlackoutDate(MONDAY)).toBe(true);
			expect(await controller.isBlackoutDate(NEXT_MONDAY)).toBe(false);
		});

		it("blackout with reason stores the reason", async () => {
			const blackout = await controller.createBlackout({
				date: "2026-07-04",
				reason: "Independence Day",
			});
			expect(blackout.reason).toBe("Independence Day");
			expect(blackout.date).toBe("2026-07-04");
		});
	});

	// ── 8. Summary accuracy with mixed bookings ──────────────────

	describe("summary accuracy with mixed bookings", () => {
		it("empty state returns all zeros", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalSchedules).toBe(0);
			expect(summary.activeSchedules).toBe(0);
			expect(summary.totalBookings).toBe(0);
			expect(summary.confirmedBookings).toBe(0);
			expect(summary.cancelledBookings).toBe(0);
			expect(summary.totalSurchargeRevenue).toBe(0);
			expect(summary.blackoutDates).toBe(0);
		});

		it("accurately counts schedules, bookings, cancellations, and revenue", async () => {
			// 2 active schedules, 1 inactive
			const s1 = await controller.createSchedule(
				makeSchedule({
					name: "Morning",
					surchargeInCents: 200,
					capacity: 5,
				}),
			);
			const s2 = await controller.createSchedule(
				makeSchedule({
					name: "Afternoon",
					dayOfWeek: 0,
					startTime: "13:00",
					endTime: "17:00",
					surchargeInCents: 500,
				}),
			);
			await controller.createSchedule(
				makeSchedule({
					name: "Inactive",
					active: false,
					startTime: "18:00",
					endTime: "20:00",
				}),
			);

			// 3 bookings on s1 (surcharge 200 each), cancel 1
			const b1 = await controller.bookSlot(
				makeBooking(s1.id, { orderId: "o1" }),
			);
			await controller.bookSlot(makeBooking(s1.id, { orderId: "o2" }));
			await controller.bookSlot(makeBooking(s1.id, { orderId: "o3" }));
			await controller.cancelBooking(b1.id);

			// 1 booking on s2 (surcharge 500)
			await controller.bookSlot(
				makeBooking(s2.id, {
					orderId: "o4",
					deliveryDate: SUNDAY,
				}),
			);

			// 2 blackout dates
			await controller.createBlackout({ date: "2026-12-25" });
			await controller.createBlackout({ date: "2026-01-01" });

			const summary = await controller.getSummary();
			expect(summary.totalSchedules).toBe(3);
			expect(summary.activeSchedules).toBe(2);
			expect(summary.totalBookings).toBe(4);
			expect(summary.confirmedBookings).toBe(3);
			expect(summary.cancelledBookings).toBe(1);
			// Revenue = 2 confirmed * 200 (s1) + 1 confirmed * 500 (s2) = 900
			expect(summary.totalSurchargeRevenue).toBe(900);
			expect(summary.blackoutDates).toBe(2);
		});

		it("surcharge revenue only counts confirmed bookings", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ surchargeInCents: 1000, capacity: 5 }),
			);
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "o1" }),
			);
			await controller.bookSlot(makeBooking(schedule.id, { orderId: "o2" }));
			await controller.cancelBooking(b1.id);

			const summary = await controller.getSummary();
			// Only 1 confirmed at 1000 cents
			expect(summary.totalSurchargeRevenue).toBe(1000);
		});

		it("zero-surcharge bookings do not affect revenue", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ surchargeInCents: 0, capacity: 5 }),
			);
			await controller.bookSlot(makeBooking(schedule.id, { orderId: "o1" }));
			await controller.bookSlot(makeBooking(schedule.id, { orderId: "o2" }));

			const summary = await controller.getSummary();
			expect(summary.totalSurchargeRevenue).toBe(0);
		});
	});

	// ── 9. Booking copies schedule snapshot ──────────────────────

	describe("booking copies schedule snapshot", () => {
		it("booking retains original schedule info after schedule update", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({
					name: "Morning Express",
					surchargeInCents: 300,
				}),
			);
			const booking = await controller.bookSlot(makeBooking(schedule.id));

			// Update the schedule name and surcharge
			await controller.updateSchedule(schedule.id, {
				name: "Morning Standard",
				surchargeInCents: 0,
			});

			const fetched = await controller.getBooking(booking.id);
			expect(fetched?.scheduleName).toBe("Morning Express");
			expect(fetched?.surchargeInCents).toBe(300);
			expect(fetched?.startTime).toBe("08:00");
			expect(fetched?.endTime).toBe("12:00");
		});
	});

	// ── 10. List bookings filtering ──────────────────────────────

	describe("list bookings filtering", () => {
		it("filters by customerId", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 10 }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, {
					orderId: "o1",
					customerId: "cust-A",
				}),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, {
					orderId: "o2",
					customerId: "cust-B",
				}),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, {
					orderId: "o3",
					customerId: "cust-A",
				}),
			);

			const custA = await controller.listBookings({
				customerId: "cust-A",
			});
			expect(custA).toHaveLength(2);
			for (const b of custA) {
				expect(b.customerId).toBe("cust-A");
			}
		});

		it("filters by orderId", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 10 }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "target-order" }),
			);
			await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "other-order" }),
			);

			const results = await controller.listBookings({
				orderId: "target-order",
			});
			expect(results).toHaveLength(1);
			expect(results[0].orderId).toBe("target-order");
		});

		it("filters by status showing only cancelled", async () => {
			const schedule = await controller.createSchedule(
				makeSchedule({ capacity: 10 }),
			);
			const b1 = await controller.bookSlot(
				makeBooking(schedule.id, { orderId: "o1" }),
			);
			await controller.bookSlot(makeBooking(schedule.id, { orderId: "o2" }));
			await controller.cancelBooking(b1.id);

			const cancelled = await controller.listBookings({
				status: "cancelled",
			});
			expect(cancelled).toHaveLength(1);
			expect(cancelled[0].orderId).toBe("o1");
		});
	});
});
