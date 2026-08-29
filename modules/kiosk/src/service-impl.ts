import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { kioskKioskSessionShape, kioskKioskStationShape } from "./schema";
import type {
	KioskController,
	KioskSession,
	KioskStation,
	OverallStats,
	StationStats,
} from "./service";

export class KioskMutationUnavailableError extends Error {
	constructor() {
		super("Kiosk state is unavailable.");
		this.name = "KioskMutationUnavailableError";
	}
}

function parseKioskSession(
	value: Record<string, unknown> | null,
): KioskSession | null {
	if (!value) return null;
	const parsed = kioskKioskSessionShape.safeParse(value);
	if (!parsed.success) throw new KioskMutationUnavailableError();
	return parsed.data;
}

function parseKioskStation(
	value: Record<string, unknown> | null,
): KioskStation | null {
	if (!value) return null;
	const parsed = kioskKioskStationShape.safeParse(value);
	if (!parsed.success) throw new KioskMutationUnavailableError();
	return parsed.data;
}

function parseKioskSessions(
	values: readonly Record<string, unknown>[],
): KioskSession[] {
	const sessions: KioskSession[] = [];
	for (const value of values) {
		const session = parseKioskSession(value);
		if (session) sessions.push(session);
	}
	return sessions;
}

function parseKioskStations(
	values: readonly Record<string, unknown>[],
): KioskStation[] {
	const stations: KioskStation[] = [];
	for (const value of values) {
		const station = parseKioskStation(value);
		if (station) stations.push(station);
	}
	return stations;
}

function stationRecord(station: KioskStation): Record<string, unknown> {
	return { ...station };
}

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

export function createKioskController(
	data: ModuleDataService,
	transactions?: ModuleTransactionRunner | undefined,
): KioskController {
	async function withLockingTransaction<T>(
		work: (transaction: LockingModuleDataTransaction) => Promise<T>,
	): Promise<T> {
		if (!transactions) throw new KioskMutationUnavailableError();
		return transactions.transaction((transaction) => {
			if (!isLockingTransaction(transaction)) {
				throw new KioskMutationUnavailableError();
			}
			return work(transaction);
		});
	}

	return {
		async registerStation(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const station: KioskStation = {
				id,
				name: params.name,
				location: params.location,
				isOnline: false,
				isActive: true,
				settings: params.settings ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("kioskStation", id, stationRecord(station));
			return station;
		},

		async updateStation(id, params) {
			return withLockingTransaction(async (transaction) => {
				const station = parseKioskStation(
					await transaction.getForUpdate("kioskStation", id),
				);
				if (!station) return null;

				const updated: KioskStation = {
					...station,
					...(params.name !== undefined ? { name: params.name } : {}),
					...(params.location !== undefined
						? { location: params.location }
						: {}),
					...(params.isActive !== undefined
						? { isActive: params.isActive }
						: {}),
					...(params.settings !== undefined
						? { settings: params.settings }
						: {}),
					updatedAt: new Date(),
				};
				await transaction.upsert("kioskStation", id, stationRecord(updated));
				return updated;
			});
		},

		async listStations(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const all = await data.findMany("kioskStation", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return parseKioskStations(all);
		},

		async getStation(id) {
			return parseKioskStation(await data.get("kioskStation", id));
		},

		async listSessions(params) {
			const where: Record<string, unknown> = {};
			if (params?.stationId) where.stationId = params.stationId;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("kioskSession", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return parseKioskSessions(all);
		},

		async getStationStats(stationId) {
			const sessions = await data.findMany("kioskSession", {
				where: { stationId },
			});
			const all = parseKioskSessions(sessions);

			const stats: StationStats = {
				totalSessions: all.length,
				completedSessions: 0,
				abandonedSessions: 0,
				totalRevenue: 0,
			};

			for (const s of all) {
				if (s.status === "abandoned" || s.status === "timed-out") {
					stats.abandonedSessions++;
				}
			}

			return stats;
		},

		async getOverallStats() {
			const allStations = await data.findMany("kioskStation", {});
			const stations = parseKioskStations(allStations);

			const allSessions = await data.findMany("kioskSession", {});
			const sessions = parseKioskSessions(allSessions);

			const stats: OverallStats = {
				totalStations: stations.length,
				onlineStations: 0,
				totalSessions: sessions.length,
				completedSessions: 0,
				abandonedSessions: 0,
				totalRevenue: 0,
			};

			for (const s of sessions) {
				if (s.status === "abandoned" || s.status === "timed-out") {
					stats.abandonedSessions++;
				}
			}

			return stats;
		},
	};
}
