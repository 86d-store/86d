"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useMemo, useState } from "react";
import OrderActivityTemplate from "./order-activity.mdx";

// ── Types ──────────────────────────────────────────────────────────────────

interface OrderNote {
	id: string;
	orderId: string;
	type: "note" | "system";
	content: string;
	authorId?: string | null;
	authorName?: string | null;
	metadata?: Record<string, unknown> | null;
	createdAt: string;
}

interface FulfillmentWithItems {
	id: string;
	orderId: string;
	status: string;
	trackingNumber?: string | null;
	carrier?: string | null;
	shippedAt?: string | null;
	deliveredAt?: string | null;
	createdAt: string;
}

interface ReturnRequestWithItems {
	id: string;
	orderId: string;
	status: string;
	type: string;
	reason: string;
	createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function relativeTime(iso: string): string {
	const now = Date.now();
	const then = new Date(iso).getTime();
	const diff = now - then;

	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return formatDate(iso);
}

// ── Timeline Entry Types ───────────────────────────────────────────────────

interface TimelineEntry {
	id: string;
	date: string;
	type: "note" | "system" | "fulfillment" | "return" | "order";
	title: string;
	content?: string | undefined;
	authorName?: string | null | undefined;
	deletable?: boolean | undefined;
}

function useOrderNotesApi() {
	const client = useModuleClient();
	return {
		listNotes: client.module("orders").admin["/admin/orders/:id/notes"],
		addNote: client.module("orders").admin["/admin/orders/:id/notes/add"],
		deleteNote: client.module("orders").admin["/admin/orders/notes/:id/delete"],
		listFulfillments:
			client.module("orders").admin["/admin/orders/:id/fulfillments"],
		listReturns: client.module("orders").admin["/admin/orders/:id/returns"],
	};
}

// ── Add Note Form ──────────────────────────────────────────────────────────

function AddNoteForm({
	orderId,
	onAdded,
}: {
	orderId: string;
	onAdded: () => void;
}) {
	const api = useOrderNotesApi();
	const [content, setContent] = useState("");
	const [isOpen, setIsOpen] = useState(false);

	const addMutation = api.addNote.useMutation({
		onSuccess: () => {
			setContent("");
			setIsOpen(false);
			onAdded();
		},
	});

	const handleSubmit = () => {
		const trimmed = content.trim();
		if (!trimmed) return;
		addMutation.mutate({
			params: { id: orderId },
			body: { content: trimmed },
		});
	};

	if (!isOpen) {
		return (
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border border-dashed px-3 py-2 text-muted-foreground text-sm transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 256 256"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z" />
				</svg>
				Add note
			</button>
		);
	}

	return (
		<div className="rounded-lg border border-border bg-muted/30 p-3">
			<textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				rows={3}
				placeholder="Write an internal note..."
				className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none"
			/>
			<div className="flex items-center gap-2">
				<button
					type="button"
					disabled={addMutation.isPending || !content.trim()}
					onClick={handleSubmit}
					className="rounded-md bg-foreground px-3 py-1.5 text-background text-sm hover:bg-foreground/90 disabled:opacity-50"
				>
					{addMutation.isPending ? "Adding..." : "Add Note"}
				</button>
				<button
					type="button"
					onClick={() => {
						setIsOpen(false);
						setContent("");
					}}
					className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

// ── Timeline Item ──────────────────────────────────────────────────────────

function TimelineItem({
	entry,
	isLast,
	onDelete,
}: {
	entry: TimelineEntry;
	isLast: boolean;
	onDelete?: ((id: string) => void) | undefined;
}) {
	const [confirmDelete, setConfirmDelete] = useState(false);

	const iconColors: Record<string, string> = {
		note: "bg-amber-500",
		system: "bg-blue-500",
		fulfillment: "bg-green-500",
		return: "bg-orange-500",
		order: "bg-blue-500",
	};

	const iconSvgs: Record<string, React.ReactNode> = {
		note: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="10"
				height="10"
				viewBox="0 0 256 256"
				fill="white"
				aria-hidden="true"
			>
				<path d="M232,96V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H96a8,8,0,0,1,5.66,2.34L128,68.69,154.34,42.34A8,8,0,0,1,160,40h56a16,16,0,0,1,16,16Z" />
			</svg>
		),
		system: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="10"
				height="10"
				viewBox="0 0 256 256"
				fill="white"
				aria-hidden="true"
			>
				<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-4,48a12,12,0,1,1-12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z" />
			</svg>
		),
		fulfillment: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="10"
				height="10"
				viewBox="0 0 256 256"
				fill="white"
				aria-hidden="true"
			>
				<path d="M223.68,66.15,135.68,18.15a16,16,0,0,0-15.36,0l-88,48a16,16,0,0,0-8.32,14v111.7a16,16,0,0,0,8.32,14l88,48a16,16,0,0,0,15.36,0l88-48a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15Z" />
			</svg>
		),
		return: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="10"
				height="10"
				viewBox="0 0 256 256"
				fill="white"
				aria-hidden="true"
			>
				<path d="M232,200a8,8,0,0,1-16,0,88.1,88.1,0,0,0-88-88H51.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,85.66,61.66L51.31,96H128A104.11,104.11,0,0,1,232,200Z" />
			</svg>
		),
		order: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="10"
				height="10"
				viewBox="0 0 256 256"
				fill="white"
				aria-hidden="true"
			>
				<path d="M216,64H176a48,48,0,0,0-96,0H40A16,16,0,0,0,24,80V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V80A16,16,0,0,0,216,64Z" />
			</svg>
		),
	};

	return (
		<div className="group relative flex gap-3 pb-4 last:pb-0">
			{/* Vertical connector line */}
			{!isLast && (
				<div className="absolute top-5 left-[9px] h-[calc(100%-12px)] w-px bg-border" />
			)}
			{/* Icon dot */}
			<div
				className={`relative mt-1 flex size-[19px] shrink-0 items-center justify-center rounded-full ${iconColors[entry.type] ?? "bg-muted"}`}
			>
				{iconSvgs[entry.type]}
			</div>
			{/* Content */}
			<div className="min-w-0 flex-1">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						<p className="font-medium text-foreground text-sm">{entry.title}</p>
						{entry.content && (
							<p className="mt-0.5 whitespace-pre-wrap text-muted-foreground text-sm">
								{entry.content}
							</p>
						)}
						<div className="mt-1 flex items-center gap-2 text-muted-foreground/70 text-xs">
							<span title={formatDate(entry.date)}>
								{relativeTime(entry.date)}
							</span>
							{entry.authorName && (
								<>
									<span>·</span>
									<span>{entry.authorName}</span>
								</>
							)}
						</div>
					</div>
					{/* Delete button for notes */}
					{entry.deletable && onDelete && (
						<div className="shrink-0">
							{confirmDelete ? (
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={() => onDelete(entry.id)}
										className="rounded px-1.5 py-0.5 text-red-600 text-xs hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
									>
										Delete
									</button>
									<button
										type="button"
										onClick={() => setConfirmDelete(false)}
										className="rounded px-1.5 py-0.5 text-muted-foreground text-xs hover:bg-muted"
									>
										Cancel
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setConfirmDelete(true)}
									className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
									title="Delete note"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="14"
										height="14"
										viewBox="0 0 256 256"
										fill="currentColor"
										aria-hidden="true"
									>
										<path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
									</svg>
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ── Main Component ─────────────────────────────────────────────────────────

export function OrderActivity({ orderId }: { orderId: string }) {
	const api = useOrderNotesApi();
	const [filter, setFilter] = useState<"all" | "notes" | "events">("all");

	// Fetch notes
	const notesQuery = api.listNotes.useQuery({
		params: { id: orderId },
	});

	// Fetch fulfillments for system events
	const fulfillmentsQuery = api.listFulfillments.useQuery({
		params: { id: orderId },
	});

	// Fetch returns for system events
	const returnsQuery = api.listReturns.useQuery({
		params: { id: orderId },
	});

	const deleteMutation = api.deleteNote.useMutation({
		onSuccess: () => {
			notesQuery.refetch();
		},
	});

	const handleDelete = useCallback(
		(noteId: string) => {
			deleteMutation.mutate({ params: { id: noteId } });
		},
		[deleteMutation],
	);

	const handleNoteAdded = useCallback(() => {
		notesQuery.refetch();
	}, [notesQuery]);

	// Build unified timeline
	const entries = useMemo(() => {
		const list: TimelineEntry[] = [];

		// Add notes
		const notes =
			(notesQuery.data as { notes?: OrderNote[] } | undefined)?.notes ?? [];
		for (const note of notes) {
			list.push({
				id: note.id,
				date: note.createdAt,
				type: note.type === "system" ? "system" : "note",
				title: note.type === "system" ? "System" : "Internal Note",
				content: note.content,
				authorName: note.authorName,
				deletable: note.type === "note",
			});
		}

		// Add fulfillment events
		const fulfillments =
			(
				fulfillmentsQuery.data as
					| { fulfillments?: FulfillmentWithItems[] }
					| undefined
			)?.fulfillments ?? [];
		for (const f of fulfillments) {
			list.push({
				id: `ff-${f.id}`,
				date: f.createdAt,
				type: "fulfillment",
				title: "Fulfillment created",
				content: f.carrier
					? `${f.carrier}${f.trackingNumber ? ` — ${f.trackingNumber}` : ""}`
					: undefined,
			});
			if (f.shippedAt) {
				list.push({
					id: `ff-shipped-${f.id}`,
					date: f.shippedAt,
					type: "fulfillment",
					title: "Shipped",
					content: f.carrier ?? undefined,
				});
			}
			if (f.deliveredAt) {
				list.push({
					id: `ff-delivered-${f.id}`,
					date: f.deliveredAt,
					type: "fulfillment",
					title: "Delivered",
				});
			}
		}

		// Add return events
		const returns =
			(returnsQuery.data as { returns?: ReturnRequestWithItems[] } | undefined)
				?.returns ?? [];
		for (const r of returns) {
			list.push({
				id: `ret-${r.id}`,
				date: r.createdAt,
				type: "return",
				title: "Return requested",
				content: `${r.type.replace(/_/g, " ")} — ${r.reason.replace(/_/g, " ")}`,
			});
		}

		// Sort newest first
		return list.sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
		);
	}, [notesQuery.data, fulfillmentsQuery.data, returnsQuery.data]);

	// Apply filter
	const filteredEntries = useMemo(() => {
		if (filter === "all") return entries;
		if (filter === "notes")
			return entries.filter((e) => e.type === "note" || e.type === "system");
		return entries.filter(
			(e) =>
				e.type === "fulfillment" ||
				e.type === "return" ||
				e.type === "order" ||
				e.type === "system",
		);
	}, [entries, filter]);

	const isLoading =
		notesQuery.isLoading ||
		fulfillmentsQuery.isLoading ||
		returnsQuery.isLoading;

	if (notesQuery.isError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load order activity
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => void notesQuery.refetch()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	return (
		<OrderActivityTemplate
			orderId={orderId}
			entries={filteredEntries}
			filter={filter}
			isLoading={isLoading}
			noteCount={entries.filter((e) => e.type === "note").length}
			eventCount={
				entries.filter(
					(e) =>
						e.type === "fulfillment" ||
						e.type === "return" ||
						e.type === "order" ||
						e.type === "system",
				).length
			}
			onFilterChange={setFilter}
			onDelete={handleDelete}
			onNoteAdded={handleNoteAdded}
			AddNoteForm={AddNoteForm}
			TimelineItem={TimelineItem}
		/>
	);
}
