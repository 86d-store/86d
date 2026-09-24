"use client";

import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { useDataTable } from "~/data-table-filters/components/data-table/data-table-context";
import type { DataTableCheckboxFilterField } from "~/data-table-filters/components/data-table/types";
import { formatCompactNumber } from "~/data-table-filters/lib/format";
import {
	boxRadiusClassName,
	boxSurfaceClassName,
} from "~/data-table-filters/lib/style";
import { cn } from "~/lib/utils";
import { Checkbox } from "~/shadcn/checkbox";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "~/shadcn/input-group";
import { Label } from "~/shadcn/label";
import { Skeleton } from "~/shadcn/skeleton";

export function DataTableFilterCheckbox<TData>({
	value: _value,
	options,
	component,
}: DataTableCheckboxFilterField<TData>) {
	const value = _value as string;
	const [inputValue, setInputValue] = useState("");
	const { table, columnFilters, isLoading, getFacetedUniqueValues } =
		useDataTable();
	const column = table.getColumn(value);
	// REMINDER: avoid using column?.getFilterValue()
	const filterValue = columnFilters.find((i) => i.id === value)?.value;
	const facetedValue =
		getFacetedUniqueValues?.(table, value) || column?.getFacetedUniqueValues();

	const Component = component;

	// filter out the options based on the input value
	const filterOptions = options?.filter(
		(option) =>
			inputValue === "" ||
			option.label.toLowerCase().includes(inputValue.toLowerCase()),
	);

	// CHECK: it could be filterValue or searchValue
	const filters = filterValue
		? Array.isArray(filterValue)
			? filterValue
			: [filterValue]
		: [];

	// REMINDER: if no options are defined, while fetching data, we should show a skeleton
	if (isLoading && !filterOptions?.length)
		return (
			<div className={cn("grid divide-y border", boxSurfaceClassName)}>
				{["skeleton-a", "skeleton-b", "skeleton-c"].map((skeletonKey) => (
					<div
						key={skeletonKey}
						className="flex items-center justify-between gap-2 px-2 py-2.5"
					>
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-4 w-full" />
					</div>
				))}
			</div>
		);

	return (
		<div className="grid gap-2">
			{options && options.length > 4 ? (
				<InputGroup className="h-9 shadow-none">
					<InputGroupAddon>
						<Search className="mt-0.5 h-4 w-4" />
					</InputGroupAddon>
					<InputGroupInput
						placeholder="Search"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
					/>
				</InputGroup>
			) : null}
			{/* FIXME: due to the added max-h and overflow-y-auto, the hover state and border is laying on top of the scroll bar */}
			<div
				className={cn(
					"max-h-[200px] overflow-y-auto border empty:border-none",
					boxSurfaceClassName,
				)}
			>
				{filterOptions
					// TODO: we shoudn't sort the options here, instead filterOptions should be sorted by default
					// .sort((a, b) => a.label.localeCompare(b.label))
					?.map((option, index) => {
						const checked = filters.includes(option.value);

						return (
							<div
								key={String(option.value)}
								className={cn(
									"group relative flex items-center space-x-2 px-2 py-2.5 hover:bg-accent/50",
									index !== filterOptions.length - 1 ? "border-b" : undefined,
								)}
							>
								<Checkbox
									id={`${value}-${option.value}`}
									checked={checked}
									onCheckedChange={(checked) => {
										const newValue = checked
											? [...(filters || []), option.value]
											: filters?.filter((value) => option.value !== value);
										column?.setFilterValue(
											newValue?.length ? newValue : undefined,
										);
									}}
								/>
								<Label
									htmlFor={`${value}-${option.value}`}
									className="flex w-full items-center justify-center gap-1 truncate text-foreground/70 group-hover:text-accent-foreground"
								>
									{Component ? (
										<Component
											{...option}
											{...(options != null ? { options } : {})}
										/>
									) : (
										<span className="truncate font-normal">{option.label}</span>
									)}
									<span className="ml-auto flex items-center justify-center font-mono text-xs">
										{isLoading ? (
											<Skeleton className="h-4 w-4" />
										) : facetedValue?.has(option.value) ? (
											formatCompactNumber(facetedValue.get(option.value) || 0)
										) : null}
									</span>
									<button
										type="button"
										onClick={() => column?.setFilterValue([option.value])}
										className={cn(
											"absolute inset-y-0 right-0 hidden font-normal text-muted-foreground backdrop-blur-xs hover:text-foreground group-hover:block",
											"outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
											boxRadiusClassName,
										)}
									>
										<span className="px-2">only</span>
									</button>
								</Label>
							</div>
						);
					})}
			</div>
		</div>
	);
}
