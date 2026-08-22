"use client";

import { useState } from "react";
import { useBackordersApi } from "./_hooks";
import { extractError, formatDate } from "./_utils";
import MyBackordersTemplate from "./my-backorders.mdx";

interface BackorderEntry {
	id: string;
	productId: string;
	productName: string;
	variantLabel?: string;
	quantity: number;
	status: string;
	estimatedAvailableAt?: string;
	createdAt: string;
	cancelledAt?: string;
	cancelReason?: string;
}

const STATUS_LABELS: Record<string, string> = {
	pending: "Pending",
	confirmed: "Confirmed",
	allocated: "Allocated",
	shipped: "Shipped",
	delivered: "Delivered",
	cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800",
	confirmed:
		"bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
	allocated:
		"bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-800",
	shipped:
		"bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800",
	delivered:
		"bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
	cancelled:
		"bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
};

function isCancellable(status: string): boolean {
	return status === "pending" || status === "confirmed";
}

export function MyBackorders() {
	const api = useBackordersApi();
	const [error, setError] = useState("");

	const { data, isLoading } = api.myBackorders.useQuery({
		take: "50",
	}) as {
		data: { backorders: BackorderEntry[] } | undefined;
		isLoading: boolean;
	};

	const backorders = data?.backorders ?? [];

	const cancelMutation = api.cancelBackorder.useMutation({
		onSettled: () => {
			void api.myBackorders.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to cancel backorder."));
		},
	});

	const handleCancel = (id: string) => {
		setError("");
		cancelMutation.mutate({ params: { id } });
	};

	const content = isLoading ? (
		<div className="divide-y divide-border">
			{(["k0", "k1", "k2"] as const).map((key) => (
				<div key={key} className="flex items-center justify-between px-5 py-4">
					<div className="flex-1 space-y-2">
						<div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
						<div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
					</div>
					<div className="h-7 w-16 animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	) : backorders.length === 0 ? (
		<p className="py-12 text-center text-muted-foreground text-sm">
			No backorders yet.
		</p>
	) : (
		<div className="divide-y divide-border">
			{backorders.map((entry) => (
				<div
					key={entry.id}
					className="flex items-center justify-between px-5 py-3"
				>
					<div className="min-w-0 flex-1">
						<p className="font-medium text-foreground text-sm">
							{entry.productName}
							{entry.variantLabel && (
								<span className="ml-1 text-muted-foreground text-xs">
									({entry.variantLabel})
								</span>
							)}
						</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							Qty: {entry.quantity} · Placed {formatDate(entry.createdAt)}
							{entry.estimatedAvailableAt && (
								<> · Est. {formatDate(entry.estimatedAvailableAt)}</>
							)}
						</p>
					</div>
					<div className="flex items-center gap-3">
						<span
							className={`inline-flex rounded-full border px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[entry.status] ?? "border-gray-200 bg-muted/30 text-foreground/80 dark:border-gray-700"}`}
						>
							{STATUS_LABELS[entry.status] ?? entry.status}
						</span>
						{isCancellable(entry.status) && (
							<button
								type="button"
								onClick={() => handleCancel(entry.id)}
								disabled={cancelMutation.isPending}
								className="text-muted-foreground text-xs hover:text-red-600 dark:hover:text-red-400"
							>
								Cancel
							</button>
						)}
					</div>
				</div>
			))}
		</div>
	);

	return <MyBackordersTemplate content={content} error={error} />;
}
