"use client";

import {
	columnFilteringFeature,
	columnVisibilityFeature,
	createColumnHelper,
	createFilteredRowModel,
	createSortedRowModel,
	filterFn_includesString,
	flexRender,
	globalFilteringFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_text,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { usePersistedTableState } from "./use-persisted-table-state";

export type ProductTableRow = {
	id: string;
	name: string;
	slug: string;
	price: number;
	status: "draft" | "active" | "archived";
	inventory: number;
	sku?: string | null;
	updatedAt: string;
};

const features = tableFeatures({
	columnFilteringFeature,
	globalFilteringFeature,
	columnVisibilityFeature,
	rowSortingFeature,
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	filterFns: {
		includesString: filterFn_includesString,
	},
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		text: sortFn_text,
	},
});

const columnHelper = createColumnHelper<typeof features, ProductTableRow>();

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function ProductRowActions({
	product,
	onDelete,
	deleting,
}: {
	product: ProductTableRow;
	onDelete: (id: string) => void;
	deleting: string | null;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className="relative sticky right-0">
			<button
				type="button"
				aria-label={`Actions for ${product.name}`}
				aria-expanded={open}
				className="rounded-md border border-border px-2 py-1 text-xs"
				onClick={() => setOpen((value) => !value)}
			>
				Actions
			</button>
			{open ? (
				<div className="absolute right-0 z-10 mt-1 min-w-36 rounded-md border border-border bg-card p-1 shadow-sm">
					<a
						href={`/admin/products/${product.id}`}
						className="block rounded px-2 py-1.5 text-sm hover:bg-muted"
						onClick={() => setOpen(false)}
					>
						Open
					</a>
					<a
						href={`/admin/products/${product.id}/edit`}
						className="block rounded px-2 py-1.5 text-sm hover:bg-muted"
						onClick={() => setOpen(false)}
					>
						Edit
					</a>
					<button
						type="button"
						className="block w-full rounded px-2 py-1.5 text-left text-destructive text-sm hover:bg-muted"
						disabled={deleting === product.id}
						onClick={() => {
							setOpen(false);
							onDelete(product.id);
						}}
					>
						{deleting === product.id ? "Deleting…" : "Delete"}
					</button>
				</div>
			) : null}
		</div>
	);
}

export interface ProductDataTableProps {
	data: ProductTableRow[];
	isLoading?: boolean;
	deleting?: string | null;
	onDelete: (id: string) => void;
	statusFilter: string;
	onStatusFilterChange: (value: string) => void;
}

