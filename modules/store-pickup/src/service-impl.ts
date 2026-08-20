import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	AvailableWindowsParams,
	CreateBlackoutParams,
	CreateLocationParams,
	CreateWindowParams,
	ListLocationsParams,
	ListPickupsParams,
	ListWindowsParams,
	PickupBlackout,
	PickupLocation,
	PickupOrder,
	PickupOrderStatus,
	PickupWindow,
	SchedulePickupParams,
	StorePickupController,
	StorePickupSummary,
	UpdateLocationParams,
	UpdateWindowParams,
	WindowAvailability,
} from "./service";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateTime(value: string, label: string): void {
	if (!TIME_RE.test(value)) {
		throw new Error(`${label} must be in HH:MM 24-hour format`);
	}
}

function validateDate(value: string, label: string): void {
	if (!DATE_RE.test(value)) {
		throw new Error(`${label} must be in YYYY-MM-DD format`);
	}
}

function validateDayOfWeek(day: number): void {
	if (!Number.isInteger(day) || day < 0 || day > 6) {
		throw new Error(
			"Day of week must be an integer from 0 (Sunday) to 6 (Saturday)",
		);
	}
}

function getDayOfWeek(dateStr: string): number {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day).getDay();
}

/** Valid status transitions for pickup orders */
const STATUS_TRANSITIONS: Record<PickupOrderStatus, PickupOrderStatus[]> = {
	scheduled: ["preparing", "cancelled"],
	preparing: ["ready", "cancelled"],
	ready: ["picked_up", "cancelled"],
	picked_up: [],
	cancelled: [],
};

