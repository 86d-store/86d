"use client";

import type {
	ColumnVisibilityState,
	OnChangeFn,
	SortingState,
	Updater,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { type GiftCardStatus, isGiftCardStatus } from "./gift-card-admin-types";

const SCHEMA_VERSION = 1;
const TABLE_ID = "store-admin.gift-cards";
const SORTABLE_COLUMNS = new Set([
	"code",
	"balance",
	"status",
	"recipient",
	"createdAt",
]);
const HIDEABLE_COLUMNS = new Set([
	"code",
	"balance",
	"status",
	"recipient",
	"createdAt",
]);

export const GIFT_CARD_TABLE_STORAGE_KEY = `merchant-table-state-${TABLE_ID}`;

export interface GiftCardTableState {
	v: number;
	columnVisibility: ColumnVisibilityState;
	sorting: SortingState;
	globalFilter: string;
	statusFilter: GiftCardStatus | "";
}

export interface GiftCardTableStateController {
	state: GiftCardTableState;
	onColumnVisibilityChange: OnChangeFn<ColumnVisibilityState>;
	onSortingChange: OnChangeFn<SortingState>;
	onGlobalFilterChange: (updater: Updater<string>) => void;
	onStatusFilterChange: (value: string) => void;
}

export function createDefaultGiftCardTableState(): GiftCardTableState {
	return {
		v: SCHEMA_VERSION,
		columnVisibility: {},
		sorting: [{ id: "createdAt", desc: true }],
		globalFilter: "",
		statusFilter: "",
	};
}

function parseVisibility(value: unknown): ColumnVisibilityState {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	const visibility: ColumnVisibilityState = {};
	for (const [columnId, visible] of Object.entries(value)) {
		if (HIDEABLE_COLUMNS.has(columnId) && typeof visible === "boolean") {
			visibility[columnId] = visible;
		}
	}
	return visibility;
}

export function normalizeGiftCardSorting(value: unknown): SortingState {
	if (!Array.isArray(value)) {
		return createDefaultGiftCardTableState().sorting;
	}
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
			SORTABLE_COLUMNS.has(id) &&
			typeof desc === "boolean"
		) {
			return [{ id, desc }];
		}
	}
	return createDefaultGiftCardTableState().sorting;
}

export function parseGiftCardTableState(
	raw: string | null,
): GiftCardTableState {
	const fallback = createDefaultGiftCardTableState();
	if (!raw) return fallback;
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (parsed.v !== SCHEMA_VERSION) return fallback;
		return {
			v: SCHEMA_VERSION,
			columnVisibility: parseVisibility(parsed.columnVisibility),
			sorting: normalizeGiftCardSorting(parsed.sorting),
			globalFilter:
				typeof parsed.globalFilter === "string"
					? parsed.globalFilter.slice(0, 200)
					: "",
			statusFilter:
				typeof parsed.statusFilter === "string" &&
				isGiftCardStatus(parsed.statusFilter)
					? parsed.statusFilter
					: "",
		};
	} catch {
		return fallback;
	}
}

function readStorage(): GiftCardTableState {
	if (typeof window === "undefined") return createDefaultGiftCardTableState();
	try {
		return parseGiftCardTableState(
			window.localStorage.getItem(GIFT_CARD_TABLE_STORAGE_KEY),
		);
	} catch {
		return createDefaultGiftCardTableState();
	}
}

function writeStorage(state: GiftCardTableState) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			GIFT_CARD_TABLE_STORAGE_KEY,
			JSON.stringify(state),
		);
	} catch {
		// The table remains usable when browser storage is unavailable.
	}
}

export function usePersistedGiftCardTableState(): GiftCardTableStateController {
	const [state, setState] = useState<GiftCardTableState>(readStorage);

	const patch = useCallback(
		(partial: Partial<Omit<GiftCardTableState, "v">>) => {
			setState((previous) => {
				const next = { ...previous, ...partial, v: SCHEMA_VERSION };
				writeStorage(next);
				return next;
			});
		},
		[],
	);

	const onColumnVisibilityChange: OnChangeFn<ColumnVisibilityState> =
		useCallback((updater) => {
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
				writeStorage(next);
				return next;
			});
		}, []);

	const onSortingChange: OnChangeFn<SortingState> = useCallback((updater) => {
		setState((previous) => {
			const updated =
				typeof updater === "function" ? updater(previous.sorting) : updater;
			const sorting = normalizeGiftCardSorting(updated);
			const next = { ...previous, sorting, v: SCHEMA_VERSION };
			writeStorage(next);
			return next;
		});
	}, []);

	const onGlobalFilterChange = useCallback((updater: Updater<string>) => {
		setState((previous) => {
			const globalFilter =
				typeof updater === "function"
					? updater(previous.globalFilter)
					: updater;
			const next = {
				...previous,
				globalFilter: globalFilter.slice(0, 200),
				v: SCHEMA_VERSION,
			};
			writeStorage(next);
			return next;
		});
	}, []);

	const onStatusFilterChange = useCallback(
		(value: string) => {
			patch({ statusFilter: isGiftCardStatus(value) ? value : "" });
		},
		[patch],
	);

	return useMemo(
		() => ({
			state,
			onColumnVisibilityChange,
			onSortingChange,
			onGlobalFilterChange,
			onStatusFilterChange,
		}),
		[
			state,
			onColumnVisibilityChange,
			onSortingChange,
			onGlobalFilterChange,
			onStatusFilterChange,
		],
	);
}
