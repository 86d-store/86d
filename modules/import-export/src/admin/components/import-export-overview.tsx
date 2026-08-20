"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import { ImportDetail } from "./import-detail";
import ImportExportOverviewTemplate from "./import-export-overview.mdx";

interface ImportJob {
	id: string;
	type: string;
	status: string;
	filename: string;
	totalRows: number;
	processedRows: number;
	failedRows: number;
	createdAt: string;
	completedAt?: string;
}

interface ExportJob {
	id: string;
	type: string;
	status: string;
	format: string;
	totalRows: number;
	createdAt: string;
	completedAt?: string;
}

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
	pending: "bg-muted text-muted-foreground",
	validating:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	processing:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	cancelled: "bg-muted text-muted-foreground",
};

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

function useImportExportAdminApi() {
	const client = useModuleClient();
	return {
		listImports:
			client.module("import-export").admin["/admin/import-export/imports"],
		createImport:
			client.module("import-export").admin[
				"/admin/import-export/imports/create"
			],
		deleteImport:
			client.module("import-export").admin[
				"/admin/import-export/imports/:id/delete"
			],
		listExports:
			client.module("import-export").admin["/admin/import-export/exports"],
		createExport:
			client.module("import-export").admin[
				"/admin/import-export/exports/create"
			],
		deleteExport:
			client.module("import-export").admin[
				"/admin/import-export/exports/:id/delete"
			],
	};
}