export function createStorePickupController(
	data: ModuleDataService,
): StorePickupController {
	async function getLocationRecord(id: string): Promise<PickupLocation | null> {
		const raw = await data.get("pickupLocation", id);
		return raw ? (raw as unknown as PickupLocation) : null;
	}

	async function getWindowRecord(id: string): Promise<PickupWindow | null> {
		const raw = await data.get("pickupWindow", id);
		return raw ? (raw as unknown as PickupWindow) : null;
	}

	async function getPickupRecord(id: string): Promise<PickupOrder | null> {
		const raw = await data.get("pickupOrder", id);
		return raw ? (raw as unknown as PickupOrder) : null;
	}

	return {
		// ── Location CRUD ────────────────────────────────────────────

		async createLocation(
			params: CreateLocationParams,
		): Promise<PickupLocation> {
			if (!params.name.trim()) {
				throw new Error("Location name is required");
			}
			if (!params.address.trim()) {
				throw new Error("Address is required");
			}
			if (!params.city.trim()) {
				throw new Error("City is required");
			}
			if (!params.state.trim()) {
				throw new Error("State is required");
			}
			if (!params.postalCode.trim()) {
				throw new Error("Postal code is required");
			}
			if (!params.country.trim()) {
				throw new Error("Country is required");
			}
			if (
				params.preparationMinutes !== undefined &&
				(params.preparationMinutes < 0 ||
					!Number.isInteger(params.preparationMinutes))
			) {
				throw new Error("Preparation minutes must be a non-negative integer");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const location: PickupLocation = {
				id,
				name: params.name.trim(),
				address: params.address.trim(),
				city: params.city.trim(),
				state: params.state.trim(),
				postalCode: params.postalCode.trim(),
				country: params.country.trim(),
				preparationMinutes: params.preparationMinutes ?? 60,
				active: params.active ?? true,
				sortOrder: params.sortOrder ?? 0,
				createdAt: now,
				updatedAt: now,
				...(params.phone != null && { phone: params.phone }),
				...(params.email != null && { email: params.email }),
				...(params.latitude != null && { latitude: params.latitude }),
				...(params.longitude != null && { longitude: params.longitude }),
			};

			await data.upsert(
				"pickupLocation",
				id,
				location as unknown as Record<string, unknown>,
			);
			return location;
		},

		async updateLocation(
			id: string,
			params: UpdateLocationParams,
		): Promise<PickupLocation | null> {
			const existing = await getLocationRecord(id);
			if (!existing) return null;

			if (params.name !== undefined && !params.name.trim()) {
				throw new Error("Location name cannot be empty");
			}
			if (params.address !== undefined && !params.address.trim()) {
				throw new Error("Address cannot be empty");
			}
			if (params.city !== undefined && !params.city.trim()) {
				throw new Error("City cannot be empty");
			}
			if (params.state !== undefined && !params.state.trim()) {
				throw new Error("State cannot be empty");
			}
			if (params.postalCode !== undefined && !params.postalCode.trim()) {
				throw new Error("Postal code cannot be empty");
			}
			if (params.country !== undefined && !params.country.trim()) {
				throw new Error("Country cannot be empty");
			}
			if (
				params.preparationMinutes !== undefined &&
				(params.preparationMinutes < 0 ||
					!Number.isInteger(params.preparationMinutes))
			) {
				throw new Error("Preparation minutes must be a non-negative integer");
			}

			const updates: Record<string, unknown> = {};
			if (params.name !== undefined) updates.name = params.name.trim();
			if (params.address !== undefined) updates.address = params.address.trim();
			if (params.city !== undefined) updates.city = params.city.trim();
			if (params.state !== undefined) updates.state = params.state.trim();
			if (params.postalCode !== undefined)
				updates.postalCode = params.postalCode.trim();
			if (params.country !== undefined) updates.country = params.country.trim();
			if (params.phone !== undefined) updates.phone = params.phone;
			if (params.email !== undefined) updates.email = params.email;
			if (params.latitude !== undefined) updates.latitude = params.latitude;
			if (params.longitude !== undefined) updates.longitude = params.longitude;
			if (params.preparationMinutes !== undefined)
				updates.preparationMinutes = params.preparationMinutes;
			if (params.active !== undefined) updates.active = params.active;
			if (params.sortOrder !== undefined) updates.sortOrder = params.sortOrder;

			const updated = {
				...(existing as unknown as Record<string, unknown>),
				...updates,
				updatedAt: new Date(),
			};
			await data.upsert("pickupLocation", id, updated);
			return updated as unknown as PickupLocation;
		},

		async getLocation(id: string): Promise<PickupLocation | null> {
			return getLocationRecord(id);
		},

		async listLocations(
			params?: ListLocationsParams,
		): Promise<PickupLocation[]> {
			const where: Record<string, unknown> = {};
			if (params?.active !== undefined) where.active = params.active;

			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where,
				orderBy: { sortOrder: "asc" },
			};
			if (params?.take != null) query.take = params.take;
			if (params?.skip != null) query.skip = params.skip;

			const raw = await data.findMany("pickupLocation", query);
			return raw as unknown as PickupLocation[];
		},

		async deleteLocation(id: string): Promise<boolean> {
			const existing = await data.get("pickupLocation", id);
			if (!existing) return false;
			await data.delete("pickupLocation", id);
			return true;
		},

		// ── Window CRUD ──────────────────────────────────────────────

		async createWindow(params: CreateWindowParams): Promise<PickupWindow> {
			const location = await getLocationRecord(params.locationId);
			if (!location) {
				throw new Error("Pickup location not found");
			}

			validateDayOfWeek(params.dayOfWeek);
			validateTime(params.startTime, "Start time");
			validateTime(params.endTime, "End time");
			if (params.startTime >= params.endTime) {
				throw new Error("Start time must be before end time");
			}
			if (!Number.isInteger(params.capacity) || params.capacity < 1) {
				throw new Error("Capacity must be a positive integer");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const window: PickupWindow = {
				id,
				locationId: params.locationId,
				dayOfWeek: params.dayOfWeek,
				startTime: params.startTime,
				endTime: params.endTime,
				capacity: params.capacity,
				active: params.active ?? true,
				sortOrder: params.sortOrder ?? 0,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"pickupWindow",
				id,
				window as unknown as Record<string, unknown>,
			);
			return window;
		},

		async updateWindow(
			id: string,
			params: UpdateWindowParams,
		): Promise<PickupWindow | null> {
			const existing = await getWindowRecord(id);
			if (!existing) return null;

			if (params.dayOfWeek !== undefined) {
				validateDayOfWeek(params.dayOfWeek);
			}
			if (params.startTime !== undefined) {
				validateTime(params.startTime, "Start time");
			}
			if (params.endTime !== undefined) {
				validateTime(params.endTime, "End time");
			}

			const newStart = params.startTime ?? existing.startTime;
			const newEnd = params.endTime ?? existing.endTime;
			if (newStart >= newEnd) {
				throw new Error("Start time must be before end time");
			}

			if (
				params.capacity !== undefined &&
				(!Number.isInteger(params.capacity) || params.capacity < 1)
			) {
				throw new Error("Capacity must be a positive integer");
			}

			const updates: Record<string, unknown> = {};
			if (params.dayOfWeek !== undefined) updates.dayOfWeek = params.dayOfWeek;
			if (params.startTime !== undefined) updates.startTime = params.startTime;
			if (params.endTime !== undefined) updates.endTime = params.endTime;
			if (params.capacity !== undefined) updates.capacity = params.capacity;
			if (params.active !== undefined) updates.active = params.active;
			if (params.sortOrder !== undefined) updates.sortOrder = params.sortOrder;

			const updated = {
				...(existing as unknown as Record<string, unknown>),
				...updates,
				updatedAt: new Date(),
			};
			await data.upsert("pickupWindow", id, updated);
			return updated as unknown as PickupWindow;
		},

		async getWindow(id: string): Promise<PickupWindow | null> {
			return getWindowRecord(id);
		},

		async listWindows(params: ListWindowsParams): Promise<PickupWindow[]> {
			const where: Record<string, unknown> = {
				locationId: params.locationId,
			};
			if (params.dayOfWeek !== undefined) where.dayOfWeek = params.dayOfWeek;
			if (params.active !== undefined) where.active = params.active;

			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where,
				orderBy: { sortOrder: "asc" },
			};
			if (params.take != null) query.take = params.take;
			if (params.skip != null) query.skip = params.skip;

			const raw = await data.findMany("pickupWindow", query);
			return raw as unknown as PickupWindow[];
		},

		async deleteWindow(id: string): Promise<boolean> {
			const existing = await data.get("pickupWindow", id);
			if (!existing) return false;
			await data.delete("pickupWindow", id);
			return true;
		},

		// ── Pickup scheduling ────────────────────────────────────────

		async schedulePickup(params: SchedulePickupParams): Promise<PickupOrder> {
			if (!params.orderId) {
				throw new Error("Order ID is required");
			}
			validateDate(params.scheduledDate, "Scheduled date");

			const location = await getLocationRecord(params.locationId);
			if (!location) {
				throw new Error("Pickup location not found");
			}
			if (!location.active) {
				throw new Error("Pickup location is not available");
			}

			const window = await getWindowRecord(params.windowId);
			if (!window) {
				throw new Error("Pickup window not found");
			}
			if (!window.active) {
				throw new Error("Pickup window is not available");
			}
			if (window.locationId !== params.locationId) {
				throw new Error("Window does not belong to the specified location");
			}

			// Verify the date matches the window's day of week
			const dow = getDayOfWeek(params.scheduledDate);
			if (dow !== window.dayOfWeek) {
				throw new Error(
					"Scheduled date does not match the window's day of week",
				);
			}

			// Check for blackout
			const blackouts = await data.findMany("pickupBlackout", {
				where: { locationId: params.locationId, date: params.scheduledDate },
			});
			if (blackouts.length > 0) {
				throw new Error(
					"Pickup is not available at this location on this date",
				);
			}

			// Check for duplicate pickup on the same order
			const existingOrderPickups = await data.findMany("pickupOrder", {
				where: { orderId: params.orderId },
			});
			const activePickup = (
				existingOrderPickups as unknown as PickupOrder[]
			).find((p) => p.status !== "cancelled" && p.status !== "picked_up");
			if (activePickup) {
				throw new Error("Order already has an active pickup scheduled");
			}

			// Check capacity
			const dateBookings = await data.findMany("pickupOrder", {
				where: {
					windowId: params.windowId,
					scheduledDate: params.scheduledDate,
				},
			});
			const activeCount = (dateBookings as unknown as PickupOrder[]).filter(
				(p) => p.status !== "cancelled",
			).length;
			if (activeCount >= window.capacity) {
				throw new Error("Pickup window is fully booked");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const pickup: PickupOrder = {
				id,
				locationId: params.locationId,
				windowId: params.windowId,
				orderId: params.orderId,
				scheduledDate: params.scheduledDate,
				locationName: location.name,
				locationAddress: `${location.address}, ${location.city}, ${location.state} ${location.postalCode}`,
				startTime: window.startTime,
				endTime: window.endTime,
				status: "scheduled",
				createdAt: now,
				updatedAt: now,
				...(params.customerId != null && {
					customerId: params.customerId,
				}),
				...(params.notes != null && { notes: params.notes }),
			};

			await data.upsert(
				"pickupOrder",
				id,
				pickup as unknown as Record<string, unknown>,
			);
			return pickup;
		},

		async getPickup(id: string): Promise<PickupOrder | null> {
			return getPickupRecord(id);
		},

		async getOrderPickup(orderId: string): Promise<PickupOrder | null> {
			const raw = await data.findMany("pickupOrder", {
				where: { orderId },
			});
			const pickups = raw as unknown as PickupOrder[];
			return (
				pickups.find(
					(p) => p.status !== "cancelled" && p.status !== "picked_up",
				) ?? null
			);
		},

		async listPickups(params?: ListPickupsParams): Promise<PickupOrder[]> {
			const where: Record<string, unknown> = {};
			if (params?.locationId !== undefined)
				where.locationId = params.locationId;
			if (params?.orderId !== undefined) where.orderId = params.orderId;
			if (params?.customerId !== undefined)
				where.customerId = params.customerId;
			if (params?.scheduledDate !== undefined)
				where.scheduledDate = params.scheduledDate;
			if (params?.status !== undefined) where.status = params.status;

			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where,
				orderBy: { createdAt: "desc" },
			};
			if (params?.take != null) query.take = params.take;
			if (params?.skip != null) query.skip = params.skip;

			const raw = await data.findMany("pickupOrder", query);
			return raw as unknown as PickupOrder[];
		},

		async updatePickupStatus(
			id: string,
			status: PickupOrderStatus,
		): Promise<PickupOrder | null> {
			const existing = await getPickupRecord(id);
			if (!existing) return null;

			const allowed = STATUS_TRANSITIONS[existing.status];
			if (!allowed.includes(status)) {
				throw new Error(
					`Cannot transition from "${existing.status}" to "${status}"`,
				);
			}

			const now = new Date();
			const updates: Record<string, unknown> = {
				status,
				updatedAt: now,
			};

			if (status === "preparing") updates.preparingAt = now;
			if (status === "ready") updates.readyAt = now;
			if (status === "picked_up") updates.pickedUpAt = now;
			if (status === "cancelled") updates.cancelledAt = now;

			const updated = {
				...(existing as unknown as Record<string, unknown>),
				...updates,
			};
			await data.upsert("pickupOrder", id, updated);
			return updated as unknown as PickupOrder;
		},

		async cancelPickup(id: string): Promise<PickupOrder | null> {
			const existing = await getPickupRecord(id);
			if (!existing) return null;

			if (existing.status === "cancelled") {
				throw new Error("Pickup is already cancelled");
			}
			if (existing.status === "picked_up") {
				throw new Error("Cannot cancel a completed pickup");
			}

			const now = new Date();
			const updated = {
				...(existing as unknown as Record<string, unknown>),
				status: "cancelled",
				cancelledAt: now,
				updatedAt: now,
			};
			await data.upsert("pickupOrder", id, updated);
			return updated as unknown as PickupOrder;
		},

		// ── Availability ──────────────────────────────────────────────

		async getAvailableWindows(
			params: AvailableWindowsParams,
		): Promise<WindowAvailability[]> {
			validateDate(params.date, "Date");

			const location = await getLocationRecord(params.locationId);
			if (!location) return [];
			if (!location.active) return [];

			// Check blackout
			const blackouts = await data.findMany("pickupBlackout", {
				where: { locationId: params.locationId, date: params.date },
			});
			if (blackouts.length > 0) return [];

			const dow = getDayOfWeek(params.date);

			const windows = (await data.findMany("pickupWindow", {
				where: {
					locationId: params.locationId,
					dayOfWeek: dow,
					active: true,
				},
				orderBy: { sortOrder: "asc" },
			})) as unknown as PickupWindow[];

			const results: WindowAvailability[] = [];
			for (const window of windows) {
				const bookings = await data.findMany("pickupOrder", {
					where: {
						windowId: window.id,
						scheduledDate: params.date,
					},
				});
				const activeCount = (bookings as unknown as PickupOrder[]).filter(
					(p) => p.status !== "cancelled",
				).length;
				const remaining = window.capacity - activeCount;

				results.push({
					window,
					date: params.date,
					booked: activeCount,
					remaining,
					available: remaining > 0,
				});
			}

			return results;
		},

		async getWindowBookingCount(
			windowId: string,
			date: string,
		): Promise<number> {
			validateDate(date, "Date");
			const bookings = await data.findMany("pickupOrder", {
				where: { windowId, scheduledDate: date },
			});
			return (bookings as unknown as PickupOrder[]).filter(
				(p) => p.status !== "cancelled",
			).length;
		},

		// ── Blackout dates ────────────────────────────────────────────

		async createBlackout(
			params: CreateBlackoutParams,
		): Promise<PickupBlackout> {
			validateDate(params.date, "Blackout date");

			const location = await getLocationRecord(params.locationId);
			if (!location) {
				throw new Error("Pickup location not found");
			}

			// Prevent duplicate blackout for the same location + date
			const existing = await data.findMany("pickupBlackout", {
				where: { locationId: params.locationId, date: params.date },
			});
			if (existing.length > 0) {
				throw new Error(
					"Blackout already exists for this location on this date",
				);
			}

			const id = crypto.randomUUID();

			const blackout: PickupBlackout = {
				id,
				locationId: params.locationId,
				date: params.date,
				createdAt: new Date(),
				...(params.reason != null && { reason: params.reason }),
			};

			await data.upsert(
				"pickupBlackout",
				id,
				blackout as unknown as Record<string, unknown>,
			);
			return blackout;
		},

		async deleteBlackout(id: string): Promise<boolean> {
			const existing = await data.get("pickupBlackout", id);
			if (!existing) return false;
			await data.delete("pickupBlackout", id);
			return true;
		},

		async listBlackouts(locationId: string): Promise<PickupBlackout[]> {
			const raw = await data.findMany("pickupBlackout", {
				where: { locationId },
				orderBy: { date: "asc" },
			});
			return raw as unknown as PickupBlackout[];
		},

		async isBlackoutDate(locationId: string, date: string): Promise<boolean> {
			validateDate(date, "Date");
			const raw = await data.findMany("pickupBlackout", {
				where: { locationId, date },
			});
			return raw.length > 0;
		},

		// ── Analytics ─────────────────────────────────────────────────

		async getSummary(): Promise<StorePickupSummary> {
			const allLocations = (await data.findMany("pickupLocation", {
				where: {},
			})) as unknown as PickupLocation[];
			const allWindows = (await data.findMany("pickupWindow", {
				where: {},
			})) as unknown as PickupWindow[];
			const allPickups = (await data.findMany("pickupOrder", {
				where: {},
			})) as unknown as PickupOrder[];
			const allBlackouts = await data.findMany("pickupBlackout", {
				where: {},
			});

			return {
				totalLocations: allLocations.length,
				activeLocations: allLocations.filter((l) => l.active).length,
				totalWindows: allWindows.length,
				activeWindows: allWindows.filter((w) => w.active).length,
				totalPickups: allPickups.length,
				scheduledPickups: allPickups.filter((p) => p.status === "scheduled")
					.length,
				preparingPickups: allPickups.filter((p) => p.status === "preparing")
					.length,
				readyPickups: allPickups.filter((p) => p.status === "ready").length,
				completedPickups: allPickups.filter((p) => p.status === "picked_up")
					.length,
				cancelledPickups: allPickups.filter((p) => p.status === "cancelled")
					.length,
				blackoutDates: allBlackouts.length,
			};
		},
	};
}