export function ProductDataTable({
	data,
	isLoading = false,
	deleting = null,
	onDelete,
	statusFilter,
	onStatusFilterChange,
}: ProductDataTableProps) {
	const persisted = usePersistedTableState("store-admin.products");
	const columns = useMemo(
		() => [
			columnHelper.accessor("name", {
				header: "Name",
				cell: (info) => (
					<a
						href={`/admin/products/${info.row.original.id}`}
						className="font-medium hover:underline"
					>
						{info.getValue()}
					</a>
				),
				meta: { label: "Name" },
			}),
			columnHelper.accessor("status", {
				header: "Status",
				cell: (info) => info.getValue(),
				meta: { label: "Status" },
			}),
			columnHelper.accessor("price", {
				header: "Price",
				cell: (info) => formatPrice(info.getValue()),
				meta: { label: "Price" },
			}),
			columnHelper.accessor("inventory", {
				header: "Inventory",
				cell: (info) => info.getValue(),
				meta: { label: "Inventory" },
			}),
			columnHelper.accessor("sku", {
				header: "SKU",
				cell: (info) => info.getValue() ?? "—",
				meta: { label: "SKU" },
			}),
			columnHelper.display({
				id: "actions",
				header: () => <span className="sr-only">Actions</span>,
				cell: ({ row }) => (
					<ProductRowActions
						product={row.original}
						onDelete={onDelete}
						deleting={deleting}
					/>
				),
				enableHiding: false,
				enableSorting: false,
			}),
		],
		[deleting, onDelete],
	);

	const rows = useMemo(() => data, [data]);
	const table = useTable({
		features,
		data: rows,
		columns: columns as Parameters<
			typeof useTable<typeof features, ProductTableRow>
		>[0]["columns"],
		getRowId: (row) => row.id,
		state: {
			columnVisibility: persisted.state.columnVisibility,
			sorting: persisted.state.sorting,
			columnFilters: persisted.state.columnFilters,
			globalFilter: persisted.state.globalFilter,
		},
		onColumnVisibilityChange: persisted.onColumnVisibilityChange,
		onSortingChange: persisted.onSortingChange,
		onColumnFiltersChange: persisted.onColumnFiltersChange,
		onGlobalFilterChange: persisted.onGlobalFilterChange,
		initialState: {
			sorting: [{ id: "name", desc: false }],
		},
	});

	const hideable = table
		.getAllColumns()
		.filter((column) => column.getCanHide());
	const tableRows = table.getRowModel().rows;

	return (
		<div className="flex flex-col gap-3" data-testid="products-data-table">
			<div className="flex flex-wrap items-center gap-2">
				<input
					type="search"
					aria-label="Search products"
					placeholder="Search products..."
					value={
						typeof table.state.globalFilter === "string"
							? table.state.globalFilter
							: ""
					}
					onChange={(event) => table.setGlobalFilter(event.target.value)}
					className="max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm"
				/>
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(event) => onStatusFilterChange(event.target.value)}
					className="rounded-md border border-border bg-background px-3 py-2 text-sm"
				>
					<option value="">All statuses</option>
					<option value="draft">Draft</option>
					<option value="active">Active</option>
					<option value="archived">Archived</option>
				</select>
				<details className="relative">
					<summary className="cursor-pointer list-none rounded-md border border-border px-3 py-2 text-sm">
						Columns
					</summary>
					<div className="absolute z-10 mt-1 min-w-40 rounded-md border border-border bg-card p-2 shadow-sm">
						{hideable.map((column) => (
							<label
								key={column.id}
								className="flex items-center gap-2 px-1 py-1 text-sm"
							>
								<input
									type="checkbox"
									checked={column.getIsVisible()}
									onChange={(event) =>
										column.toggleVisibility(event.target.checked)
									}
								/>
								{column.id}
							</label>
						))}
					</div>
				</details>
			</div>
			<div className="overflow-hidden rounded-md border border-border">
				<table className="w-full table-fixed text-sm">
					<thead>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id} className="border-border border-b">
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className={
											header.column.id === "actions"
												? "sticky right-0 bg-muted/30 px-3 py-2 text-left font-medium"
												: "bg-muted/30 px-3 py-2 text-left font-medium"
										}
									>
										{header.isPlaceholder ? null : (
											<button
												type="button"
												className="inline-flex items-center gap-1"
												disabled={!header.column.getCanSort()}
												onClick={header.column.getToggleSortingHandler()}
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</button>
										)}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{isLoading ? (
							<tr>
								<td
									colSpan={Math.max(table.getVisibleLeafColumns().length, 1)}
									className="px-3 py-8 text-center text-muted-foreground"
								>
									Loading products…
								</td>
							</tr>
						) : tableRows.length === 0 ? (
							<tr>
								<td
									colSpan={Math.max(table.getVisibleLeafColumns().length, 1)}
									className="px-3 py-8 text-center text-muted-foreground"
								>
									No products found
								</td>
							</tr>
						) : (
							tableRows.map((row) => (
								<tr key={row.id} className="border-border border-b">
									{row.getVisibleCells().map((cell) => (
										<td
											key={cell.id}
											className={
												cell.column.id === "actions"
													? "sticky right-0 bg-card px-3 py-2"
													: "px-3 py-2"
											}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
