"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductListTemplate from "./product-list.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
	id: string;
	name: string;
	slug: string;
	price: number;
	compareAtPrice?: number | null;
	costPrice?: number | null;
	sku?: string | null;
	barcode?: string | null;
	description?: string | null;
	shortDescription?: string | null;
	status: "draft" | "active" | "archived";
	inventory: number;
	trackInventory?: boolean;
	allowBackorder?: boolean;
	isFeatured: boolean;
	images: string[];
	tags: string[];
	categoryId?: string | null;
	weight?: number | null;
	weightUnit?: string | null;
	createdAt: string;
	updatedAt: string;
}

interface Category {
	id: string;
	name: string;
	slug: string;
}

interface ListResult {
	products: Product[];
	total: number;
	page: number;
	limit: number;
}

interface CategoriesResult {
	categories: Category[];
	total: number;
}

interface ImportError {
	row: number;
	field: string;
	message: string;
}

interface ImportResult {
	created: number;
	updated: number;
	errors: ImportError[];
}

// ─── Module Client ───────────────────────────────────────────────────────────

function useProductsAdminApi() {
	const client = useModuleClient();
	return {
		listProducts: client.module("products").admin["/admin/products/list"],
		deleteProduct:
			client.module("products").admin["/admin/products/:id/delete"],
		listCategories: client.module("products").admin["/admin/categories/list"],
		importProducts: client.module("products").admin["/admin/products/import"],
		bulkAction: client.module("products").admin["/admin/products/bulk"],
	};
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

const statusStyles: Record<string, string> = {
	draft: "bg-muted text-muted-foreground",
	active:
		"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	archived:
		"bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

// ─── CSV Utilities ───────────────────────────────────────────────────────────

function escapeCsvField(value: string): string {
	if (value.includes(",") || value.includes('"') || value.includes("\n")) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function downloadCsv(filename: string, rows: string[][]): void {
	const csv = rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let current = "";
	let inQuotes = false;
	let row: string[] = [];

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (inQuotes) {
			if (ch === '"') {
				if (i + 1 < text.length && text[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ",") {
			row.push(current.trim());
			current = "";
		} else if (ch === "\n" || ch === "\r") {
			if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
				i++;
			}
			row.push(current.trim());
			current = "";
			if (row.some((cell) => cell !== "")) {
				rows.push(row);
			}
			row = [];
		} else {
			current += ch;
		}
	}
	// Last row
	row.push(current.trim());
	if (row.some((cell) => cell !== "")) {
		rows.push(row);
	}
	return rows;
}

const CSV_HEADERS = [
	"Name",
	"Slug",
	"SKU",
	"Barcode",
	"Price",
	"Compare At Price",
	"Cost Price",
	"Inventory",
	"Status",
	"Category",
	"Tags",
	"Weight",
	"Weight Unit",
	"Featured",
	"Track Inventory",
	"Allow Backorder",
	"Description",
	"Short Description",
];

const HEADER_MAP: Record<string, string> = {
	name: "name",
	slug: "slug",
	sku: "sku",
	barcode: "barcode",
	price: "price",
	"compare at price": "compareAtPrice",
	compareatprice: "compareAtPrice",
	compare_at_price: "compareAtPrice",
	"cost price": "costPrice",
	costprice: "costPrice",
	cost_price: "costPrice",
	inventory: "inventory",
	stock: "inventory",
	quantity: "inventory",
	status: "status",
	category: "category",
	tags: "tags",
	weight: "weight",
	"weight unit": "weightUnit",
	weightunit: "weightUnit",
	weight_unit: "weightUnit",
	featured: "featured",
	"is featured": "featured",
	"track inventory": "trackInventory",
	trackinventory: "trackInventory",
	track_inventory: "trackInventory",
	"allow backorder": "allowBackorder",
	allowbackorder: "allowBackorder",
	allow_backorder: "allowBackorder",
	description: "description",
	"short description": "shortDescription",
	shortdescription: "shortDescription",
	short_description: "shortDescription",
};

function rowToProduct(
	headers: string[],
	values: string[],
): Record<string, unknown> {
	const product: Record<string, unknown> = {};

	for (let i = 0; i < headers.length; i++) {
		const header = headers[i].toLowerCase().trim();
		const field = HEADER_MAP[header];
		if (!field || i >= values.length) continue;

		const val = values[i];
		if (val === "") continue;

		switch (field) {
			case "price":
			case "compareAtPrice":
			case "costPrice":
			case "weight":
				product[field] = val;
				break;
			case "inventory":
				product[field] = val;
				break;
			case "featured":
			case "trackInventory":
			case "allowBackorder":
				product[field] =
					val.toLowerCase() === "true" ||
					val.toLowerCase() === "yes" ||
					val === "1";
				break;
			case "tags":
				product[field] = val
					.split(/[;|]/)
					.map((t) => t.trim())
					.filter(Boolean);
				break;
			default:
				product[field] = val;
				break;
		}
	}

	return product;
}

// ─── Import Dialog ───────────────────────────────────────────────────────────

function ImportDialog({
	onClose,
	onImport,
}: {
	onClose: () => void;
	onImport: (products: Record<string, unknown>[]) => Promise<ImportResult>;
}) {
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);
	const fileRef = useRef<HTMLInputElement>(null);
	const [preview, setPreview] = useState<{
		headers: string[];
		rows: Array<Record<string, unknown> & { _rowId: string }>;
	} | null>(null);
	const [importing, setImporting] = useState(false);
	const [result, setResult] = useState<ImportResult | null>(null);
	const [parseError, setParseError] = useState<string | null>(null);

	const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setParseError(null);
		setResult(null);

		const reader = new FileReader();
		reader.onload = (ev) => {
			const text = ev.target?.result;
			if (typeof text !== "string") return;

			const parsed = parseCsv(text);
			if (parsed.length < 2) {
				setParseError("CSV must have at least a header row and one data row.");
				return;
			}

			const headers = parsed[0];
			const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

			// Verify required columns
			const hasName = normalizedHeaders.some((h) => HEADER_MAP[h] === "name");
			const hasPrice = normalizedHeaders.some((h) => HEADER_MAP[h] === "price");

			if (!hasName || !hasPrice) {
				setParseError('CSV must include at least "Name" and "Price" columns.');
				return;
			}

			const dataRows = parsed.slice(1);
			const products = dataRows.map((row, rowIdx) => ({
				...rowToProduct(headers, row),
				_rowId: `csv-row-${rowIdx}-${row.join("|").slice(0, 50)}`,
			}));

			setPreview({ headers, rows: products });
		};
		reader.readAsText(file);
	}, []);

	const handleImport = useCallback(async () => {
		if (!preview) return;
		setImporting(true);
		try {
			const importResult = await onImport(
				preview.rows.map(({ _rowId: _unused, ...row }) => row),
			);
			setResult(importResult);
		} finally {
			setImporting(false);
		}
	}, [preview, onImport]);

	const handleDownloadTemplate = useCallback(() => {
		const sampleRow = [
			"Example Product",
			"example-product",
			"SKU-001",
			"",
			"29.99",
			"39.99",
			"15.00",
			"100",
			"draft",
			"Electronics",
			"tag1;tag2",
			"0.5",
			"kg",
			"false",
			"true",
			"false",
			"A great product for testing",
			"Short desc",
		];
		downloadCsv("products-template.csv", [CSV_HEADERS, sampleRow]);
	}, []);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl"
			>
				<div className="flex items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						Import Products
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M18 6 6 18" />
							<path d="m6 6 12 12" />
						</svg>
					</button>
				</div>

				<div className="space-y-4 px-6 py-4">
					{!result ? (
						<>
							<div className="space-y-2">
								<p className="text-muted-foreground text-sm">
									Upload a CSV file with product data. Required columns:{" "}
									<strong>Name</strong> and <strong>Price</strong> (in dollars).
									Products with a matching SKU will be updated.
								</p>
								<button
									type="button"
									onClick={handleDownloadTemplate}
									className="text-foreground text-sm underline underline-offset-2 hover:no-underline"
								>
									Download template CSV
								</button>
							</div>

							<div>
								<input
									ref={fileRef}
									type="file"
									accept=".csv,text/csv"
									onChange={handleFile}
									className="block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:font-medium file:text-foreground file:text-sm"
								/>
							</div>

							{parseError && (
								<p className="text-destructive text-sm">{parseError}</p>
							)}

							{preview && (
								<div className="space-y-3">
									<p className="font-medium text-foreground text-sm">
										{preview.rows.length}{" "}
										{preview.rows.length === 1 ? "product" : "products"} found
										in CSV
									</p>

									<div className="max-h-48 overflow-auto rounded-md border border-border">
										<table className="w-full text-xs">
											<thead>
												<tr className="border-border border-b bg-muted/50">
													<th
														scope="col"
														className="px-3 py-2 text-left font-medium text-muted-foreground"
													>
														Row
													</th>
													<th
														scope="col"
														className="px-3 py-2 text-left font-medium text-muted-foreground"
													>
														Name
													</th>
													<th
														scope="col"
														className="px-3 py-2 text-left font-medium text-muted-foreground"
													>
														Price
													</th>
													<th
														scope="col"
														className="px-3 py-2 text-left font-medium text-muted-foreground"
													>
														SKU
													</th>
													<th
														scope="col"
														className="px-3 py-2 text-left font-medium text-muted-foreground"
													>
														Status
													</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-border">
												{preview.rows.slice(0, 10).map((row, i) => (
													<tr key={row._rowId}>
														<td className="px-3 py-1.5 text-muted-foreground">
															{i + 1}
														</td>
														<td className="px-3 py-1.5 text-foreground">
															{String(row.name || "—")}
														</td>
														<td className="px-3 py-1.5 text-foreground">
															${String(row.price || "—")}
														</td>
														<td className="px-3 py-1.5 text-muted-foreground">
															{String(row.sku || "—")}
														</td>
														<td className="px-3 py-1.5 text-muted-foreground">
															{String(row.status || "draft")}
														</td>
													</tr>
												))}
												{preview.rows.length > 10 && (
													<tr>
														<td
															colSpan={5}
															className="px-3 py-1.5 text-center text-muted-foreground"
														>
															...and {preview.rows.length - 10} more
														</td>
													</tr>
												)}
											</tbody>
										</table>
									</div>

									<button
										type="button"
										onClick={() => void handleImport()}
										disabled={importing}
										className="rounded-md bg-foreground px-4 py-2 font-semibold text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
									>
										{importing
											? "Importing..."
											: `Import ${preview.rows.length} products`}
									</button>
								</div>
							)}
						</>
					) : (
						<div className="space-y-3">
							<div className="space-y-1">
								{result.created > 0 && (
									<p className="font-medium text-emerald-600 text-sm dark:text-emerald-400">
										{result.created}{" "}
										{result.created === 1 ? "product" : "products"} created
									</p>
								)}
								{result.updated > 0 && (
									<p className="font-medium text-blue-600 text-sm dark:text-blue-400">
										{result.updated}{" "}
										{result.updated === 1 ? "product" : "products"} updated
									</p>
								)}
								{result.errors.length > 0 && (
									<div>
										<p className="font-medium text-destructive text-sm">
											{result.errors.length}{" "}
											{result.errors.length === 1 ? "error" : "errors"}
										</p>
										<ul className="mt-1 list-inside list-disc text-destructive text-xs">
											{result.errors.map((err) => (
												<li
													key={`import-error-${err.row}-${err.field}-${err.message}`}
												>
													Row {err.row}: {err.message}
													{err.field !== "unknown" && ` (${err.field})`}
												</li>
											))}
										</ul>
									</div>
								)}
								{result.created === 0 &&
									result.updated === 0 &&
									result.errors.length === 0 && (
										<p className="text-muted-foreground text-sm">
											No products were imported.
										</p>
									)}
							</div>

							<button
								type="button"
								onClick={onClose}
								className="rounded-md bg-foreground px-4 py-2 font-semibold text-background text-sm transition-opacity hover:opacity-90"
							>
								Done
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ─── ProductList ──────────────────────────────────────────────────────────────

export function ProductList() {
	const api = useProductsAdminApi();

	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");
	const [category, setCategory] = useState("");
	const [deleting, setDeleting] = useState<string | null>(null);
	const [exporting, setExporting] = useState(false);
	const [showImport, setShowImport] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkProcessing, setBulkProcessing] = useState(false);

	const limit = 20;

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(limit),
		sort: "createdAt",
		order: "desc",
	};
	if (search) queryInput.search = search;
	if (status) queryInput.status = status;
	if (category) queryInput.category = category;

	const {
		data: productsData,
		isLoading: loading,
		isError: productsError,
		refetch: refetchProducts,
	} = api.listProducts.useQuery(queryInput) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: categoriesData } = api.listCategories.useQuery({
		limit: "100",
	}) as { data: CategoriesResult | undefined; isLoading: boolean };

	const deleteMutation = api.deleteProduct.useMutation({
		onSettled: () => {
			setDeleting(null);
			void api.listProducts.invalidate();
		},
	});

	const bulkMutation = api.bulkAction.useMutation({
		onSettled: () => {
			setBulkProcessing(false);
			setSelected(new Set());
			void api.listProducts.invalidate();
		},
	});

	const products = productsData?.products ?? [];
	const total = productsData?.total ?? 0;
	const categories = categoriesData?.categories ?? [];
	const totalPages = Math.ceil(total / limit);
	const allOnPageSelected =
		products.length > 0 && products.every((p) => selected.has(p.id));

	const toggleSelect = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (allOnPageSelected) {
			setSelected((prev) => {
				const next = new Set(prev);
				for (const p of products) next.delete(p.id);
				return next;
			});
		} else {
			setSelected((prev) => {
				const next = new Set(prev);
				for (const p of products) next.add(p.id);
				return next;
			});
		}
	};

	const handleBulkStatus = (newStatus: "draft" | "active" | "archived") => {
		if (selected.size === 0) return;
		setBulkProcessing(true);
		bulkMutation.mutate({
			action: "updateStatus",
			ids: Array.from(selected),
			status: newStatus,
		});
	};

	const handleBulkDelete = () => {
		if (selected.size === 0) return;
		if (
			!window.confirm(
				`Are you sure you want to delete ${selected.size} ${selected.size === 1 ? "product" : "products"}?`,
			)
		) {
			return;
		}
		setBulkProcessing(true);
		bulkMutation.mutate({
			action: "delete",
			ids: Array.from(selected),
		});
	};

	// Build a category lookup for export
	const categoryNameById = new Map<string, string>();
	for (const c of categories) {
		categoryNameById.set(c.id, c.name);
	}

	const handleDelete = (id: string) => {
		if (!window.confirm("Are you sure you want to delete this product?")) {
			return;
		}
		setDeleting(id);
		deleteMutation.mutate({ params: { id } });
	};

	const handleExport = useCallback(async () => {
		setExporting(true);
		try {
			const exportQuery: Record<string, string> = { limit: "500" };
			if (search) exportQuery.search = search;
			if (status) exportQuery.status = status;
			if (category) exportQuery.category = category;

			const result = (await api.listProducts.fetch(exportQuery)) as
				| ListResult
				| undefined;
			const exportProducts = result?.products ?? [];

			if (exportProducts.length === 0) return;

			const dataRows = exportProducts.map((p) => [
				p.name,
				p.slug,
				p.sku ?? "",
				p.barcode ?? "",
				(p.price / 100).toFixed(2),
				p.compareAtPrice ? (p.compareAtPrice / 100).toFixed(2) : "",
				p.costPrice ? (p.costPrice / 100).toFixed(2) : "",
				String(p.inventory),
				p.status,
				p.categoryId ? (categoryNameById.get(p.categoryId) ?? "") : "",
				(p.tags ?? []).join(";"),
				p.weight != null ? String(p.weight) : "",
				p.weightUnit ?? "",
				String(p.isFeatured),
				String(p.trackInventory ?? true),
				String(p.allowBackorder ?? false),
				p.description ?? "",
				p.shortDescription ?? "",
			]);

			const dateStr = new Date().toISOString().slice(0, 10);
			downloadCsv(`products-${dateStr}.csv`, [CSV_HEADERS, ...dataRows]);
		} finally {
			setExporting(false);
		}
	}, [api.listProducts, search, status, category, categoryNameById]);

	const handleImport = useCallback(
		async (rows: Record<string, unknown>[]): Promise<ImportResult> => {
			const result = (await api.importProducts.fetch({
				products: rows,
			})) as ImportResult;
			void api.listProducts.invalidate();
			return result;
		},
		[api.importProducts, api.listProducts],
	);

	if (productsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load products
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchProducts()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const content = (
		<div>
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-foreground text-lg">Products</h1>
					{total > 0 && (
						<p className="mt-1 text-muted-foreground text-sm">
							{total} {total === 1 ? "product" : "products"} total
						</p>
					)}
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowImport(true)}
						className="flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="17 8 12 3 7 8" />
							<line x1="12" x2="12" y1="3" y2="15" />
						</svg>
						Import
					</button>
					<button
						type="button"
						disabled={exporting || total === 0}
						onClick={() => void handleExport()}
						className="flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" x2="12" y1="15" y2="3" />
						</svg>
						{exporting ? "Exporting..." : "Export"}
					</button>
					<a
						href="/admin/products/new"
						className="rounded-md bg-foreground px-4 py-2 font-semibold text-background text-sm transition-opacity hover:opacity-90"
					>
						New product
					</a>
				</div>
			</div>

			{/* Filters */}
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<input
					type="search"
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
					placeholder="Search products..."
					aria-label="Search products"
					className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>

				<select
					value={status}
					onChange={(e) => {
						setStatus(e.target.value);
						setPage(1);
					}}
					className="rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					aria-label="Filter by status"
				>
					<option value="">All statuses</option>
					<option value="draft">Draft</option>
					<option value="active">Active</option>
					<option value="archived">Archived</option>
				</select>

				{categories.length > 0 && (
					<select
						value={category}
						onChange={(e) => {
							setCategory(e.target.value);
							setPage(1);
						}}
						aria-label="Filter by category"
						className="rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="">All categories</option>
						{categories.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</select>
				)}
			</div>

			{/* Bulk Action Bar */}
			{selected.size > 0 && (
				<div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
					<span className="font-medium text-foreground text-sm">
						{selected.size} {selected.size === 1 ? "product" : "products"}{" "}
						selected
					</span>
					<div className="ml-auto flex items-center gap-2">
						<button
							type="button"
							disabled={bulkProcessing}
							onClick={() => handleBulkStatus("active")}
							className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							Set Active
						</button>
						<button
							type="button"
							disabled={bulkProcessing}
							onClick={() => handleBulkStatus("draft")}
							className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
						>
							Set Draft
						</button>
						<button
							type="button"
							disabled={bulkProcessing}
							onClick={() => handleBulkStatus("archived")}
							className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
						>
							Archive
						</button>
						<button
							type="button"
							disabled={bulkProcessing}
							onClick={handleBulkDelete}
							className="rounded-md bg-destructive px-3 py-1.5 font-medium text-destructive-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{bulkProcessing ? "Processing..." : "Delete"}
						</button>
						<button
							type="button"
							onClick={() => setSelected(new Set())}
							className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{/* Table */}
			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/50">
								<th scope="col" className="w-10 px-4 py-3">
									<input
										type="checkbox"
										checked={allOnPageSelected}
										onChange={toggleSelectAll}
										disabled={products.length === 0}
										className="h-4 w-4 rounded border-border text-foreground"
										aria-label="Select all products on this page"
									/>
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Image
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Name
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Price
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Inventory
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Created
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{loading ? (
								Array.from(
									{ length: 5 },
									(_, i) => `product-list-skel-${i}`,
								).map((id) => (
									<tr key={id}>
										<td className="px-4 py-3">
											<div className="h-4 w-4 animate-pulse rounded bg-muted" />
										</td>
										<td className="px-4 py-3">
											<div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
										</td>
										<td className="px-4 py-3">
											<div className="h-4 w-32 animate-pulse rounded bg-muted" />
										</td>
										<td className="px-4 py-3">
											<div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
										</td>
										<td className="px-4 py-3">
											<div className="h-4 w-16 animate-pulse rounded bg-muted" />
										</td>
										<td className="px-4 py-3">
											<div className="h-4 w-10 animate-pulse rounded bg-muted" />
										</td>
										<td className="px-4 py-3">
											<div className="h-4 w-20 animate-pulse rounded bg-muted" />
										</td>
										<td className="px-4 py-3">
											<div className="h-4 w-16 animate-pulse rounded bg-muted" />
										</td>
									</tr>
								))
							) : products.length === 0 ? (
								<tr>
									<td
										colSpan={8}
										className="px-4 py-12 text-center text-muted-foreground"
									>
										<p className="font-medium text-foreground">
											No products found
										</p>
										<p className="mt-1 text-sm">
											Try adjusting your filters or create a new product.
										</p>
									</td>
								</tr>
							) : (
								products.map((product) => (
									<tr
										key={product.id}
										className={`transition-colors hover:bg-muted/30 ${selected.has(product.id) ? "bg-muted/20" : ""}`}
									>
										<td className="px-4 py-3">
											<input
												type="checkbox"
												checked={selected.has(product.id)}
												onChange={() => toggleSelect(product.id)}
												className="h-4 w-4 rounded border-border text-foreground"
												aria-label={`Select ${product.name}`}
											/>
										</td>
										<td className="px-4 py-3">
											<div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted">
												{product.images[0] ? (
													<Image
														src={product.images[0]}
														alt={product.name}
														width={40}
														height={40}
														unoptimized
														className="h-full w-full object-cover object-center"
													/>
												) : (
													<div className="flex h-full w-full items-center justify-center text-muted-foreground">
														<svg
															xmlns="http://www.w3.org/2000/svg"
															width="16"
															height="16"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															strokeWidth="1.5"
															strokeLinecap="round"
															strokeLinejoin="round"
															aria-hidden="true"
														>
															<rect width="18" height="18" x="3" y="3" rx="2" />
															<circle cx="9" cy="9" r="2" />
															<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
														</svg>
													</div>
												)}
											</div>
										</td>
										<td className="px-4 py-3">
											<a
												href={`/admin/products/${product.id}`}
												className="font-medium text-foreground hover:underline"
											>
												{product.name}
											</a>
										</td>
										<td className="px-4 py-3">
											<span
												className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs capitalize ${
													statusStyles[product.status] ?? statusStyles.draft
												}`}
											>
												{product.status}
											</span>
										</td>
										<td className="px-4 py-3 text-foreground">
											{formatPrice(product.price)}
										</td>
										<td className="px-4 py-3 text-foreground">
											{product.inventory}
										</td>
										<td className="px-4 py-3 text-muted-foreground">
											{formatDate(product.createdAt)}
										</td>
										<td className="px-4 py-3 text-right">
											<div className="flex items-center justify-end gap-2">
												<a
													href={`/admin/products/${product.id}/edit`}
													className="rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
													title="Edit product"
												>
													Edit
												</a>
												<button
													type="button"
													onClick={() => handleDelete(product.id)}
													disabled={deleting === product.id}
													className="rounded-md px-2 py-1 text-destructive text-xs transition-colors hover:bg-destructive/10 disabled:opacity-50"
												>
													{deleting === product.id ? "Deleting..." : "Delete"}
												</button>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="mt-4 flex items-center justify-center gap-2">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page === 1}
						className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
					>
						Previous
					</button>
					<span className="text-muted-foreground text-sm">
						Page {page} of {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page === totalPages}
						className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
					>
						Next
					</button>
				</div>
			)}

			{/* Import Dialog */}
			{showImport && (
				<ImportDialog
					onClose={() => setShowImport(false)}
					onImport={handleImport}
				/>
			)}
		</div>
	);

	return <ProductListTemplate content={content} />;
}
