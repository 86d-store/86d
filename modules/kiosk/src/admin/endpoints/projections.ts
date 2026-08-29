import type { KioskSession, KioskStation, SessionStatus } from "../../service";

export type AdminKioskStation = Pick<
	KioskStation,
	| "id"
	| "name"
	| "location"
	| "isActive"
	| "settings"
	| "createdAt"
	| "updatedAt"
>;

export type AdminKioskSession = Pick<
	KioskSession,
	"id" | "stationId" | "startedAt" | "completedAt"
> & {
	status: `legacy-${SessionStatus}`;
};

export type AdminKioskStationOption = Pick<
	KioskStation,
	"id" | "name" | "location"
>;

export function projectAdminStation(station: KioskStation): AdminKioskStation {
	return {
		id: station.id,
		name: station.name,
		location: station.location,
		isActive: station.isActive,
		settings: station.settings,
		createdAt: station.createdAt,
		updatedAt: station.updatedAt,
	};
}

export function projectAdminSession(session: KioskSession): AdminKioskSession {
	return {
		id: session.id,
		stationId: session.stationId,
		status: `legacy-${session.status}`,
		startedAt: session.startedAt,
		completedAt: session.completedAt,
	};
}

export function projectAdminStationOption(
	station: KioskStation,
): AdminKioskStationOption {
	return {
		id: station.id,
		name: station.name,
		location: station.location,
	};
}
