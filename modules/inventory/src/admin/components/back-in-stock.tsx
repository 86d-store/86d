"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

interface Subscription {
	id: string;
	productId: string;
	variantId?: string | null;
	email: string;
	customerId?: string | null;
	productName?: string | null;
	status: string;
	subscribedAt: string;
	notifiedAt?: string | null;
}

interface Stats {
	totalActive: number;
	totalNotified: number;
	uniqueProducts: number;
}

function useBackInStockApi() {
	const client = useModuleClient();
	return {
		list: client.module("inventory").admin["/admin/inventory/back-in-stock"],
		stats:
			client.module("inventory").admin["/admin/inventory/back-in-stock/stats"],
		remove:
			client.module("inventory").admin["/admin/inventory/back-in-stock/:id"],
	};
}

function statusBadge(status: string) {
	if (status === "active")
		return (
			<span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
				Active
			</span>
		);
	return (
		<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
			Notified
		</span>
	);
}

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function BackInStockAdmin() {
	const api = useBackInStockApi();
	const [statusFilter, setStatusFilter] = useState("active");
	const [deleting, setDeleting] = useState<string | null>(null);

	const { data: statsData } = api.stats.useQuery(undefined) as {
		data: { stats: Stats } | undefined;
	};

	const {
		data: listData,
		isLoading,
		isError: subsError,
		refetch: refetchSubs,
	} = api.list.useQuery(
		statusFilter ? { status: statusFilter } : undefined,
	) as {
		data: { subscriptions: Subscription[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const deleteMutation = api.remove.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.stats.invalidate();
		},
		onSettled: () => {
			setDeleting(null);
		},
	});

	if (subsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load back-in-stock subscriptions
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchSubs()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	function handleDelete(sub: Subscription) {
		setDeleting(sub.id);
		deleteMutation.mutate({ id: sub.id });
	}

	const stats = statsData?.stats;
	const subscriptions = listData?.subscriptions ?? [];

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Back in Stock</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Customers waiting for out-of-stock products
				</p>
			</div>

			{stats && (
				<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Active subscribers
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
							{stats.totalActive}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Notified
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
							{stats.totalNotified}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Products watched
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
							{stats.uniqueProducts}
						</p>
					</div>
				</div>
			)}

			<div className="mb-4">
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="active">Active</option>
					<option value="notified">Notified</option>
					<option value="">All</option>
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
								Email
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Product
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
							>
								Status
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Subscribed
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{isLoading ? (
							(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
								<tr key={key}>
									{(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
										<td key={key} className="px-4 py-3">
											<div className="h-4 w-20 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : subscriptions.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No subscriptions
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Customers will appear here when they subscribe to
										out-of-stock product notifications
									</p>
								</td>
							</tr>
						) : (
							subscriptions.map((sub) => (
								<tr
									key={sub.id}
									className="transition-colors hover:bg-muted/30"
								>
									<td className="px-4 py-3 text-foreground text-sm">
										{sub.email}
									</td>
									<td className="hidden px-4 py-3 text-sm sm:table-cell">
										<span className="font-mono text-muted-foreground">
											{sub.productName ?? sub.productId}
										</span>
										{sub.variantId && (
											<span className="ml-2 text-muted-foreground text-xs">
												({sub.variantId})
											</span>
										)}
									</td>
									<td className="hidden px-4 py-3 md:table-cell">
										{statusBadge(sub.status)}
									</td>
									<td className="hidden px-4 py-3 text-muted-foreground text-sm lg:table-cell">
										{formatDate(sub.subscribedAt)}
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => handleDelete(sub)}
											disabled={deleting === sub.id}
											className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
										>
											{deleting === sub.id ? "Removing…" : "Remove"}
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
