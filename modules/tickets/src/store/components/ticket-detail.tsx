"use client";

import { useCallback, useState } from "react";
import { useTicketsApi } from "./_hooks";
import { extractError, formatDate, priorityColor, statusColor } from "./_utils";
import TicketDetailTemplate from "./ticket-detail.mdx";

interface TicketMessage {
	id: string;
	ticketId: string;
	body: string;
	authorType: string;
	authorId?: string | undefined;
	authorName?: string | undefined;
	authorEmail?: string | undefined;
	isInternal: boolean;
	createdAt: string;
}

interface Ticket {
	id: string;
	number: string;
	categoryId?: string | undefined;
	subject: string;
	description: string;
	status: string;
	priority: string;
	customerEmail: string;
	customerName?: string | undefined;
	customerId?: string | undefined;
	orderId?: string | undefined;
	assigneeName?: string | undefined;
	tags?: string[] | undefined;
	closedAt?: string | undefined;
	createdAt: string;
	updatedAt: string;
}

interface TicketDetailResponse {
	ticket: Ticket;
	messages: TicketMessage[];
}

function MessageBubble({ message }: { message: TicketMessage }) {
	const isCustomer = message.authorType === "customer";
	return (
		<div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[80%] rounded-xl px-4 py-3 ${
					isCustomer
						? "bg-primary text-primary-foreground"
						: "border border-border bg-muted/40 text-foreground"
				}`}
			>
				<div className="mb-1 flex items-center gap-2">
					<span
						className={`font-medium text-xs ${
							isCustomer
								? "text-primary-foreground/80"
								: "text-muted-foreground"
						}`}
					>
						{message.authorName ?? (isCustomer ? "You" : "Support")}
					</span>
					<span
						className={`text-xs ${
							isCustomer
								? "text-primary-foreground/60"
								: "text-muted-foreground/70"
						}`}
					>
						{formatDate(message.createdAt)}
					</span>
				</div>
				<p className="whitespace-pre-wrap text-sm">{message.body}</p>
			</div>
		</div>
	);
}

export function TicketDetail(props: {
	ticketId?: string | undefined;
	onBack?: (() => void) | undefined;
	params?: Record<string, string> | undefined;
}) {
	const ticketId = props.ticketId ?? props.params?.id ?? "";
	const { onBack } = props;
	const api = useTicketsApi();

	const { data, isLoading, isError, error } = api.getTicket.useQuery({
		params: { id: ticketId },
	}) as {
		data: TicketDetailResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		error: Error | null;
	};

	const [replyBody, setReplyBody] = useState("");
	const [replyError, setReplyError] = useState("");

	const replyMutation = api.reply.useMutation({
		onSuccess: () => {
			setReplyBody("");
			setReplyError("");
			void api.getTicket.invalidate();
		},
		onError: (err: Error) => {
			setReplyError(extractError(err, "Failed to send reply."));
		},
	});

	const handleBack = useCallback(() => {
		if (onBack) {
			onBack();
		} else {
			const url = new URL(window.location.href);
			url.searchParams.delete("ticket");
			window.location.href = url.toString();
		}
	}, [onBack]);

	const handleReply = (e: React.FormEvent) => {
		e.preventDefault();
		if (!replyBody.trim()) return;
		replyMutation.mutate({
			params: { id: ticketId },
			body: replyBody.trim(),
		});
	};

	if (isLoading) {
		return (
			<section className="py-8">
				<div className="mb-4 h-5 w-20 animate-pulse rounded bg-muted" />
				<div className="mb-6 h-7 w-48 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-3">
					{[1, 2, 3].map((n) => (
						<div key={n} className="h-14 animate-pulse rounded-lg bg-muted" />
					))}
				</div>
			</section>
		);
	}

	if (isError || !data?.ticket) {
		const status = (error as Error & { status?: number }).status;
		const message =
			status === 401
				? "Please sign in to view this ticket."
				: status === 404
					? "Ticket not found."
					: "Failed to load ticket.";
		return (
			<section className="py-8">
				<button
					type="button"
					onClick={handleBack}
					className="mb-4 text-primary text-sm underline-offset-4 hover:underline"
				>
					&larr; Back to tickets
				</button>
				<div className="rounded-xl border border-border bg-muted/30 py-12 text-center">
					<p className="text-muted-foreground text-sm">{message}</p>
				</div>
			</section>
		);
	}

	const ticket = data.ticket;
	const messages = (data.messages ?? []).filter((m) => !m.isInternal);
	const isClosed = ticket.status === "closed" || ticket.status === "resolved";

	const statusBadge = (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${statusColor(ticket.status)}`}
		>
			{ticket.status.replace("_", " ")}
		</span>
	);

	const priorityBadge = (
		<span className={`font-medium text-xs ${priorityColor(ticket.priority)}`}>
			{ticket.priority}
		</span>
	);

	const messagesContent = (
		<div className="space-y-3">
			{messages.map((msg) => (
				<MessageBubble key={msg.id} message={msg} />
			))}
		</div>
	);

	const replyFormContent = isClosed ? (
		<div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
			<p className="text-muted-foreground text-sm">
				This ticket is {ticket.status}. You cannot reply.
			</p>
		</div>
	) : (
		<form onSubmit={handleReply} className="space-y-3">
			<textarea
				value={replyBody}
				onChange={(e) => setReplyBody(e.target.value)}
				rows={3}
				required
				maxLength={10000}
				placeholder="Type your reply..."
				className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
			/>
			{replyError && (
				<p className="text-destructive text-sm" role="alert">
					{replyError}
				</p>
			)}
			<button
				type="submit"
				disabled={replyMutation.isPending || !replyBody.trim()}
				className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground text-sm transition-opacity disabled:opacity-60"
			>
				{replyMutation.isPending ? "Sending\u2026" : "Send Reply"}
			</button>
		</form>
	);

	return (
		<TicketDetailTemplate
			onBack={handleBack}
			ticketNumber={ticket.number}
			subject={ticket.subject}
			description={ticket.description}
			date={formatDate(ticket.createdAt)}
			statusBadge={statusBadge}
			priorityBadge={priorityBadge}
			assigneeName={ticket.assigneeName ?? null}
			orderId={ticket.orderId ?? null}
			messagesContent={messagesContent}
			replyFormContent={replyFormContent}
			hasMessages={messages.length > 0}
		/>
	);
}
