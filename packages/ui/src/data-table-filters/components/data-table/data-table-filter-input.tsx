"use client";

import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";
import { useDataTable } from "~/data-table-filters/components/data-table/data-table-context";
import type { DataTableInputFilterField } from "~/data-table-filters/components/data-table/types";
import { useDebounce } from "~/data-table-filters/hooks/use-debounce";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "~/shadcn/input-group";
import { Label } from "~/shadcn/label";

function getFilter(filterValue: unknown) {
	return typeof filterValue === "string" ? filterValue : null;
}

export function DataTableFilterInput<TData>({
	value: _value,
}: DataTableInputFilterField<TData>) {
	const value = _value as string;
	const { table, columnFilters } = useDataTable();
	const column = table.getColumn(value);
	const filterValue = columnFilters.find((i) => i.id === value)?.value;
	const filters = getFilter(filterValue);
	const [input, setInput] = useState<string | null>(filters);

	const debouncedInput = useDebounce(input, 500);

	useEffect(() => {
		const newValue = debouncedInput?.trim() === "" ? null : debouncedInput;
		if (debouncedInput === null) return;
		column?.setFilterValue(newValue);
	}, [debouncedInput, column?.setFilterValue]);

	useEffect(() => {
		if (debouncedInput?.trim() !== filters) {
			setInput(filters);
		}
	}, [filters, debouncedInput?.trim]);

	return (
		<div className="grid w-full gap-1.5">
			<Label htmlFor={value} className="sr-only px-2 text-muted-foreground">
				{value}
			</Label>
			<InputGroup className="h-9 shadow-none">
				<InputGroupAddon>
					<Search className="mt-0.5 h-4 w-4" />
				</InputGroupAddon>
				<InputGroupInput
					placeholder="Search"
					name={value}
					id={value}
					value={input || ""}
					onChange={(e) => setInput(e.target.value)}
				/>
			</InputGroup>
		</div>
	);
}
