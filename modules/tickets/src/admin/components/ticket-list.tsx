"use client";

import { useState } from "react";
import {
	PRIORITY_COLORS,
	PRIORITY_LABELS,
	STATUS_COLORS,
	STATUS_LABELS,
	type Ticket,
	useTicketsApi,
} from "./_shared";

interface TicketStats {
	total: number;
	open: number;
	pending: number;
	inProgress: number;
	resolved: number;
	closed: number;
	byPriority: Record<string, number>;
}

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function TicketList() {
	const api = useTicketsApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [priorityFilter, setPriorityFilter] = useState("");

	const { data, isLoading } = api.listTickets.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
		...(priorityFilter ? { priority: priorityFilter } : {}),
	}) as {
		data: { tickets?: Ticket[] } | undefined;
		isLoading: boolean;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: TicketStats } | undefined;
	};

	const tickets = data?.tickets ?? [];
	const stats = statsData?.stats;

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Tickets</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage customer support tickets
				</p>
			</div>

			{/* Stats */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.total}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Open
						</p>
						<p className="mt-1 font-bold text-2xl text-blue-600">
							{stats.open}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Pending
						</p>
						<p className="mt-1 font-bold text-2xl text-yellow-600">
							{stats.pending}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							In Progress
						</p>
						<p className="mt-1 font-bold text-2xl text-indigo-600">
							{stats.inProgress}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Resolved
						</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{stats.resolved}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Closed
						</p>
						<p className="mt-1 font-bold text-2xl text-muted-foreground">
							{stats.closed}
						</p>
					</div>
				</div>
			) : null}

			{/* Filters */}
			<div className="mb-4 flex gap-2">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All statuses</option>
					<option value="open">Open</option>
					<option value="pending">Pending</option>
					<option value="in-progress">In Progress</option>
					<option value="resolved">Resolved</option>
					<option value="closed">Closed</option>
				</select>
				<select
					aria-label="Filter by priority"
					value={priorityFilter}
					onChange={(e) => setPriorityFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All priorities</option>
					<option value="low">Low</option>
					<option value="normal">Normal</option>
					<option value="high">High</option>
					<option value="urgent">Urgent</option>
				</select>
			</div>

			{/* Ticket list */}
			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2", "k3"] as const).map((key) => (
						<div
							key={key}
							className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : tickets.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">No tickets found.</p>
				</div>
			) : (
				<div className="space-y-3">
					{tickets.map((ticket) => (
						<a
							key={ticket.id}
							href={`/admin/tickets/${ticket.id}`}
							className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="font-mono text-muted-foreground text-xs">
											#{ticket.number}
										</span>
										<p className="font-medium text-foreground text-sm">
											{ticket.subject}
										</p>
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
										<span className="text-muted-foreground text-xs">
											{ticket.customerName} &lt;
											{ticket.customerEmail}&gt;
										</span>
										{ticket.assigneeName ? (
											<span className="text-muted-foreground text-xs">
												Assigned to {ticket.assigneeName}
											</span>
										) : null}
									</div>
								</div>
								<span className="whitespace-nowrap text-muted-foreground text-xs">
									{formatDate(ticket.createdAt)}
								</span>
							</div>
						</a>
					))}
				</div>
			)}
		</div>
	);
}
