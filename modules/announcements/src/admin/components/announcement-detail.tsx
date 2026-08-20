"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

function useAnnouncementsAdminApi() {
	const client = useModuleClient();
	const api = client.module("announcements").admin;
	return {
		getAnnouncement: api["/admin/announcements/:id"],
		deleteAnnouncement: api["/admin/announcements/:id/delete"],
		updateAnnouncement: api["/admin/announcements/:id/update"],
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

interface Announcement {
	id: string;
	title: string;
	content: string;
	type: string;
	position: string;
	isActive: boolean;
	isDismissible: boolean;
	priority: number;
	impressions: number;
	clicks: number;
	dismissals: number;
	linkUrl?: string;
	linkText?: string;
	backgroundColor?: string;
	textColor?: string;
	iconName?: string;
	startsAt?: string;
	endsAt?: string;
	targetAudience: string;
	createdAt: string;
	updatedAt: string;
}

function DeleteModal({
	title,
	onClose,
	onDelete,
	isPending,
}: {
	title: string;
	onClose: () => void;
	onDelete: () => void;
	isPending: boolean;
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
						<span className="font-medium text-foreground">{title}</span> will be
						permanently deleted.
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
							onClick={onDelete}
							disabled={isPending}
							className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
						>
							{isPending ? "Deleting…" : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function InfoRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex gap-4 py-3">
			<dt className="w-36 shrink-0 text-muted-foreground text-sm">{label}</dt>
			<dd className="text-foreground text-sm">{children}</dd>
		</div>
	);
}

export function AnnouncementDetail({ id }: { id: string }) {
	const api = useAnnouncementsAdminApi();
	const [showDelete, setShowDelete] = useState(false);
	const [error, setError] = useState("");

	const announcementQuery = api.getAnnouncement.useQuery({ params: { id } });
	const toggleMutation = api.updateAnnouncement.useMutation({
		onSuccess: () => void announcementQuery.refetch(),
		onError: () => setError("Failed to update status."),
	});
	const deleteMutation = api.deleteAnnouncement.useMutation({
		onSuccess: () => {
			window.location.href = "/admin/announcements";
		},
		onError: () => setError("Failed to delete announcement."),
	});

	const announcement = announcementQuery.data?.announcement as
		| Announcement
		| undefined;

	const clickRate =
		announcement && announcement.impressions > 0
			? ((announcement.clicks / announcement.impressions) * 100).toFixed(1)
			: "0.0";

	if (announcementQuery.isLoading) {
		return (
			<div>
				<Skeleton className="mb-4 h-7 w-1/2" />
				<div className="space-y-3">
					{Array.from({ length: 8 }, (_, i) => (
						<div key={`sk-${i}`} className="flex gap-4">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-48" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!announcement) {
		return (
			<div className="py-12 text-center">
				<p className="font-medium text-foreground">Announcement not found</p>
				<a
					href="/admin/announcements"
					className="mt-4 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
				>
					← Back to announcements
				</a>
			</div>
		);
	}

	return (
		<div>
			{/* Back link */}
			<a
				href="/admin/announcements"
				className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
			>
				← Announcements
			</a>

			{/* Header */}
			<div className="mb-6 flex items-start justify-between gap-4">
				<div className="flex items-center gap-3">
					<h1 className="text-balance font-bold text-2xl text-foreground">
						{announcement.title}
					</h1>
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs capitalize ${TYPE_COLORS[announcement.type] ?? "bg-muted text-muted-foreground"}`}
					>
						{announcement.type}
					</span>
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
							announcement.isActive
								? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
								: "bg-muted text-muted-foreground"
						}`}
					>
						{announcement.isActive ? "Active" : "Inactive"}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						onClick={() =>
							toggleMutation.mutate({
								params: { id },
								body: { isActive: !announcement.isActive },
							})
						}
						disabled={toggleMutation.isPending}
						className="rounded-md border border-border px-3 py-2 text-foreground text-sm hover:bg-muted disabled:opacity-50"
					>
						{announcement.isActive ? "Deactivate" : "Activate"}
					</button>
					<a
						href={`/admin/announcements/${id}/edit`}
						className="rounded-md border border-border px-3 py-2 text-foreground text-sm hover:bg-muted"
					>
						Edit
					</a>
					<button
						type="button"
						onClick={() => setShowDelete(true)}
						className="rounded-md px-3 py-2 text-destructive text-sm hover:bg-destructive/10"
					>
						Delete
					</button>
				</div>
			</div>

			{error && (
				<p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-destructive text-sm">
					{error}
				</p>
			)}

			{/* Stats cards */}
			<div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs uppercase tracking-wide">
						Impressions
					</p>
					<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
						{announcement.impressions.toLocaleString()}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs uppercase tracking-wide">
						Clicks
					</p>
					<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
						{announcement.clicks.toLocaleString()}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs uppercase tracking-wide">
						Dismissals
					</p>
					<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
						{announcement.dismissals.toLocaleString()}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<p className="text-muted-foreground text-xs uppercase tracking-wide">
						Click rate
					</p>
					<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
						{clickRate}%
					</p>
				</div>
			</div>

			{/* Details */}
			<div className="rounded-lg border border-border bg-card px-6">
				<dl className="divide-y divide-border">
					<InfoRow label="Content">
						<span className="text-pretty">{announcement.content}</span>
					</InfoRow>
					<InfoRow label="Type">{announcement.type}</InfoRow>
					<InfoRow label="Position">{announcement.position}</InfoRow>
					<InfoRow label="Target audience">
						{announcement.targetAudience === "all"
							? "All visitors"
							: announcement.targetAudience === "authenticated"
								? "Logged-in users"
								: "Guests only"}
					</InfoRow>
					<InfoRow label="Dismissible">
						{announcement.isDismissible ? "Yes" : "No"}
					</InfoRow>
					<InfoRow label="Priority">
						<span className="tabular-nums">{announcement.priority}</span>
					</InfoRow>
					{announcement.linkUrl && (
						<InfoRow label="Link">
							<a
								href={announcement.linkUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								{announcement.linkText ?? announcement.linkUrl}
							</a>
						</InfoRow>
					)}
					{announcement.backgroundColor && (
						<InfoRow label="Background">
							<div className="flex items-center gap-2">
								<span
									className="inline-block size-4 rounded border border-border"
									style={{ backgroundColor: announcement.backgroundColor }}
									aria-hidden="true"
								/>
								<span className="font-mono text-xs tabular-nums">
									{announcement.backgroundColor}
								</span>
							</div>
						</InfoRow>
					)}
					{announcement.textColor && (
						<InfoRow label="Text color">
							<div className="flex items-center gap-2">
								<span
									className="inline-block size-4 rounded border border-border"
									style={{ backgroundColor: announcement.textColor }}
									aria-hidden="true"
								/>
								<span className="font-mono text-xs tabular-nums">
									{announcement.textColor}
								</span>
							</div>
						</InfoRow>
					)}
					{announcement.startsAt && (
						<InfoRow label="Starts at">
							<span className="tabular-nums">
								{new Date(announcement.startsAt).toLocaleString()}
							</span>
						</InfoRow>
					)}
					{announcement.endsAt && (
						<InfoRow label="Ends at">
							<span className="tabular-nums">
								{new Date(announcement.endsAt).toLocaleString()}
							</span>
						</InfoRow>
					)}
					<InfoRow label="Created">
						<span className="tabular-nums">
							{new Date(announcement.createdAt).toLocaleString()}
						</span>
					</InfoRow>
					<InfoRow label="Updated">
						<span className="tabular-nums">
							{new Date(announcement.updatedAt).toLocaleString()}
						</span>
					</InfoRow>
				</dl>
			</div>

			{showDelete && (
				<DeleteModal
					title={announcement.title}
					onClose={() => setShowDelete(false)}
					onDelete={() => deleteMutation.mutate({ params: { id } })}
					isPending={deleteMutation.isPending}
				/>
			)}
		</div>
	);
}
