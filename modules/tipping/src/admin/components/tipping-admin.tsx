"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import TippingAdminTemplate from "./tipping-admin.mdx";

interface TipItem {
	id: string;
	orderId: string;
	amount: number;
	percentage?: number;
	type: string;
	recipientType: string;
	status: string;
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
	paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	refunded: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function useTippingAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("tipping").admin["/admin/tipping/tips"],
		get: client.module("tipping").admin["/admin/tipping/tips/:id"],
		split: client.module("tipping").admin["/admin/tipping/tips/:id/split"],
		stats: client.module("tipping").admin["/admin/tipping/stats"],
	};
}

export function TippingAdmin() {
	const api = useTippingAdminApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState("");
	const [error] = useState("");

	const {
		data: listData,
		isLoading,
		isError: tipsError,
		refetch: refetchTips,
	} = api.list.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { tips: TipItem[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (tipsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">Failed to load tips</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchTips()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const tips = listData?.tips ?? [];
	const total = listData?.total ?? 0;

	const tableContent =
		tips.length === 0 ? (
			<div className="px-5 py-8 text-center text-muted-foreground text-sm">
				No tips found.
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
									Order
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
									Type
								</th>
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
									Status
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Created
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{tips.map((t) => (
								<tr key={t.id} className="hover:bg-muted/30">
									<td className="px-5 py-3 font-mono text-foreground text-xs">
										{t.orderId}
									</td>
									<td className="px-5 py-3 font-medium text-foreground">
										{formatCurrency(t.amount)}
										{t.percentage != null && (
											<span className="ml-1 text-muted-foreground text-xs">
												({t.percentage}%)
											</span>
										)}
									</td>
									<td className="px-5 py-3 text-muted-foreground text-sm">
										{t.type}
									</td>
									<td className="px-5 py-3 text-muted-foreground text-sm">
										{t.recipientType}
									</td>
									<td className="px-5 py-3">
										<span
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[t.status] ?? ""}`}
										>
											{t.status}
										</span>
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{formatDate(t.createdAt)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="divide-y divide-border md:hidden">
					{tips.map((t) => (
						<div key={t.id} className="px-5 py-3">
							<div className="flex items-start justify-between">
								<div>
									<p className="font-medium text-foreground text-sm">
										{formatCurrency(t.amount)}
										{t.percentage != null && (
											<span className="ml-1 text-muted-foreground text-xs">
												({t.percentage}%)
											</span>
										)}
									</p>
									<p className="mt-0.5 font-mono text-muted-foreground text-xs">
										{t.orderId}
									</p>
								</div>
								<span
									className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[t.status] ?? ""}`}
								>
									{t.status}
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
		<TippingAdminTemplate
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
