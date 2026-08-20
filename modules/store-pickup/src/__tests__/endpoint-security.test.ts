import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createStorePickupController } from "../service-impl";

/**
 * Security regression tests for store-pickup endpoints.
 *
 * Security focuses on:
 * - Inactive locations/windows cannot be used for scheduling
 * - Blackout dates prevent scheduling
 * - Capacity enforcement (window capacity)
 * - Duplicate active pickup per order prevention
 * - Status transition validation (invalid transitions rejected)
 * - cancelPickup rejects already-cancelled or picked-up orders
 */

describe("store-pickup endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createStorePickupController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createStorePickupController(mockData);
	});

	// Helper: compute next date matching a specific day-of-week (0=Sun…6=Sat)
	function nextDayOfWeek(dow: number): string {
		const d = new Date();
		const diff = (dow - d.getDay() + 7) % 7 || 7;
		d.setDate(d.getDate() + diff);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	// Helpers to create a complete location + window pair
	async function createActiveLocation() {
		return controller.createLocation({
			name: "Test Location",
			address: "1 Test Ave",
			city: "Testville",
			state: "TS",
			postalCode: "12345",
			country: "US",
			active: true,
		});
	}

	async function createWindowForLocation(
		locationId: string,
		dow: number,
		capacity = 10,
	) {
		return controller.createWindow({
			locationId,
			dayOfWeek: dow,
			startTime: "09:00",
			endTime: "12:00",
			capacity,
			active: true,
		});
	}

	describe("inactive location protection", () => {
		it("schedulePickup rejects inactive location", async () => {
			const loc = await createActiveLocation();
			const dow = 1; // Monday
			const monday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			// Deactivate the location
			await controller.updateLocation(loc.id, { active: false });

			await expect(
				controller.schedulePickup({
					locationId: loc.id,
					windowId: win.id,
					orderId: "order_1",
					scheduledDate: monday,
				}),
			).rejects.toThrow("not available");
		});

		it("getAvailableWindows returns empty for inactive location", async () => {
			const loc = await createActiveLocation();
			const dow = 2; // Tuesday
			await createWindowForLocation(loc.id, dow);

			await controller.updateLocation(loc.id, { active: false });

			const tuesday = nextDayOfWeek(dow);
			const windows = await controller.getAvailableWindows({
				locationId: loc.id,
				date: tuesday,
			});
			expect(windows).toHaveLength(0);
		});
	});

	describe("inactive window protection", () => {
		it("schedulePickup rejects inactive window", async () => {
			const loc = await createActiveLocation();
			const dow = 1;
			const monday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			// Deactivate the window
			await controller.updateWindow(win.id, { active: false });

			await expect(
				controller.schedulePickup({
					locationId: loc.id,
					windowId: win.id,
					orderId: "order_1",
					scheduledDate: monday,
				}),
			).rejects.toThrow("not available");
		});

		it("getAvailableWindows excludes inactive windows", async () => {
			const loc = await createActiveLocation();
			const dow = 3;
			const wednesday = nextDayOfWeek(dow);

			await createWindowForLocation(loc.id, dow, 5);
			const inactiveWin = await createWindowForLocation(loc.id, dow, 5);
			await controller.updateWindow(inactiveWin.id, { active: false });

			const windows = await controller.getAvailableWindows({
				locationId: loc.id,
				date: wednesday,
			});
			expect(windows).toHaveLength(1);
		});
	});

	describe("blackout date enforcement", () => {
		it("schedulePickup rejects pickup on blackout date", async () => {
			const loc = await createActiveLocation();
			const dow = 2;
			const tuesday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			await controller.createBlackout({
				locationId: loc.id,
				date: tuesday,
				reason: "Holiday",
			});

			await expect(
				controller.schedulePickup({
					locationId: loc.id,
					windowId: win.id,
					orderId: "order_1",
					scheduledDate: tuesday,
				}),
			).rejects.toThrow("not available");
		});

		it("getAvailableWindows returns empty on blackout date", async () => {
			const loc = await createActiveLocation();
			const dow = 4;
			const thursday = nextDayOfWeek(dow);
			await createWindowForLocation(loc.id, dow);

			await controller.createBlackout({
				locationId: loc.id,
				date: thursday,
			});

			const windows = await controller.getAvailableWindows({
				locationId: loc.id,
				date: thursday,
			});
			expect(windows).toHaveLength(0);
		});

		it("isBlackoutDate returns true after creating a blackout", async () => {
			const loc = await createActiveLocation();
			const date = nextDayOfWeek(5);

			await controller.createBlackout({ locationId: loc.id, date });

			const result = await controller.isBlackoutDate(loc.id, date);
			expect(result).toBe(true);
		});

		it("isBlackoutDate returns false when no blackout exists", async () => {
			const loc = await createActiveLocation();
			const date = nextDayOfWeek(6);

			const result = await controller.isBlackoutDate(loc.id, date);
			expect(result).toBe(false);
		});

		it("duplicate blackout for same location+date is prevented", async () => {
			const loc = await createActiveLocation();
			const date = nextDayOfWeek(1);

			await controller.createBlackout({ locationId: loc.id, date });

			await expect(
				controller.createBlackout({ locationId: loc.id, date }),
			).rejects.toThrow("already exists");
		});
	});

	describe("capacity enforcement", () => {
		it("schedulePickup rejects when window is fully booked", async () => {
			const loc = await createActiveLocation();
			const dow = 1;
			const monday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow, 2);

			await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_1",
				scheduledDate: monday,
			});
			await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_2",
				scheduledDate: monday,
			});

			await expect(
				controller.schedulePickup({
					locationId: loc.id,
					windowId: win.id,
					orderId: "order_3",
					scheduledDate: monday,
				}),
			).rejects.toThrow("fully booked");
		});

		it("cancelled pickups free up capacity", async () => {
			const loc = await createActiveLocation();
			const dow = 2;
			const tuesday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow, 1);

			const pickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_cap",
				scheduledDate: tuesday,
			});

			await controller.cancelPickup(pickup.id);

			// Now capacity should be freed
			const newPickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_cap2",
				scheduledDate: tuesday,
			});
			expect(newPickup.status).toBe("scheduled");
		});

		it("getAvailableWindows reports remaining capacity accurately", async () => {
			const loc = await createActiveLocation();
			const dow = 3;
			const wednesday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow, 5);

			await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_rem1",
				scheduledDate: wednesday,
			});
			await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_rem2",
				scheduledDate: wednesday,
			});

			const windows = await controller.getAvailableWindows({
				locationId: loc.id,
				date: wednesday,
			});

			expect(windows).toHaveLength(1);
			expect(windows[0].booked).toBe(2);
			expect(windows[0].remaining).toBe(3);
			expect(windows[0].available).toBe(true);
		});
	});

	describe("duplicate active pickup prevention", () => {
		it("rejects second active pickup for the same order", async () => {
			const loc = await createActiveLocation();
			const dow = 1;
			const monday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_dup",
				scheduledDate: monday,
			});

			await expect(
				controller.schedulePickup({
					locationId: loc.id,
					windowId: win.id,
					orderId: "order_dup",
					scheduledDate: monday,
				}),
			).rejects.toThrow("already has an active pickup");
		});

		it("allows scheduling after previous pickup is cancelled", async () => {
			const loc = await createActiveLocation();
			const dow = 4;
			const thursday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			const first = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_resch",
				scheduledDate: thursday,
			});

			await controller.cancelPickup(first.id);

			const second = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_resch",
				scheduledDate: thursday,
			});
			expect(second.status).toBe("scheduled");
		});
	});

	describe("status transition validation", () => {
		it("rejects invalid transition: scheduled -> ready", async () => {
			const loc = await createActiveLocation();
			const dow = 5;
			const friday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			const pickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_trans1",
				scheduledDate: friday,
			});

			await expect(
				controller.updatePickupStatus(pickup.id, "ready"),
			).rejects.toThrow('Cannot transition from "scheduled" to "ready"');
		});

		it("rejects invalid transition: scheduled -> picked_up", async () => {
			const loc = await createActiveLocation();
			const dow = 6;
			const saturday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			const pickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_trans2",
				scheduledDate: saturday,
			});

			await expect(
				controller.updatePickupStatus(pickup.id, "picked_up"),
			).rejects.toThrow('Cannot transition from "scheduled" to "picked_up"');
		});

		it("allows valid transition: scheduled -> preparing -> ready -> picked_up", async () => {
			const loc = await createActiveLocation();
			const dow = 1;
			const monday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			const pickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_flow",
				scheduledDate: monday,
			});

			const preparing = await controller.updatePickupStatus(
				pickup.id,
				"preparing",
			);
			expect(preparing?.status).toBe("preparing");

			const ready = await controller.updatePickupStatus(pickup.id, "ready");
			expect(ready?.status).toBe("ready");

			const pickedUp = await controller.updatePickupStatus(
				pickup.id,
				"picked_up",
			);
			expect(pickedUp?.status).toBe("picked_up");
		});

		it("rejects transition from terminal status picked_up", async () => {
			const loc = await createActiveLocation();
			const dow = 2;
			const tuesday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			const pickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_terminal",
				scheduledDate: tuesday,
			});

			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			await controller.updatePickupStatus(pickup.id, "picked_up");

			await expect(
				controller.updatePickupStatus(pickup.id, "cancelled"),
			).rejects.toThrow('Cannot transition from "picked_up"');
		});

		it("returns null for updatePickupStatus on non-existent pickup", async () => {
			const result = await controller.updatePickupStatus(
				"nonexistent",
				"preparing",
			);
			expect(result).toBeNull();
		});
	});

	describe("cancelPickup safety", () => {
		it("cancelPickup rejects already-cancelled pickup", async () => {
			const loc = await createActiveLocation();
			const dow = 3;
			const wednesday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			const pickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_cancel1",
				scheduledDate: wednesday,
			});

			await controller.cancelPickup(pickup.id);

			await expect(controller.cancelPickup(pickup.id)).rejects.toThrow(
				"already cancelled",
			);
		});

		it("cancelPickup rejects a completed (picked_up) order", async () => {
			const loc = await createActiveLocation();
			const dow = 4;
			const thursday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			const pickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_cancel2",
				scheduledDate: thursday,
			});

			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			await controller.updatePickupStatus(pickup.id, "picked_up");

			await expect(controller.cancelPickup(pickup.id)).rejects.toThrow(
				"Cannot cancel a completed pickup",
			);
		});

		it("cancelPickup returns null for non-existent pickup", async () => {
			const result = await controller.cancelPickup("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("day-of-week validation", () => {
		it("schedulePickup rejects date that doesn't match window day", async () => {
			const loc = await createActiveLocation();
			const win = await createWindowForLocation(loc.id, 1); // Monday window

			const tuesday = nextDayOfWeek(2); // Tuesday date
			await expect(
				controller.schedulePickup({
					locationId: loc.id,
					windowId: win.id,
					orderId: "order_dow",
					scheduledDate: tuesday,
				}),
			).rejects.toThrow("does not match");
		});

		it("schedulePickup requires window to belong to the specified location", async () => {
			const loc1 = await createActiveLocation();
			const loc2 = await controller.createLocation({
				name: "Other Location",
				address: "2 Other Ave",
				city: "Testville",
				state: "TS",
				postalCode: "12345",
				country: "US",
			});
			const dow = 5;
			const friday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc2.id, dow);

			await expect(
				controller.schedulePickup({
					locationId: loc1.id,
					windowId: win.id,
					orderId: "order_mismatch",
					scheduledDate: friday,
				}),
			).rejects.toThrow("does not belong to the specified location");
		});
	});

	describe("getOrderPickup scoping", () => {
		it("getOrderPickup returns null for unknown order", async () => {
			const result = await controller.getOrderPickup("unknown_order");
			expect(result).toBeNull();
		});

		it("getOrderPickup returns the active pickup for an order", async () => {
			const loc = await createActiveLocation();
			const dow = 1;
			const monday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			const pickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_gop",
				scheduledDate: monday,
			});

			const result = await controller.getOrderPickup("order_gop");
			expect(result).not.toBeNull();
			expect(result?.id).toBe(pickup.id);
		});

		it("getOrderPickup returns null after pickup is cancelled", async () => {
			const loc = await createActiveLocation();
			const dow = 2;
			const tuesday = nextDayOfWeek(dow);
			const win = await createWindowForLocation(loc.id, dow);

			const pickup = await controller.schedulePickup({
				locationId: loc.id,
				windowId: win.id,
				orderId: "order_gop2",
				scheduledDate: tuesday,
			});

			await controller.cancelPickup(pickup.id);

			const result = await controller.getOrderPickup("order_gop2");
			expect(result).toBeNull();
		});
	});

	describe("deleteLocation safety", () => {
		it("deleteLocation returns false for non-existent location", async () => {
			const result = await controller.deleteLocation("nonexistent");
			expect(result).toBe(false);
		});

		it("deleteLocation returns true and removes the location", async () => {
			const loc = await createActiveLocation();

			const result = await controller.deleteLocation(loc.id);
			expect(result).toBe(true);

			const retrieved = await controller.getLocation(loc.id);
			expect(retrieved).toBeNull();
		});
	});
});
