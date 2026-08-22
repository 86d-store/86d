"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import NotificationListTemplate from "./notification-list.mdx";

interface NotificationItem {
	id: string;
	customerId: string;
	type: string;
	channel: string;
	title: string;
	body: string;
	actionUrl?: string | null;
	read: boolean;
	readAt?: string | null;
	createdAt: string;
}

interface NotificationStats {
	total: number;
	unread: number;
	byType: Record<string, number>;
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

const TYPE_COLORS: Record<string, string> = {
	info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	success:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	warning:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	order:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	shipping: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
	promotion:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

function useNotificationsAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("notifications").admin["/admin/notifications"],
		stats: client.module("notifications").admin["/admin/notifications/stats"],
		delete:
			client.module("notifications").admin["/admin/notifications/:id/delete"],
		bulkDelete:
			client.module("notifications").admin["/admin/notifications/bulk-delete"],
	};
}

function DeleteModal({
	notification,
	onClose,
	onSuccess,
}: {
	notification: NotificationItem;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useNotificationsAdminApi();
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	const deleteMutation = api.delete.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.stats.invalidate();
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
						Delete notification?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						&ldquo;
						<span className="font-medium text-foreground">
							{notification.title}
						</span>
						&rdquo; will be permanently deleted.
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
								deleteMutation.mutate({
									params: { id: notification.id },
								})
							}
							disabled={deleteMutation.isPending}
							className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
						>
							{deleteMutation.isPending ? "Deleting\u2026" : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export function NotificationList() {
	const api = useNotificationsAdminApi();
	const [typeFilter, setTypeFilter] = useState("");
	const [readFilter, setReadFilter] = useState("");
	const [page, setPage] = useState(1);
	const [deleteTarget, setDeleteTarget] = useState<NotificationItem | null>(
		null,
	);
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
	if (typeFilter) queryInput.type = typeFilter;
	if (readFilter) queryInput.read = readFilter;

	const {
		data,
		isLoading: loading,
		isError: notificationsError,
		refetch: refetchNotifications,
	} = api.list.useQuery(queryInput) as {
		data: { notifications: NotificationItem[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats: NotificationStats } | undefined;
	};

	if (notificationsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load notifications
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchNotifications()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const notifications = data?.notifications ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const stats = statsData?.stats;

	const subtitle = stats
		? `${stats.total} total, ${stats.unread} unread`
		: `${total} notification${total !== 1 ? "s" : ""}`;

	const tableBody = loading ? (
		(["k0", "k1", "k2", "k3", "k4"] as const).map((_key) => (
			<tr key={rowKey}>
				{(["k0", "k1", "k2", "k3", "k4", "k5"] as const).map((_key) => (
					<td key={cellKey} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : notifications.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">
					No notifications found
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Notifications will appear here when created
				</p>
			</td>
		</tr>
	) : (
		notifications.map((n) => (
			<tr
				key={n.id}
				className={`transition-colors hover:bg-muted/30 ${!n.read ? "bg-accent/5" : ""}`}
			>
				<td className="px-4 py-3">
					<div>
						<span
							className={`text-foreground text-sm ${!n.read ? "font-semibold" : ""}`}
						>
							{n.title}
						</span>
						<p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
							{n.body}
						</p>
					</div>
				</td>
				<td className="px-4 py-3">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${TYPE_COLORS[n.type] ?? "bg-muted text-muted-foreground"}`}
					>
						{n.type}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm sm:table-cell">
					{n.customerId.slice(0, 8)}&hellip;
				</td>
				<td className="hidden px-4 py-3 md:table-cell">
					{n.read ? (
						<span className="text-muted-foreground text-xs">Read</span>
					) : (
						<span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
					)}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
					{timeAgo(n.createdAt)}
				</td>
				<td className="px-4 py-3 text-right">
					<button
						type="button"
						onClick={() => setDeleteTarget(n)}
						className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
					>
						Delete
					</button>
				</td>
			</tr>
		))
	);

	return (
		<NotificationListTemplate
			subtitle={subtitle}
			typeFilter={typeFilter}
			onTypeFilterChange={(v: string) => {
				setTypeFilter(v);
				setPage(1);
			}}
			readFilter={readFilter}
			onReadFilterChange={(v: string) => {
				setReadFilter(v);
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
						notification={deleteTarget}
						onClose={() => setDeleteTarget(null)}
						onSuccess={() => setDeleteTarget(null)}
					/>
				) : null
			}
		/>
	);
}
