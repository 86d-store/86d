"use client";

import { Button } from "@86d-app/ui/button";
import { DataTableEmptyRow } from "@86d-app/ui/data-table/empty-row";
import { DataTableSkeletonRows } from "@86d-app/ui/data-table/skeleton-rows";
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
	GiftCardAdminRecord,
	GiftCardAdminSortField,
} from "./gift-card-admin-types";
import { formatGiftCardCurrency, formatGiftCardDate } from "./gift-card-format";
import { GiftCardRowActions } from "./gift-card-row-actions";
import { GiftCardStatusBadge } from "./gift-card-status-badge";
import { getGiftCardTableColumns } from "./gift-card-table-columns";
import {
	getGiftCardServerSort,
	giftCardTableFeatures,
} from "./gift-card-table-model";
import type { GiftCardTableStateController } from "./use-persisted-gift-card-table-state";

const COLUMN_CLASSES: Readonly<Record<string, string>> = {
	code: "min-w-52",
	balance: "min-w-44",
	status: "min-w-32",
	recipient: "min-w-56 max-w-72 truncate",
	createdAt: "min-w-36",
	details:
		"sticky right-0 z-10 min-w-28 border-border border-l bg-card text-right group-hover:bg-muted/50",
};

const MOBILE_SORT_OPTIONS: ReadonlyArray<{
	label: string;
	sort: GiftCardAdminSortField;
	direction: "asc" | "desc";
}> = [
	{ label: "Newest", sort: "createdAt", direction: "desc" },
	{ label: "Oldest", sort: "createdAt", direction: "asc" },
	{ label: "Code A-Z", sort: "code", direction: "asc" },
	{ label: "Code Z-A", sort: "code", direction: "desc" },
	{ label: "Highest balance", sort: "balance", direction: "desc" },
	{ label: "Lowest balance", sort: "balance", direction: "asc" },
	{ label: "Status A-Z", sort: "status", direction: "asc" },
	{ label: "Status Z-A", sort: "status", direction: "desc" },
	{ label: "Recipient A-Z", sort: "recipient", direction: "asc" },
	{ label: "Recipient Z-A", sort: "recipient", direction: "desc" },
];

function skeletonForColumn(columnId: string) {
	if (columnId === "details") {
		return <Skeleton className="ml-auto h-10 w-20" />;
	}
	if (columnId === "status") return <Skeleton className="h-5 w-16" />;
	if (columnId === "recipient") return <Skeleton className="h-4 w-36" />;
	return <Skeleton className="h-4 w-24" />;
}

export interface GiftCardEmptyStateCopy {
	title: string;
	description: string;
}

export function getGiftCardEmptyStateCopy({
	search,
	statusFilter,
}: {
	search: string;
	statusFilter: string;
}): GiftCardEmptyStateCopy {
	if (search.trim()) {
		return {
			title: "No gift cards match your search",
			description: "Try another code, recipient, status, or date.",
		};
	}
	if (statusFilter) {
		return {
			title: "No gift cards match this status",
			description: "Choose another status to review available records.",
		};
	}
	return {
		title: "No gift cards found",
		description: "No issued gift card records are available to review.",
	};
}

function GiftCardEmptyState({
	copy,
	context,
}: {
	copy: GiftCardEmptyStateCopy;
	context: "desktop" | "mobile";
}) {
	return (
		<View
			className="flex min-h-32 flex-col items-center justify-center px-4 py-8 text-center"
			data-testid={`gift-card-list-empty-${context}`}
		>
			<Text variant="p" className="font-medium text-foreground text-sm">
				{copy.title}
			</Text>
			<Text
				variant="p"
				className="mt-1 max-w-md text-pretty text-muted-foreground text-sm"
			>
				{copy.description}
			</Text>
		</View>
	);
}

