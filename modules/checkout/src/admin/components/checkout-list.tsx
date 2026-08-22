"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import CheckoutListTemplate from "./checkout-list.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckoutSession {
	id: string;
	cartId?: string | null;
	customerId?: string | null;
	guestEmail?: string | null;
	status: string;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	total: number;
	currency: string;
	discountCode?: string | null;
	giftCardCode?: string | null;
	paymentIntentId?: string | null;
	paymentStatus?: string | null;
	orderId?: string | null;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
}

interface ListResult {
	sessions: CheckoutSession[];
	total: number;
	pages: number;
}

interface CheckoutStats {
	total: number;
	pending: number;
	processing: number;
	completed: number;
	abandoned: number;
	expired: number;
	conversionRate: number;
	totalRevenue: number;
	averageOrderValue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
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

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	abandoned:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	expired: "bg-muted text-muted-foreground",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
	pending: "text-yellow-600 dark:text-yellow-400",
	processing: "text-blue-600 dark:text-blue-400",
	succeeded: "text-green-600 dark:text-green-400",
	failed: "text-red-600 dark:text-red-400",
};

function useCheckoutAdminApi() {
	const client = useModuleClient();
	return {
		listSessions: client.module("checkout").admin["/admin/checkout/sessions"],
		getSession: client.module("checkout").admin["/admin/checkout/sessions/:id"],
		getStats: client.module("checkout").admin["/admin/checkout/stats"],
		expireStale:
			client.module("checkout").admin["/admin/checkout/expire-stale"],
	};
}

// ─── StatsCards ───────────────────────────────────────────────────────────────

function StatsCards() {
	const api = useCheckoutAdminApi();
	const { data, isLoading } = api.getStats.useQuery({}) as {
		data: CheckoutStats | undefined;
		isLoading: boolean;
	};

	if (isLoading) {
		return (
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
					<div key={key} className="h-20 animate-pulse rounded-lg bg-muted" />
				))}
			</div>
		);
	}

	if (!data) return null;

	const stats = [
		{ label: "Total Sessions", value: String(data.total) },
		{ label: "Completed", value: String(data.completed) },
		{
			label: "Conversion Rate",
			value: `${(data.conversionRate * 100).toFixed(1)}%`,
		},
		{ label: "Revenue", value: formatPrice(data.totalRevenue) },
		{
			label: "Avg Order Value",
			value: formatPrice(data.averageOrderValue),
		},
	];

	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
			{stats.map((stat) => (
				<div
					key={stat.label}
					className="rounded-lg border border-border bg-card p-4"
				>
					<p className="text-muted-foreground text-xs">{stat.label}</p>
					<p className="mt-1 font-semibold text-foreground text-xl">
						{stat.value}
					</p>
				</div>
			))}
		</div>
	);
}

// ─── FunnelChart ──────────────────────────────────────────────────────────────

function FunnelChart() {
	const api = useCheckoutAdminApi();
	const { data, isLoading } = api.getStats.useQuery({}) as {
		data: CheckoutStats | undefined;
		isLoading: boolean;
	};

	if (isLoading || !data || data.total === 0) return null;

	const stages = [
		{ label: "Started", count: data.total, color: "bg-blue-500" },
		{
			label: "Processing",
			count: data.processing + data.completed,
			color: "bg-indigo-500",
		},
		{ label: "Completed", count: data.completed, color: "bg-green-500" },
	];

	const dropOff = [
		{
			label: "Abandoned",
			count: data.abandoned,
			color: "text-orange-600 dark:text-orange-400",
		},
		{
			label: "Expired",
			count: data.expired,
			color: "text-muted-foreground",
		},
	];

	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<h3 className="mb-3 font-semibold text-foreground text-sm">
				Checkout Funnel
			</h3>
			<div className="space-y-2">
				{stages.map((stage) => {
					const pct = data.total > 0 ? (stage.count / data.total) * 100 : 0;
					return (
						<div key={stage.label} className="flex items-center gap-3">
							<span className="w-24 text-muted-foreground text-xs">
								{stage.label}
							</span>
							<div className="flex-1">
								<div className="h-5 w-full overflow-hidden rounded-full bg-muted">
									<div
										className={`h-full rounded-full ${stage.color} transition-all`}
										style={{ width: `${Math.max(pct, 2)}%` }}
									/>
								</div>
							</div>
							<span className="w-16 text-right font-medium text-foreground text-sm">
								{stage.count}{" "}
								<span className="text-muted-foreground text-xs">
									({pct.toFixed(0)}%)
								</span>
							</span>
						</div>
					);
				})}
			</div>
			<div className="mt-3 flex gap-4 border-border border-t pt-3">
				{dropOff.map((d) => (
					<span key={d.label} className={`text-xs ${d.color}`}>
						{d.label}: {d.count}
					</span>
				))}
			</div>
		</div>
	);
}

