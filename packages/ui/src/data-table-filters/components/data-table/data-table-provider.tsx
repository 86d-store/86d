"use client";

import type { RowData } from "@tanstack/react-table";
import { type ReactNode, useMemo } from "react";
import {
	type DataTableBaseContextType,
	DataTableContext,
	type DataTableContextType,
	type DataTableStateContextType,
} from "~/data-table-filters/components/data-table/data-table-context";
import { DataTableStoreSync } from "~/data-table-filters/components/data-table/data-table-store-sync";
import { ControlsProvider } from "~/data-table-filters/providers/controls";

export function DataTableProvider<TData extends RowData, TValue>({
	children,
	columnFilters,
	sorting,
	rowSelection,
	columnOrder,
	columnVisibility,
	pagination,
	enableColumnOrdering,
	table,
	filterFields,
	columns,
	isLoading,
	totalRows,
	filterRows,
	getFacetedUniqueValues,
	getFacetedMinMaxValues,
}: Partial<DataTableStateContextType> &
	DataTableBaseContextType<TData, TValue> & {
		children: ReactNode;
	}) {
	const value = useMemo(
		() =>
			({
				table,
				filterFields,
				columns,
				columnFilters: columnFilters ?? [],
				sorting: sorting ?? [],
				rowSelection: rowSelection ?? {},
				columnOrder: columnOrder ?? [],
				columnVisibility: columnVisibility ?? {},
				pagination: pagination ?? { pageIndex: 0, pageSize: 10 },
				enableColumnOrdering: enableColumnOrdering ?? false,
				...(isLoading !== undefined ? { isLoading } : {}),
				...(totalRows !== undefined ? { totalRows } : {}),
				...(filterRows !== undefined ? { filterRows } : {}),
				...(getFacetedUniqueValues != null ? { getFacetedUniqueValues } : {}),
				...(getFacetedMinMaxValues != null ? { getFacetedMinMaxValues } : {}),
			}) as DataTableContextType<RowData, unknown>,
		[
			table,
			filterFields,
			columns,
			columnFilters,
			sorting,
			rowSelection,
			columnOrder,
			columnVisibility,
			pagination,
			enableColumnOrdering,
			isLoading,
			totalRows,
			filterRows,
			getFacetedUniqueValues,
			getFacetedMinMaxValues,
		],
	);

	return (
		<DataTableContext.Provider value={value}>
			<ControlsProvider>
				<DataTableStoreSync />
				{children}
			</ControlsProvider>
		</DataTableContext.Provider>
	);
}
