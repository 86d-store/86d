"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import PickupQueueTemplate from "./pickup-queue.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

type PickupStatus =
	| "scheduled"
	| "preparing"
	| "ready"
	| "picked_up"
	| "cancelled";

interface PickupItem {
	id: string;
	locationName: string;
	locationAddress: string;
	orderId: string;
	scheduledDate: string;
	startTime: string;
	endTime: string;
	status: PickupStatus;
	notes?: string;
	createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<PickupStatus, string> = {
	scheduled: "bg-muted text-muted-foreground",
	preparing:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	ready: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	picked_up: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABELS: Record<PickupStatus, string> = {
	scheduled: "Scheduled",
	preparing: "Preparing",
	ready: "Ready",
	picked_up: "Picked Up",
	cancelled: "Cancelled",
};

const NEXT_STATUS: Partial<Record<PickupStatus, PickupStatus>> = {
	scheduled: "preparing",
	preparing: "ready",
	ready: "picked_up",
};

const SKELETON_IDS = ["a", "b", "c", "d"] as const;

// ─── API hook ─────────────────────────────────────────────────────────────────

function usePickupQueueApi() {
	const client = useModuleClient();
	return {
		list: client.module("store-pickup").admin["/admin/store-pickup/pickups"],
		updateStatus:
			client.module("store-pickup").admin[
				"/admin/store-pickup/pickups/:id/status"
			],
		cancel:
			client.module("store-pickup").admin[
				"/admin/store-pickup/pickups/:id/cancel"
			],
	};
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PickupQueue() {
	const api = usePickupQueueApi();
	const [statusFilter, setStatusFilter] = useState("");

	const queryInput: Record<string, string> = { take: String(PAGE_SIZE) };
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data,
		isLoading: loading,
		isError: pickupsError,
		refetch: refetchPickups,
	} = api.list.useQuery(queryInput) as {
		data: { pickups: PickupItem[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const updateStatusMutation = api.updateStatus.useMutation({
		onSuccess: () => void api.list.invalidate(),
	});

	const cancelMutation = api.cancel.useMutation({
		onSuccess: () => void api.list.invalidate(),
	});

	if (pickupsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load pickup queue
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchPickups()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const pickups = data?.pickups ?? [];
	const isBusy = updateStatusMutation.isPending || cancelMutation.isPending;

	const handleAdvance = (pickup: PickupItem) => {
		const next = NEXT_STATUS[pickup.status];
		if (!next) return;
		updateStatusMutation.mutate({
			params: { id: pickup.id },
			body: { status: next },
		});
	};

	const handleCancel = (pickup: PickupItem) => {
		if (!window.confirm(`Cancel pickup for order ${pickup.orderId}?`)) return;
		cancelMutation.mutate({ params: { id: pickup.id } });
	};

	return (
		<PickupQueueTemplate>
			{/* Filter */}
			<div className="mb-4">
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
				>
					<option value="">All Statuses</option>
					<option value="scheduled">Scheduled</option>
					<option value="preparing">Preparing</option>
					<option value="ready">Ready</option>
					<option value="picked_up">Picked Up</option>
					<option value="cancelled">Cancelled</option>
				</select>
			</div>

			{loading ? (
				<div className="space-y-3">
					{SKELETON_IDS.map((id) => (
						<div
							key={`pq-skel-${id}`}
							className="h-14 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : pickups.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">No pickups found.</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-border border-b bg-muted">
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Order
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Location
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Date
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Window
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{pickups.map((p) => {
								const nextStatus = NEXT_STATUS[p.status];
								return (
									<tr
										key={p.id}
										className="transition-colors hover:bg-muted/50"
									>
										<td className="px-4 py-2 font-mono text-muted-foreground text-xs">
											{p.orderId.slice(0, 10)}…
										</td>
										<td className="px-4 py-2 text-foreground text-xs">
											{p.locationName}
										</td>
										<td className="px-4 py-2 text-muted-foreground text-xs">
											{p.scheduledDate}
										</td>
										<td className="px-4 py-2 text-muted-foreground text-xs">
											{p.startTime} – {p.endTime}
										</td>
										<td className="px-4 py-2">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[p.status]}`}
											>
												{STATUS_LABELS[p.status]}
											</span>
										</td>
										<td className="px-4 py-2">
											<div className="flex gap-1">
												{nextStatus ? (
													<button
														type="button"
														onClick={() => handleAdvance(p)}
														disabled={isBusy}
														className="rounded px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
													>
														→ {STATUS_LABELS[nextStatus]}
													</button>
												) : null}
												{p.status !== "cancelled" &&
												p.status !== "picked_up" ? (
													<button
														type="button"
														onClick={() => handleCancel(p)}
														disabled={isBusy}
														className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
													>
														Cancel
													</button>
												) : null}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</PickupQueueTemplate>
	);
}
