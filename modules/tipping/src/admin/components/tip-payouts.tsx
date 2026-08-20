"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import TipPayoutsTemplate from "./tip-payouts.mdx";

interface PayoutItem {
	id: string;
	recipientId: string;
	recipientType: string;
	amount: number;
	tipCount: number;
	status: string;
	periodStart: string;
	periodEnd: string;
	createdAt: string;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount / 100);
}

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function usePayoutsApi() {
	const client = useModuleClient();
	return {
		list: client.module("tipping").admin["/admin/tipping/payouts/list"],
	};
}

export function TipPayouts() {
	const api = usePayoutsApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState("");
	const [error] = useState("");

	const {
		data: listData,
		isLoading,
		isError: payoutsError,
		refetch: refetchPayouts,
	} = api.list.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { payouts: PayoutItem[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (payoutsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load payouts</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchPayouts()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const payouts = listData?.payouts ?? [];
	const total = listData?.total ?? 0;

	const tableContent =
		payouts.length === 0 ? (
			<div className="px-5 py-8 text-center text-muted-foreground text-sm">
				No payouts found.
			</div>
		) : (
			<>
				<div className="hidden md:block">
					<table className="w-full text-left text-sm">
						<thead className="border-border border-b bg-muted/50">
							<tr>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Recipient
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Amount
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Tips
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Period
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Status
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{payouts.map((p) => (
								<tr key={p.id} className="hover:bg-muted/30">
									<td className="px-5 py-3 text-foreground text-sm">
										{p.recipientId}
										<span className="ml-1 text-muted-foreground text-xs">
											({p.recipientType})
										</span>
									</td>
									<td className="px-5 py-3 font-medium text-foreground">
										{formatCurrency(p.amount)}
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{p.tipCount}
									</td>
									<td className="px-5 py-3 text-muted-foreground text-sm">
										{formatDate(p.periodStart)} -- {formatDate(p.periodEnd)}
									</td>
									<td className="px-5 py-3">
										<span
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[p.status] ?? ""}`}
										>
											{p.status}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="divide-y divide-border md:hidden">
					{payouts.map((p) => (
						<div key={p.id} className="px-5 py-3">
							<div className="flex items-start justify-between">
								<div>
									<p className="font-medium text-foreground text-sm">
										{formatCurrency(p.amount)}
									</p>
									<p className="mt-0.5 text-muted-foreground text-xs">
										{p.recipientId} - {p.tipCount} tips
									</p>
								</div>
								<span
									className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[p.status] ?? ""}`}
								>
									{p.status}
								</span>
							</div>
						</div>
					))}
				</div>

				{total > PAGE_SIZE && (
					<div className="flex items-center justify-between border-border border-t px-5 py-3">
						<span className="text-muted-foreground text-sm">
							Showing {skip + 1}--{Math.min(skip + PAGE_SIZE, total)} of {total}
						</span>
						<span className="space-x-2">
							<button
								type="button"
								onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
								disabled={skip === 0}
								className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
							>
								Previous
							</button>
							<button
								type="button"
								onClick={() => setSkip((s) => s + PAGE_SIZE)}
								disabled={skip + PAGE_SIZE >= total}
								className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
							>
								Next
							</button>
						</span>
					</div>
				)}
			</>
		);

	return (
		<TipPayoutsTemplate
			statusFilter={statusFilter}
			onStatusFilterChange={(v: string) => {
				setStatusFilter(v);
				setSkip(0);
			}}
			error={error}
			loading={isLoading}
			tableContent={tableContent}
		/>
	);
}
