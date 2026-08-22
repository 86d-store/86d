"use client";

import { useState } from "react";
import { formatCurrency, formatDate, useAffiliatesApi } from "./_shared";

interface Conversion {
	id: string;
	affiliateId: string;
	orderId?: string;
	amount: number;
	commission: number;
	status: string;
	createdAt: string;
}

const CONVERSION_STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	approved:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function ConversionList() {
	const api = useAffiliatesApi();
	const [statusFilter, setStatusFilter] = useState("");

	const { data, isLoading } = api.listConversions.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { conversions?: Conversion[]; total?: number } | undefined;
		isLoading: boolean;
	};

	const approveMutation = api.approveConversion.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const rejectMutation = api.rejectConversion.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const conversions = data?.conversions ?? [];

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
				<h1 className="font-bold text-2xl text-foreground">Conversions</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Track and approve affiliate conversions
				</p>
			</div>

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
					<option value="rejected">Rejected</option>
				</select>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2", "k3"] as const).map((key) => (
						<div
							key={key}
							className="h-14 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : conversions.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">No conversions found.</p>
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
									Affiliate
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Amount
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Commission
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
							{conversions.map((conv) => (
								<tr
									key={conv.id}
									className="transition-colors hover:bg-muted/50"
								>
									<td className="px-4 py-2 font-mono text-foreground text-xs">
										{conv.affiliateId.slice(0, 8)}...
									</td>
									<td className="px-4 py-2 text-foreground">
										{formatCurrency(conv.amount)}
									</td>
									<td className="px-4 py-2 text-foreground">
										{formatCurrency(conv.commission)}
									</td>
									<td className="px-4 py-2">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${CONVERSION_STATUS_COLORS[conv.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{conv.status}
										</span>
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{formatDate(conv.createdAt)}
									</td>
									<td className="px-4 py-2">
										{conv.status === "pending" ? (
											<div className="flex gap-1">
												<button
													type="button"
													onClick={() => handleApprove(conv.id)}
													className="rounded px-2 py-1 text-green-700 text-xs hover:bg-green-50 dark:hover:bg-green-900/20"
												>
													Approve
												</button>
												<button
													type="button"
													onClick={() => handleReject(conv.id)}
													className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
												>
													Reject
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
