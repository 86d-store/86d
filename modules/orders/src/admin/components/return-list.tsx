"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ReturnListTemplate from "./return-list.mdx";

interface ReturnItem {
	id: string;
	returnRequestId: string;
	orderItemId: string;
	quantity: number;
	reason?: string | null;
}

interface ReturnRequestWithItems {
	id: string;
	orderId: string;
	status: string;
	type: string;
	reason: string;
	customerNotes?: string | null;
	adminNotes?: string | null;
	refundAmount?: number | null;
	trackingNumber?: string | null;
	carrier?: string | null;
	createdAt: string;
	updatedAt: string;
	items: ReturnItem[];
}

interface ListResult {
	returns: ReturnRequestWithItems[];
	total: number;
	pages: number;
}

const STATUS_COLORS: Record<string, string> = {
	requested:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	shipped_back:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	received:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	refunded:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const TYPE_LABELS: Record<string, string> = {
	refund: "Refund",
	exchange: "Exchange",
	store_credit: "Store Credit",
};

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

function useReturnsAdminApi() {
	const client = useModuleClient();
	return {
		listReturns: client.module("orders").admin["/admin/orders/returns"],
	};
}

const PAGE_SIZE = 20;

export function ReturnList() {
	const api = useReturnsAdminApi();
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(PAGE_SIZE),
	};
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data: listData,
		isLoading: loading,
		isError: returnsError,
		refetch: refetchReturns,
	} = api.listReturns.useQuery(queryInput) as {
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
	const total = listData?.total ?? 0;
	const totalPages = listData?.pages ?? 1;

	const tableBody = loading ? (
		Array.from({ length: 5 }).map((_, i) => (
			<tr key={`skeleton-${i}`}>
				{Array.from({ length: 6 }).map((_, j) => (
					<td key={`cell-${j}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : returns.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">
					No return requests found
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Return requests from customers will appear here
				</p>
			</td>
		</tr>
	) : (
		returns.map((ret) => (
			<tr
				key={ret.id}
				className="cursor-pointer transition-colors hover:bg-muted/30"
				onClick={() => {
					window.location.href = `/admin/orders/${ret.orderId}`;
				}}
			>
				<td className="px-4 py-3">
					<span className="font-medium font-mono text-foreground text-sm">
						{ret.id.slice(0, 8)}...
					</span>
					<p className="text-muted-foreground text-xs">
						Order: {ret.orderId.slice(0, 8)}...
					</p>
				</td>
				<td className="hidden px-4 py-3 text-sm sm:table-cell">
					{TYPE_LABELS[ret.type] ?? ret.type}
				</td>
				<td className="px-4 py-3">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[ret.status] ?? "bg-muted text-muted-foreground"}`}
					>
						{ret.status.replace(/_/g, " ")}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm md:table-cell">
					{ret.reason.replace(/_/g, " ")}
				</td>
				<td className="px-4 py-3 text-right text-foreground text-sm tabular-nums">
					{ret.items.reduce((sum, i) => sum + i.quantity, 0)}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
					{timeAgo(ret.createdAt)}
				</td>
			</tr>
		))
	);

	return (
		<ReturnListTemplate
			total={total}
			statusFilter={statusFilter}
			onStatusFilterChange={(v: string) => {
				setStatusFilter(v);
				setPage(1);
			}}
			tableBody={tableBody}
			totalPages={totalPages}
			page={page}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
		/>
	);
}
