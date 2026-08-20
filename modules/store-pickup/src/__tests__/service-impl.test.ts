import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { StorePickupController } from "../service";
import { createStorePickupController } from "../service-impl";

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

describe("createStorePickupController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: StorePickupController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createStorePickupController(mockData);
	});

	// ── Location CRUD ────────────────────────────────────────────

	describe("createLocation", () => {
		it("creates a location with defaults", async () => {
			const loc = await controller.createLocation(makeLocation());
			expect(loc.id).toBeDefined();
			expect(loc.name).toBe("Downtown Store");
			expect(loc.address).toBe("123 Main St");
			expect(loc.city).toBe("Portland");
			expect(loc.state).toBe("OR");
			expect(loc.postalCode).toBe("97201");
			expect(loc.country).toBe("US");
			expect(loc.preparationMinutes).toBe(60);
			expect(loc.active).toBe(true);
			expect(loc.sortOrder).toBe(0);
		});

		it("creates a location with custom preparation time", async () => {
			const loc = await controller.createLocation(
				makeLocation({ preparationMinutes: 30 }),
			);
			expect(loc.preparationMinutes).toBe(30);
		});

		it("creates an inactive location", async () => {
			const loc = await controller.createLocation(
				makeLocation({ active: false }),
			);
			expect(loc.active).toBe(false);
		});

		it("creates a location with sort order", async () => {
			const loc = await controller.createLocation(
				makeLocation({ sortOrder: 3 }),
			);
			expect(loc.sortOrder).toBe(3);
		});

		it("trims whitespace from name", async () => {
			const loc = await controller.createLocation(
				makeLocation({ name: "  Uptown  " }),
			);
			expect(loc.name).toBe("Uptown");
		});

		it("stores optional contact fields", async () => {
			const loc = await controller.createLocation(
				makeLocation({
					phone: "555-0100",
					email: "store@example.com",
					latitude: 45.5152,
					longitude: -122.6784,
				}),
			);
			expect(loc.phone).toBe("555-0100");
			expect(loc.email).toBe("store@example.com");
			expect(loc.latitude).toBe(45.5152);
			expect(loc.longitude).toBe(-122.6784);
		});

		it("rejects empty name", async () => {
			await expect(
				controller.createLocation(makeLocation({ name: "   " })),
			).rejects.toThrow("Location name is required");
		});

		it("rejects empty address", async () => {
			await expect(
				controller.createLocation(makeLocation({ address: "   " })),
			).rejects.toThrow("Address is required");
		});

		it("rejects empty city", async () => {
			await expect(
				controller.createLocation(makeLocation({ city: "  " })),
			).rejects.toThrow("City is required");
		});

		it("rejects empty state", async () => {
			await expect(
				controller.createLocation(makeLocation({ state: " " })),
			).rejects.toThrow("State is required");
		});

		it("rejects empty postal code", async () => {
			await expect(
				controller.createLocation(makeLocation({ postalCode: " " })),
			).rejects.toThrow("Postal code is required");
		});

		it("rejects empty country", async () => {
			await expect(
				controller.createLocation(makeLocation({ country: "  " })),
			).rejects.toThrow("Country is required");
		});

		it("rejects negative preparation minutes", async () => {
			await expect(
				controller.createLocation(makeLocation({ preparationMinutes: -5 })),
			).rejects.toThrow("Preparation minutes must be a non-negative integer");
		});

		it("rejects fractional preparation minutes", async () => {
			await expect(
				controller.createLocation(makeLocation({ preparationMinutes: 30.5 })),
			).rejects.toThrow("Preparation minutes must be a non-negative integer");
		});
	});

	describe("updateLocation", () => {
		it("updates location name", async () => {
			const loc = await controller.createLocation(makeLocation());
			const updated = await controller.updateLocation(loc.id, {
				name: "New Name",
			});
			expect(updated?.name).toBe("New Name");
		});

		it("updates multiple fields", async () => {
			const loc = await controller.createLocation(makeLocation());
			const updated = await controller.updateLocation(loc.id, {
				city: "Eugene",
				state: "OR",
				preparationMinutes: 120,
			});
			expect(updated?.city).toBe("Eugene");
			expect(updated?.preparationMinutes).toBe(120);
		});

		it("returns null for non-existent location", async () => {
			const result = await controller.updateLocation("missing", {
				name: "X",
			});
			expect(result).toBeNull();
		});

		it("rejects empty name on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.updateLocation(loc.id, { name: "  " }),
			).rejects.toThrow("Location name cannot be empty");
		});

		it("rejects negative preparation minutes on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.updateLocation(loc.id, {
					preparationMinutes: -1,
				}),
			).rejects.toThrow("Preparation minutes must be a non-negative integer");
		});
	});

	describe("getLocation", () => {
		it("returns a location by id", async () => {
			const loc = await controller.createLocation(makeLocation());
			const found = await controller.getLocation(loc.id);
			expect(found?.id).toBe(loc.id);
		});

		it("returns null for unknown id", async () => {
			const found = await controller.getLocation("nope");
			expect(found).toBeNull();
		});
	});

	describe("listLocations", () => {
		it("lists all locations", async () => {
			await controller.createLocation(
				makeLocation({ name: "A", sortOrder: 1 }),
			);
			await controller.createLocation(
				makeLocation({ name: "B", sortOrder: 2 }),
			);
			const list = await controller.listLocations();
			expect(list.length).toBe(2);
			expect(list[0].name).toBe("A");
			expect(list[1].name).toBe("B");
		});

		it("filters by active status", async () => {
			await controller.createLocation(
				makeLocation({ name: "Active", active: true }),
			);
			await controller.createLocation(
				makeLocation({ name: "Inactive", active: false }),
			);
			const active = await controller.listLocations({ active: true });
			expect(active.length).toBe(1);
			expect(active[0].name).toBe("Active");
		});

		it("supports pagination", async () => {
			await controller.createLocation(makeLocation({ name: "A" }));
			await controller.createLocation(makeLocation({ name: "B" }));
			const page = await controller.listLocations({ take: 1 });
			expect(page.length).toBe(1);
		});
	});

	describe("deleteLocation", () => {
		it("deletes an existing location", async () => {
			const loc = await controller.createLocation(makeLocation());
			const deleted = await controller.deleteLocation(loc.id);
			expect(deleted).toBe(true);
			const found = await controller.getLocation(loc.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent location", async () => {
			const deleted = await controller.deleteLocation("missing");
			expect(deleted).toBe(false);
		});
	});

	// ── Window CRUD ──────────────────────────────────────────────

	describe("createWindow", () => {
		it("creates a window with defaults", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			expect(win.id).toBeDefined();
			expect(win.locationId).toBe(loc.id);
			expect(win.dayOfWeek).toBe(1);
			expect(win.startTime).toBe("09:00");
			expect(win.endTime).toBe("12:00");
			expect(win.capacity).toBe(5);
			expect(win.active).toBe(true);
			expect(win.sortOrder).toBe(0);
		});

		it("creates an inactive window", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { active: false }),
			);
			expect(win.active).toBe(false);
		});

		it("rejects when location does not exist", async () => {
			await expect(
				controller.createWindow(makeWindow("missing")),
			).rejects.toThrow("Pickup location not found");
		});

		it("rejects invalid day of week", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { dayOfWeek: 7 })),
			).rejects.toThrow("Day of week must be an integer");
		});

		it("rejects invalid time format", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { startTime: "9:00" })),
			).rejects.toThrow("Start time must be in HH:MM 24-hour format");
		});

		it("rejects start time >= end time", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(
					makeWindow(loc.id, {
						startTime: "14:00",
						endTime: "12:00",
					}),
				),
			).rejects.toThrow("Start time must be before end time");
		});

		it("rejects zero capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { capacity: 0 })),
			).rejects.toThrow("Capacity must be a positive integer");
		});

		it("rejects negative capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { capacity: -1 })),
			).rejects.toThrow("Capacity must be a positive integer");
		});

		it("rejects fractional capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createWindow(makeWindow(loc.id, { capacity: 2.5 })),
			).rejects.toThrow("Capacity must be a positive integer");
		});
	});

	describe("updateWindow", () => {
		it("updates window capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const updated = await controller.updateWindow(win.id, {
				capacity: 10,
			});
			expect(updated?.capacity).toBe(10);
		});

		it("updates window time range", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const updated = await controller.updateWindow(win.id, {
				startTime: "10:00",
				endTime: "14:00",
			});
			expect(updated?.startTime).toBe("10:00");
			expect(updated?.endTime).toBe("14:00");
		});

		it("returns null for non-existent window", async () => {
			const result = await controller.updateWindow("missing", {
				capacity: 10,
			});
			expect(result).toBeNull();
		});

		it("rejects invalid day of week on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await expect(
				controller.updateWindow(win.id, { dayOfWeek: -1 }),
			).rejects.toThrow("Day of week must be an integer");
		});

		it("rejects invalid time on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await expect(
				controller.updateWindow(win.id, { endTime: "25:00" }),
			).rejects.toThrow("End time must be in HH:MM 24-hour format");
		});

		it("rejects start >= end after partial update", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await expect(
				controller.updateWindow(win.id, { startTime: "13:00" }),
			).rejects.toThrow("Start time must be before end time");
		});

		it("rejects zero capacity on update", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await expect(
				controller.updateWindow(win.id, { capacity: 0 }),
			).rejects.toThrow("Capacity must be a positive integer");
		});
	});

	describe("getWindow", () => {
		it("returns a window by id", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const found = await controller.getWindow(win.id);
			expect(found?.id).toBe(win.id);
		});

		it("returns null for unknown id", async () => {
			expect(await controller.getWindow("nope")).toBeNull();
		});
	});

	describe("listWindows", () => {
		it("lists windows for a location", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id, { sortOrder: 1 }));
			await controller.createWindow(makeWindow(loc.id, { sortOrder: 2 }));
			const list = await controller.listWindows({
				locationId: loc.id,
			});
			expect(list.length).toBe(2);
			expect(list[0].sortOrder).toBe(1);
		});

		it("filters by day of week", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id, { dayOfWeek: 1 }));
			await controller.createWindow(makeWindow(loc.id, { dayOfWeek: 2 }));
			const monday = await controller.listWindows({
				locationId: loc.id,
				dayOfWeek: 1,
			});
			expect(monday.length).toBe(1);
		});

		it("filters by active status", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id, { active: true }));
			await controller.createWindow(makeWindow(loc.id, { active: false }));
			const active = await controller.listWindows({
				locationId: loc.id,
				active: true,
			});
			expect(active.length).toBe(1);
		});
	});

	describe("deleteWindow", () => {
		it("deletes an existing window", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			expect(await controller.deleteWindow(win.id)).toBe(true);
			expect(await controller.getWindow(win.id)).toBeNull();
		});

		it("returns false for non-existent window", async () => {
			expect(await controller.deleteWindow("missing")).toBe(false);
		});
	});

	// ── Pickup scheduling ────────────────────────────────────────

	describe("schedulePickup", () => {
		it("schedules a pickup with defaults", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			expect(pickup.id).toBeDefined();
			expect(pickup.locationId).toBe(loc.id);
			expect(pickup.windowId).toBe(win.id);
			expect(pickup.orderId).toBe("order_1");
			expect(pickup.scheduledDate).toBe(MONDAY_DATE);
			expect(pickup.status).toBe("scheduled");
			expect(pickup.locationName).toBe("Downtown Store");
			expect(pickup.locationAddress).toContain("123 Main St");
			expect(pickup.startTime).toBe("09:00");
			expect(pickup.endTime).toBe("12:00");
		});

		it("stores optional customer ID and notes", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id, {
					customerId: "cust_1",
					notes: "Ring doorbell",
				}),
			);
			expect(pickup.customerId).toBe("cust_1");
			expect(pickup.notes).toBe("Ring doorbell");
		});

		it("rejects missing order ID", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await expect(
				controller.schedulePickup(makePickup(loc.id, win.id, { orderId: "" })),
			).rejects.toThrow("Order ID is required");
		});

		it("rejects invalid date format", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, {
						scheduledDate: "03-09-2026",
					}),
				),
			).rejects.toThrow("Scheduled date must be in YYYY-MM-DD format");
		});

		it("rejects non-existent location", async () => {
			await expect(
				controller.schedulePickup({
					locationId: "missing",
					windowId: "win_1",
					orderId: "order_1",
					scheduledDate: MONDAY_DATE,
				}),
			).rejects.toThrow("Pickup location not found");
		});

		it("rejects inactive location", async () => {
			const loc = await controller.createLocation(
				makeLocation({ active: false }),
			);
			const win = await controller.createWindow(makeWindow(loc.id));
			await expect(
				controller.schedulePickup(makePickup(loc.id, win.id)),
			).rejects.toThrow("Pickup location is not available");
		});

		it("rejects non-existent window", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.schedulePickup(makePickup(loc.id, "missing")),
			).rejects.toThrow("Pickup window not found");
		});

		it("rejects inactive window", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { active: false }),
			);
			await expect(
				controller.schedulePickup(makePickup(loc.id, win.id)),
			).rejects.toThrow("Pickup window is not available");
		});

		it("rejects window from a different location", async () => {
			const loc1 = await controller.createLocation(makeLocation());
			const loc2 = await controller.createLocation(
				makeLocation({ name: "Other Store" }),
			);
			const win = await controller.createWindow(makeWindow(loc2.id));
			await expect(
				controller.schedulePickup(makePickup(loc1.id, win.id)),
			).rejects.toThrow("Window does not belong to the specified location");
		});

		it("rejects date that does not match window day of week", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id)); // Monday
			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, {
						scheduledDate: TUESDAY_DATE,
					}),
				),
			).rejects.toThrow(
				"Scheduled date does not match the window's day of week",
			);
		});

		it("rejects pickup on blackout date", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			await expect(
				controller.schedulePickup(makePickup(loc.id, win.id)),
			).rejects.toThrow(
				"Pickup is not available at this location on this date",
			);
		});

		it("rejects duplicate active pickup for the same order", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await controller.schedulePickup(makePickup(loc.id, win.id));
			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, { orderId: "order_1" }),
				),
			).rejects.toThrow("Order already has an active pickup scheduled");
		});

		it("allows new pickup for an order after previous was cancelled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const first = await controller.schedulePickup(makePickup(loc.id, win.id));
			await controller.cancelPickup(first.id);
			const second = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			expect(second.status).toBe("scheduled");
		});

		it("rejects when window is at capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 1 }),
			);
			await controller.schedulePickup(makePickup(loc.id, win.id));
			await expect(
				controller.schedulePickup(
					makePickup(loc.id, win.id, { orderId: "order_2" }),
				),
			).rejects.toThrow("Pickup window is fully booked");
		});

		it("does not count cancelled pickups toward capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 1 }),
			);
			const first = await controller.schedulePickup(makePickup(loc.id, win.id));
			await controller.cancelPickup(first.id);
			const second = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "order_2" }),
			);
			expect(second.status).toBe("scheduled");
		});
	});

	describe("getPickup", () => {
		it("returns a pickup by id", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			const found = await controller.getPickup(pickup.id);
			expect(found?.id).toBe(pickup.id);
		});

		it("returns null for unknown id", async () => {
			expect(await controller.getPickup("nope")).toBeNull();
		});
	});

	describe("getOrderPickup", () => {
		it("returns active pickup for an order", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await controller.schedulePickup(makePickup(loc.id, win.id));
			const found = await controller.getOrderPickup("order_1");
			expect(found).not.toBeNull();
			expect(found?.orderId).toBe("order_1");
		});

		it("returns null when all pickups are cancelled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.cancelPickup(pickup.id);
			const found = await controller.getOrderPickup("order_1");
			expect(found).toBeNull();
		});

		it("returns null for unknown order", async () => {
			expect(await controller.getOrderPickup("unknown")).toBeNull();
		});
	});

	describe("listPickups", () => {
		it("lists all pickups ordered by createdAt desc", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "order_1" }),
			);
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "order_2" }),
			);
			const list = await controller.listPickups();
			expect(list.length).toBe(2);
		});

		it("filters by status", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.cancelPickup(pickup.id);
			const scheduled = await controller.listPickups({
				status: "scheduled",
			});
			expect(scheduled.length).toBe(0);
			const cancelled = await controller.listPickups({
				status: "cancelled",
			});
			expect(cancelled.length).toBe(1);
		});

		it("filters by scheduledDate", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await controller.schedulePickup(makePickup(loc.id, win.id));
			const result = await controller.listPickups({
				scheduledDate: TUESDAY_DATE,
			});
			expect(result.length).toBe(0);
		});

		it("supports pagination", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o1" }),
			);
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o2" }),
			);
			const page = await controller.listPickups({ take: 1 });
			expect(page.length).toBe(1);
		});
	});

	// ── Status transitions ───────────────────────────────────────

	describe("updatePickupStatus", () => {
		it("transitions scheduled → preparing", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			const updated = await controller.updatePickupStatus(
				pickup.id,
				"preparing",
			);
			expect(updated?.status).toBe("preparing");
			expect(updated?.preparingAt).toBeInstanceOf(Date);
		});

		it("transitions preparing → ready", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			const updated = await controller.updatePickupStatus(pickup.id, "ready");
			expect(updated?.status).toBe("ready");
			expect(updated?.readyAt).toBeInstanceOf(Date);
		});

		it("transitions ready → picked_up", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			const updated = await controller.updatePickupStatus(
				pickup.id,
				"picked_up",
			);
			expect(updated?.status).toBe("picked_up");
			expect(updated?.pickedUpAt).toBeInstanceOf(Date);
		});

		it("transitions scheduled → cancelled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			const updated = await controller.updatePickupStatus(
				pickup.id,
				"cancelled",
			);
			expect(updated?.status).toBe("cancelled");
			expect(updated?.cancelledAt).toBeInstanceOf(Date);
		});

		it("transitions preparing → cancelled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			const updated = await controller.updatePickupStatus(
				pickup.id,
				"cancelled",
			);
			expect(updated?.status).toBe("cancelled");
		});

		it("transitions ready → cancelled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			const updated = await controller.updatePickupStatus(
				pickup.id,
				"cancelled",
			);
			expect(updated?.status).toBe("cancelled");
		});

		it("rejects invalid transition scheduled → ready", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await expect(
				controller.updatePickupStatus(pickup.id, "ready"),
			).rejects.toThrow('Cannot transition from "scheduled" to "ready"');
		});

		it("rejects invalid transition scheduled → picked_up", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await expect(
				controller.updatePickupStatus(pickup.id, "picked_up"),
			).rejects.toThrow('Cannot transition from "scheduled" to "picked_up"');
		});

		it("rejects transition from picked_up", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			await controller.updatePickupStatus(pickup.id, "picked_up");
			await expect(
				controller.updatePickupStatus(pickup.id, "scheduled"),
			).rejects.toThrow('Cannot transition from "picked_up" to "scheduled"');
		});

		it("rejects transition from cancelled", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.cancelPickup(pickup.id);
			await expect(
				controller.updatePickupStatus(pickup.id, "scheduled"),
			).rejects.toThrow('Cannot transition from "cancelled" to "scheduled"');
		});

		it("returns null for non-existent pickup", async () => {
			const result = await controller.updatePickupStatus(
				"missing",
				"preparing",
			);
			expect(result).toBeNull();
		});
	});

	describe("cancelPickup", () => {
		it("cancels a scheduled pickup", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			const cancelled = await controller.cancelPickup(pickup.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
		});

		it("cancels a preparing pickup", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			const cancelled = await controller.cancelPickup(pickup.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancels a ready pickup", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			const cancelled = await controller.cancelPickup(pickup.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("rejects cancelling an already cancelled pickup", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.cancelPickup(pickup.id);
			await expect(controller.cancelPickup(pickup.id)).rejects.toThrow(
				"Pickup is already cancelled",
			);
		});

		it("rejects cancelling a completed pickup", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const pickup = await controller.schedulePickup(
				makePickup(loc.id, win.id),
			);
			await controller.updatePickupStatus(pickup.id, "preparing");
			await controller.updatePickupStatus(pickup.id, "ready");
			await controller.updatePickupStatus(pickup.id, "picked_up");
			await expect(controller.cancelPickup(pickup.id)).rejects.toThrow(
				"Cannot cancel a completed pickup",
			);
		});

		it("returns null for non-existent pickup", async () => {
			expect(await controller.cancelPickup("missing")).toBeNull();
		});
	});

	// ── Availability ──────────────────────────────────────────────

	describe("getAvailableWindows", () => {
		it("returns available windows for a date", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id));
			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail.length).toBe(1);
			expect(avail[0].available).toBe(true);
			expect(avail[0].remaining).toBe(5);
			expect(avail[0].booked).toBe(0);
		});

		it("reflects booked count in availability", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await controller.schedulePickup(makePickup(loc.id, win.id));
			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail[0].booked).toBe(1);
			expect(avail[0].remaining).toBe(4);
		});

		it("shows unavailable when window is full", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 1 }),
			);
			await controller.schedulePickup(makePickup(loc.id, win.id));
			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail[0].available).toBe(false);
			expect(avail[0].remaining).toBe(0);
		});

		it("returns empty on blackout date", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id));
			await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail.length).toBe(0);
		});

		it("returns empty for inactive location", async () => {
			const loc = await controller.createLocation(
				makeLocation({ active: false }),
			);
			await controller.createWindow(makeWindow(loc.id));
			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail.length).toBe(0);
		});

		it("excludes inactive windows", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id, { active: false }));
			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail.length).toBe(0);
		});

		it("returns empty for non-matching day of week", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createWindow(makeWindow(loc.id)); // Monday
			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: TUESDAY_DATE,
			});
			expect(avail.length).toBe(0);
		});

		it("returns empty for non-existent location", async () => {
			const avail = await controller.getAvailableWindows({
				locationId: "missing",
				date: MONDAY_DATE,
			});
			expect(avail.length).toBe(0);
		});

		it("rejects invalid date format", async () => {
			await expect(
				controller.getAvailableWindows({
					locationId: "any",
					date: "bad",
				}),
			).rejects.toThrow("Date must be in YYYY-MM-DD format");
		});

		it("does not count cancelled pickups toward capacity", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(
				makeWindow(loc.id, { capacity: 1 }),
			);
			const p = await controller.schedulePickup(makePickup(loc.id, win.id));
			await controller.cancelPickup(p.id);
			const avail = await controller.getAvailableWindows({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(avail[0].available).toBe(true);
			expect(avail[0].remaining).toBe(1);
		});
	});

	describe("getWindowBookingCount", () => {
		it("counts active bookings for a window on a date", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o1" }),
			);
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o2" }),
			);
			const count = await controller.getWindowBookingCount(win.id, MONDAY_DATE);
			expect(count).toBe(2);
		});

		it("excludes cancelled pickups", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const p = await controller.schedulePickup(makePickup(loc.id, win.id));
			await controller.cancelPickup(p.id);
			const count = await controller.getWindowBookingCount(win.id, MONDAY_DATE);
			expect(count).toBe(0);
		});

		it("returns 0 for empty date", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));
			const count = await controller.getWindowBookingCount(win.id, MONDAY_DATE);
			expect(count).toBe(0);
		});
	});

	// ── Blackout dates ────────────────────────────────────────────

	describe("createBlackout", () => {
		it("creates a blackout for a location", async () => {
			const loc = await controller.createLocation(makeLocation());
			const blackout = await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(blackout.id).toBeDefined();
			expect(blackout.locationId).toBe(loc.id);
			expect(blackout.date).toBe(MONDAY_DATE);
		});

		it("creates a blackout with reason", async () => {
			const loc = await controller.createLocation(makeLocation());
			const blackout = await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
				reason: "Holiday closure",
			});
			expect(blackout.reason).toBe("Holiday closure");
		});

		it("rejects duplicate blackout for same location and date", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			await expect(
				controller.createBlackout({
					locationId: loc.id,
					date: MONDAY_DATE,
				}),
			).rejects.toThrow(
				"Blackout already exists for this location on this date",
			);
		});

		it("allows same date for different locations", async () => {
			const loc1 = await controller.createLocation(makeLocation());
			const loc2 = await controller.createLocation(
				makeLocation({ name: "Uptown" }),
			);
			await controller.createBlackout({
				locationId: loc1.id,
				date: MONDAY_DATE,
			});
			const b = await controller.createBlackout({
				locationId: loc2.id,
				date: MONDAY_DATE,
			});
			expect(b.date).toBe(MONDAY_DATE);
		});

		it("rejects non-existent location", async () => {
			await expect(
				controller.createBlackout({
					locationId: "missing",
					date: MONDAY_DATE,
				}),
			).rejects.toThrow("Pickup location not found");
		});

		it("rejects invalid date format", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(
				controller.createBlackout({
					locationId: loc.id,
					date: "bad",
				}),
			).rejects.toThrow("Blackout date must be in YYYY-MM-DD format");
		});
	});

	describe("deleteBlackout", () => {
		it("deletes an existing blackout", async () => {
			const loc = await controller.createLocation(makeLocation());
			const blackout = await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(await controller.deleteBlackout(blackout.id)).toBe(true);
		});

		it("returns false for non-existent blackout", async () => {
			expect(await controller.deleteBlackout("missing")).toBe(false);
		});
	});

	describe("listBlackouts", () => {
		it("lists blackouts for a location", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			await controller.createBlackout({
				locationId: loc.id,
				date: TUESDAY_DATE,
			});
			const list = await controller.listBlackouts(loc.id);
			expect(list.length).toBe(2);
			expect(list[0].date).toBe(MONDAY_DATE);
			expect(list[1].date).toBe(TUESDAY_DATE);
		});

		it("only returns blackouts for the specified location", async () => {
			const loc1 = await controller.createLocation(makeLocation());
			const loc2 = await controller.createLocation(
				makeLocation({ name: "Uptown" }),
			);
			await controller.createBlackout({
				locationId: loc1.id,
				date: MONDAY_DATE,
			});
			await controller.createBlackout({
				locationId: loc2.id,
				date: TUESDAY_DATE,
			});
			const list = await controller.listBlackouts(loc1.id);
			expect(list.length).toBe(1);
		});
	});

	describe("isBlackoutDate", () => {
		it("returns true for a blackout date", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			expect(await controller.isBlackoutDate(loc.id, MONDAY_DATE)).toBe(true);
		});

		it("returns false for a non-blackout date", async () => {
			const loc = await controller.createLocation(makeLocation());
			expect(await controller.isBlackoutDate(loc.id, MONDAY_DATE)).toBe(false);
		});

		it("rejects invalid date format", async () => {
			const loc = await controller.createLocation(makeLocation());
			await expect(controller.isBlackoutDate(loc.id, "nope")).rejects.toThrow(
				"Date must be in YYYY-MM-DD format",
			);
		});
	});

	// ── Analytics ─────────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns zero counts when empty", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalLocations).toBe(0);
			expect(summary.activeLocations).toBe(0);
			expect(summary.totalWindows).toBe(0);
			expect(summary.activeWindows).toBe(0);
			expect(summary.totalPickups).toBe(0);
			expect(summary.scheduledPickups).toBe(0);
			expect(summary.preparingPickups).toBe(0);
			expect(summary.readyPickups).toBe(0);
			expect(summary.completedPickups).toBe(0);
			expect(summary.cancelledPickups).toBe(0);
			expect(summary.blackoutDates).toBe(0);
		});

		it("counts locations and windows correctly", async () => {
			const loc1 = await controller.createLocation(makeLocation());
			await controller.createLocation(
				makeLocation({ name: "B", active: false }),
			);
			await controller.createWindow(makeWindow(loc1.id));
			await controller.createWindow(makeWindow(loc1.id, { active: false }));
			const summary = await controller.getSummary();
			expect(summary.totalLocations).toBe(2);
			expect(summary.activeLocations).toBe(1);
			expect(summary.totalWindows).toBe(2);
			expect(summary.activeWindows).toBe(1);
		});

		it("counts pickup statuses correctly", async () => {
			const loc = await controller.createLocation(makeLocation());
			const win = await controller.createWindow(makeWindow(loc.id));

			// scheduled
			await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o1" }),
			);

			// preparing
			const p2 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o2" }),
			);
			await controller.updatePickupStatus(p2.id, "preparing");

			// ready
			const p3 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o3" }),
			);
			await controller.updatePickupStatus(p3.id, "preparing");
			await controller.updatePickupStatus(p3.id, "ready");

			// picked_up
			const p4 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o4" }),
			);
			await controller.updatePickupStatus(p4.id, "preparing");
			await controller.updatePickupStatus(p4.id, "ready");
			await controller.updatePickupStatus(p4.id, "picked_up");

			// cancelled
			const p5 = await controller.schedulePickup(
				makePickup(loc.id, win.id, { orderId: "o5" }),
			);
			await controller.cancelPickup(p5.id);

			const summary = await controller.getSummary();
			expect(summary.totalPickups).toBe(5);
			expect(summary.scheduledPickups).toBe(1);
			expect(summary.preparingPickups).toBe(1);
			expect(summary.readyPickups).toBe(1);
			expect(summary.completedPickups).toBe(1);
			expect(summary.cancelledPickups).toBe(1);
		});

		it("counts blackout dates", async () => {
			const loc = await controller.createLocation(makeLocation());
			await controller.createBlackout({
				locationId: loc.id,
				date: MONDAY_DATE,
			});
			await controller.createBlackout({
				locationId: loc.id,
				date: TUESDAY_DATE,
			});
			const summary = await controller.getSummary();
			expect(summary.blackoutDates).toBe(2);
		});
	});
});
