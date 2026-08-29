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
import type {
	AdminKioskSession,
	AdminKioskStationOption,
} from "./kiosk-admin-types";
import { KIOSK_TABLE_PAGE_SIZE, kioskTableFeatures } from "./kiosk-table-model";
import {
	formatKioskDate,
	SessionStatusBadge,
} from "./kiosk-table-presentation";
import { getSessionTableColumns } from "./session-table-columns";
import type { KioskSessionTableStateController } from "./use-persisted-kiosk-table-state";

const COLUMN_CLASSES: Readonly<Record<string, string>> = {
	id: "min-w-48",
	stationId: "min-w-48",
	status: "min-w-40",
	startedAt: "min-w-44",
};

const MOBILE_SORT_OPTIONS = [
	{ label: "Newest", id: "startedAt", desc: true },
	{ label: "Oldest", id: "startedAt", desc: false },
	{ label: "Session A-Z", id: "id", desc: false },
	{ label: "Session Z-A", id: "id", desc: true },
	{ label: "Status A-Z", id: "status", desc: false },
	{ label: "Status Z-A", id: "status", desc: true },
] as const;

function skeletonForColumn(columnId: string) {
	if (columnId === "status") return <Skeleton className="h-5 w-24" />;
	return <Skeleton className="h-4 w-28" />;
}

function SessionEmptyState({
	search,
	stationFilter,
	statusFilter,
}: {
	search: string;
	stationFilter: string;
	statusFilter: string;
}) {
	const isFiltered =
		search.trim() !== "" || stationFilter.trim() !== "" || statusFilter !== "";
	return (
		<View className="flex min-h-36 flex-col items-center justify-center px-4 py-8 text-center">
			<Text variant="p" className="font-medium text-foreground text-sm">
				{search.trim()
					? "No legacy session records match your search"
					: isFiltered
						? "No legacy session records match these filters"
						: "No legacy session records found"}
			</Text>
			<Text
				variant="p"
				className="mt-1 max-w-md text-pretty text-muted-foreground text-xs"
			>
				{isFiltered
					? "Change the search or filters to review other stored lifecycle records."
					: "No stored session lifecycle records are available to review."}
			</Text>
		</View>
	);
}

function SessionMobileSkeleton() {
	return (
		<View className="divide-y divide-border md:hidden">
			{["one", "two", "three"].map((key) => (
				<View key={key} className="space-y-3 px-4 py-4">
					<View className="flex items-start justify-between gap-4">
						<View className="space-y-2">
							<Skeleton className="h-4 w-44" />
							<Skeleton className="h-4 w-24" />
						</View>
						<Skeleton className="h-5 w-24" />
					</View>
				</View>
			))}
		</View>
	);
}

export function SessionDataTable({
	sessions,
	stationOptions,
	total,
	isLoading,
	stateController,
}: {
	sessions: AdminKioskSession[];
	stationOptions: AdminKioskStationOption[];
	total: number;
	isLoading: boolean;
	stateController: KioskSessionTableStateController;
}) {
	const stationNames = useMemo(
		() => new Map(stationOptions.map((station) => [station.id, station.name])),
		[stationOptions],
	);
	const columns = useMemo(
		() => getSessionTableColumns(stationNames),
		[stationNames],
	);
	const data = useMemo(() => sessions, [sessions]);
	const table = useTable({
		features: kioskTableFeatures,
		data,
		columns,
		getRowId: (session) => session.id,
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
		id: "startedAt",
		desc: true,
	};
	const mobileSortValue = `${sorting.id}:${sorting.desc ? "desc" : "asc"}`;
	const isColumnVisible = (columnId: string) =>
		table.getColumn(columnId)?.getIsVisible() ?? true;
	const skip = stateController.state.pageIndex * KIOSK_TABLE_PAGE_SIZE;

	return (
		<View className="space-y-3" data-testid="kiosk-session-data-table">
			<View className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Input
					type="search"
					placeholder="Search legacy sessions..."
					aria-label="Search legacy session records"
					value={stateController.state.globalFilter}
					onChange={(event) => table.setGlobalFilter(event.target.value)}
					disabled={isLoading}
					className="w-full sm:max-w-xs"
				/>
				<View className="flex min-w-0 flex-wrap items-center gap-2">
					<NativeSelect
						value={stateController.state.stationFilter}
						onChange={(event) =>
							stateController.onStationFilterChange(event.target.value)
						}
						aria-label="Filter legacy session records by station"
						disabled={isLoading}
					>
						<NativeSelectOption value="">All stations</NativeSelectOption>
						{stationOptions.map((station) => (
							<NativeSelectOption key={station.id} value={station.id}>
								{station.location
									? `${station.name} — ${station.location}`
									: station.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
					<NativeSelect
						aria-label="Filter legacy session records by status"
						value={stateController.state.statusFilter}
						onChange={(event) =>
							stateController.onStatusFilterChange(event.target.value)
						}
						disabled={isLoading}
					>
						<NativeSelectOption value="">All statuses</NativeSelectOption>
						<NativeSelectOption value="active">
							Legacy active
						</NativeSelectOption>
						<NativeSelectOption value="completed">
							Legacy completed
						</NativeSelectOption>
						<NativeSelectOption value="abandoned">
							Legacy abandoned
						</NativeSelectOption>
						<NativeSelectOption value="timed-out">
							Legacy timed out
						</NativeSelectOption>
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
						aria-label="Sort legacy session records"
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
						? "Loading records..."
						: `${total} ${total === 1 ? "record" : "records"}`}
				</Text>
			</View>

			<View className="hidden overflow-x-auto rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:block">
				<Table className="w-max min-w-full">
					<TableHeader className="bg-muted/40">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="hover:bg-transparent">
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id} className="px-3 first:pl-4">
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
								<SessionEmptyState
									search={stateController.state.globalFilter}
									stationFilter={stateController.state.stationFilter}
									statusFilter={stateController.state.statusFilter}
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
				<SessionMobileSkeleton />
			) : rows.length === 0 ? (
				<View className="rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:hidden">
					<SessionEmptyState
						search={stateController.state.globalFilter}
						stationFilter={stateController.state.stationFilter}
						statusFilter={stateController.state.statusFilter}
					/>
				</View>
			) : (
				<View className="divide-y divide-border overflow-hidden rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:hidden">
					{rows.map((row) => {
						const session = row.original;
						return (
							<View key={row.id} className="space-y-3 px-4 py-4">
								<View className="flex items-start justify-between gap-4">
									<View className="min-w-0">
										{isColumnVisible("id") ? (
											<Text className="block truncate font-mono text-foreground text-xs">
												{session.id}
											</Text>
										) : null}
										{isColumnVisible("stationId") ? (
											<Text className="mt-1 block truncate text-muted-foreground text-xs">
												{stationNames.get(session.stationId) ??
													session.stationId.slice(0, 8)}
											</Text>
										) : null}
									</View>
									{isColumnVisible("status") ? (
										<SessionStatusBadge status={session.status} />
									) : null}
								</View>
								{isColumnVisible("startedAt") ? (
									<Text className="text-muted-foreground text-xs tabular-nums">
										Started {formatKioskDate(session.startedAt)}
									</Text>
								) : null}
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
