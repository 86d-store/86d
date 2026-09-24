"use client";

import { XIcon as X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "~/button";
import { useDataTable } from "~/data-table-filters/components/data-table/data-table-context";
import type { DataTableFilterField } from "~/data-table-filters/components/data-table/types";

export function DataTableFilterResetButton<TData>({
	value: _value,
}: DataTableFilterField<TData>) {
	const { columnFilters, table } = useDataTable();
	const value = _value as string;
	const column = table.getColumn(value);
	const filterValue = columnFilters.find((f) => f.id === value)?.value;

	// TODO: check if we could useMemo
	const filters = filterValue
		? Array.isArray(filterValue)
			? filterValue
			: [filterValue]
		: [];

	if (filters.length === 0) return null;

	return (
		<Button
			variant="outline"
			className="h-5 gap-1 px-1.5! py-1! font-mono text-[10px] shadow-none"
			onClick={(e) => {
				e.stopPropagation();
				column?.setFilterValue(undefined);
			}}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.code === "Enter") {
					column?.setFilterValue(undefined);
				}
			}}
			render={<button type="button" />}
		>
			<span>{filters.length}</span>
			<X className="ml-1! size-2.5! text-muted-foreground" />
		</Button>
	);
}
