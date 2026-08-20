"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import LabelAdminTemplate from "./label-admin.mdx";

interface LabelData {
	id: string;
	name: string;
	slug: string;
	displayText: string;
	type: string;
	color?: string;
	backgroundColor?: string;
	priority: number;
	isActive: boolean;
	createdAt: string;
}

interface LabelStatData {
	labelId: string;
	name: string;
	displayText: string;
	type: string;
	isActive: boolean;
	productCount: number;
}

const PAGE_SIZE = 30;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
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

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useLabelAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("product-labels").admin["/admin/product-labels"],
		stats: client.module("product-labels").admin["/admin/product-labels/stats"],
		create:
			client.module("product-labels").admin["/admin/product-labels/create"],
		deleteLabel:
			client.module("product-labels").admin["/admin/product-labels/:id/delete"],
	};
}

export function LabelAdmin() {
	const api = useLabelAdminApi();
	const [skip, setSkip] = useState(0);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data: listData, isLoading: listLoading } = api.list.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
	}) as {
		data: { labels: LabelData[]; total: number } | undefined;
		isLoading: boolean;
	};

	const { data: statsData, isLoading: statsLoading } = api.stats.useQuery({
		take: "50",
	}) as {
		data: { stats: LabelStatData[] } | undefined;
		isLoading: boolean;
	};

	const labels = listData?.labels ?? [];
	const total = listData?.total ?? 0;
	const stats = statsData?.stats ?? [];
	const activeCount = stats.filter((s) => s.isActive).length;
	const totalAssignments = stats.reduce((sum, s) => sum + s.productCount, 0);

	const deleteMutation = api.deleteLabel.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.list.invalidate();
			void api.stats.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete label."));
		},
	});

	const handleDelete = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	const loading = listLoading || statsLoading;

	const createButton = (
		<button
			type="button"
			onClick={() => {
				/* create modal handled by admin framework */
			}}
			className="rounded bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs hover:opacity-90"
		>
			New Label
		</button>
	);

	const labelsContent = loading ? (
		<div className="rounded-lg border border-border bg-card">
			<div className="hidden md:block">
				<table className="w-full text-left text-sm">
					<tbody className="divide-y divide-border">
						{Array.from({ length: 5 }, (_, i) => (
							<tr key={`skeleton-${i}`}>
								{Array.from({ length: 6 }, (_, j) => (
									<td key={`skeleton-cell-${j}`} className="px-5 py-3">
										<Skeleton className="h-4 rounded" />
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="space-y-3 p-4 md:hidden">
				{Array.from({ length: 3 }, (_, i) => (
					<Skeleton key={`mobile-skeleton-${i}`} className="h-16 rounded-lg" />
				))}
			</div>
		</div>
	) : labels.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No labels created yet.
		</div>
	) : (
		<>
			<div className="hidden md:block">
				<table className="w-full text-left text-sm">
					<thead className="border-border border-b bg-muted/50">
						<tr>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Label
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
								Priority
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Products
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
						{labels.map((label) => {
							const stat = stats.find((s) => s.labelId === label.id);
							return (
								<tr key={label.id}>
									<td className="px-5 py-3">
										<div className="flex items-center gap-2">
											{label.backgroundColor && (
												<span
													className="inline-block h-3 w-3 rounded-full"
													style={{ backgroundColor: label.backgroundColor }}
												/>
											)}
											<span className="text-foreground">
												{label.displayText}
											</span>
											<span className="text-muted-foreground text-xs">
												({label.slug})
											</span>
										</div>
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{label.type}
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{label.priority}
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{stat?.productCount ?? 0}
									</td>
									<td className="px-5 py-3">
										<span
											className={`rounded-full px-2 py-0.5 text-xs ${
												label.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{label.isActive ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{formatDate(label.createdAt)}
									</td>
									<td className="px-5 py-3">
										{deleteConfirm === label.id ? (
											<span className="space-x-2">
												<button
													type="button"
													onClick={() => handleDelete(label.id)}
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
												onClick={() => setDeleteConfirm(label.id)}
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
			</div>

			<div className="divide-y divide-border md:hidden">
				{labels.map((label) => {
					const stat = stats.find((s) => s.labelId === label.id);
					return (
						<div key={label.id} className="px-5 py-3">
							<div className="flex items-start justify-between">
								<div>
									<div className="flex items-center gap-2">
										{label.backgroundColor && (
											<span
												className="inline-block h-3 w-3 rounded-full"
												style={{ backgroundColor: label.backgroundColor }}
											/>
										)}
										<p className="font-medium text-foreground text-sm">
											{label.displayText}
										</p>
									</div>
									<p className="mt-0.5 text-muted-foreground text-xs">
										{label.type} &middot; Priority {label.priority} &middot;{" "}
										{stat?.productCount ?? 0} products
									</p>
									<p className="mt-0.5 text-muted-foreground text-xs">
										{formatDate(label.createdAt)}
									</p>
								</div>
								{deleteConfirm === label.id ? (
									<span className="space-x-2">
										<button
											type="button"
											onClick={() => handleDelete(label.id)}
											className="font-medium text-destructive text-xs"
										>
											Confirm
										</button>
										<button
											type="button"
											onClick={() => setDeleteConfirm(null)}
											className="text-muted-foreground text-xs"
										>
											Cancel
										</button>
									</span>
								) : (
									<button
										type="button"
										onClick={() => setDeleteConfirm(label.id)}
										className="text-muted-foreground text-xs hover:text-destructive"
									>
										Delete
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-between border-border border-t px-5 py-3">
					<span className="text-muted-foreground text-sm">
						Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
					</span>
					<span className="space-x-2">
						<button
							type="button"
							onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
							disabled={skip === 0}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => setSkip((s) => s + PAGE_SIZE)}
							disabled={skip + PAGE_SIZE >= total}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Next
						</button>
					</span>
				</div>
			)}
		</>
	);

	return (
		<LabelAdminTemplate
			totalLabels={total}
			activeLabels={activeCount}
			totalAssignments={totalAssignments}
			error={error}
			createButton={createButton}
			labelsContent={labelsContent}
		/>
	);
}