// ─── CheckoutList ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export function CheckoutList() {
	const api = useCheckoutAdminApi();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [expiringStale, setExpiringStale] = useState(false);

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(PAGE_SIZE),
	};
	if (search) queryInput.search = search;
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data: listData,
		isLoading: loading,
		isError: checkoutsError,
		refetch: refetchCheckouts,
	} = api.listSessions.useQuery(queryInput) as {
		data: ListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const expireStale = api.expireStale.useMutation({
		onSettled: () => {
			setExpiringStale(false);
			void api.listSessions.invalidate();
			void api.getStats.invalidate();
		},
	});

	if (checkoutsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load checkout sessions
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchCheckouts()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const sessions = listData?.sessions ?? [];
	const total = listData?.total ?? 0;
	const totalPages = listData?.pages ?? 1;

	const handleExpireStale = () => {
		setExpiringStale(true);
		expireStale.mutate({});
	};

	const content = (
		<div>
			<div className="mb-6 flex items-start justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Checkout</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						{total} {total === 1 ? "session" : "sessions"}
					</p>
				</div>
				<button
					type="button"
					disabled={expiringStale}
					onClick={handleExpireStale}
					className="flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
				>
					{expiringStale ? "Expiring..." : "Expire Stale Sessions"}
				</button>
			</div>

			{/* Stats */}
			<div className="mb-6 space-y-4">
				<StatsCards />
				<FunnelChart />
			</div>

			{/* Filters */}
			<div className="mb-4 flex flex-wrap gap-3">
				<input
					type="search"
					aria-label="Search checkout sessions"
					placeholder="Search by email or session ID..."
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
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
					<option value="pending">Pending</option>
					<option value="processing">Processing</option>
					<option value="completed">Completed</option>
					<option value="abandoned">Abandoned</option>
					<option value="expired">Expired</option>
				</select>
			</div>

			{/* Session List */}
			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Session
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
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
							>
								Payment
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Total
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Created
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{loading ? (
							(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
								<tr key={key}>
									{(["k0", "k1", "k2", "k3", "k4", "k5"] as const).map(
										(_key) => (
											<td key={key} className="px-4 py-3">
												<div className="h-4 w-24 animate-pulse rounded bg-muted" />
											</td>
										),
									)}
								</tr>
							))
						) : sessions.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No checkout sessions found
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Sessions appear when customers begin checkout
									</p>
								</td>
							</tr>
						) : (
							sessions.map((session) => (
								<tr
									key={session.id}
									className="cursor-pointer transition-colors hover:bg-muted/30"
									onClick={() => {
										window.location.href = `/admin/checkout/${session.id}`;
									}}
								>
									<td className="px-4 py-3">
										<span
											className="font-medium font-mono text-foreground text-sm"
											title={session.id}
										>
											{session.id.slice(0, 8)}...
										</span>
									</td>
									<td className="hidden px-4 py-3 text-sm sm:table-cell">
										{session.guestEmail ?? (
											<span className="text-muted-foreground">
												{session.customerId ? "Registered customer" : "Guest"}
											</span>
										)}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[session.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{session.status}
										</span>
									</td>
									<td className="hidden px-4 py-3 text-sm md:table-cell">
										{session.paymentStatus ? (
											<span
												className={`font-medium ${PAYMENT_STATUS_COLORS[session.paymentStatus] ?? "text-muted-foreground"}`}
											>
												{session.paymentStatus}
											</span>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</td>
									<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
										{formatPrice(session.total, session.currency)}
									</td>
									<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
										{timeAgo(session.createdAt)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="mt-4 flex items-center justify-center gap-2">
					<button
						type="button"
						onClick={() => setPage((p: number) => Math.max(1, p - 1))}
						disabled={page === 1}
						className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
					>
						Previous
					</button>
					<span className="text-muted-foreground text-sm">
						Page {page} of {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
						disabled={page === totalPages}
						className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
					>
						Next
					</button>
				</div>
			)}
		</div>
	);

	return <CheckoutListTemplate content={content} />;
}
