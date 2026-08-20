"use client";

import { useState } from "react";
import {
	extractError,
	PRIORITY_COLORS,
	PRIORITY_LABELS,
	STATUS_COLORS,
	STATUS_LABELS,
	type Ticket,
	useTicketsApi,
} from "./_shared";

interface TicketMessage {
	id: string;
	ticketId: string;
	body: string;
	authorType: string;
	authorId?: string;
	authorName: string;
	authorEmail?: string;
	isInternal: boolean;
	createdAt: string;
}

function formatDateTime(dateStr: string) {
	return new Date(dateStr).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function TicketDetail({ params }: { params: { id: string } }) {
	const api = useTicketsApi();
	const [replyBody, setReplyBody] = useState("");
	const [isInternal, setIsInternal] = useState(false);
	const [error, setError] = useState("");

	const { data, isLoading } = api.getTicket.useQuery({
		params: { id: params.id },
	}) as {
		data:
			| { ticket?: Ticket; messages?: TicketMessage[]; error?: string }
			| undefined;
		isLoading: boolean;
	};

	const replyMutation = api.adminReply.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const closeMutation = api.closeTicket.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const reopenMutation = api.reopenTicket.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const deleteTicketMutation = api.deleteTicket.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const updateMutation = api.updateTicket.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const ticket = data?.ticket;
	const messages = data?.messages ?? [];

	const handleReply = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!replyBody.trim()) {
			setError("Reply body is required.");
			return;
		}
		try {
			await replyMutation.mutateAsync({
				params: { id: params.id },
				body: {
					body: replyBody.trim(),
					authorName: "Admin",
					isInternal,
				},
			});
			setReplyBody("");
			setIsInternal(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleClose = async () => {
		try {
			await closeMutation.mutateAsync({ params: { id: params.id } });
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleReopen = async () => {
		try {
			await reopenMutation.mutateAsync({ params: { id: params.id } });
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleDelete = async () => {
		if (
			!window.confirm(
				"Permanently delete this ticket and all its messages? This cannot be undone.",
			)
		) {
			return;
		}
		try {
			await deleteTicketMutation.mutateAsync({ params: { id: params.id } });
			window.location.assign("/admin/tickets");
		} catch {
			// silently handled
		}
	};

	const handleStatusChange = async (newStatus: string) => {
		try {
			await updateMutation.mutateAsync({
				params: { id: params.id },
				body: { status: newStatus },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handlePriorityChange = async (newPriority: string) => {
		try {
			await updateMutation.mutateAsync({
				params: { id: params.id },
				body: { priority: newPriority },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
				<div className="h-32 animate-pulse rounded-lg border border-border bg-muted/30" />
				<div className="h-24 animate-pulse rounded-lg border border-border bg-muted/30" />
			</div>
		);
	}

	if (!ticket) {
		return (
			<div className="rounded-lg border border-border bg-card p-8 text-center">
				<p className="text-muted-foreground text-sm">Ticket not found.</p>
				<a
					href="/admin/tickets"
					className="mt-2 inline-block text-sm underline"
				>
					Back to tickets
				</a>
			</div>
		);
	}

	const isClosed = ticket.status === "closed";

	return (
		<div>
			{/* Header */}
			<div className="mb-6">
				<a
					href="/admin/tickets"
					className="text-muted-foreground text-sm hover:underline"
				>
					&larr; Back to tickets
				</a>
				<div className="mt-2 flex items-start justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<span className="font-mono text-muted-foreground text-sm">
								#{ticket.number}
							</span>
							<h1 className="font-bold text-foreground text-xl">
								{ticket.subject}
							</h1>
						</div>
						<div className="mt-1.5 flex flex-wrap items-center gap-2">
							<span
								className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[ticket.status] ?? "bg-muted text-muted-foreground"}`}
							>
								{STATUS_LABELS[ticket.status] ?? ticket.status}
							</span>
							<span
								className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${PRIORITY_COLORS[ticket.priority] ?? "bg-muted text-muted-foreground"}`}
							>
								{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
							</span>
						</div>
					</div>
					<div className="flex gap-2">
						{isClosed ? (
							<button
								type="button"
								onClick={handleReopen}
								disabled={reopenMutation.isPending}
								className="rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-sm hover:bg-muted disabled:opacity-50"
							>
								Reopen
							</button>
						) : (
							<button
								type="button"
								onClick={handleClose}
								disabled={closeMutation.isPending}
								className="rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-sm hover:bg-muted disabled:opacity-50"
							>
								Close
							</button>
						)}
						<button
							type="button"
							onClick={() => void handleDelete()}
							disabled={deleteTicketMutation.isPending}
							className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-600 text-sm hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:hover:bg-red-900/40"
						>
							{deleteTicketMutation.isPending ? "Deleting…" : "Delete"}
						</button>
					</div>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Message thread */}
				<div className="lg:col-span-2">
					{/* Original ticket description */}
					<div className="mb-4 rounded-lg border border-border bg-card p-4">
						<div className="mb-2 flex items-center justify-between">
							<span className="font-medium text-foreground text-sm">
								{ticket.customerName}
							</span>
							<span className="text-muted-foreground text-xs">
								{formatDateTime(ticket.createdAt)}
							</span>
						</div>
						<p className="whitespace-pre-wrap text-foreground text-sm">
							{ticket.description}
						</p>
					</div>

					{/* Messages */}
					{messages.length > 0 ? (
						<div className="space-y-3">
							{messages.map((msg) => (
								<div
									key={msg.id}
									className={`rounded-lg border p-4 ${
										msg.isInternal
											? "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800/50 dark:bg-yellow-900/10"
											: msg.authorType === "admin"
												? "border-border bg-muted/30"
												: "border-border bg-card"
									}`}
								>
									<div className="mb-2 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="font-medium text-foreground text-sm">
												{msg.authorName}
											</span>
											<span
												className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium text-xs ${
													msg.authorType === "admin"
														? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
														: msg.authorType === "system"
															? "bg-muted text-muted-foreground"
															: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
												}`}
											>
												{msg.authorType}
											</span>
											{msg.isInternal ? (
												<span className="inline-flex items-center rounded-full bg-yellow-100 px-1.5 py-0.5 font-medium text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
													Internal
												</span>
											) : null}
										</div>
										<span className="text-muted-foreground text-xs">
											{formatDateTime(msg.createdAt)}
										</span>
									</div>
									<p className="whitespace-pre-wrap text-foreground text-sm">
										{msg.body}
									</p>
								</div>
							))}
						</div>
					) : null}

					{/* Reply form */}
					{!isClosed ? (
						<div className="mt-4 rounded-lg border border-border bg-card p-4">
							<h3 className="mb-3 font-semibold text-foreground text-sm">
								Reply
							</h3>
							{error ? (
								<div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
									{error}
								</div>
							) : null}
							<form onSubmit={handleReply} className="space-y-3">
								<textarea
									value={replyBody}
									onChange={(e) => setReplyBody(e.target.value)}
									placeholder="Write your reply..."
									rows={4}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
								<div className="flex items-center justify-between">
									<label className="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={isInternal}
											onChange={(e) => setIsInternal(e.target.checked)}
											className="rounded border-border"
										/>
										<span className="text-muted-foreground">
											Internal note (not visible to customer)
										</span>
									</label>
									<button
										type="submit"
										disabled={replyMutation.isPending}
										className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
									>
										{replyMutation.isPending ? "Sending..." : "Send Reply"}
									</button>
								</div>
							</form>
						</div>
					) : null}
				</div>

				{/* Sidebar */}
				<div className="space-y-4">
					{/* Customer info */}
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Customer
						</h3>
						<dl className="space-y-2 text-sm">
							<div>
								<dt className="text-muted-foreground">Name</dt>
								<dd className="text-foreground">{ticket.customerName}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Email</dt>
								<dd className="text-foreground">{ticket.customerEmail}</dd>
							</div>
							{ticket.orderId ? (
								<div>
									<dt className="text-muted-foreground">Order</dt>
									<dd className="text-foreground">{ticket.orderId}</dd>
								</div>
							) : null}
						</dl>
					</div>

					{/* Ticket details */}
					<div className="rounded-lg border border-border bg-card p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Details
						</h3>
						<div className="space-y-3">
							<label className="block text-sm">
								<span className="mb-1 block text-muted-foreground">Status</span>
								<select
									value={ticket.status}
									onChange={(e) => handleStatusChange(e.target.value)}
									disabled={isClosed}
									className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
								>
									<option value="open">Open</option>
									<option value="pending">Pending</option>
									<option value="in-progress">In Progress</option>
									<option value="resolved">Resolved</option>
								</select>
							</label>
							<label className="block text-sm">
								<span className="mb-1 block text-muted-foreground">
									Priority
								</span>
								<select
									value={ticket.priority}
									onChange={(e) => handlePriorityChange(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
								>
									<option value="low">Low</option>
									<option value="normal">Normal</option>
									<option value="high">High</option>
									<option value="urgent">Urgent</option>
								</select>
							</label>
							{ticket.assigneeName ? (
								<div className="text-sm">
									<span className="block text-muted-foreground">Assignee</span>
									<span className="text-foreground">{ticket.assigneeName}</span>
								</div>
							) : null}
							{ticket.tags && ticket.tags.length > 0 ? (
								<div className="text-sm">
									<span className="block text-muted-foreground">Tags</span>
									<div className="mt-1 flex flex-wrap gap-1">
										{ticket.tags.map((tag) => (
											<span
												key={tag}
												className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
											>
												{tag}
											</span>
										))}
									</div>
								</div>
							) : null}
							<div className="text-sm">
								<span className="block text-muted-foreground">Created</span>
								<span className="text-foreground">
									{formatDateTime(ticket.createdAt)}
								</span>
							</div>
							{ticket.closedAt ? (
								<div className="text-sm">
									<span className="block text-muted-foreground">Closed</span>
									<span className="text-foreground">
										{formatDateTime(ticket.closedAt)}
									</span>
								</div>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
