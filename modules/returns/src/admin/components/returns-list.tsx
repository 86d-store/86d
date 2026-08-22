"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ReturnsListTemplate from "./returns-list.mdx";

interface ReturnListItem {
	id: string;
	orderId: string;
	customerId: string;
	customerEmail?: string;
	status: string;
	refundMethod: string;
	refundAmount: number;
	currency: string;
	reason: string;
	createdAt: string;
}

interface ListResult {
	returns: ReturnListItem[];
}

const STATUS_COLORS: Record<string, string> = {
	requested:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	received:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	cancelled: "bg-muted text-muted-foreground",
};

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

function useReturnsApi() {
	const client = useModuleClient();
	return {
		list: client.module("returns").admin["/admin/returns"],
	};
}

const PAGE_SIZE = 20;

export function ReturnsList() {
	const api = useReturnsApi();
	const [statusFilter, setStatusFilter] = useState("");

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
	};
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data: listData,
		isLoading: loading,
		isError: returnsError,
		refetch: refetchReturns,
	} = api.list.useQuery(queryInput) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (returnsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load returns</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchReturns()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const returns = listData?.returns ?? [];

	const content = (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Returns</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage customer return requests
				</p>
			</div>

			<div className="mb-4">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">All statuses</option>
					<option value="requested">Requested</option>
					<option value="approved">Approved</option>
					<option value="received">Received</option>
					<option value="completed">Completed</option>
					<option value="rejected">Rejected</option>
					<option value="cancelled">Cancelled</option>
				</select>
			</div>

			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Return ID
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Customer
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Status
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
							>
								Reason
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Refund
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Date
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{loading ? (
							(["k0", "k1", "k2", "k3", "k4"] as const).map((_key) => (
								<tr key={rowKey}>
									{(["k0", "k1", "k2", "k3", "k4", "k5"] as const).map(
										(_key) => (
											<td key={cellKey} className="px-4 py-3">
												<div className="h-4 w-24 animate-pulse rounded bg-muted" />
											</td>
										),
									)}
								</tr>
							))
						) : returns.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No return requests found
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Return requests will appear here when customers submit them
									</p>
								</td>
							</tr>
						) : (
							returns.map((ret) => (
								<tr
									key={ret.id}
									className="cursor-pointer transition-colors hover:bg-muted/30"
									onClick={() => {
										window.location.href = `/admin/returns/${ret.id}`;
									}}
								>
									<td className="px-4 py-3">
										<span className="font-medium font-mono text-foreground text-sm">
											{ret.id.slice(0, 8)}
										</span>
									</td>
									<td className="hidden px-4 py-3 text-muted-foreground text-sm sm:table-cell">
										{ret.customerEmail ?? `${ret.customerId.slice(0, 8)}…`}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[ret.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{ret.status.replace(/_/g, " ")}
										</span>
									</td>
									<td className="hidden px-4 py-3 text-muted-foreground text-sm md:table-cell">
										{ret.reason.length > 40
											? `${ret.reason.slice(0, 40)}...`
											: ret.reason}
									</td>
									<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
										{formatPrice(ret.refundAmount, ret.currency)}
									</td>
									<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
										{timeAgo(ret.createdAt)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);

	return <ReturnsListTemplate content={content} />;
}
