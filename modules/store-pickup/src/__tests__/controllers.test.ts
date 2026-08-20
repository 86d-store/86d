import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { StorePickupController } from "../service";
import { createStorePickupController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

// 2026-03-09 is a Monday (dayOfWeek = 1)
const MONDAY_DATE = "2026-03-09";
// 2026-03-16 is the following Monday
const NEXT_MONDAY_DATE = "2026-03-16";
// 2026-03-10 is a Tuesday (dayOfWeek = 2)
const TUESDAY_DATE = "2026-03-10";
// 2026-03-11 is a Wednesday (dayOfWeek = 3)
const WEDNESDAY_DATE = "2026-03-11";
// 2026-03-15 is a Sunday (dayOfWeek = 0)
const SUNDAY_DATE = "2026-03-15";

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

const makePickup = (
	locationId: string,
	windowId: string,
	overrides?: Record<string, unknown>,
) => ({
	locationId,
	windowId,
	orderId: "order_1",
	scheduledDate: MONDAY_DATE,
	...overrides,
});

describe("store-pickup controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: StorePickupController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createStorePickupController(mockData);
	});

	// ── Multi-location isolation ──────────────────────────────────

	describe("multi-location isolation", () => {
		it("windows belong to their own location and do not leak", async () => {
			const loc1 = await controller.createLocation(
				makeLocation({ name: "Store A" }),
			);
			const loc2 = await controller.createLocation(
				makeLocation({ name: "Store B" }),
			);

			await controller.createWindow(
				makeWindow(loc1.id, { startTime: "09:00", endTime: "11:00" }),
			);
			await controller.createWindow(
				makeWindow(loc1.id, { startTime: "11:00", endTime: "13:00" }),
			);
			await controller.createWindow(
				makeWindow(loc2.id, { startTime: "14:00", endTime: "16:00" }),
			);

			const loc1Windows = await controller.listWindows({
				locationId: loc1.id,
			});
			const loc2Windows = await controller.listWindows({
				locationId: loc2.id,
			});

			expect(loc1Windows.length).toBe(2);
			expect(loc2Windows.length).toBe(1);
			expect(loc2Windows[0].startTime).toBe("14:00");
		});

		it("blackouts on one location do not affect another", async () => {
			const loc1 = await controller.createLocation(
				makeLocation({ name: "Store A" }),
			);
			const loc2 = await controller.createLocation(
				makeLocation({ name: "Store B" }),
			);

			await controller.createWindow(makeWindow(loc1.id));
			await controller.createWindow(makeWindow(loc2.id));

			// Blackout loc1 only
			await controller.createBlackout({
				locationId: loc1.id,
				date: MONDAY_DATE,
			});

			const loc1Avail = await controller.getAvailableWindows({
				locationId: loc1.id,
				date: MONDAY_DATE,
			});
			const loc2Avail = await controller.getAvailableWindows({
				locationId: loc2.id,
				date: MONDAY_DATE,
			});

			expect(loc1Avail.length).toBe(0);
			expect(loc2Avail.length).toBe(1);
			expect(loc2Avail[0].available).toBe(true);
		});

		it("booking counts are isolated per window and date", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win1 = await controller.createWindow(
				makeWindow(loc.id, { startTime: "09:00", endTime: "11:00" }),
			);
			const win2 = await controller.createWindow(
				makeWindow(loc.id, { startTime: "11:00", endTime: "13:00" }),
			);

			await controller.schedulePickup(
				makePickup(loc.id, win1.id, { orderId: "o1" }),
			);
			await controller.schedulePickup(
				makePickup(loc.id, win1.id, { orderId: "o2" }),
			);
			await controller.schedulePickup(
				makePickup(loc.id, win2.id, { orderId: "o3" }),
			);

			const count1 = await controller.getWindowBookingCount(
				win1.id,
				MONDAY_DATE,
			);
			const count2 = await controller.getWindowBookingCount(
				win2.id,
				MONDAY_DATE,
			);

			expect(count1).toBe(2);
			expect(count2).toBe(1);
		});
	});

	// ── Capacity and cancelled bookings ─────────────────────────

	describe("capacity with mixed statuses", () => {
		it("cancelled bookings free capacity for new pickups", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 2 }),
			);

			const p1 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o1" }),
			);
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o2" }),
			);

			// At capacity - this should fail
			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, { orderId: "o3" }),
				),
			).rejects.toThrow("Pickup window is fully booked");

			// Cancel one and try again
			await controller.cancelPickup(p1.id);
			const p3 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o3" }),
			);
			expect(p3.status).toBe("scheduled");
		});

		it("picked_up bookings still count toward capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 1 }),
			);

			const p1 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o1" }),
			);
			await controller.updatePickupStatus(p1.id, "preparing");
			await controller.updatePickupStatus(p1.id, "ready");
			await controller.updatePickupStatus(p1.id, "picked_up");

			// Even though picked up, it still counts toward capacity
			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, { orderId: "o2" }),
				),
			).rejects.toThrow("Pickup window is fully booked");
		});

		it("preparing and ready bookings count toward capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 2 }),
			);

			const p1 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o1" }),
			);
			await controller.updatePickupStatus(p1.id, "preparing");

			const p2 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o2" }),
			);
			await controller.updatePickupStatus(p2.id, "preparing");
			await controller.updatePickupStatus(p2.id, "ready");

			// Both preparing and ready count
			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, { orderId: "o3" }),
				),
			).rejects.toThrow("Pickup window is fully booked");
		});
	});

	// ── Full pickup lifecycle ───────────────────────────────────

	describe("full pickup lifecycle", () => {
		it("tracks all timestamps through the full lifecycle", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);

			expect(pickup.status).toBe("scheduled");
			expect(pickup.preparingAt).toBeUndefined();
			expect(pickup.readyAt).toBeUndefined();
			expect(pickup.pickedUpAt).toBeUndefined();
			expect(pickup.cancelledAt).toBeUndefined();

			const preparing = unwrap(
				await controller.updatePickupStatus(pickup.id, "preparing"),
			);
			expect(preparing.status).toBe("preparing");
			expect(preparing.preparingAt).toBeInstanceOf(Date);
			expect(preparing.readyAt).toBeUndefined();

			const ready = unwrap(
				await controller.updatePickupStatus(pickup.id, "ready"),
			);
			expect(ready.status).toBe("ready");
			expect(ready.preparingAt).toBeInstanceOf(Date);
			expect(ready.readyAt).toBeInstanceOf(Date);
			expect(ready.pickedUpAt).toBeUndefined();

			const completed = unwrap(
				await controller.updatePickupStatus(pickup.id, "picked_up"),
			);
			expect(completed.status).toBe("picked_up");
			expect(completed.preparingAt).toBeInstanceOf(Date);
			expect(completed.readyAt).toBeInstanceOf(Date);
			expect(completed.pickedUpAt).toBeInstanceOf(Date);
			expect(completed.cancelledAt).toBeUndefined();
		});

		it("cancel from preparing preserves preparingAt and sets cancelledAt", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			const cancelled = unwrap(await controller.cancelPickup(pickup.id));

			expect(cancelled.status).toBe("cancelled");
			expect(cancelled.preparingAt).toBeInstanceOf(Date);
			expect(cancelled.cancelledAt).toBeInstanceOf(Date);
			expect(cancelled.readyAt).toBeUndefined();
			expect(cancelled.pickedUpAt).toBeUndefined();
		});

		it("cancel from ready preserves preparingAt and readyAt", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			const cancelled = unwrap(await controller.cancelPickup(pickup.id));

			expect(cancelled.status).toBe("cancelled");
			expect(cancelled.preparingAt).toBeInstanceOf(Date);
			expect(cancelled.readyAt).toBeInstanceOf(Date);
			expect(cancelled.cancelledAt).toBeInstanceOf(Date);
			expect(cancelled.pickedUpAt).toBeUndefined();
		});
	});

	// ── Re-scheduling after cancel/complete ──────────────────────

	describe("re-scheduling after cancel or complete", () => {
		it("allows a new pickup after previous one was cancelled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const first = await controller.schedulePickup(makePickup(loc.id, win.id));
			await controller.cancelPickup(first.id);

			const second = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			expect(second.status).toBe("scheduled");
			expect(second.id).not.toBe(first.id);
		});

		it("allows a new pickup after previous one was picked_up", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const first = await controller.schedulePickup(makePickup(loc.id, win.id));
			await controller.updatePickupStatus(first.id, "preparing");
			await controller.updatePickupStatus(first.id, "ready");
			await controller.updatePickupStatus(first.id, "picked_up");

			const second = await controller.schedulePickup(
				makePickup(loc.id, win.id, { scheduledDate: NEXT_MONDAY_DATE }),
			);
			expect(second.status).toBe("scheduled");
		});

		it("rejects new pickup while one is in preparing status", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const first = await controller.schedulePickup(makePickup(loc.id, win.id));
			await controller.updatePickupStatus(first.id, "preparing");

			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, {
						scheduledDate: NEXT_MONDAY_DATE,
					}),
				),
			).rejects.toThrow("Order already has an active pickup scheduled");
		});

		it("rejects new pickup while one is in ready status", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const first = await controller.schedulePickup(makePickup(loc.id, win.id));
			await controller.updatePickupStatus(first.id, "preparing");
			await controller.updatePickupStatus(first.id, "ready");

			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, {
						scheduledDate: NEXT_MONDAY_DATE,
					}),
				),
			).rejects.toThrow("Order already has an active pickup scheduled");
		});
	});

	// ── getOrderPickup behavior ─────────────────────────────────

	describe("getOrderPickup edge cases", () => {
		it("returns null when pickup was picked_up", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			await controller.updatePickupStatus(pickup.id, "picked_up");

			const result = await controller.getOrderPickup("order_1");
			expect(result).toBeNull();
		});

		it("returns the active pickup when there are multiple for same order", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));

			// First pickup - cancel it
			const first = await controller.schedulePickup(makePickup(loc.id, win.id));
			await controller.cancelPickup(first.id);

			// Second pickup - active
			const second = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);

			const found = unwrap(await controller.getOrderPickup("order_1"));
			expect(found.id).toBe(second.id);
			expect(found.status).toBe("scheduled");
		});

		it("returns preparing pickup as active", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");

			const found = unwrap(await controller.getOrderPickup("order_1"));
			expect(found.status).toBe("preparing");
		});

		it("returns ready pickup as active", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");

			const found = unwrap(await controller.getOrderPickup("order_1"));
			expect(found.status).toBe("ready");
		});
	});

	// ── Status transition exhaustive checks ─────────────────────

	describe("status transition exhaustive checks", () => {
		it("rejects preparing -> scheduled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");

			await expect(
				controller.updatePickupStatus(pickup.id, "scheduled"),
			).rejects.toThrow('Cannot transition from "preparing" to "scheduled"');
		});

		it("rejects preparing -> picked_up (must go through ready)", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");

			await expect(
				controller.updatePickupStatus(pickup.id, "picked_up"),
			).rejects.toThrow('Cannot transition from "preparing" to "picked_up"');
		});

		it("rejects ready -> scheduled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");

			await expect(
				controller.updatePickupStatus(pickup.id, "scheduled"),
			).rejects.toThrow('Cannot transition from "ready" to "scheduled"');
		});

		it("rejects ready -> preparing (no backwards transitions)", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");

			await expect(
				controller.updatePickupStatus(pickup.id, "preparing"),
			).rejects.toThrow('Cannot transition from "ready" to "preparing"');
		});

		it("rejects picked_up -> cancelled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			await controller.updatePickupStatus(pickup.id, "picked_up");

			await expect(
				controller.updatePickupStatus(pickup.id, "cancelled"),
			).rejects.toThrow('Cannot transition from "picked_up" to "cancelled"');
		});

		it("rejects cancelled -> preparing", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.cancelPickup(pickup.id);

			await expect(
				controller.updatePickupStatus(pickup.id, "preparing"),
			).rejects.toThrow('Cannot transition from "cancelled" to "preparing"');
		});
	});

	// ── Location update preserves existing data ─────────────────

	describe("location update preserves existing data", () => {
		it("partial update does not erase unset fields", async () => {
			const loc = await controller.createLocation(
				makeLocation({
					phone: "555-1234",
					email: "store@example.com",
					latitude: 45.5,
					longitude: -122.6,
					preparationMinutes: 30,
					sortOrder: 5,
				}),
			);

			const updated = unwrap(
				await controller.updateLocation(loc.id, { name: "New Name" }),
			);

			expect(updated.name).toBe("New Name");
			expect(updated.address).toBe("123 Main St");
			expect(updated.city).toBe("Portland");
			expect(updated.phone).toBe("555-1234");
			expect(updated.email).toBe("store@example.com");
			expect(updated.latitude).toBe(45.5);
			expect(updated.longitude).toBe(-122.6);
			expect(updated.preparationMinutes).toBe(30);
			expect(updated.sortOrder).toBe(5);
		});

		it("update sets updatedAt to a new date", async () => {
			const loc = await controller.createLocation(makeLocation());
			const originalUpdatedAt = loc.updatedAt;

			const updated = unwrap(
				await controller.updateLocation(loc.id, { name: "Changed" }),
			);
			expect(updated.updatedAt).not.toBe(originalUpdatedAt);
		});

		it("rejects empty address on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.updateLocation(loc.id, { address: "  " }),
			).rejects.toThrow("Address cannot be empty");
		});

		it("rejects empty city on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.updateLocation(loc.id, { city: "  " }),
			).rejects.toThrow("City cannot be empty");
		});

		it("rejects empty state on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.updateLocation(loc.id, { state: "  " }),
			).rejects.toThrow("State cannot be empty");
		});

		it("rejects empty postal code on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.updateLocation(loc.id, { postalCode: "  " }),
			).rejects.toThrow("Postal code cannot be empty");
		});

		it("rejects empty country on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.updateLocation(loc.id, { country: "  " }),
			).rejects.toThrow("Country cannot be empty");
		});

		it("rejects fractional preparation minutes on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.updateLocation(loc.id, { preparationMinutes: 15.5 }),
			).rejects.toThrow("Preparation minutes must be a non-negative integer");
		});

		it("allows zero preparation minutes", async () => {
			const loc = await controller.createLocation(
				makeLocation({ preparationMinutes: 0 }),
			);
			expect(loc.preparationMinutes).toBe(0);
		});

		it("can deactivate and reactivate a location", async () => {
			const loc = await controller.createLocation(makeLocation());
			expect(loc.active).toBe(true);

			const deactivated = unwrap(
				await controller.updateLocation(loc.id, { active: false }),
			);
			expect(deactivated.active).toBe(false);

			const reactivated = unwrap(
				await controller.updateLocation(loc.id, { active: true }),
			);
			expect(reactivated.active).toBe(true);
		});
	});

	// ── Window update edge cases ────────────────────────────────

	describe("window update edge cases", () => {
		it("can change day of week", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { dayOfWeek: 1 }),
			);
			const updated = unwrap(
				await controller.updateWindow(win.id, { dayOfWeek: 3 }),
			);
			expect(updated.dayOfWeek).toBe(3);
		});

		it("can deactivate and reactivate a window", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));

			const deactivated = unwrap(
				await controller.updateWindow(win.id, { active: false }),
			);
			expect(deactivated.active).toBe(false);

			const reactivated = unwrap(
				await controller.updateWindow(win.id, { active: true }),
			);
			expect(reactivated.active).toBe(true);
		});

		it("rejects end time that equals start time", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(
					makeWindow(loc.id, {
						startTime: "10:00",
						endTime: "10:00",
					}),
				),
			).rejects.toThrow("Start time must be before end time");
		});

		it("validates new start time against existing end time", async () => {
			const loc = await controller.createLocation(makeLocation());
			// Window: 09:00 - 12:00
			const win = await controller.createWindow(makeWindow(loc.id));
			// Try to change start to 14:00 (after end)
			await expect(
				controller.updateWindow(win.id, { startTime: "14:00" }),
			).rejects.toThrow("Start time must be before end time");
		});

		it("validates new end time against existing start time", async () => {
			const loc = await controller.createLocation(makeLocation());
			// Window: 09:00 - 12:00
			const win = await controller.createWindow(makeWindow(loc.id));
			// Try to change end to 08:00 (before start)
			await expect(
				controller.updateWindow(win.id, { endTime: "08:00" }),
			).rejects.toThrow("Start time must be before end time");
		});

		it("allows simultaneous start and end time update", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const updated = unwrap(
				await controller.updateWindow(win.id, {
					startTime: "14:00",
					endTime: "18:00",
				}),
			);
			expect(updated.startTime).toBe("14:00");
			expect(updated.endTime).toBe("18:00");
		});
	});

	// ── Multiple windows per day ────────────────────────────────

	describe("multiple windows per day", () => {
		it("availability returns all matching windows for a day", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "09:00",
					endTime: "11:00",
					sortOrder: 0,
				}),
			);
			await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "11:00",
					endTime: "13:00",
					sortOrder: 1,
				}),
			);
			await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "14:00",
					endTime: "16:00",
					sortOrder: 2,
				}),
			);

			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail.length).toBe(3);
			expect(avail[0].window.startTime).toBe("09:00");
			expect(avail[1].window.startTime).toBe("11:00");
			expect(avail[2].window.startTime).toBe("14:00");
		});

		it("bookings only affect the specific window they belong to", async () => {
			const loc = await controller.createLocation(makeLocation());
			const morningWin = await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "09:00",
					endTime: "11:00",
					capacity: 1,
				}),
			);
			const afternoonWin = await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "14:00",
					endTime: "16:00",
					capacity: 1,
				}),
			);

			// Book the morning window
			await controller.schedulePickup(
				makePickup(loc.id, morningWin.id, { orderId: "o1" }),
			);

			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});

			const morning = avail.find((a) => a.window.id === morningWin.id);
			const afternoon = avail.find((a) => a.window.id === afternoonWin.id);

			expect(morning?.available).toBe(false);
			expect(morning?.remaining).toBe(0);
			expect(afternoon?.available).toBe(true);
			expect(afternoon?.remaining).toBe(1);
		});
	});

	// ── Blackout and scheduling interaction ──────────────────────

	describe("blackout and scheduling interaction", () => {
		it("adding a blackout does not cancel existing pickups", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);

			// Add blackout after pickup is already scheduled
			await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});

			// Existing pickup should still be retrievable
			const found = unwrap(await controller.getPickup(pickup.id));
			expect(found.status).toBe("scheduled");
		});

		it("removing a blackout restores availability", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id));

			const blackout = await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});

			let avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail.length).toBe(0);

			await controller.deleteBlackout(blackout.id);

			avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail.length).toBe(1);
			expect(avail[0].available).toBe(true);
		});

		it("isBlackoutDate is isolated per location", async () => {
			const loc1 = await controller.createLocation(
				makeLocation({ name: "Store A" }),
			);
			const loc2 = await controller.createLocation(
				makeLocation({ name: "Store B" }),
			);

			await controller.createBlackout({
				locationId: loc1.id,
				date: MONDAY_DATE,
			});

			expect(await controller.isBlackoutDate(loc1.id, MONDAY_DATE)).toBe(true);
			expect(await controller.isBlackoutDate(loc2.id, MONDAY_DATE)).toBe(false);
		});
	});

	// ── Day of week matching ────────────────────────────────────

	describe("day of week matching", () => {
		it("window on Sunday (0) matches Sunday date", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id, { dayOfWeek: 0 }));

			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: SUNDAY_DATE,
			});
			expect(avail.length).toBe(1);
		});

		it("rejects scheduling on wrong day even when window exists", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { dayOfWeek: 3 }), // Wednesday
			);

			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, {
						scheduledDate: MONDAY_DATE,
					}),
				),
			).rejects.toThrow(
				"Scheduled date does not match the window's day of week",
			);
		});

		it("schedules on the correct day matching window dayOfWeek", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { dayOfWeek: 3 }), // Wednesday
			);

			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id, {
					scheduledDate: WEDNESDAY_DATE,
				}),
			);
			expect(pickup.status).toBe("scheduled");
		});
	});

	// ── Pickup location address formatting ──────────────────────

	describe("pickup address formatting", () => {
		it("constructs location address from parts", async () => {
			const loc = await controller.createLocation(
				makeLocation({
					address: "456 Oak Ave",
					city: "Eugene",
					state: "OR",
					postalCode: "97401",
				}),
			);
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);

			expect(pickup.locationAddress).toBe("456 Oak Ave, Eugene, OR 97401");
		});

		it("uses the location name at time of scheduling", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);

			expect(pickup.locationName).toBe("Downtown Store");

			// Changing the name after scheduling does not retroactively change pickup
			await controller.updateLocation(loc.id, {
				name: "Renamed Store",
			});
			const found = unwrap(await controller.getPickup(pickup.id));
			expect(found.locationName).toBe("Downtown Store");
		});
	});

	// ── listPickups filtering ───────────────────────────────────

	describe("listPickups filtering", () => {
		it("filters by customerId", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));

			await controller.schedulePickup(
				makePickup(loc.id, win.id, {
					orderId: "o1",
					customerId: "cust_1",
				}),
			);
			await controller.schedulePickup(
				makePickup(loc.id, win.id, {
					orderId: "o2",
					customerId: "cust_2",
				}),
			);
			await controller.schedulePickup(
				makePickup(loc.id, win.id, {
					orderId: "o3",
					customerId: "cust_1",
				}),
			);

			const result = await controller.listPickups({
				customerId: "cust_1",
			});
			expect(result.length).toBe(2);
		});

		it("filters by locationId", async () => {
			const loc1 = await controller.createLocation(
				makeLocation({ name: "Store A" }),
			);
			const loc2 = await controller.createLocation(
				makeLocation({ name: "Store B" }),
			);
			const win1 = await controller.createWindow(makeWindow(loc1.id));
			const win2 = await controller.createWindow(makeWindow(loc2.id));

			await controller.schedulePickup(
				makePickup(loc1.id, win1.id, { orderId: "o1" }),
			);
			await controller.schedulePickup(
				makePickup(loc2.id, win2.id, { orderId: "o2" }),
			);

			const result = await controller.listPickups({
				locationId: loc1.id,
			});
			expect(result.length).toBe(1);
			expect(result[0].locationId).toBe(loc1.id);
		});

		it("combines multiple filters", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));

			await controller.schedulePickup(
				makePickup(loc.id, win.id, {
					orderId: "o1",
					customerId: "cust_1",
				}),
			);
			const p2 = await controller.schedulePickup(
				makePickup(loc.id, win.id, {
					orderId: "o2",
					customerId: "cust_1",
				}),
			);
			await controller.cancelPickup(p2.id);

			const result = await controller.listPickups({
				customerId: "cust_1",
				status: "cancelled",
			});
			expect(result.length).toBe(1);
			expect(result[0].orderId).toBe("o2");
		});

		it("returns empty array when no pickups match", async () => {
			const result = await controller.listPickups({
				locationId: "nonexistent",
			});
			expect(result.length).toBe(0);
		});
	});

	// ── Summary with multiple locations ─────────────────────────

	describe("summary with multiple locations", () => {
		it("aggregates across all locations", async () => {
			const loc1 = await controller.createLocation(
				makeLocation({ name: "Store A" }),
			);
			const loc2 = await controller.createLocation(
				makeLocation({ name: "Store B", active: false }),
			);
			const win1 = await controller.createWindow(makeWindow(loc1.id));
			await controller.createWindow(makeWindow(loc2.id, { active: false }));

			// Blackouts
			await controller.createBlackout({
				locationId: loc1.id,
				date: TUESDAY_DATE,
			});
			await controller.createBlackout({
				locationId: loc1.id,
				date: WEDNESDAY_DATE,
			});

			// Pickups with different statuses (need active location for schedule)
			await controller.schedulePickup(
				makePickup(loc1.id, win1.id, { orderId: "o1" }),
			);
			const p2 = await controller.schedulePickup(
				makePickup(loc1.id, win1.id, { orderId: "o2" }),
			);
			await controller.updatePickupStatus(p2.id, "preparing");
			const p3 = await controller.schedulePickup(
				makePickup(loc1.id, win1.id, { orderId: "o3" }),
			);
			await controller.cancelPickup(p3.id);

			const summary = await controller.getSummary();

			expect(summary.totalLocations).toBe(2);
			expect(summary.activeLocations).toBe(1);
			expect(summary.totalWindows).toBe(2);
			expect(summary.activeWindows).toBe(1);
			expect(summary.totalPickups).toBe(3);
			expect(summary.scheduledPickups).toBe(1);
			expect(summary.preparingPickups).toBe(1);
			expect(summary.cancelledPickups).toBe(1);
			expect(summary.readyPickups).toBe(0);
			expect(summary.completedPickups).toBe(0);
			expect(summary.blackoutDates).toBe(2);
		});
	});

	// ── Window booking count edge cases ─────────────────────────

	describe("window booking count edge cases", () => {
		it("rejects invalid date format", async () => {
			await expect(
				controller.getWindowBookingCount("win_1", "not-a-date"),
			).rejects.toThrow("Date must be in YYYY-MM-DD format");
		});

		it("counts across different order statuses correctly", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 10 }),
			);

			// Schedule 4 pickups
			const p1 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o1" }),
			);
			const p2 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o2" }),
			);
			const p3 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o3" }),
			);
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o4" }),
			);

			// Cancel p1, preparing p2, ready p3, keep p4 scheduled
			await controller.cancelPickup(p1.id);
			await controller.updatePickupStatus(p2.id, "preparing");
			await controller.updatePickupStatus(p3.id, "preparing");
			await controller.updatePickupStatus(p3.id, "ready");

			const count = await controller.getWindowBookingCount(win.id, MONDAY_DATE);
			// p1 cancelled (excluded), p2 preparing, p3 ready, p4 scheduled = 3
			expect(count).toBe(3);
		});

		it("does not mix counts from different dates", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 10 }),
			);

			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o1" }),
			);

			const mondayCount = await controller.getWindowBookingCount(
				win.id,
				MONDAY_DATE,
			);
			const tuesdayCount = await controller.getWindowBookingCount(
				win.id,
				TUESDAY_DATE,
			);

			expect(mondayCount).toBe(1);
			expect(tuesdayCount).toBe(0);
		});
	});

	// ── Validation edge cases ───────────────────────────────────

	describe("validation edge cases", () => {
		it("rejects day of week -1", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { dayOfWeek: -1 })),
			).rejects.toThrow("Day of week must be an integer");
		});

		it("rejects day of week 7", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { dayOfWeek: 7 })),
			).rejects.toThrow("Day of week must be an integer");
		});

		it("rejects fractional day of week", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { dayOfWeek: 1.5 })),
			).rejects.toThrow("Day of week must be an integer");
		});

		it("accepts day of week 0 (Sunday)", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { dayOfWeek: 0 }),
			);
			expect(win.dayOfWeek).toBe(0);
		});

		it("accepts day of week 6 (Saturday)", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { dayOfWeek: 6 }),
			);
			expect(win.dayOfWeek).toBe(6);
		});

		it("rejects end time with bad format like 9:00", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { endTime: "9:00" })),
			).rejects.toThrow("End time must be in HH:MM 24-hour format");
		});

		it("rejects start time 25:00", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { startTime: "25:00" })),
			).rejects.toThrow("Start time must be in HH:MM 24-hour format");
		});

		it("accepts boundary time 23:59", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "23:00",
					endTime: "23:59",
				}),
			);
			expect(win.endTime).toBe("23:59");
		});

		it("accepts 00:00 as valid start time", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "00:00",
					endTime: "01:00",
				}),
			);
			expect(win.startTime).toBe("00:00");
		});
	});

	// ── Cross-window same-date capacity ─────────────────────────

	describe("cross-window same-date capacity", () => {
		it("different windows on same day have independent capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win1 = await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "09:00",
					endTime: "11:00",
					capacity: 1,
				}),
			);
			const win2 = await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "11:00",
					endTime: "13:00",
					capacity: 1,
				}),
			);

			// Fill win1
			await controller.schedulePickup(
				makePickup(loc.id, win1.id, { orderId: "o1" }),
			);

			// win2 should still have capacity
			const p2 = await controller.schedulePickup(
				makePickup(loc.id, win2.id, { orderId: "o2" }),
			);
			expect(p2.status).toBe("scheduled");

			// win1 should be full
			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win1.id, { orderId: "o3" }),
				),
			).rejects.toThrow("Pickup window is fully booked");
		});
	});

	// ── Blackout date validation and duplicates ─────────────────

	describe("blackout date operations", () => {
		it("multiple blackouts for different dates at same location", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			await controller.createBlackout({
				locationId: loc.id,
				date: TUESDAY_DATE,
			});
			await controller.createBlackout({
				locationId: loc.id,
				date: WEDNESDAY_DATE,
			});

			const list = await controller.listBlackouts(loc.id);
			expect(list.length).toBe(3);
			// Ordered by date asc
			expect(list[0].date).toBe(MONDAY_DATE);
			expect(list[1].date).toBe(TUESDAY_DATE);
			expect(list[2].date).toBe(WEDNESDAY_DATE);
		});

		it("blackout reason is optional and defaults to undefined", async () => {
			const loc = await controller.createLocation(makeLocation());
			const blackout = await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(blackout.reason).toBeUndefined();
		});

		it("deleting a blackout makes the date available again for isBlackoutDate", async () => {
			const loc = await controller.createLocation(makeLocation());
			const blackout = await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(await controller.isBlackoutDate(loc.id, MONDAY_DATE)).toBe(true);

			await controller.deleteBlackout(blackout.id);
			expect(await controller.isBlackoutDate(loc.id, MONDAY_DATE)).toBe(false);
		});

		it("can re-create blackout after deletion", async () => {
			const loc = await controller.createLocation(makeLocation());
			const first = await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			await controller.deleteBlackout(first.id);

			const second = await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
				reason: "Re-added",
			});
			expect(second.reason).toBe("Re-added");
			expect(await controller.isBlackoutDate(loc.id, MONDAY_DATE)).toBe(true);
		});
	});

	// ── Pickup with window time snapshot ─────────────────────────

	describe("pickup snapshots window times", () => {
		it("pickup captures window start/end time at creation", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, {
					startTime: "10:00",
					endTime: "14:00",
				}),
			);

			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			expect(pickup.startTime).toBe("10:00");
			expect(pickup.endTime).toBe("14:00");

			// Update window times after scheduling
			await controller.updateWindow(win.id, {
				startTime: "08:00",
				endTime: "16:00",
			});

			// Pickup should retain the original times
			const found = unwrap(await controller.getPickup(pickup.id));
			expect(found.startTime).toBe("10:00");
			expect(found.endTime).toBe("14:00");
		});
	});

	// ── Edge cases for delete operations ────────────────────────

	describe("delete operations", () => {
		it("deleting a location does not fail with existing windows", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id));
			const deleted = await controller.deleteLocation(loc.id);
			expect(deleted).toBe(true);
			expect(await controller.getLocation(loc.id)).toBeNull();
		});

		it("deleting a window after pickups still works", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await controller.schedulePickup(makePickup(loc.id, win.id));

			const deleted = await controller.deleteWindow(win.id);
			expect(deleted).toBe(true);
			expect(await controller.getWindow(win.id)).toBeNull();
		});
	});

	// ── Availability with deactivated location ──────────────────

	describe("availability with deactivated location", () => {
		it("returns empty when location is deactivated even with active windows", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id));

			// Deactivate the location
			await controller.updateLocation(loc.id, { active: false });

			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail.length).toBe(0);
		});

		it("scheduling fails for deactivated location", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));

			await controller.updateLocation(loc.id, { active: false });

			await expect(
				controller.schedulePickup(makePickup(loc.id, win.id)),
			).rejects.toThrow("Pickup location is not available");
		});
	});

	// ── Window from different location ──────────────────────────

	describe("window-location mismatch", () => {
		it("cannot schedule with window from wrong location", async () => {
			const locA = await controller.createLocation(makeLocation({ name: "A" }));
			const locB = await controller.createLocation(makeLocation({ name: "B" }));
			const winB = await controller.createWindow(makeWindow(locB.id));

			await expect(
				controller.schedulePickup(
					makePickup(locA.id, winB.id, { orderId: "o1" }),
				),
			).rejects.toThrow("Window does not belong to the specified location");
		});
	});

	// ── Summary after full lifecycle ────────────────────────────

	describe("summary after full lifecycle", () => {
		it("reflects all status changes accurately", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 10 }),
			);

			// Create pickups in various final states
			// 1. Remains scheduled
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o1" }),
			);

			// 2. Goes to preparing
			const p2 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o2" }),
			);
			await controller.updatePickupStatus(p2.id, "preparing");

			// 3. Goes to ready
			const p3 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o3" }),
			);
			await controller.updatePickupStatus(p3.id, "preparing");
			await controller.updatePickupStatus(p3.id, "ready");

			// 4. Goes to picked_up
			const p4 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o4" }),
			);
			await controller.updatePickupStatus(p4.id, "preparing");
			await controller.updatePickupStatus(p4.id, "ready");
			await controller.updatePickupStatus(p4.id, "picked_up");

			// 5. Cancelled from scheduled
			const p5 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o5" }),
			);
			await controller.cancelPickup(p5.id);

			// 6. Cancelled from preparing
			const p6 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o6" }),
			);
			await controller.updatePickupStatus(p6.id, "preparing");
			await controller.cancelPickup(p6.id);

			// 7. Cancelled from ready
			const p7 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o7" }),
			);
			await controller.updatePickupStatus(p7.id, "preparing");
			await controller.updatePickupStatus(p7.id, "ready");
			await controller.cancelPickup(p7.id);

			const summary = await controller.getSummary();
			expect(summary.totalPickups).toBe(7);
			expect(summary.scheduledPickups).toBe(1);
			expect(summary.preparingPickups).toBe(1);
			expect(summary.readyPickups).toBe(1);
			expect(summary.completedPickups).toBe(1);
			expect(summary.cancelledPickups).toBe(3);
		});
	});
});
