"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

function useAnnouncementsAdminApi() {
	const client = useModuleClient();
	const api = client.module("announcements").admin;
	return {
		listAnnouncements: api["/admin/announcements"],
		getStats: api["/admin/announcements/stats"],
		deleteAnnouncement: api["/admin/announcements/:id/delete"],
	};
}

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

const TYPE_COLORS: Record<string, string> = {
	bar: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	banner:
		"bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
	popup:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const AUDIENCE_LABELS: Record<string, string> = {
	all: "All visitors",
	authenticated: "Logged in",
	guest: "Guests only",
};

interface AnnouncementItem {
	id: string;
	title: string;
	type: string;
	position: string;
	isActive: boolean;
	priority: number;
	impressions: number;
	targetAudience: string;
}

function DeleteModal({
	announcement,
	onClose,
	onSuccess,
}: {
	announcement: AnnouncementItem;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);
	const api = useAnnouncementsAdminApi();
	const deleteMutation = api.deleteAnnouncement.useMutation({
		onSuccess: () => {
			void api.listAnnouncements.invalidate();
			void api.getStats.invalidate();
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
					<h2 className="text-balance font-semibold text-foreground text-lg">
						Delete announcement?
					</h2>
					<p className="mt-2 text-pretty text-muted-foreground text-sm">
						<span className="font-medium text-foreground">
							{announcement.title}
						</span>{" "}
						will be permanently deleted.
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
								deleteMutation.mutate({ params: { id: announcement.id } })
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

const SKELETON_ROW_KEYS = ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5"];
const SKELETON_CELL_KEYS = ["c1", "c2", "c3", "c4", "c5", "c6"];
const STAT_SKELETON_KEYS = ["s1", "s2", "s3", "s4"];

export function AnnouncementList() {
	const api = useAnnouncementsAdminApi();
	const [typeFilter, setTypeFilter] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(
		null,
	);

	const listQuery = api.listAnnouncements.useQuery({
		query: { type: typeFilter || undefined },
	});
	const statsQuery = api.getStats.useQuery({});

	const announcements = (listQuery.data?.announcements ??
		[]) as AnnouncementItem[];
	const stats = statsQuery.data?.stats;

	if (listQuery.isError) {
		return (
			<div>
				<h1 className="mb-4 font-bold text-2xl text-foreground">
					Announcements
				</h1>
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
				>
					<p className="font-semibold text-destructive">
						Failed to load announcements
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Check your connection and try again.
					</p>
					<button
						type="button"
						onClick={() => void listQuery.refetch()}
						className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
					>
						Try again
					</button>
				</div>
			</div>
		);
	}

	return (
		<div>
			{/* Header */}
			<div className="mb-6 flex items-start justify-between gap-4">
				<div>
					<h1 className="text-balance font-bold text-2xl text-foreground">
						Announcements
					</h1>
					<p className="mt-1 text-pretty text-muted-foreground text-sm">
						Manage site-wide announcement bars, banners, and popup notices.
					</p>
				</div>
				<a
					href="/admin/announcements/new"
					className="flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<line x1="12" x2="12" y1="5" y2="19" />
						<line x1="5" x2="19" y1="12" y2="12" />
					</svg>
					New Announcement
				</a>
			</div>

			{/* Stats cards */}
			{stats ? (
				<div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs uppercase tracking-wide">
							Active
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
							{stats.activeAnnouncements as number}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs uppercase tracking-wide">
							Scheduled
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
							{stats.scheduledAnnouncements as number}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs uppercase tracking-wide">
							Impressions
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
							{(stats.totalImpressions as number).toLocaleString()}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs uppercase tracking-wide">
							Click rate
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
							{((stats.clickRate as number) * 100).toFixed(1)}%
						</p>
					</div>
				</div>
			) : (
				<div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
					{STAT_SKELETON_KEYS.map((k) => (
						<div
							key={k}
							className="rounded-lg border border-border bg-card p-4"
						>
							<Skeleton className="h-3 w-16" />
							<Skeleton className="mt-2 h-7 w-12" />
						</div>
					))}
				</div>
			)}

			{/* Filter bar */}
			<div className="mb-4">
				<select
					aria-label="Filter by type"
					value={typeFilter}
					onChange={(e) => setTypeFilter(e.target.value)}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">All types</option>
					<option value="bar">Bar</option>
					<option value="banner">Banner</option>
					<option value="popup">Popup</option>
				</select>
			</div>

			{/* Table */}
			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Title
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Type
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Audience
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Status
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Impressions
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{listQuery.isLoading ? (
							SKELETON_ROW_KEYS.map((rk) => (
								<tr key={rk}>
									{SKELETON_CELL_KEYS.map((ck) => (
										<td key={ck} className="px-4 py-3">
											<Skeleton className="h-4" />
										</td>
									))}
								</tr>
							))
						) : announcements.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground">
										No announcements yet
									</p>
									<p className="mt-1 text-pretty text-muted-foreground text-sm">
										Create your first announcement to get started.
									</p>
									<a
										href="/admin/announcements/new"
										className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
									>
										New Announcement
									</a>
								</td>
							</tr>
						) : (
							announcements.map((a) => (
								<tr key={a.id} className="hover:bg-muted/30">
									<td className="px-4 py-3">
										<a
											href={`/admin/announcements/${a.id}`}
											className="block max-w-[200px] truncate font-medium text-foreground text-sm hover:text-primary"
										>
											{a.title}
										</a>
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs capitalize ${TYPE_COLORS[a.type] ?? "bg-muted text-muted-foreground"}`}
										>
											{a.type}
										</span>
									</td>
									<td className="hidden px-4 py-3 sm:table-cell">
										<span className="text-muted-foreground text-sm">
											{AUDIENCE_LABELS[a.targetAudience] ?? a.targetAudience}
										</span>
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												a.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{a.isActive ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="hidden px-4 py-3 text-right lg:table-cell">
										<span className="text-muted-foreground text-sm tabular-nums">
											{a.impressions.toLocaleString()}
										</span>
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center justify-end gap-1">
											<a
												href={`/admin/announcements/${a.id}/edit`}
												className="rounded px-2 py-1 text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
											>
												Edit
											</a>
											<button
												type="button"
												onClick={() => setDeleteTarget(a)}
												className="rounded px-2 py-1 text-muted-foreground text-sm hover:bg-destructive/10 hover:text-destructive"
											>
												Delete
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{deleteTarget && (
				<DeleteModal
					announcement={deleteTarget}
					onClose={() => setDeleteTarget(null)}
					onSuccess={() => setDeleteTarget(null)}
				/>
			)}
		</div>
	);
}
