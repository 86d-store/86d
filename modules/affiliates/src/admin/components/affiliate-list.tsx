"use client";

import { useState } from "react";
import { type Affiliate, formatCurrency, useAffiliatesApi } from "./_shared";

interface AffiliateStats {
	totalAffiliates: number;
	activeAffiliates: number;
	pendingAffiliates: number;
	totalConversions: number;
	totalRevenue: number;
}

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	approved:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	rejected: "bg-muted text-muted-foreground",
};

export function AffiliateList() {
	const api = useAffiliatesApi();
	const [statusFilter, setStatusFilter] = useState("");

	const {
		data,
		isLoading,
		isError: affiliatesError,
		refetch: refetchAffiliates,
	} = api.listAffiliates.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { affiliates?: Affiliate[]; total?: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: AffiliateStats } | undefined;
	};

	const approveMutation = api.approveAffiliate.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const suspendMutation = api.suspendAffiliate.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const rejectMutation = api.rejectAffiliate.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	if (affiliatesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load affiliates
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchAffiliates()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const affiliates = data?.affiliates ?? [];
	const stats = statsData?.stats;

	const handleApprove = async (id: string) => {
		try {
			await approveMutation.mutateAsync({
				params: { id },
				body: { id },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleSuspend = async (id: string) => {
		try {
			await suspendMutation.mutateAsync({
				params: { id },
				body: { id },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleReject = async (id: string) => {
		try {
			await rejectMutation.mutateAsync({
				params: { id },
				body: { id },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Affiliates</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage affiliate partners
				</p>
			</div>

			{/* Stats */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalAffiliates}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Active
						</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{stats.activeAffiliates}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Pending
						</p>
						<p className="mt-1 font-bold text-2xl text-yellow-600">
							{stats.pendingAffiliates}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Conversions
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalConversions}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Revenue
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{formatCurrency(stats.totalRevenue)}
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
					<option value="approved">Approved</option>
					<option value="suspended">Suspended</option>
					<option value="rejected">Rejected</option>
				</select>
			</div>

			{/* Affiliate list */}
			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 4 }).map((_, i) => (
						<div
							key={`skel-${i}`}
							className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : affiliates.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">No affiliates found.</p>
				</div>
			) : (
				<div className="space-y-3">
					{affiliates.map((aff) => (
						<div
							key={aff.id}
							className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground text-sm">
											{aff.name}
										</p>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[aff.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{aff.status}
										</span>
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
										<span>{aff.email}</span>
										<span>Commission: {aff.commissionRate}%</span>
										{aff.website ? <span>{aff.website}</span> : null}
									</div>
								</div>
								<div className="flex gap-1">
									{aff.status === "pending" ? (
										<>
											<button
												type="button"
												onClick={() => handleApprove(aff.id)}
												className="rounded bg-green-50 px-2 py-1 text-green-700 text-xs hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"
											>
												Approve
											</button>
											<button
												type="button"
												onClick={() => handleReject(aff.id)}
												className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
											>
												Reject
											</button>
										</>
									) : null}
									{aff.status === "approved" ? (
										<button
											type="button"
											onClick={() => handleSuspend(aff.id)}
											className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
										>
											Suspend
										</button>
									) : null}
									{aff.status === "suspended" ? (
										<button
											type="button"
											onClick={() => handleApprove(aff.id)}
											className="rounded bg-green-50 px-2 py-1 text-green-700 text-xs hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"
										>
											Reactivate
										</button>
									) : null}
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
