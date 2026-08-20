import type { ModuleController } from "@86d-app/core/types/module";

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
	| "preparing"
	| "ready"
	| "picked_up"
	| "cancelled";

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
	preparingAt?: Date;
	readyAt?: Date;
	pickedUpAt?: Date;
	cancelledAt?: Date;
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
	preparingPickups: number;
	readyPickups: number;
	completedPickups: number;
	cancelledPickups: number;
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

	// Availability
	getAvailableWindows(
		params: AvailableWindowsParams,
	): Promise<WindowAvailability[]>;
	getWindowBookingCount(windowId: string, date: string): Promise<number>;

	// Blackout dates
	createBlackout(params: CreateBlackoutParams): Promise<PickupBlackout>;
	deleteBlackout(id: string): Promise<boolean>;
	listBlackouts(locationId: string): Promise<PickupBlackout[]>;
	isBlackoutDate(locationId: string, date: string): Promise<boolean>;

	// Analytics
	getSummary(): Promise<StorePickupSummary>;
};
