"use client";

import { useState } from "react";
import { useMembershipsApi } from "./_shared";

interface Membership {
	id: string;
	customerId: string;
	planId: string;
	status: string;
	startDate: string;
	endDate?: string;
	trialEndDate?: string;
	cancelledAt?: string;
	pausedAt?: string;
	createdAt: string;
	updatedAt: string;
}

interface MembershipStats {
	totalMemberships: number;
	activeMemberships: number;
	trialMemberships: number;
	cancelledMemberships: number;
	pausedMemberships: number;
}

const MEMBERSHIP_SKELETON_IDS = ["a", "b", "c", "d"] as const;

const STATUS_COLORS: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	trial: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	expired: "bg-muted text-muted-foreground",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	paused:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function MembershipAdmin() {
	const api = useMembershipsApi();
	const [statusFilter, setStatusFilter] = useState("");

	const { data, isLoading } = api.listMemberships.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { memberships?: Membership[]; total?: number } | undefined;
		isLoading: boolean;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: MembershipStats } | undefined;
	};

	const cancelMutation = api.cancelMembership.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const pauseMutation = api.pauseMembership.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const resumeMutation = api.resumeMembership.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const memberships = data?.memberships ?? [];
	const stats = statsData?.stats;

	const handleAction = async (
		id: string,
		action: "cancel" | "pause" | "resume",
	) => {
		const mutation =
			action === "cancel"
				? cancelMutation
				: action === "pause"
					? pauseMutation
					: resumeMutation;
		try {
			await mutation.mutateAsync({ params: { id } });
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Memberships</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage customer memberships
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
							{stats.totalMemberships}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Active
						</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{stats.activeMemberships}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Trial
						</p>
						<p className="mt-1 font-bold text-2xl text-blue-600">
							{stats.trialMemberships}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Paused
						</p>
						<p className="mt-1 font-bold text-2xl text-yellow-600">
							{stats.pausedMemberships}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Cancelled
						</p>
						<p className="mt-1 font-bold text-2xl text-red-600">
							{stats.cancelledMemberships}
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
					<option value="active">Active</option>
					<option value="trial">Trial</option>
					<option value="expired">Expired</option>
					<option value="cancelled">Cancelled</option>
					<option value="paused">Paused</option>
				</select>
			</div>

			{/* Membership list */}
			{isLoading ? (
				<div className="space-y-3">
					{MEMBERSHIP_SKELETON_IDS.map((id) => (
						<div
							key={`membership-skel-${id}`}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : memberships.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">No memberships found.</p>
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
									ID
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
									Plan
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
									Started
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
							{memberships.map((m) => (
								<tr key={m.id} className="transition-colors hover:bg-muted/50">
									<td className="px-4 py-2 font-mono text-xs">
										{m.id.slice(0, 8)}...
									</td>
									<td className="px-4 py-2 text-foreground">
										{m.customerId.slice(0, 8)}...
									</td>
									<td className="px-4 py-2 text-foreground">
										{m.planId.slice(0, 8)}...
									</td>
									<td className="px-4 py-2">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[m.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{m.status}
										</span>
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{formatDate(m.startDate)}
									</td>
									<td className="px-4 py-2">
										<div className="flex gap-1">
											{m.status === "active" || m.status === "trial" ? (
												<>
													<button
														type="button"
														onClick={() => handleAction(m.id, "pause")}
														className="rounded px-2 py-1 text-xs hover:bg-muted"
													>
														Pause
													</button>
													<button
														type="button"
														onClick={() => handleAction(m.id, "cancel")}
														className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
													>
														Cancel
													</button>
												</>
											) : null}
											{m.status === "paused" ? (
												<button
													type="button"
													onClick={() => handleAction(m.id, "resume")}
													className="rounded px-2 py-1 text-xs hover:bg-muted"
												>
													Resume
												</button>
											) : null}
										</div>
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
