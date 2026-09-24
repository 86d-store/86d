import {
	CaretDownIcon as ChevronDown,
	CaretUpIcon as ChevronUp,
} from "@phosphor-icons/react/dist/ssr";
import type { Column, RowData } from "@tanstack/react-table";
import type React from "react";
import { Button } from "~/button";
import type { DataTableFeatures } from "~/data-table-filters/lib/table/features";
import { cn } from "~/lib/utils";

interface DataTableColumnHeaderProps<TData extends RowData, TValue>
	extends React.ComponentProps<typeof Button> {
	column: Column<DataTableFeatures, TData, TValue>;
	title: string;
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
	column,
	title,
	className,
	...props
}: DataTableColumnHeaderProps<TData, TValue>) {
	if (!column.getCanSort()) {
		return <div className={cn(className)}>{title}</div>;
	}

	return (
		<Button
			variant="ghost"
			onClick={() => {
				column.toggleSorting(undefined);
			}}
			className={cn(
				"flex h-7 w-full items-center justify-between gap-2 px-0 py-0 hover:bg-transparent",
				className,
			)}
			{...props}
		>
			<span>{title}</span>
			<span className="flex flex-col">
				<ChevronUp
					className={cn(
						"-mb-0.5 size-3",
						column.getIsSorted() === "asc"
							? "text-accent-foreground"
							: "text-muted-foreground",
					)}
				/>
				<ChevronDown
					className={cn(
						"-mt-0.5 size-3",
						column.getIsSorted() === "desc"
							? "text-accent-foreground"
							: "text-muted-foreground",
					)}
				/>
			</span>
		</Button>
	);
}
