"use client";

import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactTable, RowData, TableFeatures } from "@tanstack/react-table";
import { Button } from "~/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/dropdown-menu";
import { cn } from "~/lib/utils";

type VisibilityColumn = {
	id: string;
	columnDef: { header?: unknown; meta?: unknown };
	getCanHide: () => boolean;
	getIsVisible: () => boolean;
	toggleVisibility: (value?: boolean) => void;
};

export interface DataTableViewOptionsProps<
	TFeatures extends TableFeatures,
	TData extends RowData,
> {
	table: ReactTable<TFeatures, TData>;
	className?: string;
}

function columnLabel(column: VisibilityColumn) {
	const meta = column.columnDef.meta as { label?: string } | undefined;
	if (meta?.label) return meta.label;
	if (typeof column.columnDef.header === "string") {
		return column.columnDef.header;
	}
	return column.id;
}

export function DataTableViewOptions<
	TFeatures extends TableFeatures,
	TData extends RowData,
>({ table, className }: DataTableViewOptionsProps<TFeatures, TData>) {
	const hideable = (
		table.getAllColumns() as unknown as VisibilityColumn[]
	).filter((column) => column.getCanHide());

	if (hideable.length === 0) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className={cn("ml-auto", className)}
					/>
				}
			>
				<SlidersHorizontalIcon data-icon="inline-start" weight="bold" />
				View
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{hideable.map((column) => (
						<DropdownMenuCheckboxItem
							key={column.id}
							checked={column.getIsVisible()}
							onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
						>
							{columnLabel(column)}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
