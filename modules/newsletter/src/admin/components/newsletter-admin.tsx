"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import NewsletterAdminTemplate from "./newsletter-admin.mdx";

interface Subscriber {
	id: string;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
	status: "active" | "unsubscribed" | "bounced";
	source?: string | null;
	tags: string[];
	subscribedAt: string;
	unsubscribedAt?: string | null;
}

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

const STATUS_COLORS: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	unsubscribed: "bg-muted text-muted-foreground",
	bounced: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function useNewsletterAdminApi() {
	const client = useModuleClient();
	return {
		listSubscribers: client.module("newsletter").admin["/admin/newsletter"],
		deleteSubscriber:
			client.module("newsletter").admin["/admin/newsletter/:id/delete"],
	};
}

function DeleteModal({
	subscriber,
	onClose,
	onSuccess,
}: {
	subscriber: Subscriber;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useNewsletterAdminApi();
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	const deleteMutation = api.deleteSubscriber.useMutation({
		onSuccess: () => {
			void api.listSubscribers.invalidate();
			onSuccess();
		},
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl"
			>
				<div className="px-6 py-5">
					<h2 className="font-semibold text-foreground text-lg">
						Remove subscriber?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">
							{subscriber.email}
						</span>{" "}
						will be permanently deleted from the list.
					</p>
					<div className="mt-5 flex justify-end gap-2">
						<button
							ref={cancelRef}
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() =>
								deleteMutation.mutate({ params: { id: subscriber.id } })
							}
							disabled={deleteMutation.isPending}
							className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
						>
							{deleteMutation.isPending ? "Deleting…" : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export function NewsletterAdmin() {
	const api = useNewsletterAdminApi();
	const [statusFilter, setStatusFilter] = useState("active");
	const [page, setPage] = useState(1);
	const [deleteTarget, setDeleteTarget] = useState<Subscriber | null>(null);
	const pageSize = 25;

	useEffect(() => {
		if (!deleteTarget) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setDeleteTarget(null);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [deleteTarget]);

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(pageSize),
	};
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data,
		isLoading: loading,
		isError: subscribersError,
		refetch: refetchSubscribers,
	} = api.listSubscribers.useQuery(queryInput) as {
		data: { subscribers: Subscriber[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (subscribersError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load subscribers
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchSubscribers()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const subscribers = data?.subscribers ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const handleDeleteSuccess = () => {
		setDeleteTarget(null);
	};

	const handleExport = () => {
		const rows = [
			[
				"Email",
				"First Name",
				"Last Name",
				"Status",
				"Source",
				"Tags",
				"Subscribed At",
			],
			...subscribers.map((s) => [
				s.email,
				s.firstName ?? "",
				s.lastName ?? "",
				s.status,
				s.source ?? "",
				s.tags.join(";"),
				s.subscribedAt,
			]),
		];
		const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "subscribers.csv";
		a.click();
		URL.revokeObjectURL(url);
	};

	const subtitle = `${total} ${total === 1 ? "subscriber" : "subscribers"}${statusFilter === "active" ? " active" : ""}`;

	const tableBody = loading ? (
		Array.from({ length: 5 }).map((_, i) => (
			<tr key={`skeleton-${i}`}>
				{Array.from({ length: 7 }).map((_, j) => (
					<td key={`skeleton-cell-${j}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : subscribers.length === 0 ? (
		<tr>
			<td colSpan={7} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">
					No subscribers found
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					{statusFilter === "active"
						? "Active subscribers will appear here after sign-up"
						: "No subscribers match the current filter"}
				</p>
			</td>
		</tr>
	) : (
		subscribers.map((sub) => (
			<tr key={sub.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3">
					<span className="text-foreground text-sm">{sub.email}</span>
				</td>
				<td className="hidden px-4 py-3 text-foreground text-sm sm:table-cell">
					{sub.firstName || sub.lastName ? (
						`${sub.firstName ?? ""} ${sub.lastName ?? ""}`.trim()
					) : (
						<span className="text-muted-foreground">&mdash;</span>
					)}
				</td>
				<td className="px-4 py-3">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[sub.status] ?? "bg-muted text-muted-foreground"}`}
					>
						{sub.status}
					</span>
				</td>
				<td className="hidden px-4 py-3 md:table-cell">
					{sub.tags.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{sub.tags.slice(0, 3).map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
								>
									{tag}
								</span>
							))}
							{sub.tags.length > 3 && (
								<span className="text-muted-foreground text-xs">
									+{sub.tags.length - 3}
								</span>
							)}
						</div>
					) : (
						<span className="text-muted-foreground text-sm">&mdash;</span>
					)}
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm lg:table-cell">
					{sub.source ?? "—"}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs xl:table-cell">
					{timeAgo(sub.subscribedAt)}
				</td>
				<td className="px-4 py-3 text-right">
					<button
						type="button"
						onClick={() => setDeleteTarget(sub)}
						className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
					>
						Delete
					</button>
				</td>
			</tr>
		))
	);

	return (
		<NewsletterAdminTemplate
			subtitle={subtitle}
			onExport={handleExport}
			exportDisabled={subscribers.length === 0}
			statusFilter={statusFilter}
			onStatusFilterChange={(v: string) => {
				setStatusFilter(v);
				setPage(1);
			}}
			tableBody={tableBody}
			showPagination={totalPages > 1}
			page={page}
			totalPages={totalPages}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
			deleteModal={
				deleteTarget ? (
					<DeleteModal
						subscriber={deleteTarget}
						onClose={() => setDeleteTarget(null)}
						onSuccess={handleDeleteSuccess}
					/>
				) : null
			}
		/>
	);
}
