"use client";

import type {
	ColumnFiltersState,
	ColumnVisibilityState,
	OnChangeFn,
	SortingState,
	Updater,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

const SCHEMA_VERSION = 1;

type PersistedTableState = {
	v: number;
	columnVisibility: ColumnVisibilityState;
	sorting: SortingState;
	columnFilters: ColumnFiltersState;
	globalFilter: string;
};

const emptyState: PersistedTableState = {
	v: SCHEMA_VERSION,
	columnVisibility: {},
	sorting: [],
	columnFilters: [],
	globalFilter: "",
};

function readStorage(tableId: string): PersistedTableState {
	if (typeof window === "undefined") return emptyState;
	try {
		const raw = window.localStorage.getItem(`merchant-table-state-${tableId}`);
		if (!raw) return emptyState;
		const parsed = JSON.parse(raw) as PersistedTableState;
		if (parsed.v !== SCHEMA_VERSION) return emptyState;
		return {
			v: SCHEMA_VERSION,
			columnVisibility: parsed.columnVisibility ?? {},
			sorting: Array.isArray(parsed.sorting) ? parsed.sorting : [],
			columnFilters: Array.isArray(parsed.columnFilters)
				? parsed.columnFilters
				: [],
			globalFilter:
				typeof parsed.globalFilter === "string" ? parsed.globalFilter : "",
		};
	} catch {
		return emptyState;
	}
}

function writeStorage(tableId: string, state: PersistedTableState) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		`merchant-table-state-${tableId}`,
		JSON.stringify(state),
	);
}

export function usePersistedTableState(tableId: string) {
	const [state, setState] = useState<PersistedTableState>(() =>
		readStorage(tableId),
	);

	const onColumnVisibilityChange: OnChangeFn<ColumnVisibilityState> =
		useCallback(
			(updater) => {
				setState((prev) => {
					const nextVisibility =
						typeof updater === "function"
							? updater(prev.columnVisibility)
							: updater;
					const next = {
						...prev,
						columnVisibility: nextVisibility,
						v: SCHEMA_VERSION,
					};
					writeStorage(tableId, next);
					return next;
				});
			},
			[tableId],
		);

	const onSortingChange: OnChangeFn<SortingState> = useCallback(
		(updater) => {
			setState((prev) => {
				const nextSorting =
					typeof updater === "function" ? updater(prev.sorting) : updater;
				const next = { ...prev, sorting: nextSorting, v: SCHEMA_VERSION };
				writeStorage(tableId, next);
				return next;
			});
		},
		[tableId],
	);

	const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
		(updater) => {
			setState((prev) => {
				const nextFilters =
					typeof updater === "function" ? updater(prev.columnFilters) : updater;
				const next = { ...prev, columnFilters: nextFilters, v: SCHEMA_VERSION };
				writeStorage(tableId, next);
				return next;
			});
		},
		[tableId],
	);

	const onGlobalFilterChange = useCallback(
		(updater: Updater<string>) => {
			setState((prev) => {
				const nextFilter =
					typeof updater === "function" ? updater(prev.globalFilter) : updater;
				const next = { ...prev, globalFilter: nextFilter, v: SCHEMA_VERSION };
				writeStorage(tableId, next);
				return next;
			});
		},
		[tableId],
	);

	return useMemo(
		() => ({
			state,
			onColumnVisibilityChange,
			onSortingChange,
			onColumnFiltersChange,
			onGlobalFilterChange,
		}),
		[
			state,
			onColumnVisibilityChange,
			onSortingChange,
			onColumnFiltersChange,
			onGlobalFilterChange,
		],
	);
}
