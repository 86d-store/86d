"use client";

import { useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "~/data-table-filters/components/custom/date-picker-with-range";
import { useDataTable } from "~/data-table-filters/components/data-table/data-table-context";
import type { DataTableTimerangeFilterField } from "~/data-table-filters/components/data-table/types";
import { isArrayOfDates } from "~/data-table-filters/lib/is-array";

export function DataTableFilterTimerange<TData>({
	value: _value,
	presets,
}: DataTableTimerangeFilterField<TData>) {
	const value = _value as string;
	const { table, columnFilters } = useDataTable();
	const column = table.getColumn(value);
	const filterValue = columnFilters.find((i) => i.id === value)?.value;

	const date: DateRange | undefined = useMemo(
		() =>
			filterValue instanceof Date
				? { from: filterValue, to: undefined }
				: Array.isArray(filterValue) && isArrayOfDates(filterValue)
					? { from: filterValue?.[0], to: filterValue?.[1] }
					: undefined,
		[filterValue],
	);

	const setDate = (date: DateRange | undefined) => {
		if (!date) {
			column?.setFilterValue(undefined);
			return;
		}
		if (date.from && !date.to) {
			column?.setFilterValue([date.from]);
		}
		if (date.to && date.from) {
			column?.setFilterValue([date.from, date.to]);
		}
	};

	return (
		<DatePickerWithRange
			date={date}
			setDate={setDate}
			{...(presets != null ? { presets } : {})}
		/>
	);
}
