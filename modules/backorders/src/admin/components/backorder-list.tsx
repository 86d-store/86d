"use client";

import { useState } from "react";
import { useBackordersApi } from "./_shared";

interface Backorder {
	id: string;
	productId: string;
	productName: string;
	variantLabel?: string;
	customerId: string;
	customerEmail: string;
	quantity: number;
	status: string;
	reason?: string;
	createdAt: string;
	updatedAt: string;
}

interface BackorderSummary {
	totalBackorders: number;
	pendingBackorders: number;
	confirmedBackorders: number;
	allocatedBackorders: number;
	cancelledBackorders: number;
}

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	allocated:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	shipped:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	delivered:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function BackorderList() {
	const api = useBackordersApi();
	const [statusFilter, setStatusFilter] = useState("");

	const { data, isLoading } = api.listBackorders.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { backorders?: Backorder[]; total?: number } | undefined;
		isLoading: boolean;
	};
	const { data: summaryData } = api.summary.useQuery({}) as {
		data: { summary?: BackorderSummary } | undefined;
	};

	const updateMutation = api.updateStatus.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const cancelMutation = api.cancelBackorder.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const backorders = data?.backorders ?? [];
	const summary = summaryData?.summary;

	const handleStatusChange = async (id: string, status: string) => {
		try {
			await updateMutation.mutateAsync({
				params: { id },
				body: { status },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleCancel = async (id: string) => {
		if (!confirm("Cancel this backorder?")) return;
		try {
			await cancelMutation.mutateAsync({
				params: { id },
				body: {},
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Backorders</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage product backorders
				</p>
			</div>

			{/* Summary */}
			{summary ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{summary.totalBackorders}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Pending
						</p>
						<p className="mt-1 font-bold text-2xl text-yellow-600">
							{summary.pendingBackorders}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Confirmed
						</p>
						<p className="mt-1 font-bold text-2xl text-blue-600">
							{summary.confirmedBackorders}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Allocated
						</p>
						<p className="mt-1 font-bold text-2xl text-indigo-600">
							{summary.allocatedBackorders}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Cancelled
						</p>
						<p className="mt-1 font-bold text-2xl text-red-600">
							{summary.cancelledBackorders}
						</p>
					</div>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All statuses</option>
					<option value="pending">Pending</option>
					<option value="confirmed">Confirmed</option>
					<option value="allocated">Allocated</option>
					<option value="shipped">Shipped</option>
					<option value="delivered">Delivered</option>
					<option value="cancelled">Cancelled</option>
				</select>
			</div>

			{/* Backorder list */}
			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 4 }).map((_, i) => (
						<div
							key={`skel-${i}`}
							className="h-14 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : backorders.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">No backorders found.</p>
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
									Product
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Customer
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Qty
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
									Date
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
							{backorders.map((bo) => (
								<tr key={bo.id} className="transition-colors hover:bg-muted/50">
									<td className="px-4 py-2 text-foreground text-xs">
										{bo.productName}
										{bo.variantLabel ? (
											<span className="ml-1 text-muted-foreground">
												· {bo.variantLabel}
											</span>
										) : null}
									</td>
									<td className="px-4 py-2 text-foreground text-xs">
										{bo.customerEmail}
									</td>
									<td className="px-4 py-2 text-foreground">{bo.quantity}</td>
									<td className="px-4 py-2">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[bo.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{bo.status}
										</span>
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{formatDate(bo.createdAt)}
									</td>
									<td className="px-4 py-2">
										{bo.status !== "cancelled" && bo.status !== "delivered" ? (
											<div className="flex gap-1">
												{bo.status === "pending" ? (
													<button
														type="button"
														onClick={() =>
															handleStatusChange(bo.id, "confirmed")
														}
														className="rounded px-2 py-1 text-xs hover:bg-muted"
													>
														Confirm
													</button>
												) : null}
												{bo.status === "confirmed" ? (
													<button
														type="button"
														onClick={() =>
															handleStatusChange(bo.id, "allocated")
														}
														className="rounded px-2 py-1 text-xs hover:bg-muted"
													>
														Allocate
													</button>
												) : null}
												{bo.status === "allocated" ? (
													<button
														type="button"
														onClick={() => handleStatusChange(bo.id, "shipped")}
														className="rounded px-2 py-1 text-xs hover:bg-muted"
													>
														Ship
													</button>
												) : null}
												{bo.status === "shipped" ? (
													<button
														type="button"
														onClick={() =>
															handleStatusChange(bo.id, "delivered")
														}
														className="rounded px-2 py-1 text-xs hover:bg-muted"
													>
														Delivered
													</button>
												) : null}
												<button
													type="button"
													onClick={() => handleCancel(bo.id)}
													className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
												>
													Cancel
												</button>
											</div>
										) : null}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
