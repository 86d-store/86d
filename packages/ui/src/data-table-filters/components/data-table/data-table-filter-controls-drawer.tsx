"use client";

import { FunnelIcon as FilterIcon } from "@phosphor-icons/react/dist/ssr";
import React from "react";
import { Button } from "~/button";
import { DataTableFilterControls } from "~/data-table-filters/components/data-table/data-table-filter-controls";
import { TOOLTIP_DELAY } from "~/data-table-filters/components/data-table/ui-compat";
import { useHotKey } from "~/data-table-filters/hooks/use-hot-key";
import { useMediaQuery } from "~/data-table-filters/hooks/use-media-query";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "~/shadcn/drawer";
import { Kbd } from "~/shadcn/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/shadcn/tooltip";

export function DataTableFilterControlsDrawer() {
	const triggerButtonRef = React.useRef<HTMLButtonElement>(null);
	const isMobile = useMediaQuery("(max-width: 640px)");

	useHotKey(() => {
		triggerButtonRef.current?.click();
	}, "b");

	return (
		<Drawer>
			<TooltipProvider {...TOOLTIP_DELAY}>
				<Tooltip>
					<TooltipTrigger
						render={
							<DrawerTrigger
								render={
									<Button
										ref={isMobile ? triggerButtonRef : null}
										variant="ghost"
										size="icon"
										className="h-9 w-9"
									/>
								}
							/>
						}
					>
						<FilterIcon className="h-4 w-4" />
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
			<DrawerContent className="max-h-[calc(100dvh-4rem)]">
				<span className="sr-only">
					<DrawerHeader>
						<DrawerTitle>Filters</DrawerTitle>
						<DrawerDescription>Adjust your table filters</DrawerDescription>
					</DrawerHeader>
				</span>
				<div className="flex-1 overflow-y-auto px-4">
					<DataTableFilterControls />
				</div>
				<DrawerFooter>
					<DrawerClose render={<Button variant="outline" className="w-full" />}>
						Close
					</DrawerClose>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
