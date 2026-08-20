"use client";

import { useState } from "react";
import { useOrderNotesApi } from "./_hooks";
import OrderNotesTemplate from "./order-notes.mdx";

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

function AuthorTypeBadge({ authorType }: { authorType: string }) {
	const styles: Record<string, string> = {
		customer: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
		admin:
			"bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
		system: "bg-muted text-muted-foreground",
	};

	return (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs capitalize ${styles[authorType] ?? styles.system}`}
		>
			{authorType}
		</span>
	);
}

export function OrderNotes({
	orderId,
	customerId,
}: {
	orderId: string;
	customerId?: string | undefined;
}) {
	const api = useOrderNotesApi();
	const [newNote, setNewNote] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editContent, setEditContent] = useState("");
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data, isLoading: loading } = api.listNotes.useQuery({
		params: { orderId },
	}) as {
		data: { notes: OrderNote[]; total: number } | undefined;
		isLoading: boolean;
	};

	const notes = data?.notes ?? [];
	const total = data?.total ?? 0;

	const addMutation = api.addNote.useMutation({
		onSettled: () => {
			setSubmitting(false);
			void api.listNotes.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to add note."));
		},
		onSuccess: () => {
			setNewNote("");
			setError("");
		},
	});

	const updateMutation = api.updateNote.useMutation({
		onSettled: () => {
			setSubmitting(false);
			void api.listNotes.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to update note."));
		},
		onSuccess: () => {
			setEditingId(null);
			setEditContent("");
			setError("");
		},
	});

	const deleteMutation = api.deleteNote.useMutation({
		onSettled: () => {
			setSubmitting(false);
			void api.listNotes.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete note."));
		},
		onSuccess: () => {
			setDeleteConfirm(null);
			setError("");
		},
	});

	const handleAddNote = () => {
		if (!newNote.trim()) return;
		setSubmitting(true);
		setError("");
		addMutation.mutate({
			params: { orderId },
			content: newNote.trim(),
		});
	};

	const handleUpdate = (noteId: string) => {
		if (!editContent.trim()) return;
		setSubmitting(true);
		setError("");
		updateMutation.mutate({
			params: { noteId },
			content: editContent.trim(),
		});
	};

	const handleDelete = (noteId: string) => {
		setSubmitting(true);
		setDeleteConfirm(null);
		setError("");
		deleteMutation.mutate({ params: { noteId } });
	};

	const startEdit = (note: OrderNote) => {
		setEditingId(note.id);
		setEditContent(note.content);
		setError("");
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditContent("");
	};

	const isOwnNote = (note: OrderNote) =>
		customerId !== undefined && note.authorId === customerId;

	const noteCards = loading ? (
		<div className="space-y-3">
			{[1, 2, 3].map((n) => (
				<div
					key={n}
					className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
				/>
			))}
		</div>
	) : notes.length === 0 ? (
		<div className="rounded-xl border border-border bg-muted/30 py-10 text-center">
			<p className="font-medium text-foreground text-sm">No notes yet</p>
			<p className="mt-1 text-muted-foreground text-sm">
				Add a note to communicate with the store about this order.
			</p>
		</div>
	) : (
		<div className="space-y-3">
			{notes.map((note) => (
				<div
					key={note.id}
					className="rounded-lg border border-border bg-card p-4"
				>
					{editingId === note.id ? (
						<div className="space-y-2">
							<textarea
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								rows={3}
								className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={submitting || !editContent.trim()}
									onClick={() => handleUpdate(note.id)}
									className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
								>
									{submitting ? "Saving..." : "Save"}
								</button>
								<button
									type="button"
									onClick={cancelEdit}
									className="rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-muted"
								>
									Cancel
								</button>
							</div>
						</div>
					) : (
						<>
							<div className="mb-1 flex flex-wrap items-center gap-2">
								<span className="font-medium text-foreground text-sm">
									{note.authorName}
								</span>
								<AuthorTypeBadge authorType={note.authorType} />
								<span className="text-muted-foreground text-xs">
									{formatDate(note.createdAt)}
								</span>
							</div>
							<p className="whitespace-pre-wrap text-foreground text-sm">
								{note.content}
							</p>
							{isOwnNote(note) && (
								<div className="mt-2 flex gap-2">
									<button
										type="button"
										onClick={() => startEdit(note)}
										className="font-medium text-blue-600 text-xs hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
									>
										Edit
									</button>
									{deleteConfirm === note.id ? (
										<span className="inline-flex items-center gap-1.5">
											<span className="text-muted-foreground text-xs">
												Delete?
											</span>
											<button
												type="button"
												disabled={submitting}
												onClick={() => handleDelete(note.id)}
												className="font-medium text-red-600 text-xs hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
											>
												Confirm
											</button>
											<button
												type="button"
												onClick={() => setDeleteConfirm(null)}
												className="font-medium text-muted-foreground text-xs hover:text-foreground"
											>
												Cancel
											</button>
										</span>
									) : (
										<button
											type="button"
											onClick={() => setDeleteConfirm(note.id)}
											className="font-medium text-red-600 text-xs hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
										>
											Delete
										</button>
									)}
								</div>
							)}
						</>
					)}
				</div>
			))}
		</div>
	);

	const addNoteForm = (
		<div className="space-y-2">
			<textarea
				value={newNote}
				onChange={(e) => setNewNote(e.target.value)}
				placeholder="Add a note..."
				rows={3}
				className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			/>
			<button
				type="button"
				disabled={submitting || !newNote.trim()}
				onClick={handleAddNote}
				className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
			>
				{submitting ? "Adding..." : "Add Note"}
			</button>
		</div>
	);

	return (
		<OrderNotesTemplate
			total={total}
			error={error}
			noteCards={noteCards}
			addNoteForm={addNoteForm}
		/>
	);
}
