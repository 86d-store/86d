export interface AdminKioskStation {
	id: string;
	name: string;
	location?: string | null | undefined;
	isActive: boolean;
	settings: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export const LEGACY_SESSION_STATUSES = [
	"legacy-active",
	"legacy-completed",
	"legacy-abandoned",
	"legacy-timed-out",
] as const;

export type LegacySessionStatus = (typeof LEGACY_SESSION_STATUSES)[number];

export interface AdminKioskSession {
	id: string;
	stationId: string;
	status: LegacySessionStatus;
	startedAt: string;
	completedAt?: string | undefined;
}

export interface AdminKioskStationOption {
	id: string;
	name: string;
	location?: string | null | undefined;
}

export function isLegacySessionStatus(
	value: string,
): value is LegacySessionStatus {
	return LEGACY_SESSION_STATUSES.some((status) => status === value);
}
