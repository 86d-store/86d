"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { type ReactNode, useEffect, useRef, useState } from "react";
import CampaignAdminTemplate from "./campaign-admin.mdx";

interface Campaign {
	id: string;
	subject: string;
	body: string;
	status: "draft" | "scheduled" | "sending" | "sent";
	recipientCount: number;
	sentCount: number;
	failedCount: number;
	tags: string[];
	scheduledAt?: string | null;
	sentAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

interface CampaignStats {
	total: number;
	draft: number;
	scheduled: number;
	sending: number;
	sent: number;
	totalRecipients: number;
	totalSent: number;
	totalFailed: number;
}

const STATUS_COLORS: Record<string, string> = {
	draft: "bg-muted text-muted-foreground",
	scheduled:
		"bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
	sending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	sent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function formatDate(dateStr: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(dateStr));
}

function useCampaignApi() {
	const client = useModuleClient();
	return {
		list: client.module("newsletter").admin["/admin/newsletter/campaigns"],
		create:
			client.module("newsletter").admin["/admin/newsletter/campaigns/create"],
		stats:
			client.module("newsletter").admin["/admin/newsletter/campaigns/stats"],
		update:
			client.module("newsletter").admin["/admin/newsletter/campaigns/:id"],
		delete:
			client.module("newsletter").admin[
				"/admin/newsletter/campaigns/:id/delete"
			],
		send: client.module("newsletter").admin[
			"/admin/newsletter/campaigns/:id/send"
		],
	};
}

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-xl border border-border bg-card p-4">
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
				{label}
			</p>
			<p className="mt-1 font-semibold text-foreground text-xl">{value}</p>
		</div>
	);
}

