"use client";

import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactTable, RowData, TableFeatures } from "@tanstack/react-table";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "~/input-group";
import { cn } from "~/lib/utils";

type GlobalFilterTable<
	TFeatures extends TableFeatures,
	TData extends RowData,
> = ReactTable<TFeatures, TData> & {
	setGlobalFilter: (updater: unknown) => void;
};

export interface DataTableToolbarProps<
	TFeatures extends TableFeatures,
	TData extends RowData,
> extends Omit<
		React.ComponentProps<typeof InputGroupInput>,
		"value" | "onChange"
	> {
	table: GlobalFilterTable<TFeatures, TData>;
	value?: string;
	onValueChange?: (value: string) => void;
	className?: string;
	disabled?: boolean;
}

export function DataTableToolbar<
	TFeatures extends TableFeatures,
	TData extends RowData,
>({
	table,
	value: valueProp,
	onValueChange,
	placeholder = "Search...",
	className,
	disabled = false,
	...props
}: DataTableToolbarProps<TFeatures, TData>) {
	const stateFilter = (table.state as { globalFilter?: unknown } | null)
		?.globalFilter;
	const value =
		valueProp ?? (typeof stateFilter === "string" ? stateFilter : "");

	const setValue = (next: string) => {
		onValueChange?.(next);
		table.setGlobalFilter(next);
	};

	return (
		<InputGroup
			className={cn("max-w-xs", className)}
			data-disabled={disabled || undefined}
		>
			<InputGroupAddon>
				<MagnifyingGlassIcon weight="bold" />
			</InputGroupAddon>
			<InputGroupInput
				value={value}
				placeholder={placeholder}
				disabled={disabled}
				onChange={(event) => setValue(event.target.value)}
				{...props}
			/>
			{value.trim() ? (
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						variant="ghost"
						size="icon-xs"
						aria-label="Clear search"
						disabled={disabled}
						onClick={() => setValue("")}
					>
						<XIcon weight="bold" />
					</InputGroupButton>
				</InputGroupAddon>
			) : null}
		</InputGroup>
	);
}
