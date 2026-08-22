"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useEffect, useRef, useState } from "react";
import CustomerListTemplate from "./customer-list.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
	id: string;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
	phone?: string | null;
	tags?: string[] | null;
	createdAt: string;
}

interface ListResult {
	customers: Customer[];
	total: number;
	pages: number;
}

interface ExportResult {
	customers: Customer[];
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

interface TagEntry {
	tag: string;
	count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

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
	row.push(current.trim());
	if (row.some((cell) => cell !== "")) {
		rows.push(row);
	}
	return rows;
}

const CSV_HEADERS = ["Email", "First Name", "Last Name", "Phone", "Tags"];

const HEADER_MAP: Record<string, string> = {
	email: "email",
	"e-mail": "email",
	"email address": "email",
	"first name": "firstName",
	firstname: "firstName",
	first_name: "firstName",
	"last name": "lastName",
	lastname: "lastName",
	last_name: "lastName",
	phone: "phone",
	"phone number": "phone",
	telephone: "phone",
	tags: "tags",
	tag: "tags",
};

type ImportCustomerRow = {
	email: string;
	firstName?: string;
	lastName?: string;
	phone?: string;
	tags?: string[];
};

function rowToCustomer(
	headers: string[],
	row: string[],
): ImportCustomerRow | null {
	const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
	const obj: Record<string, unknown> = {};

	for (let i = 0; i < normalizedHeaders.length; i++) {
		const field = HEADER_MAP[normalizedHeaders[i]];
		if (field && i < row.length && row[i] !== "") {
			if (field === "tags") {
				obj[field] = row[i]
					.split(";")
					.map((t) => t.trim())
					.filter(Boolean);
			} else {
				obj[field] = row[i];
			}
		}
	}

	if (!obj.email) return null;
	return obj as ImportCustomerRow;
}

// ─── Module Client ───────────────────────────────────────────────────────────

function useCustomersAdminApi() {
	const client = useModuleClient();
	return {
		listCustomers: client.module("customers").admin["/admin/customers"],
		listTags: client.module("customers").admin["/admin/customers/tags"],
		exportCustomers:
			client.module("customers").admin["/admin/customers/export"],
		importCustomers:
			client.module("customers").admin["/admin/customers/import"],
	};
}

// ─── Import Dialog ───────────────────────────────────────────────────────────

function ImportDialog({
	onClose,
	onImport,
}: {
	onClose: () => void;
	onImport: (customers: ImportCustomerRow[]) => Promise<ImportResult>;
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
		rows: ImportCustomerRow[];
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

			const hasEmail = normalizedHeaders.some((h) => HEADER_MAP[h] === "email");
			if (!hasEmail) {
				setParseError('CSV must include an "Email" column.');
				return;
			}

			const dataRows = parsed.slice(1);
			const customers = dataRows
				.map((row) => rowToCustomer(headers, row))
				.filter((c): c is ImportCustomerRow => c !== null);

			if (customers.length === 0) {
				setParseError("No valid customer rows found in CSV.");
				return;
			}

			setPreview({ headers, rows: customers });
		};
		reader.readAsText(file);
	}, []);

	const handleImport = useCallback(async () => {
		if (!preview) return;
		setImporting(true);
		try {
			const importResult = await onImport(preview.rows);
			setResult(importResult);
		} finally {
			setImporting(false);
		}
	}, [preview, onImport]);

	const handleDownloadTemplate = useCallback(() => {
		const sampleRow = [
			"alice@example.com",
			"Alice",
			"Smith",
			"+1-555-0100",
			"vip;wholesale",
		];
		downloadCsv("customers-template.csv", [CSV_HEADERS, sampleRow]);
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
						Import Customers
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
							<line x1="18" x2="6" y1="6" y2="18" />
							<line x1="6" x2="18" y1="6" y2="18" />
						</svg>
					</button>
				</div>

				<div className="space-y-4 p-6">
					{result ? (
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
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
										className="text-green-500"
										aria-hidden="true"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</div>
								<div>
									<p className="font-medium text-foreground text-sm">
										Import complete
									</p>
									<p className="text-muted-foreground text-xs">
										{result.created} created, {result.updated} updated
										{result.errors.length > 0 &&
											`, ${result.errors.length} errors`}
									</p>
								</div>
							</div>

							{result.errors.length > 0 && (
								<div
									role="alert"
									className="max-h-32 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-3"
								>
									{result.errors.map((err) => (
										<p
											key={`${err.row}-${err.field}`}
											className="text-destructive text-xs"
										>
											Row {err.row}: {err.field} — {err.message}
										</p>
									))}
								</div>
							)}

							<div className="flex justify-end">
								<button
									type="button"
									onClick={onClose}
									className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm transition-colors hover:bg-foreground/90"
								>
									Done
								</button>
							</div>
						</div>
					) : (
						<>
							<div className="space-y-2">
								<p className="text-muted-foreground text-sm">
									Upload a CSV file with customer data. Required column:{" "}
									<strong>Email</strong>. Optional: First Name, Last Name,
									Phone, Tags (semicolon-separated).
								</p>
								<p className="text-muted-foreground text-xs">
									Existing customers are matched by email and updated. New
									emails create new customers.
								</p>
							</div>

							<div className="flex items-center gap-3">
								<input
									ref={fileRef}
									type="file"
									accept=".csv,text/csv"
									onChange={handleFile}
									className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:font-medium file:text-foreground file:text-sm"
								/>
								<button
									type="button"
									onClick={handleDownloadTemplate}
									className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
								>
									Download template
								</button>
							</div>

							{parseError && (
								<p className="text-destructive text-sm">{parseError}</p>
							)}

							{preview && (
								<div className="space-y-3">
									<div className="max-h-48 overflow-auto rounded-md border border-border">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-border border-b bg-muted/50">
													<th
														scope="col"
														className="px-3 py-2 text-left font-semibold text-muted-foreground text-xs"
													>
														Email
													</th>
													<th
														scope="col"
														className="px-3 py-2 text-left font-semibold text-muted-foreground text-xs"
													>
														First Name
													</th>
													<th
														scope="col"
														className="px-3 py-2 text-left font-semibold text-muted-foreground text-xs"
													>
														Last Name
													</th>
													<th
														scope="col"
														className="px-3 py-2 text-left font-semibold text-muted-foreground text-xs"
													>
														Tags
													</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-border">
												{preview.rows.slice(0, 5).map((c) => (
													<tr key={c.email}>
														<td className="px-3 py-1.5 text-foreground text-xs">
															{c.email}
														</td>
														<td className="px-3 py-1.5 text-foreground text-xs">
															{c.firstName ?? "—"}
														</td>
														<td className="px-3 py-1.5 text-foreground text-xs">
															{c.lastName ?? "—"}
														</td>
														<td className="px-3 py-1.5 text-foreground text-xs">
															{c.tags?.join(", ") ?? "—"}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
									<p className="text-muted-foreground text-xs">
										{preview.rows.length}{" "}
										{preview.rows.length === 1 ? "customer" : "customers"} to
										import
										{preview.rows.length > 5 &&
											` (showing first 5 of ${preview.rows.length})`}
									</p>
									<div className="flex justify-end gap-2">
										<button
											type="button"
											onClick={onClose}
											className="rounded-md border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
										>
											Cancel
										</button>
										<button
											type="button"
											disabled={importing}
											onClick={() => void handleImport()}
											className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm transition-colors hover:bg-foreground/90 disabled:opacity-50"
										>
											{importing
												? "Importing…"
												: `Import ${preview.rows.length} customers`}
										</button>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}

// ─── Main Component ──────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export function CustomerList() {
	const api = useCustomersAdminApi();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [tagFilter, setTagFilter] = useState("");
	const [exporting, setExporting] = useState(false);
	const [showImport, setShowImport] = useState(false);

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(PAGE_SIZE),
	};
	if (search) queryInput.search = search;
	if (tagFilter) queryInput.tag = tagFilter;

	const {
		data: listData,
		isLoading: loading,
		isError: customersError,
		refetch: refetchCustomers,
	} = api.listCustomers.useQuery(queryInput) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: tagsData } = api.listTags.useQuery({}) as {
		data: { tags: TagEntry[] } | undefined;
	};
	const allTags = tagsData?.tags ?? [];

	const customers = listData?.customers ?? [];
	const total = listData?.total ?? 0;
	const totalPages = listData?.pages ?? 1;

	const handleExport = useCallback(async () => {
		setExporting(true);
		try {
			const exportQuery: Record<string, string> = {};
			if (search) exportQuery.search = search;
			if (tagFilter) exportQuery.tag = tagFilter;

			const result = (await api.exportCustomers.fetch(exportQuery)) as
				| ExportResult
				| undefined;
			const exportCustomers = result?.customers ?? [];

			if (exportCustomers.length === 0) return;

			const header = [
				"Email",
				"First Name",
				"Last Name",
				"Phone",
				"Tags",
				"Joined",
			];
			const dataRows = exportCustomers.map((c) => [
				c.email,
				c.firstName ?? "",
				c.lastName ?? "",
				c.phone ?? "",
				(c.tags ?? []).join(";"),
				new Date(c.createdAt).toISOString(),
			]);

			const dateStr = new Date().toISOString().slice(0, 10);
			downloadCsv(`customers-${dateStr}.csv`, [header, ...dataRows]);
		} finally {
			setExporting(false);
		}
	}, [api.exportCustomers, search, tagFilter]);

	const handleImport = useCallback(
		async (rows: ImportCustomerRow[]) => {
			const result = (await api.importCustomers.fetch({
				customers: rows,
			})) as ImportResult;
			void api.listCustomers.invalidate();
			void api.listTags.invalidate();
			return result;
		},
		[api.importCustomers, api.listCustomers, api.listTags],
	);

	if (customersError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load customers
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchCustomers()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const subtitle = `${total} ${total === 1 ? "customer" : "customers"}`;

	const tableBody = loading ? (
		(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
			<tr key={key}>
				{(["k0", "k1", "k2", "k3"] as const).map((key) => (
					<td key={key} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : customers.length === 0 ? (
		<tr>
			<td colSpan={4} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No customers yet</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Customers will appear here after they create an account
				</p>
			</td>
		</tr>
	) : (
		customers.map((customer) => (
			<tr
				key={customer.id}
				className="cursor-pointer transition-colors hover:bg-muted/30"
				onClick={() => {
					window.location.href = `/admin/customers/${customer.id}`;
				}}
			>
				<td className="px-4 py-3 font-medium text-sm">
					<a
						href={`/admin/customers/${customer.id}`}
						className="text-foreground hover:underline"
						onClick={(e) => e.stopPropagation()}
					>
						{customer.firstName || customer.lastName
							? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim()
							: "—"}
					</a>
				</td>
				<td className="px-4 py-3 text-foreground text-sm">{customer.email}</td>
				<td className="hidden px-4 py-3 sm:table-cell">
					<div className="flex flex-wrap gap-1">
						{(customer.tags ?? []).length > 0 ? (
							(customer.tags ?? []).map((tag) => (
								<span
									key={tag}
									className="inline-flex rounded-full bg-foreground/10 px-2 py-0.5 font-medium text-foreground text-xs"
								>
									{tag}
								</span>
							))
						) : (
							<span className="text-muted-foreground text-sm">—</span>
						)}
					</div>
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
					{timeAgo(customer.createdAt)}
				</td>
			</tr>
		))
	);

	return (
		<>
			<CustomerListTemplate
				subtitle={subtitle}
				onExport={() => void handleExport()}
				exportDisabled={exporting || total === 0}
				exportLabel={exporting ? "Exporting…" : "Export CSV"}
				onImport={() => setShowImport(true)}
				search={search}
				onSearchChange={(v: string) => {
					setSearch(v);
					setPage(1);
				}}
				tagFilter={tagFilter}
				allTags={allTags}
				onTagFilterChange={(v: string) => {
					setTagFilter(v);
					setPage(1);
				}}
				tableBody={tableBody}
				showPagination={totalPages > 1}
				page={page}
				totalPages={totalPages}
				onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
				onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
			/>

			{showImport && (
				<ImportDialog
					onClose={() => setShowImport(false)}
					onImport={handleImport}
				/>
			)}
		</>
	);
}