function GiftCardMobileSkeleton() {
	return (
		<View
			className="divide-y divide-border md:hidden"
			data-testid="gift-card-list-loading-mobile"
		>
			{["one", "two", "three"].map((key) => (
				<View key={key} className="space-y-3 px-4 py-4">
					<View className="flex items-start justify-between gap-4">
						<View className="space-y-2">
							<Skeleton className="h-4 w-44" />
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

export interface GiftCardDataTableProps {
	cards: GiftCardAdminRecord[];
	total: number;
	isLoading?: boolean;
	pageSize: number;
	skip: number;
	stateController: GiftCardTableStateController;
	onStatusFilterChange: (value: string) => void;
	onView: (id: string) => void;
	onPreviousPage: () => void;
	onNextPage: () => void;
}

export function GiftCardDataTable({
	cards,
	total,
	isLoading = false,
	pageSize,
	skip,
	stateController,
	onStatusFilterChange,
	onView,
	onPreviousPage,
	onNextPage,
}: GiftCardDataTableProps) {
	const columns = useMemo(() => getGiftCardTableColumns(onView), [onView]);
	const data = useMemo(() => cards, [cards]);
	const table = useTable({
		features: giftCardTableFeatures,
		data,
		columns,
		getRowId: (card) => card.id,
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
	const search = stateController.state.globalFilter;
	const statusFilter = stateController.state.statusFilter;
	const emptyCopy = getGiftCardEmptyStateCopy({ search, statusFilter });
	const hideableColumns = table
		.getAllColumns()
		.filter((column) => column.getCanHide());
	const serverSort = getGiftCardServerSort(stateController.state.sorting);
	const mobileSortValue = `${serverSort.sort}:${serverSort.direction}`;
	const isColumnVisible = (columnId: string) =>
		table.getColumn(columnId)?.getIsVisible() ?? true;

	return (
		<View className="space-y-3" data-testid="gift-card-data-table">
			<View className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Input
					type="search"
					aria-label="Search gift cards"
					placeholder="Search gift cards..."
					value={search}
					onChange={(event) => table.setGlobalFilter(event.target.value)}
					disabled={isLoading}
					data-testid="gift-card-search"
					className="h-10 w-full sm:max-w-xs"
				/>
				<View className="flex min-w-0 flex-wrap items-center gap-2">
					<NativeSelect
						value={statusFilter}
						onChange={(event) => onStatusFilterChange(event.target.value)}
						aria-label="Filter gift cards by status"
						disabled={isLoading}
						data-testid="gift-card-status-filter"
						className="min-w-0 flex-1 sm:flex-none"
					>
						<NativeSelectOption value="">All statuses</NativeSelectOption>
						<NativeSelectOption value="active">Active</NativeSelectOption>
						<NativeSelectOption value="disabled">Disabled</NativeSelectOption>
						<NativeSelectOption value="expired">Expired</NativeSelectOption>
						<NativeSelectOption value="depleted">Depleted</NativeSelectOption>
					</NativeSelect>
					<NativeSelect
						value={mobileSortValue}
						onChange={(event) => {
							const selected = MOBILE_SORT_OPTIONS.find(
								(option) =>
									`${option.sort}:${option.direction}` === event.target.value,
							);
							if (selected) {
								table.setSorting([
									{
										id: selected.sort,
										desc: selected.direction === "desc",
									},
								]);
							}
						}}
						aria-label="Sort gift cards"
						disabled={isLoading}
						data-testid="gift-card-mobile-sort"
						className="min-w-0 flex-1 md:hidden"
					>
						{MOBILE_SORT_OPTIONS.map((option) => (
							<NativeSelectOption
								key={`${option.sort}:${option.direction}`}
								value={`${option.sort}:${option.direction}`}
							>
								{option.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
					<details
						className="relative"
						data-testid="gift-card-column-visibility"
					>
						<summary className="flex h-10 cursor-pointer list-none items-center rounded-md border border-border bg-background px-3 font-medium text-sm shadow-xs hover:bg-muted">
							Columns
						</summary>
						<View className="absolute right-0 z-30 mt-1 min-w-48 rounded-md border border-border bg-card p-2 shadow-md">
							<Text className="block px-1 pb-1 font-medium text-muted-foreground text-xs">
								Toggle columns
							</Text>
							{hideableColumns.map((column) => {
								const meta = column.columnDef.meta as
									| { label?: string }
									| undefined;
								return (
									<label
										key={column.id}
										className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-muted"
									>
										<input
											type="checkbox"
											checked={column.getIsVisible()}
											onChange={(event) =>
												column.toggleVisibility(event.target.checked)
											}
										/>
										{meta?.label ?? column.id}
									</label>
								);
							})}
						</View>
					</details>
				</View>
				<Text className="hidden items-center gap-1 text-muted-foreground text-xs tabular-nums sm:inline-flex">
					{isLoading ? (
						"Loading cards..."
					) : (
						<>
							<span className="font-medium text-foreground">{total}</span>{" "}
							{total === 1 ? "card" : "cards"}
						</>
					)}
				</Text>
			</View>

			<View
				className="hidden overflow-x-auto rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:block"
				data-testid="gift-card-list-scroll-region"
			>
				<Table
					className="w-max min-w-full"
					data-testid="gift-card-list-desktop"
				>
					<TableHeader className="bg-muted/40">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="hover:bg-transparent">
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className={
											header.column.id === "details"
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
					<TableBody data-testid="gift-card-list-body">
						{isLoading ? (
							<DataTableSkeletonRows
								columnIds={visibleColumnIds}
								cellClassName={(columnId) => COLUMN_CLASSES[columnId]}
								renderCell={skeletonForColumn}
							/>
						) : rows.length === 0 ? (
							<DataTableEmptyRow colSpan={Math.max(visibleColumnIds.length, 1)}>
								<GiftCardEmptyState copy={emptyCopy} context="desktop" />
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
				<GiftCardMobileSkeleton />
			) : rows.length === 0 ? (
				<View className="rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:hidden">
					<GiftCardEmptyState copy={emptyCopy} context="mobile" />
				</View>
			) : (
				<View
					className="divide-y divide-border overflow-hidden rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:hidden"
					data-testid="gift-card-list-mobile"
				>
					{rows.map((row) => {
						const card = row.original;
						const showPrimary =
							isColumnVisible("code") ||
							isColumnVisible("balance") ||
							isColumnVisible("status");
						const showSecondary =
							isColumnVisible("recipient") || isColumnVisible("createdAt");
						return (
							<View key={row.id} className="space-y-3 px-4 py-4">
								{showPrimary ? (
									<View className="flex items-start justify-between gap-4">
										<View className="min-w-0">
											{isColumnVisible("code") ? (
												<Text className="block truncate font-medium font-mono text-foreground text-sm">
													{card.code}
												</Text>
											) : null}
											{isColumnVisible("balance") ? (
												<Text className="mt-1 block text-muted-foreground text-sm tabular-nums">
													{formatGiftCardCurrency(
														card.currentBalance,
														card.currency,
													)}
												</Text>
											) : null}
										</View>
										{isColumnVisible("status") ? (
											<GiftCardStatusBadge status={card.status} />
										) : null}
									</View>
								) : null}
								{showSecondary ? (
									<View className="flex items-end justify-between gap-3 text-muted-foreground text-xs">
										{isColumnVisible("recipient") ? (
											<Text className="min-w-0 truncate">
												{card.recipientEmail ?? "No recipient recorded"}
											</Text>
										) : null}
										{isColumnVisible("createdAt") ? (
											<Text className="shrink-0 tabular-nums">
												{formatGiftCardDate(card.createdAt)}
											</Text>
										) : null}
									</View>
								) : null}
								<GiftCardRowActions
									card={card}
									onView={onView}
									context="mobile"
								/>
							</View>
						);
					})}
				</View>
			)}

			{total > pageSize ? (
				<View className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<Text className="text-muted-foreground text-sm tabular-nums">
						Showing {skip + 1}–{Math.min(skip + pageSize, total)} of {total}
					</Text>
					<View className="grid grid-cols-2 gap-2 sm:flex">
						<Button
							type="button"
							variant="outline"
							onClick={onPreviousPage}
							disabled={skip === 0 || isLoading}
							data-testid="gift-card-previous-page"
							className="min-h-11 sm:min-h-10"
						>
							Previous
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={onNextPage}
							disabled={skip + pageSize >= total || isLoading}
							data-testid="gift-card-next-page"
							className="min-h-11 sm:min-h-10"
						>
							Next
						</Button>
					</View>
				</View>
			) : null}
		</View>
	);
}
