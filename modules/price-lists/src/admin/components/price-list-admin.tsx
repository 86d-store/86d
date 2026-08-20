"use client";

import { useState } from "react";
import {
	formatDate,
	type PriceList,
	STATUS_COLORS,
	usePriceListsApi,
} from "./_shared";

interface PriceListStats {
	totalPriceLists: number;
	activePriceLists: number;
	scheduledPriceLists: number;
	inactivePriceLists: number;
	totalEntries: number;
	priceListsWithEntries: number;
}

export function PriceListAdmin() {
	const api = usePriceListsApi();
	const [statusFilter, setStatusFilter] = useState("");

	const {
		data,
		isLoading,
		isError: priceListsError,
		refetch: refetchPriceLists,
	} = api.list.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { priceLists?: PriceList[]; total?: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: PriceListStats } | undefined;
	};

	const priceLists = data?.priceLists ?? [];
	const stats = statsData?.stats;

	if (priceListsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load price lists
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchPriceLists()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Price Lists</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage custom pricing for customer groups, B2B, and promotions
					</p>
				</div>
				<a
					href="/admin/price-lists/create"
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					Create price list
				</a>
			</div>

			{/* Stats row */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Active
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.activePriceLists}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Scheduled
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.scheduledPriceLists}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total Entries
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalEntries}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							With Entries
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.priceListsWithEntries}
						</p>
					</div>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4 flex gap-2">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All statuses</option>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
					<option value="scheduled">Scheduled</option>
				</select>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={`skel-${i}`}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : priceLists.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No price lists yet. Create one to set custom pricing for products.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-lg border border-border bg-card">
					<table className="w-full">
						<thead>
							<tr className="border-border border-b bg-muted/40">
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Name
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Priority
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Currency
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Schedule
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{priceLists.map((pl) => (
								<tr key={pl.id} className="hover:bg-muted/30">
									<td className="px-4 py-3">
										<a
											href={`/admin/price-lists/${pl.id}`}
											className="font-medium text-foreground text-sm hover:underline"
										>
											{pl.name}
										</a>
										{pl.description ? (
											<p className="mt-0.5 text-muted-foreground text-xs">
												{pl.description}
											</p>
										) : null}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[pl.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{pl.status}
										</span>
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{pl.priority}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{pl.currency ?? "—"}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-xs">
										{pl.startsAt || pl.endsAt
											? `${formatDate(pl.startsAt)} → ${formatDate(pl.endsAt)}`
											: "Always"}
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
