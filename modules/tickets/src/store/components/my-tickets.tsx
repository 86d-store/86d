"use client";

import { useCallback } from "react";
import { useTicketsApi } from "./_hooks";
import { formatDate, priorityColor, statusColor } from "./_utils";
import MyTicketsTemplate from "./my-tickets.mdx";

interface Ticket {
	id: string;
	number: string;
	subject: string;
	status: string;
	priority: string;
	createdAt: string;
}

interface TicketsResponse {
	tickets: Ticket[];
}

function TicketRow({
	ticket,
	onSelect,
}: {
	ticket: Ticket;
	onSelect: (id: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(ticket.id)}
			className="flex w-full items-center justify-between gap-4 border-border border-b px-4 py-4 text-left transition-colors hover:bg-muted/40"
		>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="font-mono text-muted-foreground text-xs">
						#{ticket.number}
					</span>
					<span className="font-medium text-foreground text-sm">
						{ticket.subject}
					</span>
				</div>
				<div className="mt-1 flex items-center gap-2">
					<span
						className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${statusColor(ticket.status)}`}
					>
						{ticket.status.replace("_", " ")}
					</span>
					<span
						className={`font-medium text-xs ${priorityColor(ticket.priority)}`}
					>
						{ticket.priority}
					</span>
				</div>
			</div>
			<span className="shrink-0 text-muted-foreground text-xs">
				{formatDate(ticket.createdAt)}
			</span>
		</button>
	);
}

export function MyTickets({
	onSelectTicket,
}: {
	onSelectTicket?: ((id: string) => void) | undefined;
}) {
	const api = useTicketsApi();

	const { data, isLoading, isError, error } = api.myTickets.useQuery({}) as {
		data: TicketsResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		error: Error | null;
	};

	const handleSelect = useCallback(
		(id: string) => {
			if (onSelectTicket) {
				onSelectTicket(id);
			} else {
				const url = new URL(window.location.href);
				url.searchParams.set("ticket", id);
				window.location.href = url.toString();
			}
		},
		[onSelectTicket],
	);

	if (isLoading) {
		return (
			<section className="py-8">
				<div className="mb-4 h-7 w-36 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-3">
					{[1, 2, 3].map((n) => (
						<div key={n} className="h-16 animate-pulse rounded-lg bg-muted" />
					))}
				</div>
			</section>
		);
	}

	if (isError) {
		const is401 = (error as Error & { status?: number }).status === 401;
		return (
			<section className="py-8">
				<h2 className="mb-4 font-semibold text-foreground text-xl">
					My Tickets
				</h2>
				<div className="rounded-xl border border-border bg-muted/30 py-12 text-center">
					<p className="text-muted-foreground text-sm">
						{is401
							? "Please sign in to view your tickets."
							: "Failed to load tickets."}
					</p>
				</div>
			</section>
		);
	}

	const tickets = data?.tickets ?? [];

	const ticketListContent =
		tickets.length === 0 ? null : (
			<div className="overflow-hidden rounded-xl border border-border">
				{tickets.map((ticket) => (
					<TicketRow key={ticket.id} ticket={ticket} onSelect={handleSelect} />
				))}
			</div>
		);

	return (
		<MyTicketsTemplate
			isEmpty={tickets.length === 0}
			ticketListContent={ticketListContent}
		/>
	);
}
