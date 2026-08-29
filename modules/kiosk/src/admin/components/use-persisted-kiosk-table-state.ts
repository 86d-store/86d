"use client";

import type {
	ColumnVisibilityState,
	OnChangeFn,
	SortingState,
	Updater,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

const SCHEMA_VERSION = 1;
const SEARCH_LIMIT = 200;
const STATION_SORTABLE_COLUMNS = new Set(["name", "location", "isActive"]);
const STATION_HIDEABLE_COLUMNS = new Set(["name", "location", "isActive"]);
const SESSION_SORTABLE_COLUMNS = new Set(["id", "status", "startedAt"]);
const SESSION_HIDEABLE_COLUMNS = new Set([
	"id",
	"stationId",
	"status",
	"startedAt",
]);
const SESSION_FILTER_STATUSES = new Set([
	"active",
	"completed",
	"abandoned",
	"timed-out",
]);

export const KIOSK_STATION_TABLE_STORAGE_KEY =
	"merchant-table-state-store-admin.kiosk-stations";
export const KIOSK_SESSION_TABLE_STORAGE_KEY =
	"merchant-table-state-store-admin.kiosk-sessions";

interface KioskTableStateBase {
	v: number;
	columnVisibility: ColumnVisibilityState;
	sorting: SortingState;
	globalFilter: string;
	pageIndex: number;
}

export interface KioskStationTableState extends KioskTableStateBase {
	activityFilter: "" | "true" | "false";
}

export interface KioskSessionTableState extends KioskTableStateBase {
	stationFilter: string;
	statusFilter: "" | "active" | "completed" | "abandoned" | "timed-out";
}

interface KioskTableStateController<TState extends KioskTableStateBase> {
	state: TState;
	onColumnVisibilityChange: OnChangeFn<ColumnVisibilityState>;
	onSortingChange: OnChangeFn<SortingState>;
	onGlobalFilterChange: (updater: Updater<string>) => void;
	setPageIndex: (pageIndex: number) => void;
}

export interface KioskStationTableStateController
	extends KioskTableStateController<KioskStationTableState> {
	onActivityFilterChange: (value: string) => void;
}

export interface KioskSessionTableStateController
	extends KioskTableStateController<KioskSessionTableState> {
	onStationFilterChange: (value: string) => void;
	onStatusFilterChange: (value: string) => void;
}

export function createDefaultKioskStationTableState(): KioskStationTableState {
	return {
		v: SCHEMA_VERSION,
		columnVisibility: {},
		sorting: [{ id: "name", desc: false }],
		globalFilter: "",
		pageIndex: 0,
		activityFilter: "",
	};
}

export function createDefaultKioskSessionTableState(): KioskSessionTableState {
	return {
		v: SCHEMA_VERSION,
		columnVisibility: {},
		sorting: [{ id: "startedAt", desc: true }],
		globalFilter: "",
		pageIndex: 0,
		stationFilter: "",
		statusFilter: "",
	};
}

function parseVisibility(
	value: unknown,
	allowedColumns: ReadonlySet<string>,
): ColumnVisibilityState {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	const visibility: ColumnVisibilityState = {};
	for (const [columnId, visible] of Object.entries(value)) {
		if (allowedColumns.has(columnId) && typeof visible === "boolean") {
			visibility[columnId] = visible;
		}
	}
	return visibility;
}

function normalizeSorting(
	value: unknown,
	allowedColumns: ReadonlySet<string>,
	fallback: SortingState,
): SortingState {
	if (!Array.isArray(value)) return fallback;
	for (const candidate of value) {
		if (
			!candidate ||
			typeof candidate !== "object" ||
			Array.isArray(candidate)
		) {
			continue;
		}
		const { id, desc } = candidate as { id?: unknown; desc?: unknown };
		if (
			typeof id === "string" &&
			allowedColumns.has(id) &&
			typeof desc === "boolean"
		) {
			return [{ id, desc }];
		}
	}
	return fallback;
}

export function normalizeKioskStationSorting(value: unknown): SortingState {
	return normalizeSorting(
		value,
		STATION_SORTABLE_COLUMNS,
		createDefaultKioskStationTableState().sorting,
	);
}

export function normalizeKioskSessionSorting(value: unknown): SortingState {
	return normalizeSorting(
		value,
		SESSION_SORTABLE_COLUMNS,
		createDefaultKioskSessionTableState().sorting,
	);
}

function parseBase(
	parsed: Record<string, unknown>,
	allowedColumns: ReadonlySet<string>,
	normalizeTableSorting: (value: unknown) => SortingState,
) {
	return {
		v: SCHEMA_VERSION,
		columnVisibility: parseVisibility(parsed.columnVisibility, allowedColumns),
		sorting: normalizeTableSorting(parsed.sorting),
		globalFilter:
			typeof parsed.globalFilter === "string"
				? parsed.globalFilter.slice(0, SEARCH_LIMIT)
				: "",
		pageIndex:
			typeof parsed.pageIndex === "number" &&
			Number.isSafeInteger(parsed.pageIndex) &&
			parsed.pageIndex >= 0
				? parsed.pageIndex
				: 0,
	};
}

export function parseKioskStationTableState(
	raw: string | null,
): KioskStationTableState {
	const fallback = createDefaultKioskStationTableState();
	if (!raw) return fallback;
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (parsed.v !== SCHEMA_VERSION) return fallback;
		return {
			...parseBase(
				parsed,
				STATION_HIDEABLE_COLUMNS,
				normalizeKioskStationSorting,
			),
			activityFilter:
				parsed.activityFilter === "true" || parsed.activityFilter === "false"
					? parsed.activityFilter
					: "",
		};
	} catch {
		return fallback;
	}
}

