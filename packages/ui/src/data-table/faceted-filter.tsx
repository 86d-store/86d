"use client";

import { CheckIcon, PlusCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Subscribe, type SubscribeSource } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Badge } from "~/badge";
import { Button } from "~/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "~/core/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/core/popover";
import { Separator } from "~/core/separator";
import { cn } from "~/lib/utils";
import { View } from "~/view";

export type DataTableFacetedFilterOption = {
	label: string;
	value: string;
	icon?: ReactNode;
};

type ColumnFiltersState = Array<{ id: string; value: unknown }>;

type ColumnFiltersAtom = SubscribeSource<ColumnFiltersState>;

type FilterableColumn = {
	id: string;
	getFilterValue: () => unknown;
	setFilterValue: (value: unknown) => void;
	getFacetedUniqueValues?: () => Map<unknown, number>;
	table?: {
		atoms?: {
			columnFilters?: ColumnFiltersAtom;
		};
	};
};

export interface DataTableFacetedFilterProps {
	column?: FilterableColumn | undefined;
	title: string;
	options: DataTableFacetedFilterOption[];
	/** Optional counts keyed by option value. Falls back to column facets. */
	facets?: Map<string, number> | undefined;
	className?: string | undefined;
	disabled?: boolean;
}

function selectedFilterValues(value: unknown): Set<string> {
	if (!Array.isArray(value)) return new Set();
	return new Set(
		value.filter((item): item is string => typeof item === "string"),
	);
}

function filterValueForColumn(
	filters: ColumnFiltersState | undefined,
	columnId: string,
): unknown {
	return filters?.find((filter) => filter.id === columnId)?.value;
}

function FacetedFilterMenu({
	column,
	title,
	options,
	facets: facetsProp,
	className,
	selectedValues,
	disabled = false,
}: {
	column: FilterableColumn;
	title: string;
	options: DataTableFacetedFilterOption[];
	facets?: Map<string, number> | undefined;
	className?: string | undefined;
	selectedValues: Set<string>;
	disabled?: boolean;
}) {
	const columnFacets = column.getFacetedUniqueValues?.();

	const countFor = (value: string) => {
		if (facetsProp) return facetsProp.get(value);
		return columnFacets?.get(value);
	};

	const orderedOptions =
		selectedValues.size === 0
			? options
			: [
					...options.filter((option) => selectedValues.has(option.value)),
					...options.filter((option) => !selectedValues.has(option.value)),
				];

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						disabled={disabled}
						className={cn("h-8 border-dashed", className)}
					/>
				}
			>
				<PlusCircleIcon data-icon="inline-start" weight="bold" />
				{title}
				{selectedValues.size > 0 ? (
					<>
						<Separator
							orientation="vertical"
							className="mx-0.5 data-vertical:h-4"
						/>
						<Badge
							variant="secondary"
							className="rounded-sm px-1 font-normal lg:hidden"
						>
							{selectedValues.size}
						</Badge>
						<View className="hidden gap-1 lg:flex">
							{selectedValues.size > 2 ? (
								<Badge
									variant="secondary"
									className="rounded-sm px-1 font-normal"
								>
									{selectedValues.size} selected
								</Badge>
							) : (
								options
									.filter((option) => selectedValues.has(option.value))
									.map((option) => (
										<Badge
											variant="secondary"
											key={option.value}
											className="rounded-sm px-1 font-normal capitalize"
										>
											{option.label}
										</Badge>
									))
							)}
						</View>
					</>
				) : null}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-52 gap-0 p-0">
				<Command>
					<CommandInput placeholder={title} />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup>
							{orderedOptions.map((option) => {
								const isSelected = selectedValues.has(option.value);
								const count = countFor(option.value);
								return (
									<CommandItem
										key={option.value}
										value={option.value}
										data-checked={isSelected || undefined}
										onSelect={() => {
											const next = new Set(selectedValues);
											if (isSelected) {
												next.delete(option.value);
											} else {
												next.add(option.value);
											}
											const filterValues = Array.from(next);
											column.setFilterValue(
												filterValues.length > 0 ? filterValues : undefined,
											);
										}}
									>
										<View
											className={cn(
												"flex size-4 items-center justify-center rounded-sm border",
												isSelected
													? "border-primary bg-primary text-primary-foreground"
													: "border-input [&_svg]:invisible",
											)}
										>
											<CheckIcon
												weight="bold"
												className="size-3.5 text-primary-foreground"
											/>
										</View>
										{option.icon}
										<span className="capitalize">{option.label}</span>
										{count !== undefined ? (
											<CommandShortcut className="font-mono tabular-nums tracking-normal">
												{count}
											</CommandShortcut>
										) : null}
									</CommandItem>
								);
							})}
						</CommandGroup>
						{selectedValues.size > 0 ? (
							<>
								<CommandSeparator />
								<CommandGroup>
									<CommandItem
										onSelect={() => column.setFilterValue(undefined)}
										className="justify-center text-center"
									>
										Clear filters
									</CommandItem>
								</CommandGroup>
							</>
						) : null}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export function DataTableFacetedFilter({
	column,
	title,
	options,
	facets,
	className,
	disabled = false,
}: DataTableFacetedFilterProps) {
	if (!column) return null;

	const filtersAtom = column.table?.atoms?.columnFilters;

	if (filtersAtom) {
		return (
			<Subscribe
				source={filtersAtom}
				selector={(filters: ColumnFiltersState) =>
					filterValueForColumn(filters, column.id)
				}
			>
				{(filterValue: unknown) => (
					<FacetedFilterMenu
						column={column}
						title={title}
						options={options}
						facets={facets}
						className={className}
						selectedValues={selectedFilterValues(filterValue)}
						disabled={disabled}
					/>
				)}
			</Subscribe>
		);
	}

	return (
		<FacetedFilterMenu
			column={column}
			title={title}
			options={options}
			facets={facets}
			className={className}
			selectedValues={selectedFilterValues(column.getFilterValue())}
			disabled={disabled}
		/>
	);
}
