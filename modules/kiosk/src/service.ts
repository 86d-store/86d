import type { ModuleController } from "@86d-app/core/types/module";

export type SessionStatus = "active" | "completed" | "abandoned" | "timed-out";
export type PaymentStatus = "pending" | "paid" | "failed";

export type KioskStation = {
	id: string;
	name: string;
	location?: string | undefined;
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
			location?: string | undefined;
			isActive?: boolean | undefined;
			settings?: Record<string, unknown> | undefined;
		},
	): Promise<KioskStation | null>;

	listStations(params?: {
		isActive?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<KioskStation[]>;

	getStation(id: string): Promise<KioskStation | null>;

	listSessions(params?: {
		stationId?: string | undefined;
		status?: SessionStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<KioskSession[]>;

	getStationStats(stationId: string): Promise<StationStats>;

	getOverallStats(): Promise<OverallStats>;
};
