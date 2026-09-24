"use client";

import { XIcon as X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "~/button";
import { useDataTable } from "~/data-table-filters/components/data-table/data-table-context";
import { TOOLTIP_DELAY } from "~/data-table-filters/components/data-table/ui-compat";
import { useHotKey } from "~/data-table-filters/hooks/use-hot-key";
import { Kbd } from "~/shadcn/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/shadcn/tooltip";

export function DataTableResetButton() {
	const { table } = useDataTable();
	useHotKey(table.resetColumnFilters, "Escape");

	return (
		<TooltipProvider {...TOOLTIP_DELAY}>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							variant="ghost"
							onClick={() => table.resetColumnFilters()}
						/>
					}
				>
					<X className="mr-2 h-4 w-4" />
					Reset
				</TooltipTrigger>
				<TooltipContent side="left">
					<p className="text-nowrap">
						Reset filters with{" "}
						<Kbd className="ml-1 text-muted-foreground group-hover:text-accent-foreground">
							<span className="mr-1">⌘</span>
							<span>Esc</span>
						</Kbd>
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
