"use client";

import { Button } from "@86d-app/ui/button";
import { DataTableEmptyRow } from "@86d-app/ui/data-table/empty-row";
import { DataTableSkeletonRows } from "@86d-app/ui/data-table/skeleton-rows";
import { DataTableViewOptions } from "@86d-app/ui/data-table/view-options";
import { Input } from "@86d-app/ui/shadcn/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@86d-app/ui/shadcn/native-select";
import { Skeleton } from "@86d-app/ui/shadcn/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@86d-app/ui/shadcn/table";
import { Text } from "@86d-app/ui/text";
import { View } from "@86d-app/ui/view";
import { flexRender, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import type { AdminKioskStation } from "./kiosk-admin-types";
import { KIOSK_TABLE_PAGE_SIZE, kioskTableFeatures } from "./kiosk-table-model";
import { StationRegistrationBadge } from "./kiosk-table-presentation";
import { StationRowActions } from "./station-row-actions";
import { getStationTableColumns } from "./station-table-columns";
import type { KioskStationTableStateController } from "./use-persisted-kiosk-table-state";

const COLUMN_CLASSES: Readonly<Record<string, string>> = {
	name: "min-w-56",
	location: "min-w-48",
	isActive: "min-w-32",
	actions:
		"sticky right-0 z-10 min-w-24 border-border border-l bg-card text-right group-hover:bg-muted/50",
};

const MOBILE_SORT_OPTIONS = [
	{ label: "Name A-Z", id: "name", desc: false },
	{ label: "Name Z-A", id: "name", desc: true },
	{ label: "Location A-Z", id: "location", desc: false },
	{ label: "Location Z-A", id: "location", desc: true },
	{ label: "Enabled first", id: "isActive", desc: true },
	{ label: "Disabled first", id: "isActive", desc: false },
] as const;

function skeletonForColumn(columnId: string) {
	if (columnId === "actions") return <Skeleton className="ml-auto h-10 w-16" />;
	if (columnId === "isActive") return <Skeleton className="h-5 w-16" />;
	return <Skeleton className="h-4 w-28" />;
}

function StationEmptyState({
	search,
	activityFilter,
	onCreate,
}: {
	search: string;
	activityFilter: string;
	onCreate: () => void;
}) {
	const isFiltered = search.trim() !== "" || activityFilter !== "";
	return (
		<View className="flex min-h-36 flex-col items-center justify-center px-4 py-8 text-center">
			<Text variant="p" className="font-medium text-foreground text-sm">
				{search.trim()
					? "No stations match your search"
					: activityFilter
						? "No stations match this registration status"
						: "No stations yet"}
			</Text>
			<Text
				variant="p"
				className="mt-1 max-w-md text-pretty text-muted-foreground text-xs"
			>
				{isFiltered
					? "Change the search or registration filter to review other registrations."
					: "Add a station registration record."}
			</Text>
			{isFiltered ? null : (
				<Button type="button" onClick={onCreate} className="mt-4">
					Add station
				</Button>
			)}
		</View>
	);
}

function StationMobileSkeleton() {
	return (
		<View className="divide-y divide-border md:hidden">
			{["one", "two", "three"].map((key) => (
				<View key={key} className="space-y-3 px-4 py-4">
					<View className="flex items-start justify-between gap-4">
						<View className="space-y-2">
							<Skeleton className="h-4 w-36" />
							<Skeleton className="h-4 w-24" />
						</View>
						<Skeleton className="h-5 w-16" />
					</View>
					<Skeleton className="h-11 w-full" />
				</View>
			))}
		</View>
	);
}

export function StationDataTable({
	stations,
	total,
	isLoading,
	stateController,
	onCreate,
}: {
	stations: AdminKioskStation[];
	total: number;
	isLoading: boolean;
	stateController: KioskStationTableStateController;
	onCreate: () => void;
}) {
	const columns = useMemo(getStationTableColumns, []);
	const data = useMemo(() => stations, [stations]);
	const table = useTable({
		features: kioskTableFeatures,
		data,
		columns,
		getRowId: (station) => station.id,
		state: {
			columnVisibility: stateController.state.columnVisibility,
			sorting: stateController.state.sorting,
			globalFilter: stateController.state.globalFilter,
		},
		onColumnVisibilityChange: stateController.onColumnVisibilityChange,
		onSortingChange: stateController.onSortingChange,
		onGlobalFilterChange: stateController.onGlobalFilterChange,
		manualFiltering: true,
		manualSorting: true,
		enableMultiSort: false,
		enableSortingRemoval: false,
	});
	const rows = table.getRowModel().rows;
	const visibleColumnIds = table
		.getVisibleLeafColumns()
		.map((column) => column.id);
	const sorting = stateController.state.sorting[0] ?? {
		id: "name",
		desc: false,
	};
	const mobileSortValue = `${sorting.id}:${sorting.desc ? "desc" : "asc"}`;
	const isColumnVisible = (columnId: string) =>
		table.getColumn(columnId)?.getIsVisible() ?? true;
	const skip = stateController.state.pageIndex * KIOSK_TABLE_PAGE_SIZE;

	return (
		<View className="space-y-3" data-testid="kiosk-station-data-table">
			<View className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Input
					type="search"
					placeholder="Search stations..."
					aria-label="Search stations"
					value={stateController.state.globalFilter}
					onChange={(event) => table.setGlobalFilter(event.target.value)}
					disabled={isLoading}
					className="w-full sm:max-w-xs"
				/>
				<View className="flex min-w-0 flex-wrap items-center gap-2">
					<NativeSelect
						value={stateController.state.activityFilter}
						onChange={(event) =>
							stateController.onActivityFilterChange(event.target.value)
						}
						aria-label="Filter stations by registration status"
						disabled={isLoading}
					>
						<NativeSelectOption value="">All stations</NativeSelectOption>
						<NativeSelectOption value="true">Enabled only</NativeSelectOption>
						<NativeSelectOption value="false">Disabled only</NativeSelectOption>
					</NativeSelect>
					<NativeSelect
						value={mobileSortValue}
						onChange={(event) => {
							const selected = MOBILE_SORT_OPTIONS.find(
								(option) =>
									`${option.id}:${option.desc ? "desc" : "asc"}` ===
									event.target.value,
							);
							if (selected) {
								table.setSorting([{ id: selected.id, desc: selected.desc }]);
							}
						}}
						aria-label="Sort stations"
						disabled={isLoading}
						className="md:hidden"
					>
						{MOBILE_SORT_OPTIONS.map((option) => (
							<NativeSelectOption
								key={`${option.id}:${option.desc}`}
								value={`${option.id}:${option.desc ? "desc" : "asc"}`}
							>
								{option.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
					<DataTableViewOptions table={table} className="ml-0" />
				</View>
				<Text className="text-muted-foreground text-xs tabular-nums sm:ml-auto">
					{isLoading
						? "Loading stations..."
						: `${total} ${total === 1 ? "registration" : "registrations"}`}
				</Text>
			</View>

			<View className="hidden overflow-x-auto rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:block">
				<Table className="w-max min-w-full">
					<TableHeader className="bg-muted/40">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="hover:bg-transparent">
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className={
											header.column.id === "actions"
												? "sticky right-0 z-20 border-border border-l bg-muted px-3 text-right text-[11px] text-muted-foreground uppercase tracking-wide"
												: "px-3 first:pl-4"
										}
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<DataTableSkeletonRows
								columnIds={visibleColumnIds}
								cellClassName={(columnId) => COLUMN_CLASSES[columnId]}
								renderCell={skeletonForColumn}
							/>
						) : rows.length === 0 ? (
							<DataTableEmptyRow colSpan={Math.max(visibleColumnIds.length, 1)}>
								<StationEmptyState
									search={stateController.state.globalFilter}
									activityFilter={stateController.state.activityFilter}
									onCreate={onCreate}
								/>
							</DataTableEmptyRow>
						) : (
							rows.map((row) => (
								<TableRow key={row.id} className="group">
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className={`px-3 py-3 first:pl-4 ${COLUMN_CLASSES[cell.column.id] ?? ""}`}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</View>

			{isLoading ? (
				<StationMobileSkeleton />
			) : rows.length === 0 ? (
				<View className="rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:hidden">
					<StationEmptyState
						search={stateController.state.globalFilter}
						activityFilter={stateController.state.activityFilter}
						onCreate={onCreate}
					/>
				</View>
			) : (
				<View className="divide-y divide-border overflow-hidden rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:hidden">
					{rows.map((row) => {
						const station = row.original;
						return (
							<View key={row.id} className="space-y-3 px-4 py-4">
								<View className="flex items-start justify-between gap-4">
									<View className="min-w-0">
										{isColumnVisible("name") ? (
											<Text className="block truncate font-medium text-foreground text-sm">
												{station.name}
											</Text>
										) : null}
										{isColumnVisible("location") ? (
											<Text className="mt-1 block truncate text-muted-foreground text-xs">
												{station.location ?? "No location recorded"}
											</Text>
										) : null}
									</View>
									{isColumnVisible("isActive") ? (
										<StationRegistrationBadge enabled={station.isActive} />
									) : null}
								</View>
								<StationRowActions station={station} context="mobile" />
							</View>
						);
					})}
				</View>
			)}

			{total > KIOSK_TABLE_PAGE_SIZE ? (
				<View className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<Text className="text-muted-foreground text-sm tabular-nums">
						Showing {skip + 1}–{Math.min(skip + KIOSK_TABLE_PAGE_SIZE, total)}{" "}
						of {total}
					</Text>
					<View className="grid grid-cols-2 gap-2 sm:flex">
						<Button
							type="button"
							variant="outline"
							disabled={skip === 0 || isLoading}
							onClick={() =>
								stateController.setPageIndex(
									stateController.state.pageIndex - 1,
								)
							}
						>
							Previous
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={skip + KIOSK_TABLE_PAGE_SIZE >= total || isLoading}
							onClick={() =>
								stateController.setPageIndex(
									stateController.state.pageIndex + 1,
								)
							}
						>
							Next
						</Button>
					</View>
				</View>
			) : null}
		</View>
	);
}
