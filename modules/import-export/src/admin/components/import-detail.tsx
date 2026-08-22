"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import ImportDetailTemplate from "./import-detail.mdx";

interface ImportError {
	row: number;
	field?: string;
	message: string;
}

interface ImportJob {
	id: string;
	type: string;
	status: string;
	filename: string;
	totalRows: number;
	processedRows: number;
	failedRows: number;
	skippedRows: number;
	errors: ImportError[];
	options: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
	completedAt?: string;
}

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

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useImportExportApi() {
	const client = useModuleClient();
	return {
		getImport:
			client.module("import-export").admin["/admin/import-export/imports/:id"],
		cancelImport:
			client.module("import-export").admin[
				"/admin/import-export/imports/:id/cancel"
			],
	};
}

export function ImportDetail({
	importId,
	onBack,
}: {
	importId: string;
	onBack: () => void;
}) {
	const api = useImportExportApi();

	const { data, isLoading } = api.getImport.useQuery({
		params: { id: importId },
	}) as { data: { job: ImportJob } | undefined; isLoading: boolean };

	const cancelMutation = api.cancelImport.useMutation({
		onSettled: () => {
			void api.getImport.invalidate();
		},
	});

	if (isLoading) {
		return (
			<div className="space-y-4 p-1">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-12 w-full rounded-lg" />
				<Skeleton className="h-32 w-full rounded-lg" />
			</div>
		);
	}

	const job = data?.job;
	if (!job) {
		return (
			<div className="py-8 text-center text-muted-foreground text-sm">
				Import job not found.
			</div>
		);
	}

	const progress =
		job.totalRows > 0
			? Math.round((job.processedRows / job.totalRows) * 100)
			: 0;

	const canCancel =
		job.status === "pending" ||
		job.status === "validating" ||
		job.status === "processing";

	const detailContent = (
		<div className="space-y-4">
			<div className="rounded-lg border border-border bg-card p-5">
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div>
						<p className="text-muted-foreground text-xs">Type</p>
						<p className="mt-0.5 font-medium text-foreground capitalize">
							{job.type}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Filename</p>
						<p className="mt-0.5 font-medium text-foreground text-sm">
							{job.filename}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Created</p>
						<p className="mt-0.5 text-foreground text-sm">
							{formatDate(job.createdAt)}
						</p>
					</div>
					{job.completedAt && (
						<div>
							<p className="text-muted-foreground text-xs">Completed</p>
							<p className="mt-0.5 text-foreground text-sm">
								{formatDate(job.completedAt)}
							</p>
						</div>
					)}
				</div>

				<div className="mt-4">
					<div className="mb-1 flex justify-between text-sm">
						<span className="text-muted-foreground">Progress</span>
						<span className="font-medium text-foreground">{progress}%</span>
					</div>
					<div className="h-2 w-full rounded-full bg-muted">
						<div
							className="h-2 rounded-full bg-foreground transition-all"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>

				<div className="mt-4 grid grid-cols-4 gap-4 text-center">
					<div>
						<p className="font-semibold text-foreground text-lg">
							{job.totalRows}
						</p>
						<p className="text-muted-foreground text-xs">Total</p>
					</div>
					<div>
						<p className="font-semibold text-foreground text-lg">
							{job.processedRows}
						</p>
						<p className="text-muted-foreground text-xs">Processed</p>
					</div>
					<div>
						<p className="font-semibold text-lg text-red-600 dark:text-red-400">
							{job.failedRows}
						</p>
						<p className="text-muted-foreground text-xs">Failed</p>
					</div>
					<div>
						<p className="font-semibold text-amber-600 text-lg dark:text-amber-400">
							{job.skippedRows}
						</p>
						<p className="text-muted-foreground text-xs">Skipped</p>
					</div>
				</div>

				{canCancel && (
					<div className="mt-4">
						<button
							type="button"
							onClick={() => cancelMutation.mutate({ params: { id: job.id } })}
							disabled={cancelMutation.isPending}
							className="rounded-md border border-destructive px-3 py-1.5 text-destructive text-sm hover:bg-destructive/10 disabled:opacity-50"
						>
							{cancelMutation.isPending ? "Cancelling..." : "Cancel Import"}
						</button>
					</div>
				)}
			</div>
		</div>
	);

	const errorContent =
		job.errors.length > 0 ? (
			<div className="rounded-lg border border-border bg-card">
				<div className="border-border border-b px-5 py-3">
					<h3 className="font-semibold text-foreground text-sm">
						Errors ({job.errors.length})
					</h3>
				</div>
				<div className="max-h-80 divide-y divide-border overflow-y-auto">
					{job.errors.map((err, _i) => (
						<div key={err.id} className="px-5 py-3">
							<div className="flex items-start justify-between">
								<div>
									<span className="font-medium text-foreground text-sm">
										Row {err.row}
									</span>
									{err.field && (
										<span className="ml-2 font-mono text-muted-foreground text-xs">
											{err.field}
										</span>
									)}
								</div>
							</div>
							<p className="mt-0.5 text-red-600 text-sm dark:text-red-400">
								{err.message}
							</p>
						</div>
					))}
				</div>
			</div>
		) : null;

	return (
		<ImportDetailTemplate
			onBack={onBack}
			status={job.status}
			statusClassName={`rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_COLORS[job.status] ?? ""}`}
			detailContent={detailContent}
			errorContent={errorContent}
		/>
	);
}