function ImportForm({ onClose }: { onClose: () => void }) {
	const api = useImportExportAdminApi();
	const [type, setType] = useState("products");
	const [filename, setFilename] = useState("");
	const [totalRows, setTotalRows] = useState("");
	const [updateExisting, setUpdateExisting] = useState(false);
	const [skipDuplicates, setSkipDuplicates] = useState(false);
	const [error, setError] = useState("");

	const createMutation = api.createImport.useMutation({
		onSettled: () => {
			void api.listImports.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create import job."));
		},
		onSuccess: () => {
			onClose();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const rows = Number.parseInt(totalRows, 10);
		if (Number.isNaN(rows) || rows <= 0) {
			setError("Enter a valid number of rows.");
			return;
		}
		if (!filename.trim()) {
			setError("Enter a filename.");
			return;
		}
		createMutation.mutate({
			type: type as "products" | "customers" | "orders" | "inventory",
			filename: filename.trim(),
			totalRows: rows,
			options: {
				...(updateExisting ? { updateExisting: true } : {}),
				...(skipDuplicates ? { skipDuplicates: true } : {}),
			},
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<div
					role="alert"
					className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}
			<div className="grid grid-cols-2 gap-4">
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Data Type *
					</span>
					<select
						value={type}
						onChange={(e) => setType(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="products">Products</option>
						<option value="customers">Customers</option>
						<option value="orders">Orders</option>
						<option value="inventory">Inventory</option>
					</select>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Total Rows *
					</span>
					<input
						type="number"
						min="1"
						max="100000"
						value={totalRows}
						onChange={(e) => setTotalRows(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						placeholder="1000"
						required
					/>
				</label>
			</div>
			<label className="block">
				<span className="mb-1 block font-medium text-foreground text-sm">
					Filename *
				</span>
				<input
					type="text"
					value={filename}
					onChange={(e) => setFilename(e.target.value)}
					className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					placeholder="products-2026-03.csv"
					required
				/>
			</label>
			<div className="flex gap-4">
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={updateExisting}
						onChange={(e) => setUpdateExisting(e.target.checked)}
						className="rounded border-border"
					/>
					<span className="text-foreground">Update existing records</span>
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={skipDuplicates}
						onChange={(e) => setSkipDuplicates(e.target.checked)}
						className="rounded border-border"
					/>
					<span className="text-foreground">Skip duplicates</span>
				</label>
			</div>
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onClose}
					className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={createMutation.isPending}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
				>
					{createMutation.isPending ? "Creating..." : "Create Import"}
				</button>
			</div>
		</form>
	);
}

function ExportForm({ onClose }: { onClose: () => void }) {
	const api = useImportExportAdminApi();
	const [type, setType] = useState("products");
	const [format, setFormat] = useState("csv");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [error, setError] = useState("");

	const createMutation = api.createExport.useMutation({
		onSettled: () => {
			void api.listExports.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create export job."));
		},
		onSuccess: () => {
			onClose();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		createMutation.mutate({
			type: type as "products" | "customers" | "orders" | "inventory",
			format: format as "csv" | "json",
			filters: {
				...(dateFrom ? { dateFrom } : {}),
				...(dateTo ? { dateTo } : {}),
			},
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<div
					role="alert"
					className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}
			<div className="grid grid-cols-2 gap-4">
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Data Type *
					</span>
					<select
						value={type}
						onChange={(e) => setType(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="products">Products</option>
						<option value="customers">Customers</option>
						<option value="orders">Orders</option>
						<option value="inventory">Inventory</option>
					</select>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						Format
					</span>
					<select
						value={format}
						onChange={(e) => setFormat(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="csv">CSV</option>
						<option value="json">JSON</option>
					</select>
				</label>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						From Date
					</span>
					<input
						type="date"
						value={dateFrom}
						onChange={(e) => setDateFrom(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-foreground text-sm">
						To Date
					</span>
					<input
						type="date"
						value={dateTo}
						onChange={(e) => setDateTo(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</label>
			</div>
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onClose}
					className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={createMutation.isPending}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
				>
					{createMutation.isPending ? "Creating..." : "Create Export"}
				</button>
			</div>
		</form>
	);
}

export function ImportExportOverview() {
	const api = useImportExportAdminApi();
	const [tab, setTab] = useState("imports");
	const [typeFilter, setTypeFilter] = useState("");
	const [skip, setSkip] = useState(0);
	const [showImportForm, setShowImportForm] = useState(false);
	const [showExportForm, setShowExportForm] = useState(false);
	const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data: importData, isLoading: importsLoading } =
		api.listImports.useQuery({
			take: String(PAGE_SIZE),
			skip: String(skip),
			...(typeFilter ? { type: typeFilter } : {}),
		}) as {
			data: { jobs: ImportJob[]; total: number } | undefined;
			isLoading: boolean;
		};

	const { data: exportData, isLoading: exportsLoading } =
		api.listExports.useQuery({
			take: String(PAGE_SIZE),
			skip: String(skip),
			...(typeFilter ? { type: typeFilter } : {}),
		}) as {
			data: { jobs: ExportJob[]; total: number } | undefined;
			isLoading: boolean;
		};

	const deleteImportMutation = api.deleteImport.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.listImports.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete job."));
		},
	});

	const deleteExportMutation = api.deleteExport.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.listExports.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete job."));
		},
	});

	if (selectedImportId) {
		return (
			<ImportDetail
				importId={selectedImportId}
				onBack={() => setSelectedImportId(null)}
			/>
		);
	}

	const isLoading = tab === "imports" ? importsLoading : exportsLoading;

	const form = showImportForm ? (
		<div className="rounded-lg border border-border bg-card p-5">
			<h3 className="mb-4 font-semibold text-foreground">New Import Job</h3>
			<ImportForm onClose={() => setShowImportForm(false)} />
		</div>
	) : showExportForm ? (
		<div className="rounded-lg border border-border bg-card p-5">
			<h3 className="mb-4 font-semibold text-foreground">New Export Job</h3>
			<ExportForm onClose={() => setShowExportForm(false)} />
		</div>
	) : null;

	const importJobs = importData?.jobs ?? [];
	const exportJobs = exportData?.jobs ?? [];

	const importsTable =
		importJobs.length === 0 ? (
			<div className="px-5 py-8 text-center text-muted-foreground text-sm">
				No import jobs found.
			</div>
		) : (
			<table className="w-full text-left text-sm">
				<thead className="border-border border-b bg-muted/50">
					<tr>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Filename
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Type
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Status
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Progress
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Created
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{importJobs.map((job) => {
						const progress =
							job.totalRows > 0
								? Math.round((job.processedRows / job.totalRows) * 100)
								: 0;
						return (
							<tr
								key={job.id}
								className="cursor-pointer hover:bg-muted/30"
								onClick={() => setSelectedImportId(job.id)}
							>
								<td className="px-5 py-3 font-medium text-foreground text-sm">
									{job.filename}
								</td>
								<td className="px-5 py-3 text-muted-foreground capitalize">
									{job.type}
								</td>
								<td className="px-5 py-3">
									<span
										className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[job.status] ?? ""}`}
									>
										{job.status}
									</span>
								</td>
								<td className="px-5 py-3 text-muted-foreground text-sm">
									{job.processedRows}/{job.totalRows} ({progress}%)
									{job.failedRows > 0 && (
										<span className="ml-1 text-red-600 dark:text-red-400">
											{job.failedRows} failed
										</span>
									)}
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{formatDate(job.createdAt)}
								</td>
								<td
									className="px-5 py-3"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
								>
									{deleteConfirm === job.id ? (
										<span className="space-x-2">
											<button
												type="button"
												onClick={() =>
													deleteImportMutation.mutate({
														params: { id: job.id },
													})
												}
												className="font-medium text-destructive text-xs hover:opacity-80"
											>
												Confirm
											</button>
											<button
												type="button"
												onClick={() => setDeleteConfirm(null)}
												className="text-muted-foreground text-xs hover:text-foreground"
											>
												Cancel
											</button>
										</span>
									) : (
										<button
											type="button"
											onClick={() => setDeleteConfirm(job.id)}
											className="text-muted-foreground text-xs hover:text-destructive"
										>
											Delete
										</button>
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		);

	const exportsTable =
		exportJobs.length === 0 ? (
			<div className="px-5 py-8 text-center text-muted-foreground text-sm">
				No export jobs found.
			</div>
		) : (
			<table className="w-full text-left text-sm">
				<thead className="border-border border-b bg-muted/50">
					<tr>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Type
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Format
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Status
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Rows
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Created
						</th>
						<th
							scope="col"
							className="px-5 py-2.5 font-medium text-muted-foreground"
						>
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{exportJobs.map((job) => (
						<tr key={job.id} className="hover:bg-muted/30">
							<td className="px-5 py-3 font-medium text-foreground capitalize">
								{job.type}
							</td>
							<td className="px-5 py-3 font-mono text-muted-foreground text-xs uppercase">
								{job.format}
							</td>
							<td className="px-5 py-3">
								<span
									className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[job.status] ?? ""}`}
								>
									{job.status}
								</span>
							</td>
							<td className="px-5 py-3 text-muted-foreground text-sm">
								{job.totalRows}
							</td>
							<td className="px-5 py-3 text-muted-foreground">
								{formatDate(job.createdAt)}
							</td>
							<td className="px-5 py-3">
								{deleteConfirm === job.id ? (
									<span className="space-x-2">
										<button
											type="button"
											onClick={() =>
												deleteExportMutation.mutate({
													params: { id: job.id },
												})
											}
											className="font-medium text-destructive text-xs hover:opacity-80"
										>
											Confirm
										</button>
										<button
											type="button"
											onClick={() => setDeleteConfirm(null)}
											className="text-muted-foreground text-xs hover:text-foreground"
										>
											Cancel
										</button>
									</span>
								) : (
									<button
										type="button"
										onClick={() => setDeleteConfirm(job.id)}
										className="text-muted-foreground text-xs hover:text-destructive"
									>
										Delete
									</button>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		);

	const tableContent = tab === "imports" ? importsTable : exportsTable;

	return (
		<ImportExportOverviewTemplate
			tab={tab}
			onTabChange={(v: string) => {
				setTab(v);
				setSkip(0);
			}}
			typeFilter={typeFilter}
			onTypeFilterChange={(v: string) => {
				setTypeFilter(v);
				setSkip(0);
			}}
			onImportClick={() => {
				setShowImportForm(true);
				setShowExportForm(false);
			}}
			onExportClick={() => {
				setShowExportForm(true);
				setShowImportForm(false);
			}}
			form={form}
			error={error}
			loading={isLoading}
			tableContent={tableContent}
		/>
	);
}
