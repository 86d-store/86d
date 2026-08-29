import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { kioskKioskSessionShape, kioskKioskStationShape } from "./schema";
import type {
	KioskAdminSortDirection,
	KioskController,
	KioskSession,
	KioskSessionAdminListParams,
	KioskSessionAdminSortField,
	KioskStation,
	KioskStationAdminListParams,
	KioskStationAdminSortField,
	OverallStats,
	StationStats,
} from "./service";

const READ_BATCH_SIZE = 1_000;

const kioskAdminDateFormatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "UTC",
});

const kioskAdminTextCollator = new Intl.Collator("en-US", {
	numeric: true,
	sensitivity: "base",
});

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

async function findAllRows(
	data: ModuleDataService,
	entityType: "kioskStation" | "kioskSession",
	where?: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>[]> {
	const rows: Record<string, unknown>[] = [];
	let skip = 0;
	let batch: Record<string, unknown>[];

	do {
		batch = await data.findMany(entityType, {
			...(where && Object.keys(where).length > 0 ? { where } : {}),
			orderBy: { id: "asc" },
			take: READ_BATCH_SIZE,
			skip,
		});
		rows.push(...batch);
		skip += batch.length;
	} while (batch.length === READ_BATCH_SIZE);

	return rows;
}

async function findAllStations(
	data: ModuleDataService,
	where?: Record<string, unknown> | undefined,
): Promise<KioskStation[]> {
	return parseKioskStations(await findAllRows(data, "kioskStation", where));
}

async function findAllSessions(
	data: ModuleDataService,
	where?: Record<string, unknown> | undefined,
): Promise<KioskSession[]> {
	return parseKioskSessions(await findAllRows(data, "kioskSession", where));
}

function matchesSearch(
	values: Array<string | null | undefined>,
	search: string,
) {
	const query = search.trim().toLocaleLowerCase("en-US");
	if (!query) return true;
	return values.some((value) =>
		value?.toLocaleLowerCase("en-US").includes(query),
	);
}

function matchesStationAdminSearch(station: KioskStation, search: string) {
	return matchesSearch([station.name, station.location], search);
}

function matchesSessionAdminSearch(session: KioskSession, search: string) {
	return matchesSearch(
		[
			session.id,
			session.stationId,
			`legacy-${session.status}`,
			`legacy ${session.status.replaceAll("-", " ")}`,
			session.startedAt.toISOString(),
			kioskAdminDateFormatter.format(session.startedAt),
		],
		search,
	);
}

function compareStationAdminField(
	left: KioskStation,
	right: KioskStation,
	sort: KioskStationAdminSortField,
) {
	if (sort === "isActive") {
		return Number(left.isActive) - Number(right.isActive);
	}
	return kioskAdminTextCollator.compare(left[sort] ?? "", right[sort] ?? "");
}

function compareSessionAdminField(
	left: KioskSession,
	right: KioskSession,
	sort: KioskSessionAdminSortField,
) {
	if (sort === "startedAt") {
		return left.startedAt.getTime() - right.startedAt.getTime();
	}
	return kioskAdminTextCollator.compare(left[sort], right[sort]);
}

function sortAdminRows<T extends { id: string }>(
	rows: T[],
	direction: KioskAdminSortDirection | undefined,
	compare: (left: T, right: T) => number,
) {
	const multiplier = direction === "desc" ? -1 : 1;
	return [...rows].sort((left, right) => {
		const compared = compare(left, right);
		if (compared !== 0) return compared * multiplier;
		return kioskAdminTextCollator.compare(left.id, right.id);
	});
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
				location: params.location ?? null,
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

			const stations = await findAllStations(data, where);
			const skip = params?.skip ?? 0;
			return stations.slice(
				skip,
				params?.take !== undefined ? skip + params.take : undefined,
			);
		},

		async listStationAdminPage(params?: KioskStationAdminListParams) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;
			const matching = (await findAllStations(data, where)).filter((station) =>
				params?.search
					? matchesStationAdminSearch(station, params.search)
					: true,
			);
			const sort = params?.sort ?? "name";
			const sorted = sortAdminRows(matching, params?.direction, (left, right) =>
				compareStationAdminField(left, right, sort),
			);
			const skip = params?.skip ?? 0;
			const take = params?.take ?? 20;
			return {
				stations: sorted.slice(skip, skip + take),
				total: sorted.length,
			};
		},

		async getStation(id) {
			return parseKioskStation(await data.get("kioskStation", id));
		},

		async listSessions(params) {
			const where: Record<string, unknown> = {};
			if (params?.stationId) where.stationId = params.stationId;
			if (params?.status) where.status = params.status;

			const sessions = await findAllSessions(data, where);
			const skip = params?.skip ?? 0;
			return sessions.slice(
				skip,
				params?.take !== undefined ? skip + params.take : undefined,
			);
		},

		async listSessionAdminPage(params?: KioskSessionAdminListParams) {
			const where: Record<string, unknown> = {};
			if (params?.stationId) where.stationId = params.stationId;
			if (params?.status) where.status = params.status;
			const matching = (await findAllSessions(data, where)).filter((session) =>
				params?.search
					? matchesSessionAdminSearch(session, params.search)
					: true,
			);
			const sort = params?.sort ?? "startedAt";
			const direction = params?.direction ?? "desc";
			const sorted = sortAdminRows(matching, direction, (left, right) =>
				compareSessionAdminField(left, right, sort),
			);
			const skip = params?.skip ?? 0;
			const take = params?.take ?? 20;
			return {
				sessions: sorted.slice(skip, skip + take),
				total: sorted.length,
			};
		},

		async getStationStats(stationId) {
			const all = await findAllSessions(data, { stationId });

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
			const stations = await findAllStations(data);
			const sessions = await findAllSessions(data);

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
