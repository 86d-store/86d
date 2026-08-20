"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import OrderNotesOverviewTemplate from "./order-notes-overview.mdx";

interface OrderNote {
	id: string;
	orderId: string;
	authorId: string;
	authorName: string;
	authorType: string;
	content: string;
	isInternal: boolean;
	isPinned: boolean;
	createdAt: string;
	updatedAt: string;
}

interface SummaryData {
	totalNotes: number;
	notesPerOrder: number;
	internalCount: number;
	customerCount: number;
	adminCount: number;
}

type AuthorTypeFilter = "all" | "customer" | "admin" | "system";

const AUTHOR_TYPE_FILTERS: { label: string; value: AuthorTypeFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Customer", value: "customer" },
	{ label: "Admin", value: "admin" },
	{ label: "System", value: "system" },
];

const PAGE_SIZE = 20;

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
	const err = error as Error & {
		body?: { error?: string | { message?: string } };
	};
	const body = err.body;
	if (typeof body?.error === "string") return body.error;
	if (
		typeof body?.error === "object" &&
		body.error &&
		typeof body.error.message === "string"
	)
		return body.error.message;
	return fallback;
}

function useOrderNotesAdminApi() {
	const client = useModuleClient();
	return {
		listAll: client.module("order-notes").admin["/admin/order-notes"],
		summary: client.module("order-notes").admin["/admin/order-notes/summary"],
		deleteNote:
			client.module("order-notes").admin["/admin/order-notes/:id/delete"],
		togglePin:
			client.module("order-notes").admin["/admin/order-notes/:id/toggle-pin"],
	};
}

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-xl border border-border bg-card p-5">
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
				{label}
			</p>
			<p className="mt-1 font-semibold text-2xl text-foreground">{value}</p>
		</div>
	);
}

