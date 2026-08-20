"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import WaitlistDashboardTemplate from "./waitlist-dashboard.mdx";

interface WaitlistEntry {
	id: string;
	productId: string;
	productName: string;
	variantLabel?: string;
	email: string;
	status: string;
	notifiedAt?: string;
	createdAt: string;
}

interface WaitlistSummary {
	totalWaiting: number;
	totalNotified: number;
	topProducts: Array<{ productId: string; productName: string; count: number }>;
}

const PAGE_SIZE = 20;

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

const STATUS_LABELS: Record<string, string> = {
	waiting: "Waiting",
	notified: "Notified",
	purchased: "Purchased",
	cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
	waiting:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	notified: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	purchased:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-muted text-muted-foreground",
};

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useWaitlistAdminApi() {
	const client = useModuleClient();
	return {
		listAll: client.module("waitlist").admin["/admin/waitlist"],
		summary: client.module("waitlist").admin["/admin/waitlist/summary"],
		notify:
			client.module("waitlist").admin["/admin/waitlist/:productId/notify"],
		deleteEntry: client.module("waitlist").admin["/admin/waitlist/:id/delete"],
	};
}

export function WaitlistDashboard() {
	const api = useWaitlistAdminApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState<string>("");
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [notifyConfirm, setNotifyConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data: summaryData, isLoading: summaryLoading } = api.summary.useQuery(
		{},
	) as {
		data: { summary: WaitlistSummary } | undefined;
		isLoading: boolean;
	};

	const queryParams: Record<string, string> = {
		take: String(PAGE_SIZE),
		skip: String(skip),
	};
	if (statusFilter) queryParams.status = statusFilter;

	const { data: listData, isLoading: listLoading } = api.listAll.useQuery(
		queryParams,
	) as {
		data: { entries: WaitlistEntry[]; total: number } | undefined;
		isLoading: boolean;
	};

	const summary = summaryData?.summary;
	const entries = listData?.entries ?? [];
	const total = listData?.total ?? 0;

	const deleteMutation = api.deleteEntry.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.listAll.invalidate();
			void api.summary.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete entry."));
		},
	});

	const notifyMutation = api.notify.useMutation({
		onSettled: () => {
			setNotifyConfirm(null);
			void api.listAll.invalidate();
			void api.summary.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to send notifications."));
		},
	});

	const handleDelete = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	const handleNotify = (productId: string) => {
		setError("");
		notifyMutation.mutate({ params: { productId }, productId });
	};

	const loading = summaryLoading || listLoading;

	const statusBadge = (status: string) => (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
		>
			{STATUS_LABELS[status] ?? status}
		</span>
	);

	const itemsContent = loading ? (
		<div className="rounded-lg border border-border bg-card">
			<div className="hidden md:block">
				<table className="w-full text-left text-sm">
					<tbody className="divide-y divide-border">
						{Array.from({ length: 5 }, (_, i) => (
							<tr key={`skeleton-${i}`}>
								{Array.from({ length: 5 }, (_, j) => (
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
	) : entries.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No waitlist entries yet.
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
								Product
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Email
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
								Date
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
						{entries.map((entry) => (
							<tr key={entry.id}>
								<td className="px-5 py-3">
									<span className="text-foreground">{entry.productName}</span>
									{entry.variantLabel && (
										<span className="ml-2 text-muted-foreground text-xs">
											({entry.variantLabel})
										</span>
									)}
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{entry.email}
								</td>
								<td className="px-5 py-3">{statusBadge(entry.status)}</td>
								<td className="px-5 py-3 text-muted-foreground">
									{formatDate(entry.createdAt)}
								</td>
								<td className="px-5 py-3">
									{deleteConfirm === entry.id ? (
										<span className="space-x-2">
											<button
												type="button"
												onClick={() => handleDelete(entry.id)}
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
											onClick={() => setDeleteConfirm(entry.id)}
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
			</div>

			<div className="divide-y divide-border md:hidden">
				{entries.map((entry) => (
					<div key={entry.id} className="px-5 py-3">
						<div className="flex items-start justify-between">
							<div>
								<p className="font-medium text-foreground text-sm">
									{entry.productName}
									{entry.variantLabel && (
										<span className="ml-1 text-muted-foreground text-xs">
											({entry.variantLabel})
										</span>
									)}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{entry.email}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{formatDate(entry.createdAt)}
								</p>
								<div className="mt-1">{statusBadge(entry.status)}</div>
							</div>
							{deleteConfirm === entry.id ? (
								<span className="space-x-2">
									<button
										type="button"
										onClick={() => handleDelete(entry.id)}
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
									onClick={() => setDeleteConfirm(entry.id)}
									className="text-muted-foreground text-xs hover:text-destructive"
								>
									Delete
								</button>
							)}
						</div>
					</div>
				))}
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
		<WaitlistDashboardTemplate
			summary={summary}
			error={error}
			statusFilter={statusFilter}
			onStatusChange={setStatusFilter}
			notifyConfirm={notifyConfirm}
			onNotifyConfirm={setNotifyConfirm}
			onNotify={handleNotify}
			itemsContent={itemsContent}
		/>
	);
}
