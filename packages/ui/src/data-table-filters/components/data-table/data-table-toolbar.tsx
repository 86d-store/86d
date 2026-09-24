"use client";

import {
	SidebarSimpleIcon as PanelLeftClose,
	SidebarSimpleIcon as PanelLeftOpen,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "~/button";
import { useDataTable } from "~/data-table-filters/components/data-table/data-table-context";
import { DataTableFilterControlsDrawer } from "~/data-table-filters/components/data-table/data-table-filter-controls-drawer";
import { DataTableResetButton } from "~/data-table-filters/components/data-table/data-table-reset-button";
import { DataTableViewOptions } from "~/data-table-filters/components/data-table/data-table-view-options";
import { TOOLTIP_DELAY } from "~/data-table-filters/components/data-table/ui-compat";
import { useHotKey } from "~/data-table-filters/hooks/use-hot-key";
import { formatCompactNumber } from "~/data-table-filters/lib/format";
import { useControls } from "~/data-table-filters/providers/controls";
import { Kbd } from "~/shadcn/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/shadcn/tooltip";

interface DataTableToolbarProps {
	renderActions?: (() => React.ReactNode) | undefined;
}

export function DataTableToolbar({ renderActions }: DataTableToolbarProps) {
	const { table, columnFilters, totalRows, filterRows } = useDataTable();
	const { open, setOpen } = useControls();
	useHotKey(() => setOpen((prev) => !prev), "b");
	const rows = {
		total: totalRows ?? table.getCoreRowModel().rows.length,
		filtered: filterRows ?? table.getFilteredRowModel().rows.length,
	};

	return (
		<div className="flex flex-wrap items-center justify-between gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<TooltipProvider {...TOOLTIP_DELAY}>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant="ghost"
									onClick={() => setOpen((prev) => !prev)}
									className="hidden gap-2 sm:flex"
								/>
							}
						>
							{open ? (
								<>
									<PanelLeftClose className="h-4 w-4" />
									<span className="hidden md:block">Hide Controls</span>
								</>
							) : (
								<>
									<PanelLeftOpen className="h-4 w-4" />
									<span className="hidden md:block">Show Controls</span>
								</>
							)}
						</TooltipTrigger>
						<TooltipContent side="right">
							<p className="text-nowrap">
								Toggle controls with{" "}
								<Kbd className="ml-1 text-muted-foreground group-hover:text-accent-foreground">
									<span className="mr-1">⌘</span>
									<span>B</span>
								</Kbd>
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<div className="block sm:hidden">
					<DataTableFilterControlsDrawer />
				</div>
				<div>
					<p className="hidden text-muted-foreground text-sm sm:block">
						<span className="font-medium font-mono">
							{formatCompactNumber(rows.filtered)}
						</span>{" "}
						of{" "}
						<span className="font-medium font-mono">
							{formatCompactNumber(rows.total)}
						</span>{" "}
						row(s) <span className="sr-only sm:not-sr-only">filtered</span>
					</p>
					<p className="block text-muted-foreground text-sm sm:hidden">
						<span className="font-medium font-mono">
							{formatCompactNumber(rows.filtered)}
						</span>{" "}
						row(s)
					</p>
				</div>
			</div>
			<div className="ml-auto flex items-center gap-2">
				{columnFilters.length ? <DataTableResetButton /> : null}
				{renderActions?.()}
				<DataTableViewOptions />
			</div>
		</div>
	);
}