function AuthorTypeBadge({ authorType }: { authorType: string }) {
	const styles: Record<string, string> = {
		customer: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
		admin:
			"bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
		system: "bg-muted/30 text-foreground/80 dark:bg-background",
	};

	return (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs capitalize ${styles[authorType] ?? styles.system}`}
		>
			{authorType}
		</span>
	);
}

function PinBadge() {
	return (
		<span
			className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-950 dark:text-amber-300"
			title="Pinned"
		>
			<svg
				aria-hidden="true"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="shrink-0"
			>
				<line x1="12" y1="17" x2="12" y2="22" />
				<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
			</svg>
			Pinned
		</span>
	);
}

function InternalBadge() {
	return (
		<span
			className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 text-xs dark:bg-slate-800 dark:text-slate-300"
			title="Internal note"
		>
			<svg
				aria-hidden="true"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="shrink-0"
			>
				<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
				<circle cx="12" cy="12" r="3" />
				<line x1="1" y1="1" x2="23" y2="23" />
			</svg>
			Internal
		</span>
	);
}

export function OrderNotesOverview() {
	const api = useOrderNotesAdminApi();
	const [authorTypeFilter, setAuthorTypeFilter] =
		useState<AuthorTypeFilter>("all");
	const [orderIdFilter, setOrderIdFilter] = useState("");
	const [internalFilter, setInternalFilter] = useState<
		"all" | "true" | "false"
	>("all");
	const [skip, setSkip] = useState(0);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
		skip: String(skip),
	};
	if (authorTypeFilter !== "all") {
		queryInput.authorType = authorTypeFilter;
	}
	if (orderIdFilter.trim()) {
		queryInput.orderId = orderIdFilter.trim();
	}
	if (internalFilter !== "all") {
		queryInput.isInternal = internalFilter;
	}

	const { data: summaryData, isLoading: summaryLoading } = api.summary.useQuery(
		{},
	) as {
		data: SummaryData | undefined;
		isLoading: boolean;
	};

	const { data, isLoading: loading } = api.listAll.useQuery(queryInput) as {
		data: { notes: OrderNote[]; total: number } | undefined;
		isLoading: boolean;
	};

	const notes = data?.notes ?? [];
	const total = data?.total ?? 0;

	const deleteMutation = api.deleteNote.useMutation({
		onSettled: () => {
			setActionLoading(null);
			void api.listAll.invalidate();
			void api.summary.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete note."));
		},
	});

	const togglePinMutation = api.togglePin.useMutation({
		onSettled: () => {
			setActionLoading(null);
			void api.listAll.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to toggle pin."));
		},
	});

	const handleDelete = (id: string) => {
		setActionLoading(id);
		setDeleteConfirm(null);
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	const handleTogglePin = (id: string) => {
		setActionLoading(id);
		setError("");
		togglePinMutation.mutate({ params: { id } });
	};

	const handleFilterChange = (filter: AuthorTypeFilter) => {
		setAuthorTypeFilter(filter);
		setSkip(0);
	};

	const handleOrderIdChange = (value: string) => {
		setOrderIdFilter(value);
		setSkip(0);
	};

	const handleInternalChange = (value: "all" | "true" | "false") => {
		setInternalFilter(value);
		setSkip(0);
	};

	const hasPrev = skip > 0;
	const hasNext = skip + PAGE_SIZE < total;
	const showingFrom = notes.length > 0 ? skip + 1 : 0;
	const showingTo = Math.min(skip + PAGE_SIZE, total);

	const summaryCards = summaryLoading ? (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{[1, 2, 3, 4].map((n) => (
				<div
					key={n}
					className="h-20 animate-pulse rounded-xl border border-border bg-card"
				/>
			))}
		</div>
	) : summaryData ? (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard label="Total Notes" value={summaryData.totalNotes} />
			<StatCard label="Customer Notes" value={summaryData.customerCount} />
			<StatCard label="Admin Notes" value={summaryData.adminCount} />
			<StatCard label="Internal Notes" value={summaryData.internalCount} />
		</div>
	) : null;

	const filters = (
		<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
			<div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
				{AUTHOR_TYPE_FILTERS.map((f) => (
					<button
						key={f.value}
						type="button"
						onClick={() => handleFilterChange(f.value)}
						className={`rounded-md px-3 py-1 font-medium text-sm transition-colors ${
							authorTypeFilter === f.value
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						{f.label}
					</button>
				))}
			</div>
			<input
				type="text"
				placeholder="Filter by Order ID..."
				value={orderIdFilter}
				onChange={(e) => handleOrderIdChange(e.target.value)}
				className="rounded-lg border border-border bg-background px-3 py-1.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			/>
			<select
				value={internalFilter}
				onChange={(e) =>
					handleInternalChange(e.target.value as "all" | "true" | "false")
				}
				className="rounded-lg border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			>
				<option value="all">All visibility</option>
				<option value="true">Internal only</option>
				<option value="false">Public only</option>
			</select>
		</div>
	);

	const notesList =
		loading && notes.length === 0 ? (
			<div className="space-y-3">
				{[1, 2, 3].map((n) => (
					<div
						key={n}
						className="h-24 animate-pulse rounded-lg border border-border bg-card"
					/>
				))}
			</div>
		) : notes.length === 0 ? (
			<div className="rounded-xl border border-border bg-muted/30 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No notes found</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Try adjusting your filters.
				</p>
			</div>
		) : (
			<div className="space-y-3">
				{notes.map((note) => (
					<div
						key={note.id}
						className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/20"
					>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0 flex-1">
								<div className="mb-1 flex flex-wrap items-center gap-2">
									<span className="font-medium text-foreground text-sm">
										{note.authorName}
									</span>
									<AuthorTypeBadge authorType={note.authorType} />
									{note.isPinned && <PinBadge />}
									{note.isInternal && <InternalBadge />}
								</div>
								<p className="whitespace-pre-wrap text-foreground text-sm">
									{note.content}
								</p>
								<div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
									<span>
										Order{" "}
										<code className="rounded bg-muted px-1 py-0.5">
											{note.orderId}
										</code>
									</span>
									<span>{formatDate(note.createdAt)}</span>
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-1">
								{deleteConfirm === note.id ? (
									<span className="inline-flex items-center gap-1.5">
										<span className="text-muted-foreground text-xs">
											Delete?
										</span>
										<button
											type="button"
											disabled={actionLoading === note.id}
											onClick={() => handleDelete(note.id)}
											className="rounded px-2 py-1 font-medium text-red-600 text-xs hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
										>
											Confirm
										</button>
										<button
											type="button"
											onClick={() => setDeleteConfirm(null)}
											className="rounded px-2 py-1 font-medium text-muted-foreground text-xs hover:bg-muted"
										>
											Cancel
										</button>
									</span>
								) : (
									<>
										<button
											type="button"
											disabled={actionLoading === note.id}
											onClick={() => handleTogglePin(note.id)}
											className="rounded px-2 py-1 font-medium text-foreground text-xs hover:bg-muted disabled:opacity-50"
										>
											{note.isPinned ? "Unpin" : "Pin"}
										</button>
										<button
											type="button"
											disabled={actionLoading === note.id}
											onClick={() => setDeleteConfirm(note.id)}
											className="rounded px-2 py-1 font-medium text-destructive text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
										>
											Delete
										</button>
									</>
								)}
							</div>
						</div>
					</div>
				))}
			</div>
		);

	const pagination = (
		<div className="flex items-center justify-between">
			<p className="text-muted-foreground text-sm">
				Showing {showingFrom}–{showingTo} of {total}
			</p>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={!hasPrev || loading}
					onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
					className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
				>
					Previous
				</button>
				<button
					type="button"
					disabled={!hasNext || loading}
					onClick={() => setSkip((s) => s + PAGE_SIZE)}
					className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
				>
					Next
				</button>
			</div>
		</div>
	);

	return (
		<OrderNotesOverviewTemplate
			summaryCards={summaryCards}
			filters={filters}
			error={error}
			notesList={notesList}
			pagination={pagination}
			total={total}
		/>
	);
}
