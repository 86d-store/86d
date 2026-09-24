import type {
	ColumnDef,
	ColumnFiltersState,
	ColumnVisibilityState,
	PaginationState,
	ReactTable,
	RowData,
	RowSelectionState,
	SortingState,
	Table,
} from "@tanstack/react-table";
import { createContext, useContext } from "react";
import type { DataTableFilterField } from "~/data-table-filters/components/data-table/types";
import type { DataTableFeatures } from "~/data-table-filters/lib/table/features";

export interface DataTableStateContextType {
	columnFilters: ColumnFiltersState;
	sorting: SortingState;
	rowSelection: RowSelectionState;
	columnOrder: string[];
	columnVisibility: ColumnVisibilityState;
	pagination: PaginationState;
	enableColumnOrdering: boolean;
}

/**
 * `TFeatures` is pinned to `DataTableFeatures` rather than left generic.
 *
 * v9 declares it `in out` — invariant — so a component generic over `TFeatures`
 * cannot resolve any feature API, and pinning is the only typing that works.
 */
export interface DataTableBaseContextType<
	TData extends RowData = RowData,
	TValue = unknown,
> {
	table: ReactTable<DataTableFeatures, TData>;
	filterFields: DataTableFilterField<TData>[];
	columns: ColumnDef<DataTableFeatures, TData, TValue>[];
	isLoading?: boolean | undefined;
	totalRows?: number | undefined;
	filterRows?: number | undefined;
	getFacetedUniqueValues?:
		| ((
				table: Table<DataTableFeatures, TData>,
				columnId: string,
		  ) => Map<string, number>)
		| undefined;
	getFacetedMinMaxValues?:
		| ((
				table: Table<DataTableFeatures, TData>,
				columnId: string,
		  ) => undefined | [number, number])
		| undefined;
}

export interface DataTableContextType<
	TData extends RowData = RowData,
	TValue = unknown,
> extends DataTableStateContextType,
		DataTableBaseContextType<TData, TValue> {}

/**
 * React contexts cannot be generic. Erase to `RowData`/`unknown` here and cast
 * back in `useDataTable`.
 */
export const DataTableContext = createContext<DataTableContextType<
	RowData,
	unknown
> | null>(null);

export function useDataTable<TData extends RowData, TValue>() {
	const context = useContext(DataTableContext);

	if (!context) {
		throw new Error("useDataTable must be used within a DataTableProvider");
	}

	return context as DataTableContextType<TData, TValue>;
}