export function parseKioskSessionTableState(
	raw: string | null,
): KioskSessionTableState {
	const fallback = createDefaultKioskSessionTableState();
	if (!raw) return fallback;
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (parsed.v !== SCHEMA_VERSION) return fallback;
		return {
			...parseBase(
				parsed,
				SESSION_HIDEABLE_COLUMNS,
				normalizeKioskSessionSorting,
			),
			stationFilter:
				typeof parsed.stationFilter === "string"
					? parsed.stationFilter.slice(0, SEARCH_LIMIT)
					: "",
			statusFilter:
				typeof parsed.statusFilter === "string" &&
				SESSION_FILTER_STATUSES.has(parsed.statusFilter)
					? (parsed.statusFilter as KioskSessionTableState["statusFilter"])
					: "",
		};
	} catch {
		return fallback;
	}
}

function readStorage<TState>(
	key: string,
	parse: (raw: string | null) => TState,
): TState {
	if (typeof window === "undefined") return parse(null);
	try {
		return parse(window.localStorage.getItem(key));
	} catch {
		return parse(null);
	}
}

function writeStorage<TState>(key: string, state: TState) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, JSON.stringify(state));
	} catch {
		// The table remains usable when browser storage is unavailable.
	}
}

function usePersistedTableState<TState extends KioskTableStateBase>({
	storageKey,
	parse,
	normalizeTableSorting,
}: {
	storageKey: string;
	parse: (raw: string | null) => TState;
	normalizeTableSorting: (value: unknown) => SortingState;
}) {
	const [state, setState] = useState<TState>(() =>
		readStorage(storageKey, parse),
	);

	const patch = useCallback(
		(partial: Partial<TState>) => {
			setState((previous) => {
				const next = { ...previous, ...partial, v: SCHEMA_VERSION };
				writeStorage(storageKey, next);
				return next;
			});
		},
		[storageKey],
	);

	const onColumnVisibilityChange: OnChangeFn<ColumnVisibilityState> =
		useCallback(
			(updater) => {
				setState((previous) => {
					const columnVisibility =
						typeof updater === "function"
							? updater(previous.columnVisibility)
							: updater;
					const next = {
						...previous,
						columnVisibility,
						v: SCHEMA_VERSION,
					};
					writeStorage(storageKey, next);
					return next;
				});
			},
			[storageKey],
		);

	const onSortingChange: OnChangeFn<SortingState> = useCallback(
		(updater) => {
			setState((previous) => {
				const updated =
					typeof updater === "function" ? updater(previous.sorting) : updater;
				const next = {
					...previous,
					sorting: normalizeTableSorting(updated),
					pageIndex: 0,
					v: SCHEMA_VERSION,
				};
				writeStorage(storageKey, next);
				return next;
			});
		},
		[normalizeTableSorting, storageKey],
	);

	const onGlobalFilterChange = useCallback(
		(updater: Updater<string>) => {
			setState((previous) => {
				const globalFilter =
					typeof updater === "function"
						? updater(previous.globalFilter)
						: updater;
				const next = {
					...previous,
					globalFilter: globalFilter.slice(0, SEARCH_LIMIT),
					pageIndex: 0,
					v: SCHEMA_VERSION,
				};
				writeStorage(storageKey, next);
				return next;
			});
		},
		[storageKey],
	);

	const setPageIndex = useCallback(
		(pageIndex: number) => {
			setState((previous) => {
				const next = {
					...previous,
					pageIndex: Math.max(0, pageIndex),
					v: SCHEMA_VERSION,
				};
				writeStorage(storageKey, next);
				return next;
			});
		},
		[storageKey],
	);

	return useMemo(
		() => ({
			state,
			patch,
			onColumnVisibilityChange,
			onSortingChange,
			onGlobalFilterChange,
			setPageIndex,
		}),
		[
			state,
			patch,
			onColumnVisibilityChange,
			onSortingChange,
			onGlobalFilterChange,
			setPageIndex,
		],
	);
}

export function usePersistedKioskStationTableState(): KioskStationTableStateController {
	const controller = usePersistedTableState({
		storageKey: KIOSK_STATION_TABLE_STORAGE_KEY,
		parse: parseKioskStationTableState,
		normalizeTableSorting: normalizeKioskStationSorting,
	});
	const onActivityFilterChange = useCallback(
		(value: string) => {
			controller.patch({
				activityFilter: value === "true" || value === "false" ? value : "",
				pageIndex: 0,
			});
		},
		[controller],
	);

	return useMemo(
		() => ({
			...controller,
			onActivityFilterChange,
		}),
		[controller, onActivityFilterChange],
	);
}

export function usePersistedKioskSessionTableState(): KioskSessionTableStateController {
	const controller = usePersistedTableState({
		storageKey: KIOSK_SESSION_TABLE_STORAGE_KEY,
		parse: parseKioskSessionTableState,
		normalizeTableSorting: normalizeKioskSessionSorting,
	});
	const onStationFilterChange = useCallback(
		(value: string) => {
			controller.patch({
				stationFilter: value.slice(0, SEARCH_LIMIT),
				pageIndex: 0,
			});
		},
		[controller],
	);
	const onStatusFilterChange = useCallback(
		(value: string) => {
			controller.patch({
				statusFilter: SESSION_FILTER_STATUSES.has(value)
					? (value as KioskSessionTableState["statusFilter"])
					: "",
				pageIndex: 0,
			});
		},
		[controller],
	);

	return useMemo(
		() => ({
			...controller,
			onStationFilterChange,
			onStatusFilterChange,
		}),
		[controller, onStationFilterChange, onStatusFilterChange],
	);
}
