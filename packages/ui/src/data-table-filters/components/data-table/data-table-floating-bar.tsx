"use client";

import { XIcon as X } from "@phosphor-icons/react/dist/ssr";
import type { Row, RowData, Table as TTable } from "@tanstack/react-table";
import { type ReactNode, useMemo } from "react";
import { Button } from "~/button";
import { useDataTable } from "~/data-table-filters/components/data-table/data-table-context";
import { TOOLTIP_DELAY } from "~/data-table-filters/components/data-table/ui-compat";
import { useHotKey } from "~/data-table-filters/hooks/use-hot-key";
import { boxRadiusClassName } from "~/data-table-filters/lib/style";
import type { DataTableFeatures } from "~/data-table-filters/lib/table/features";
import { cn } from "~/lib/utils";
import { Kbd } from "~/shadcn/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/shadcn/tooltip";

interface DataTableFloatingBarProps<TData extends RowData> {
	children: (props: {
		rows: Row<DataTableFeatures, TData>[];
		table: TTable<DataTableFeatures, TData>;
	}) => ReactNode;
}

export function DataTableFloatingBar<TData extends RowData>({
	children,
}: DataTableFloatingBarProps<TData>) {
	const { table, rowSelection } = useDataTable<TData, unknown>();
	const selectedRowCount = Object.keys(rowSelection).length;

	const selectedRows = useMemo(() => {
		return table.getFilteredSelectedRowModel().rows;
	}, [table]);

	useHotKey(() => table.resetRowSelection(), "x", { shift: true });

	if (selectedRowCount === 0) return null;

	return (
		<div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit">
			<div
				className={cn(
					"flex items-center gap-2 border border-border bg-background px-4 py-2.5 shadow-lg",
					boxRadiusClassName,
				)}
			>
				<div className="flex items-center gap-1">
					<span className="whitespace-nowrap text-muted-foreground text-sm">
						{selectedRowCount} selected
					</span>
					<TooltipProvider {...TOOLTIP_DELAY}>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										variant="ghost"
										size="icon-xs"
										onClick={() => table.resetRowSelection()}
										className="p-0.5 text-muted-foreground transition-colors hover:text-foreground"
										aria-label="Deselect all"
									/>
								}
							>
								<X className="size-4" />
							</TooltipTrigger>
							<TooltipContent side="top">
								<p className="text-nowrap">
									Deselect all <Kbd className="ml-1">⌘ ⇧ X</Kbd>
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
				<div className="mr-1 h-5 w-px bg-border" />
				<div className="flex items-center gap-2">
					{children({ rows: selectedRows, table })}
				</div>
			</div>
		</div>
	);
}
