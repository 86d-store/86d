"use client";

import { useState } from "react";
import { usePreordersApi } from "./_hooks";
import { extractError, formatCurrency, formatDate } from "./_utils";
import MyPreordersTemplate from "./my-preorders.mdx";

interface PreorderItem {
	id: string;
	campaignId: string;
	customerId: string;
	customerEmail: string;
	quantity: number;
	status: string;
	depositPaid: number;
	totalPrice: number;
	orderId?: string;
	notifiedAt?: string;
	cancelledAt?: string;
	cancelReason?: string;
	fulfilledAt?: string;
	createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
	pending: "Pending",
	confirmed: "Confirmed",
	ready: "Ready to Ship",
	fulfilled: "Fulfilled",
	cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-800",
	confirmed:
		"bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800",
	ready:
		"bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800",
	fulfilled:
		"bg-muted/30 text-foreground/80 border-gray-200 dark:border-gray-700",
	cancelled:
		"bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800",
};

export function MyPreorders() {
	const api = usePreordersApi();
	const [error, setError] = useState("");

	const { data, isLoading } = api.myPreorders.useQuery({
		take: "50",
	}) as {
		data: { items: PreorderItem[]; total: number } | undefined;
		isLoading: boolean;
	};

	const items = data?.items ?? [];

	const cancelMutation = api.cancelPreorder.useMutation({
		onSettled: () => {
			void api.myPreorders.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to cancel pre-order."));
		},
	});

	const handleCancel = (id: string) => {
		setError("");
		cancelMutation.mutate({ params: { id }, reason: "Customer requested" });
	};

	const isCancellable = (status: string) =>
		status === "pending" || status === "confirmed";

	const content = isLoading ? (
		<div className="divide-y divide-border">
			{["sk-a", "sk-b", "sk-c"].map((k) => (
				<div
					key={k}
					className="flex items-start justify-between gap-4 px-5 py-4"
				>
					<div className="flex-1 space-y-2">
						<div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
						<div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
						<div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
					</div>
					<div className="h-7 w-16 animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	) : items.length === 0 ? (
		<p className="py-12 text-center text-muted-foreground text-sm">
			No pre-orders yet.
		</p>
	) : (
		<div className="divide-y divide-border">
			{items.map((item) => (
				<div
					key={item.id}
					className="flex items-start justify-between gap-4 px-5 py-4"
				>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<p className="font-medium text-foreground text-sm">
								Pre-order #{item.id.slice(0, 8)}
							</p>
							<span
								className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${STATUS_COLORS[item.status] ?? "border-gray-200 bg-muted/30 text-foreground/80 dark:border-gray-700"}`}
							>
								{STATUS_LABELS[item.status] ?? item.status}
							</span>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">
							Qty: {item.quantity} · Total: {formatCurrency(item.totalPrice)}
							{item.depositPaid > 0 && (
								<> · Deposit: {formatCurrency(item.depositPaid)}</>
							)}
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							Placed {formatDate(item.createdAt)}
							{item.fulfilledAt && (
								<> · Fulfilled {formatDate(item.fulfilledAt)}</>
							)}
							{item.cancelledAt && (
								<> · Cancelled {formatDate(item.cancelledAt)}</>
							)}
						</p>
					</div>
					{isCancellable(item.status) && (
						<button
							type="button"
							onClick={() => handleCancel(item.id)}
							disabled={cancelMutation.isPending}
							className="shrink-0 text-muted-foreground text-xs hover:text-red-600 dark:hover:text-red-400"
						>
							Cancel
						</button>
					)}
				</div>
			))}
		</div>
	);

	return <MyPreordersTemplate content={content} error={error} />;
}