function CreateCampaignModal({
	onClose,
	onSuccess,
}: {
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useCampaignApi();
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.stats.invalidate();
			onSuccess();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!subject.trim() || !body.trim()) return;
		createMutation.mutate({ body: { subject, body } });
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl"
			>
				<form onSubmit={handleSubmit}>
					<div className="px-6 py-5">
						<h2 className="font-semibold text-foreground text-lg">
							New campaign
						</h2>
						<div className="mt-4 space-y-4">
							<div>
								<label
									htmlFor="campaign-subject"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Subject line
								</label>
								<input
									ref={firstInputRef}
									id="campaign-subject"
									type="text"
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
									placeholder="Your email subject"
									className="h-10 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									required
								/>
							</div>
							<div>
								<label
									htmlFor="campaign-body"
									className="mb-1.5 block font-medium text-foreground text-sm"
								>
									Email body
								</label>
								<textarea
									id="campaign-body"
									value={body}
									onChange={(e) => setBody(e.target.value)}
									placeholder="Write your email content here..."
									rows={8}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									required
								/>
							</div>
						</div>
					</div>
					<div className="flex justify-end gap-2 border-border border-t px-6 py-4">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={
								createMutation.isPending || !subject.trim() || !body.trim()
							}
							className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:bg-foreground/90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create draft"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function SendConfirmModal({
	campaign,
	onClose,
	onSuccess,
}: {
	campaign: Campaign;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useCampaignApi();
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	const sendMutation = api.send.useMutation({
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
						Send campaign?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						This will send{" "}
						<span className="font-medium text-foreground">
							&ldquo;{campaign.subject}&rdquo;
						</span>{" "}
						to all active subscribers. This action cannot be undone.
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
								sendMutation.mutate({
									params: { id: campaign.id },
								})
							}
							disabled={sendMutation.isPending}
							className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:bg-foreground/90 disabled:opacity-50"
						>
							{sendMutation.isPending ? "Sending..." : "Send now"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function DeleteCampaignModal({
	campaign,
	onClose,
	onSuccess,
}: {
	campaign: Campaign;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const api = useCampaignApi();
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
						Delete campaign?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">
							&ldquo;{campaign.subject}&rdquo;
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
								deleteMutation.mutate({
									params: { id: campaign.id },
								})
							}
							disabled={deleteMutation.isPending}
							className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

type ModalState =
	| { type: "create" }
	| { type: "send"; campaign: Campaign }
	| { type: "delete"; campaign: Campaign }
	| null;

export function CampaignAdmin() {
	const api = useCampaignApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [page, setPage] = useState(1);
	const [modal, setModal] = useState<ModalState>(null);
	const pageSize = 25;

	useEffect(() => {
		if (!modal) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setModal(null);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [modal]);

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(pageSize),
	};
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data,
		isLoading: loading,
		isError: campaignsError,
		refetch: refetchCampaigns,
	} = api.list.useQuery(queryInput) as {
		data: { campaigns: Campaign[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats: CampaignStats } | undefined;
	};

	if (campaignsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load campaigns
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchCampaigns()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const campaigns = data?.campaigns ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const stats = statsData?.stats;

	const statsCards = stats ? (
		<div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard label="Total Campaigns" value={stats.total} />
			<StatCard label="Drafts" value={stats.draft} />
			<StatCard label="Sent" value={stats.sent} />
			<StatCard label="Total Delivered" value={stats.totalSent} />
		</div>
	) : null;

	const tableBody = loading ? (
		Array.from({ length: 5 }).map((_, i) => (
			<tr key={`skeleton-${i}`}>
				{Array.from({ length: 6 }).map((_, j) => (
					<td key={`skeleton-cell-${j}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : campaigns.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">
					No campaigns found
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					{statusFilter
						? "No campaigns match the current filter"
						: "Create your first campaign to get started"}
				</p>
			</td>
		</tr>
	) : (
		campaigns.map((c) => (
			<tr key={c.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3">
					<span className="font-medium text-foreground text-sm">
						{c.subject}
					</span>
					{c.tags.length > 0 && (
						<div className="mt-0.5 flex flex-wrap gap-1">
							{c.tags.slice(0, 2).map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground text-xs"
								>
									{tag}
								</span>
							))}
						</div>
					)}
				</td>
				<td className="px-4 py-3">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}
					>
						{c.status}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-right text-foreground text-sm sm:table-cell">
					{c.recipientCount}
				</td>
				<td className="hidden px-4 py-3 text-right text-foreground text-sm md:table-cell">
					{c.sentCount}
					{c.failedCount > 0 && (
						<span className="ml-1 text-destructive text-xs">
							({c.failedCount} failed)
						</span>
					)}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
					{c.sentAt
						? formatDate(c.sentAt)
						: c.scheduledAt
							? `Scheduled: ${formatDate(c.scheduledAt)}`
							: formatDate(c.createdAt)}
				</td>
				<td className="px-4 py-3 text-right">
					<div className="flex items-center justify-end gap-1">
						{(c.status === "draft" || c.status === "scheduled") && (
							<button
								type="button"
								onClick={() => setModal({ type: "send", campaign: c })}
								className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
							>
								Send
							</button>
						)}
						{c.status !== "sending" && (
							<button
								type="button"
								onClick={() => setModal({ type: "delete", campaign: c })}
								className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
							>
								Delete
							</button>
						)}
					</div>
				</td>
			</tr>
		))
	);

	const subtitle = `${stats?.total ?? 0} campaign${stats?.total === 1 ? "" : "s"}`;

	let modalContent: ReactNode = null;
	if (modal?.type === "create") {
		modalContent = (
			<CreateCampaignModal
				onClose={() => setModal(null)}
				onSuccess={() => setModal(null)}
			/>
		);
	} else if (modal?.type === "send") {
		modalContent = (
			<SendConfirmModal
				campaign={modal.campaign}
				onClose={() => setModal(null)}
				onSuccess={() => setModal(null)}
			/>
		);
	} else if (modal?.type === "delete") {
		modalContent = (
			<DeleteCampaignModal
				campaign={modal.campaign}
				onClose={() => setModal(null)}
				onSuccess={() => setModal(null)}
			/>
		);
	}

	return (
		<CampaignAdminTemplate
			subtitle={subtitle}
			onCreateNew={() => setModal({ type: "create" })}
			statsCards={statsCards}
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
			modal={modalContent}
		/>
	);
}
