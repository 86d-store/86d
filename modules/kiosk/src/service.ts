import type { ModuleController } from "@86d-app/core/types/module";

export type SessionStatus = "active" | "completed" | "abandoned" | "timed-out";
export type PaymentStatus = "pending" | "paid" | "failed";

export type KioskStation = {
	id: string;
	name: string;
	location?: string | null | undefined;
	isOnline: boolean;
	isActive: boolean;
	lastHeartbeat?: Date | undefined;
	currentSessionId?: string | null | undefined;
	settings: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type KioskItem = {
	id: string;
	name: string;
	price: number;
	quantity: number;
	modifiers?: Array<Record<string, unknown>> | undefined;
};

export type KioskSession = {
	id: string;
	stationId: string;
	status: SessionStatus;
	items: KioskItem[];
	subtotal: number;
	tax: number;
	tip: number;
	total: number;
	paymentMethod?: string | undefined;
	paymentStatus: PaymentStatus;
	startedAt: Date;
	completedAt?: Date | undefined;
	createdAt: Date;
};

export type StationStats = {
	totalSessions: number;
	completedSessions: number;
	abandonedSessions: number;
	totalRevenue: number;
};

export type OverallStats = {
	totalStations: number;
	onlineStations: number;
	totalSessions: number;
	completedSessions: number;
	abandonedSessions: number;
	totalRevenue: number;
};

export const KIOSK_STATION_ADMIN_SORT_FIELDS = [
	"name",
	"location",
	"isActive",
] as const;

export type KioskStationAdminSortField =
	(typeof KIOSK_STATION_ADMIN_SORT_FIELDS)[number];

export const KIOSK_SESSION_ADMIN_SORT_FIELDS = [
	"id",
	"stationId",
	"status",
	"startedAt",
] as const;

export type KioskSessionAdminSortField =
	(typeof KIOSK_SESSION_ADMIN_SORT_FIELDS)[number];

export type KioskAdminSortDirection = "asc" | "desc";

export type KioskStationAdminListParams = {
	isActive?: boolean | undefined;
	search?: string | undefined;
	sort?: KioskStationAdminSortField | undefined;
	direction?: KioskAdminSortDirection | undefined;
	take?: number | undefined;
	skip?: number | undefined;
};

export type KioskStationAdminListPage = {
	stations: KioskStation[];
	total: number;
};

export type KioskSessionAdminListParams = {
	stationId?: string | undefined;
	status?: SessionStatus | undefined;
	search?: string | undefined;
	sort?: KioskSessionAdminSortField | undefined;
	direction?: KioskAdminSortDirection | undefined;
	take?: number | undefined;
	skip?: number | undefined;
};

export type KioskSessionAdminListPage = {
	sessions: KioskSession[];
	total: number;
};

export type KioskController = ModuleController & {
	registerStation(params: {
		name: string;
		location?: string | undefined;
		settings?: Record<string, unknown> | undefined;
	}): Promise<KioskStation>;

	updateStation(
		id: string,
		params: {
			name?: string | undefined;
			location?: string | null | undefined;
			isActive?: boolean | undefined;
			settings?: Record<string, unknown> | undefined;
		},
	): Promise<KioskStation | null>;

	listStations(params?: {
		isActive?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<KioskStation[]>;

	/** Query one admin page after applying filters and ordering to all records. */
	listStationAdminPage(
		params?: KioskStationAdminListParams,
	): Promise<KioskStationAdminListPage>;

	getStation(id: string): Promise<KioskStation | null>;

	listSessions(params?: {
		stationId?: string | undefined;
		status?: SessionStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<KioskSession[]>;

	/** Query one admin page after applying filters and ordering to all records. */
	listSessionAdminPage(
		params?: KioskSessionAdminListParams,
	): Promise<KioskSessionAdminListPage>;

	getStationStats(stationId: string): Promise<StationStats>;

	getOverallStats(): Promise<OverallStats>;
};
