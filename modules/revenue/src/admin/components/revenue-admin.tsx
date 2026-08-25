"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useMemo, useState } from "react";
import type { PaymentIntentStatus, RevenueStats } from "../../service";
import RevenueAdminTemplate from "./revenue-admin.mdx";
import {
	isRevenueExportResult,
	isRevenueStats,
	isRevenueTransactionPage,
	resolveRevenueQuery,
} from "./revenue-stats";

type DatePreset = "today" | "7d" | "30d" | "90d" | "all";

const PRESET_LABELS: Record<DatePreset, string> = {
	today: "Today",
	"7d": "Last 7 days",
	"30d": "Last 30 days",
	"90d": "Last 90 days",
	all: "All time",
};

function presetToRange(preset: DatePreset): { from?: string; to?: string } {
	if (preset === "all") return {};
	const now = new Date();
	const to = now.toISOString();
	const days: Record<DatePreset, number> = {
		today: 1,
		"7d": 7,
		"30d": 30,
		"90d": 90,
		all: 0,
	};
	const from = new Date(now.getTime() - days[preset] * 86400000).toISOString();
	return { from, to };
}

function formatMoney(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(cents / 100);
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

const STATUS_COLORS: Record<PaymentIntentStatus, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	succeeded:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	cancelled: "bg-muted text-muted-foreground",
	refunded:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

function useRevenueApi() {
	const client = useModuleClient();
	return {
		getStats: client.module("revenue").admin["/admin/revenue/stats"],
		listTransactions:
			client.module("revenue").admin["/admin/revenue/transactions"],
		exportTransactions: client.module("revenue").admin["/admin/revenue/export"],
	};
}

function StatCard({
	label,
	value,
	sub,
}: {
	label: string;
	value: string;
	sub?: string;
}) {
	return (
		<div className="rounded-lg border border-border bg-card p-5">
			<p className="text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</p>
			<p className="mt-1.5 font-semibold text-2xl text-foreground">{value}</p>
			{sub && <p className="mt-0.5 text-muted-foreground text-xs">{sub}</p>}
		</div>
	);
}

function OverviewTab({ preset }: { preset: DatePreset }) {
	const api = useRevenueApi();
	const range = useMemo(() => presetToRange(preset), [preset]);

	const { data, isLoading, isError } = api.getStats.useQuery(range) as {
		data: unknown;
		isLoading: boolean;
		isError: boolean;
	};

	const statsQuery = resolveRevenueQuery(
		{ data, isError, isLoading },
		isRevenueStats,
	);

	if (statsQuery.status === "unavailable") {
		return (
			<div
				className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
				role="alert"
			>
				<p className="font-medium text-destructive text-sm">
					Failed to load revenue stats
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Please try refreshing the page.
				</p>
			</div>
		);
	}

	if (statsQuery.status === "loading") {
		return (
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{(["k0", "k1", "k2", "k3"] as const).map((key) => (
					<div key={key} className="h-24 animate-pulse rounded-lg bg-muted" />
				))}
			</div>
		);
	}

	const stats: RevenueStats = statsQuery.data;

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard
					label="Total Revenue"
					value={formatMoney(stats.totalVolume, stats.currency)}
					sub={`${stats.transactionCount} transactions`}
				/>
				<StatCard
					label="Avg. Order Value"
					value={formatMoney(stats.averageValue, stats.currency)}
				/>
				<StatCard
					label="Refunded"
					value={formatMoney(stats.refundVolume, stats.currency)}
					sub={`${stats.refundCount} refunds`}
				/>
				<StatCard
					label="Failed"
					value={String(stats.byStatus.failed + stats.byStatus.cancelled)}
					sub="failed + cancelled"
				/>
			</div>

			<div className="rounded-lg border border-border bg-card">
				<div className="border-border border-b px-5 py-3">
					<h3 className="font-semibold text-foreground text-sm">By Status</h3>
				</div>
				<div className="divide-y divide-border">
					{(
						[
							"succeeded",
							"pending",
							"processing",
							"refunded",
							"failed",
							"cancelled",
						] as PaymentIntentStatus[]
					).map((s) => (
						<div
							key={s}
							className="flex items-center justify-between px-5 py-3"
						>
							<span
								className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[s]}`}
							>
								{s}
							</span>
							<span className="font-medium text-foreground text-sm">
								{stats.byStatus[s]}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function TransactionsTab({ preset }: { preset: DatePreset }) {
	const api = useRevenueApi();
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState<string>("");
	const [search, setSearch] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [exportFailed, setExportFailed] = useState(false);
	const range = useMemo(() => presetToRange(preset), [preset]);
	const pageSize = 20;

	const query: Record<string, string> = {
		page: String(page),
		limit: String(pageSize),
		...range,
	};
	if (statusFilter) query.status = statusFilter;
	if (search) query.search = search;

	const { data, isLoading, isError } = api.listTransactions.useQuery(query) as {
		data: unknown;
		isLoading: boolean;
		isError: boolean;
	};

	const transactionsQuery = resolveRevenueQuery(
		{ data, isError, isLoading },
		isRevenueTransactionPage,
	);
	const transactionPage =
		transactionsQuery.status === "ready" ? transactionsQuery.data : undefined;
	const transactions = transactionPage?.transactions ?? [];
	const total = transactionPage?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const handleExport = async () => {
		const exportQuery: Record<string, string> = { ...range };
		if (statusFilter) exportQuery.status = statusFilter;
		let result: unknown;
		try {
			result = await api.exportTransactions.fetch(exportQuery);
		} catch {
			setExportFailed(true);
			return;
		}
		if (!isRevenueExportResult(result)) {
			setExportFailed(true);
			return;
		}
		setExportFailed(false);

		const blob = new Blob([result.csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	if (transactionsQuery.status === "unavailable") {
		return (
			<div
				className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
				role="alert"
			>
				<p className="font-medium text-destructive text-sm">
					Failed to load transactions
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Please try refreshing the page.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{exportFailed && (
				<p className="text-destructive text-sm" role="alert">
					Failed to export transactions
				</p>
			)}
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex flex-1 items-center gap-2">
					<input
						type="text"
						placeholder="Search by email, order ID, intent ID…"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								setSearch(searchInput);
								setPage(1);
							}
						}}
						className="h-9 min-w-48 flex-1 rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
					{searchInput !== search && (
						<button
							type="button"
							onClick={() => {
								setSearch(searchInput);
								setPage(1);
							}}
							className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground text-sm hover:bg-primary/90"
						>
							Search
						</button>
					)}
					{search && (
						<button
							type="button"
							onClick={() => {
								setSearch("");
								setSearchInput("");
								setPage(1);
							}}
							className="h-9 rounded-md border border-border px-3 text-foreground text-sm hover:bg-muted"
						>
							Clear
						</button>
					)}
				</div>

				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => {
						setStatusFilter(e.target.value);
						setPage(1);
					}}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">All statuses</option>
					<option value="succeeded">Succeeded</option>
					<option value="pending">Pending</option>
					<option value="processing">Processing</option>
					<option value="refunded">Refunded</option>
					<option value="failed">Failed</option>
					<option value="cancelled">Cancelled</option>
				</select>

				<button
					type="button"
					onClick={() => void handleExport()}
					className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-foreground text-sm hover:bg-muted"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
					Export CSV
				</button>
			</div>

			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Transaction
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Customer
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Status
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Amount
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Date
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{transactionsQuery.status === "loading" ? (
							(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
								<tr key={key}>
									{(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
										<td key={key} className="px-4 py-3">
											<div className="h-4 w-24 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : transactions.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No transactions found
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{search || statusFilter
											? "Try adjusting your filters"
											: "Transactions will appear once customers complete checkout"}
									</p>
								</td>
							</tr>
						) : (
							transactions.map((tx) => (
								<tr key={tx.id} className="transition-colors hover:bg-muted/30">
									<td className="px-4 py-3">
										<span className="font-mono text-foreground text-xs">
											{tx.providerIntentId
												? `${tx.providerIntentId.slice(0, 16)}…`
												: `${tx.id.slice(0, 8)}…`}
										</span>
										{tx.orderId && (
											<p className="mt-0.5 text-muted-foreground text-xs">
												Order {tx.orderId.slice(0, 8)}…
											</p>
										)}
									</td>
									<td className="hidden px-4 py-3 text-foreground text-sm sm:table-cell">
										{tx.email ?? (
											<span className="text-muted-foreground">&mdash;</span>
										)}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[tx.status]}`}
										>
											{tx.status}
										</span>
									</td>
									<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
										{formatMoney(tx.amount, tx.currency)}
									</td>
									<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
										{timeAgo(tx.createdAt)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-sm">
						{total} transaction{total !== 1 ? "s" : ""}
					</span>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
						>
							Previous
						</button>
						<span className="text-muted-foreground text-sm">
							{page} / {totalPages}
						</span>
						<button
							type="button"
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							disabled={page === totalPages}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

export function RevenueAdmin() {
	const [tab, setTab] = useState<"overview" | "transactions">("overview");
	const [preset, setPreset] = useState<DatePreset>("30d");

	return (
		<RevenueAdminTemplate
			tab={tab}
			preset={preset}
			presetLabels={PRESET_LABELS}
			onTabChange={setTab}
			onPresetChange={setPreset}
			tabContent={
				tab === "overview" ? (
					<OverviewTab preset={preset} />
				) : (
					<TransactionsTab preset={preset} />
				)
			}
		/>
	);
}
