import type { ModuleController } from "@86d-store/core/types/module";

// ── Entities ───────────────────────────────────────────────────────

export type PickupLocation = {
	id: string;
	name: string;
	address: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string;
	email?: string;
	latitude?: number;
	longitude?: number;
	preparationMinutes: number;
	active: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
};

export type PickupWindow = {
	id: string;
	locationId: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	capacity: number;
	active: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
};

export type PickupOrderStatus =
	| "scheduled"
	| "started"
	| "preparing"
	| "ready"
	| "picked_up"
	| "cancelled"
	| "no_show";

export type PickupOrder = {
	id: string;
	locationId: string;
	windowId: string;
	orderId: string;
	customerId?: string;
	scheduledDate: string;
	locationName: string;
	locationAddress: string;
	startTime: string;
	endTime: string;
	status: PickupOrderStatus;
	notes?: string;
	startedAt?: Date;
	preparingAt?: Date;
	readyAt?: Date;
	pickedUpAt?: Date;
	cancelledAt?: Date;
	noShowAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type PickupBlackout = {
	id: string;
	locationId: string;
	date: string;
	reason?: string;
	createdAt: Date;
};

// ── Input params ───────────────────────────────────────────────────

export type CreateLocationParams = {
	name: string;
	address: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string;
	email?: string;
	latitude?: number;
	longitude?: number;
	preparationMinutes?: number;
	active?: boolean;
	sortOrder?: number;
};

export type UpdateLocationParams = {
	name?: string;
	address?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
	phone?: string;
	email?: string;
	latitude?: number;
	longitude?: number;
	preparationMinutes?: number;
	active?: boolean;
	sortOrder?: number;
};

export type ListLocationsParams = {
	active?: boolean;
	take?: number;
	skip?: number;
};

export type CreateWindowParams = {
	locationId: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	capacity: number;
	active?: boolean;
	sortOrder?: number;
};

export type UpdateWindowParams = {
	dayOfWeek?: number;
	startTime?: string;
	endTime?: string;
	capacity?: number;
	active?: boolean;
	sortOrder?: number;
};

export type ListWindowsParams = {
	locationId: string;
	dayOfWeek?: number;
	active?: boolean;
	take?: number;
	skip?: number;
};

export type SchedulePickupParams = {
	locationId: string;
	windowId: string;
	orderId: string;
	scheduledDate: string;
	customerId?: string;
	notes?: string;
};

export type ListPickupsParams = {
	locationId?: string;
	orderId?: string;
	customerId?: string;
	scheduledDate?: string;
	status?: PickupOrderStatus;
	take?: number;
	skip?: number;
};

export type CreateBlackoutParams = {
	locationId: string;
	date: string;
	reason?: string;
};

export type AvailableWindowsParams = {
	locationId: string;
	date: string;
};

// ── Results ────────────────────────────────────────────────────────

export type WindowAvailability = {
	window: PickupWindow;
	date: string;
	booked: number;
	remaining: number;
	available: boolean;
};

export type StorePickupSummary = {
	totalLocations: number;
	activeLocations: number;
	totalWindows: number;
	activeWindows: number;
	totalPickups: number;
	scheduledPickups: number;
	startedPickups: number;
	preparingPickups: number;
	readyPickups: number;
	completedPickups: number;
	cancelledPickups: number;
	noShowPickups: number;
	blackoutDates: number;
};

// ── Controller ─────────────────────────────────────────────────────

export type StorePickupController = ModuleController & {
	// Location CRUD
	createLocation(params: CreateLocationParams): Promise<PickupLocation>;
	updateLocation(
		id: string,
		params: UpdateLocationParams,
	): Promise<PickupLocation | null>;
	getLocation(id: string): Promise<PickupLocation | null>;
	listLocations(params?: ListLocationsParams): Promise<PickupLocation[]>;
	deleteLocation(id: string): Promise<boolean>;

	// Window CRUD
	createWindow(params: CreateWindowParams): Promise<PickupWindow>;
	updateWindow(
		id: string,
		params: UpdateWindowParams,
	): Promise<PickupWindow | null>;
	getWindow(id: string): Promise<PickupWindow | null>;
	listWindows(params: ListWindowsParams): Promise<PickupWindow[]>;
	deleteWindow(id: string): Promise<boolean>;

	// Pickup scheduling
	schedulePickup(params: SchedulePickupParams): Promise<PickupOrder>;
	getPickup(id: string): Promise<PickupOrder | null>;
	getOrderPickup(orderId: string): Promise<PickupOrder | null>;
	listPickups(params?: ListPickupsParams): Promise<PickupOrder[]>;
	updatePickupStatus(
		id: string,
		status: PickupOrderStatus,
	): Promise<PickupOrder | null>;
	cancelPickup(id: string): Promise<PickupOrder | null>;
	customerCancelPickup(id: string): Promise<PickupOrder | null>;

	// Availability
	getAvailableWindows(
		params: AvailableWindowsParams,
	): Promise<WindowAvailability[]>;
	/**
	 * Get available pickup windows for a date with timezone-aware slot filtering.
	 * @param params Location and date parameters
	 * @param timezone IANA timezone for filtering past slots
	 */
	getAvailableWindowsWithTimezone(
		params: AvailableWindowsParams,
		timezone: string,
	): Promise<WindowAvailability[]>;
	getWindowBookingCount(windowId: string, date: string): Promise<number>;

	// Blackout dates
	createBlackout(params: CreateBlackoutParams): Promise<PickupBlackout>;
	deleteBlackout(id: string): Promise<boolean>;
	listBlackouts(locationId: string): Promise<PickupBlackout[]>;
	isBlackoutDate(locationId: string, date: string): Promise<boolean>;

	// Analytics
	getSummary(): Promise<StorePickupSummary>;

	/**
	 * Mark pickup orders as no-show if they have passed the no-show window.
	 * @param noShowWindowMinutes Minutes after ready/slot time to mark as no-show
	 * @param timezone IANA timezone for date calculations
	 * @returns Number of pickups marked as no-show
	 */
	processNoShows(
		noShowWindowMinutes: number,
		timezone: string,
	): Promise<{ processed: number; pickupIds: string[] }>;

	/**
	 * Customer-initiated pickup cancellation with configurable lock state.
	 * @param id Pickup order ID
	 * @param cancelLockState Which status blocks customer cancel (default: 'started')
	 * @param cancelBlockedMessage Custom message when cancel is blocked
	 * @returns Cancelled pickup or null if not found
	 * @throws If cancellation is blocked by the lock state
	 */
	customerCancelPickupWithPolicy(
		id: string,
		cancelLockState: "started" | "preparing" | "ready" | "none",
		cancelBlockedMessage?: string,
	): Promise<PickupOrder | null>;

	/**
	 * Schedule a pickup with timezone validation.
	 * @param params Schedule pickup parameters
	 * @param timezone IANA timezone for slot validation
	 * @returns Scheduled pickup order
	 * @throws If timezone is not provided or slot has passed
	 */
	schedulePickupWithTimezone(
		params: SchedulePickupParams,
		timezone: string,
	): Promise<PickupOrder>;
};
