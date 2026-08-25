"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import AnalyticsAdminTemplate from "./analytics-admin.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChartPayloadEntry {
	dataKey?: string;
	name?: string;
	value?: number | string;
	color?: string;
	payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
	active?: boolean;
	payload?: ChartPayloadEntry[];
	label?: string | number;
	formatter?: (value: number | string | undefined) => string;
}

interface EventStats {
	type: string;
	count: number;
}

interface ProductStats {
	productId: string;
	views: number;
	purchases: number;
}

interface AnalyticsEvent {
	id: string;
	type: string;
	sessionId?: string | null;
	customerId?: string | null;
	productId?: string | null;
	orderId?: string | null;
	value?: number | null;
	data: Record<string, unknown>;
	createdAt: string;
}

interface RevenueSummary {
	totalRevenue: number;
	orderCount: number;
	averageOrderValue: number;
	previousRevenue: number;
	previousOrders: number;
}

interface RevenueTimeSeriesPoint {
	date: string;
	revenue: number;
	orders: number;
}

interface FunnelStep {
	step: string;
	count: number;
	rate: number;
}

interface ProductSalesStats {
	productId: string;
	revenue: number;
	orders: number;
	averageValue: number;
}

type DateRange = "7d" | "30d" | "90d" | "all";
type Tab = "overview" | "revenue" | "funnel" | "events" | "products" | "search";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function sinceDate(range: DateRange): string | undefined {
	if (range === "all") return undefined;
	const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
	const d = new Date();
	d.setDate(d.getDate() - days);
	return d.toISOString();
}

function formatCurrency(cents: number): string {
	return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyShort(cents: number): string {
	const dollars = cents / 100;
	if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
	return `$${dollars.toFixed(0)}`;
}

function formatChange(
	current: number,
	previous: number,
): { text: string; positive: boolean } | null {
	if (previous === 0) return null;
	const pct = ((current - previous) / previous) * 100;
	const sign = pct >= 0 ? "+" : "";
	return { text: `${sign}${pct.toFixed(1)}%`, positive: pct >= 0 };
}

const TYPE_COLORS: Record<string, string> = {
	pageView: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	productView:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	addToCart:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	removeFromCart:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	checkout:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	purchase:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	search: "bg-muted text-muted-foreground",
};

const FUNNEL_LABELS: Record<string, string> = {
	pageView: "Page Views",
	productView: "Product Views",
	addToCart: "Add to Cart",
	checkout: "Checkout",
	purchase: "Purchase",
};

const CHART_COLORS = [
	"#3b82f6",
	"#8b5cf6",
	"#eab308",
	"#f97316",
	"#6366f1",
	"#22c55e",
	"#6b7280",
	"#ec4899",
	"#14b8a6",
	"#ef4444",
];

function getEventColor(type: string, index: number): string {
	const colorMap: Record<string, string> = {
		pageView: "#3b82f6",
		productView: "#8b5cf6",
		addToCart: "#eab308",
		removeFromCart: "#f97316",
		checkout: "#6366f1",
		purchase: "#22c55e",
		search: "#6b7280",
	};
	return colorMap[type] ?? CHART_COLORS[index % CHART_COLORS.length];
}

// ── API Hook ─────────────────────────────────────────────────────────────────

function useAnalyticsAdminApi() {
	const client = useModuleClient();
	return {
		getStats: client.module("analytics").admin["/admin/analytics/stats"],
		getTopProducts:
			client.module("analytics").admin["/admin/analytics/top-products"],
		getEvents: client.module("analytics").admin["/admin/analytics/events"],
		getRevenue: client.module("analytics").admin["/admin/analytics/revenue"],
		getRevenueTimeSeries:
			client.module("analytics").admin["/admin/analytics/revenue/timeseries"],
		getFunnel: client.module("analytics").admin["/admin/analytics/funnel"],
		getSalesByProduct:
			client.module("analytics").admin["/admin/analytics/sales-by-product"],
		getSearchAnalytics:
			client.module("analytics").admin["/admin/analytics/search"],
	};
}

// ── Shared Components ────────────────────────────────────────────────────────

function EventTypeBadge({ type }: { type: string }) {
	const cls = TYPE_COLORS[type] ?? "bg-muted text-muted-foreground";
	return (
		<span
			className={`inline-block rounded px-2 py-0.5 font-medium text-xs ${cls}`}
		>
			{type}
		</span>
	);
}

function StatCard({
	label,
	value,
	sub,
	change,
}: {
	label: string;
	value: number | string;
	sub?: string | undefined;
	change?: { text: string; positive: boolean } | null | undefined;
}) {
	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<p className="text-muted-foreground text-sm">{label}</p>
			<div className="mt-1 flex items-baseline gap-2">
				<p className="font-semibold text-2xl text-foreground">
					{typeof value === "number" ? value.toLocaleString() : value}
				</p>
				{change && (
					<span
						className={`font-medium text-sm ${change.positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
					>
						{change.text}
					</span>
				)}
			</div>
			{sub && <p className="mt-0.5 text-muted-foreground text-xs">{sub}</p>}
		</div>
	);
}

function LoadingState() {
	return (
		<div className="flex justify-center py-12 text-muted-foreground">
			Loading&hellip;
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="rounded-lg border border-border bg-card py-12 text-center text-muted-foreground text-sm">
			{message}
		</div>
	);
}

function ChartCard({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="rounded-lg border border-border bg-card">
			<div className="border-border border-b px-4 py-3">
				<h2 className="font-medium text-foreground">{title}</h2>
			</div>
			<div className="p-4">{children}</div>
		</div>
	);
}

function ChartTooltipBase({
	active,
	payload,
	label,
	formatter,
}: ChartTooltipProps) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
			{label && (
				<p className="mb-1 font-medium text-foreground text-xs">{label}</p>
			)}
			{payload.map((entry) => (
				<div
					key={entry.dataKey || entry.name}
					className="flex items-center gap-2 text-xs"
				>
					<span
						className="inline-block h-2 w-2 rounded-full"
						style={{ backgroundColor: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-medium text-foreground">
						{formatter ? formatter(entry.value) : entry.value?.toLocaleString()}
					</span>
				</div>
			))}
		</div>
	);
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
	stats,
	loading,
	range,
	pageViews,
	purchases,
	addToCarts,
	totalEvents,
}: {
	stats: EventStats[];
	loading: boolean;
	range: DateRange;
	pageViews: number;
	purchases: number;
	addToCarts: number;
	totalEvents: number;
}) {
	const pieData = useMemo(
		() =>
			stats.map((s, i) => ({
				name: s.type,
				value: s.count,
				fill: getEventColor(s.type, i),
			})),
		[stats],
	);

	if (loading) return <LoadingState />;

	const conversionRate =
		pageViews > 0 ? ((purchases / pageViews) * 100).toFixed(1) : "—";

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatCard
					label="Total Events"
					value={totalEvents}
					sub={range === "all" ? "all time" : `last ${range}`}
				/>
				<StatCard label="Page Views" value={pageViews} />
				<StatCard label="Purchases" value={purchases} />
				<StatCard
					label="Conversion Rate"
					value={
						typeof conversionRate === "string"
							? conversionRate
							: `${conversionRate}%`
					}
					sub="purchases / page views"
				/>
			</div>

			{/* Event distribution pie chart + breakdown list */}
			{stats.length > 0 && (
				<div className="grid gap-6 lg:grid-cols-2">
					<ChartCard title="Event Distribution">
						<div style={{ width: "100%", height: 280 }}>
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={pieData}
										cx="50%"
										cy="50%"
										innerRadius={60}
										outerRadius={100}
										paddingAngle={2}
										dataKey="value"
										nameKey="name"
									>
										{pieData.map((entry) => (
											<Cell key={entry.name} fill={entry.fill} />
										))}
									</Pie>
									<Tooltip
										content={
											<ChartTooltipBase
												formatter={(v) =>
													typeof v === "number"
														? v.toLocaleString()
														: String(v ?? "")
												}
											/>
										}
									/>
									<Legend
										formatter={(value: string) => (
											<span className="text-muted-foreground text-xs">
												{value}
											</span>
										)}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>

					<ChartCard title="Events by Type">
						<div style={{ width: "100%", height: 280 }}>
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={stats}
									layout="vertical"
									margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										horizontal={false}
										opacity={0.15}
									/>
									<XAxis
										type="number"
										tick={{ fontSize: 11 }}
										tickFormatter={(v: number) => v.toLocaleString()}
									/>
									<YAxis
										type="category"
										dataKey="type"
										width={100}
										tick={{ fontSize: 11 }}
									/>
									<Tooltip
										content={
											<ChartTooltipBase
												formatter={(v) =>
													typeof v === "number"
														? v.toLocaleString()
														: String(v ?? "")
												}
											/>
										}
									/>
									<Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
										{stats.map((s, i) => (
											<Cell key={s.type} fill={getEventColor(s.type, i)} />
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</ChartCard>
				</div>
			)}

			{addToCarts > 0 && (
				<StatCard
					label="Cart Add Rate"
					value={
						pageViews > 0
							? `${((addToCarts / pageViews) * 100).toFixed(1)}%`
							: "—"
					}
					sub={`${addToCarts.toLocaleString()} add-to-cart events`}
				/>
			)}
		</div>
	);
}

// ── Revenue Tab ──────────────────────────────────────────────────────────────

function RevenueTab({
	since,
	range,
}: {
	since: string | undefined;
	range: DateRange;
}) {
	const api = useAnalyticsAdminApi();
	const revenueInput: Record<string, string> = {};
	if (since) revenueInput.since = since;

	const tsInput: Record<string, string> = {};
	if (since) tsInput.since = since;

	const salesInput: Record<string, string> = { limit: "10" };
	if (since) salesInput.since = since;

	const { data: revenueData, isLoading: loadingRevenue } =
		api.getRevenue.useQuery(revenueInput) as {
			data: { summary?: RevenueSummary } | undefined;
			isLoading: boolean;
		};

	const { data: tsData, isLoading: loadingTs } =
		api.getRevenueTimeSeries.useQuery(tsInput) as {
			data: { timeseries?: RevenueTimeSeriesPoint[] } | undefined;
			isLoading: boolean;
		};

	const { data: salesData, isLoading: loadingSales } =
		api.getSalesByProduct.useQuery(salesInput) as {
			data: { products?: ProductSalesStats[] } | undefined;
			isLoading: boolean;
		};

	const currencyTooltipFormatter = useCallback(
		(v: number | string | undefined) =>
			formatCurrency(typeof v === "number" ? v : 0),
		[],
	);

	if (loadingRevenue || loadingTs || loadingSales) return <LoadingState />;

	const summary = revenueData?.summary;
	const timeseries = tsData?.timeseries ?? [];
	const salesProducts = salesData?.products ?? [];

	const revenueChange = summary
		? formatChange(summary.totalRevenue, summary.previousRevenue)
		: null;
	const ordersChange = summary
		? formatChange(summary.orderCount, summary.previousOrders)
		: null;

	return (
		<div className="space-y-6">
			{/* Revenue summary cards */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
				<StatCard
					label="Total Revenue"
					value={formatCurrency(summary?.totalRevenue ?? 0)}
					sub={range === "all" ? "all time" : `last ${range}`}
					change={revenueChange}
				/>
				<StatCard
					label="Orders"
					value={summary?.orderCount ?? 0}
					change={ordersChange}
				/>
				<StatCard
					label="Avg. Order Value"
					value={formatCurrency(summary?.averageOrderValue ?? 0)}
				/>
			</div>

			{/* Revenue area chart */}
			{timeseries.length > 0 && (
				<ChartCard title="Revenue Over Time">
					<div style={{ width: "100%", height: 280 }}>
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart
								data={timeseries}
								margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
							>
								<defs>
									<linearGradient
										id="revenueGradient"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
										<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
									</linearGradient>
									<linearGradient
										id="ordersGradient"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
										<stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" opacity={0.15} />
								<XAxis
									dataKey="date"
									tick={{ fontSize: 11 }}
									tickFormatter={(d: string) => {
										const parts = d.split("-");
										return `${parts[1]}/${parts[2]}`;
									}}
								/>
								<YAxis
									yAxisId="revenue"
									tick={{ fontSize: 11 }}
									tickFormatter={(v: number) => formatCurrencyShort(v)}
								/>
								<YAxis
									yAxisId="orders"
									orientation="right"
									tick={{ fontSize: 11 }}
								/>
								<Tooltip content={<RevenueTooltip />} />
								<Legend
									formatter={(value: string) => (
										<span className="text-muted-foreground text-xs">
											{value}
										</span>
									)}
								/>
								<Area
									yAxisId="revenue"
									type="monotone"
									dataKey="revenue"
									name="Revenue"
									stroke="#3b82f6"
									strokeWidth={2}
									fill="url(#revenueGradient)"
								/>
								<Area
									yAxisId="orders"
									type="monotone"
									dataKey="orders"
									name="Orders"
									stroke="#22c55e"
									strokeWidth={2}
									fill="url(#ordersGradient)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</ChartCard>
			)}

			{/* Sales by product — bar chart + table */}
			{salesProducts.length > 0 && (
				<ChartCard title="Top Products by Revenue">
					<div style={{ width: "100%", height: 240 }}>
						<ResponsiveContainer width="100%" height="100%">
							<BarChart
								data={salesProducts}
								margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
							>
								<CartesianGrid strokeDasharray="3 3" opacity={0.15} />
								<XAxis
									dataKey="productId"
									tick={{ fontSize: 10 }}
									tickFormatter={(id: string) => id.slice(0, 8)}
								/>
								<YAxis
									tick={{ fontSize: 11 }}
									tickFormatter={(v: number) => formatCurrencyShort(v)}
								/>
								<Tooltip
									content={
										<ChartTooltipBase formatter={currencyTooltipFormatter} />
									}
								/>
								<Bar
									dataKey="revenue"
									name="Revenue"
									fill="#3b82f6"
									radius={[4, 4, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-4 overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="border-border border-b bg-muted/30 text-left">
								<tr>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										#
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Product ID
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Revenue
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Orders
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										AOV
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{salesProducts.map((p, i) => (
									<tr key={p.productId} className="hover:bg-muted/30">
										<td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
										<td className="px-4 py-2 font-mono text-foreground/70 text-xs">
											{p.productId}
										</td>
										<td className="px-4 py-2 font-medium text-green-600 dark:text-green-400">
											{formatCurrency(p.revenue)}
										</td>
										<td className="px-4 py-2 text-foreground/70">{p.orders}</td>
										<td className="px-4 py-2 text-muted-foreground">
											{formatCurrency(p.averageValue)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</ChartCard>
			)}
		</div>
	);
}

function RevenueTooltip({ active, payload, label }: ChartTooltipProps) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
			<p className="mb-1 font-medium text-foreground text-xs">{label}</p>
			{payload.map((entry) => (
				<div key={entry.dataKey} className="flex items-center gap-2 text-xs">
					<span
						className="inline-block h-2 w-2 rounded-full"
						style={{ backgroundColor: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-medium text-foreground">
						{entry.dataKey === "revenue"
							? formatCurrency(
									typeof entry.value === "number" ? entry.value : 0,
								)
							: entry.value}
					</span>
				</div>
			))}
		</div>
	);
}

// ── Funnel Tab ───────────────────────────────────────────────────────────────

function FunnelTab({ since }: { since: string | undefined }) {
	const api = useAnalyticsAdminApi();
	const funnelInput: Record<string, string> = {};
	if (since) funnelInput.since = since;

	const { data: funnelData, isLoading } = api.getFunnel.useQuery(
		funnelInput,
	) as {
		data: { funnel?: FunnelStep[] } | undefined;
		isLoading: boolean;
	};

	if (isLoading) return <LoadingState />;

	const funnel = funnelData?.funnel ?? [];
	const firstCount = funnel[0]?.count ?? 0;

	if (firstCount === 0)
		return (
			<EmptyState message="No funnel data yet. Events will appear once visitors interact with your store." />
		);

	const chartData = funnel.map((step, i) => ({
		name: FUNNEL_LABELS[step.step] ?? step.step,
		count: step.count,
		fill: getEventColor(step.step, i),
		dropOff: i > 0 ? funnel[i - 1].count - step.count : 0,
	}));

	return (
		<div className="space-y-6">
			{/* Funnel bar chart */}
			<ChartCard title="Conversion Funnel">
				<div style={{ width: "100%", height: 300 }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={chartData}
							margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
						>
							<CartesianGrid strokeDasharray="3 3" opacity={0.15} />
							<XAxis dataKey="name" tick={{ fontSize: 11 }} />
							<YAxis
								tick={{ fontSize: 11 }}
								tickFormatter={(v: number) => v.toLocaleString()}
							/>
							<Tooltip content={<FunnelTooltip funnel={funnel} />} />
							<Bar dataKey="count" name="Sessions" radius={[4, 4, 0, 0]}>
								{chartData.map((entry) => (
									<Cell key={entry.name} fill={entry.fill} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</ChartCard>

			{/* Funnel metrics cards */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{funnel.length >= 2 && (
					<StatCard
						label="Browse Rate"
						value={`${funnel[1].rate}%`}
						sub="page view → product view"
					/>
				)}
				{funnel.length >= 3 && (
					<StatCard
						label="Cart Rate"
						value={`${funnel[2].rate}%`}
						sub="page view → add to cart"
					/>
				)}
				{funnel.length >= 5 && (
					<StatCard
						label="Purchase Rate"
						value={`${funnel[4].rate}%`}
						sub="page view → purchase"
					/>
				)}
			</div>

			{/* Step-by-step drop-off table */}
			<ChartCard title="Step-by-Step Drop-off">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="border-border border-b bg-muted/30 text-left">
							<tr>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground"
								>
									Step
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground"
								>
									Sessions
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground"
								>
									From Top
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground"
								>
									Drop-off
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{funnel.map((step, i) => {
								const prev = i > 0 ? funnel[i - 1].count : step.count;
								const dropped = prev - step.count;
								const dropPct =
									prev > 0 && i > 0 ? ((dropped / prev) * 100).toFixed(1) : "—";
								return (
									<tr key={step.step} className="hover:bg-muted/30">
										<td className="px-4 py-3 font-medium text-foreground">
											{FUNNEL_LABELS[step.step] ?? step.step}
										</td>
										<td className="px-4 py-3 text-foreground/70">
											{step.count.toLocaleString()}
										</td>
										<td className="px-4 py-3 text-muted-foreground">
											{step.rate}%
										</td>
										<td className="px-4 py-3">
											{i > 0 && dropped > 0 ? (
												<span className="text-red-500 dark:text-red-400">
													-{dropped.toLocaleString()} ({dropPct}%)
												</span>
											) : (
												<span className="text-muted-foreground">{"—"}</span>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</ChartCard>
		</div>
	);
}

function FunnelTooltip({
	active,
	payload,
	label,
	funnel,
}: {
	active?: boolean;
	payload?: Array<{ value: number }>;
	label?: string;
	funnel: FunnelStep[];
}) {
	if (!active || !payload?.length) return null;
	const step = funnel.find(
		(s: FunnelStep) => (FUNNEL_LABELS[s.step] ?? s.step) === label,
	);
	return (
		<div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
			<p className="mb-1 font-medium text-foreground text-xs">{label}</p>
			<p className="text-muted-foreground text-xs">
				{payload[0].value.toLocaleString()} sessions
			</p>
			{step && (
				<p className="text-muted-foreground text-xs">
					{step.rate}% from top of funnel
				</p>
			)}
		</div>
	);
}

// ── Events Tab ───────────────────────────────────────────────────────────────

function EventsTab({ since }: { since: string | undefined }) {
	const api = useAnalyticsAdminApi();
	const [typeFilter, setTypeFilter] = useState("");
	const [page, setPage] = useState(1);

	const eventsInput: Record<string, string> = {
		page: String(page),
		limit: "50",
	};
	if (typeFilter) eventsInput.type = typeFilter;
	if (since) eventsInput.since = since;

	const { data: eventsData, isLoading } = api.getEvents.useQuery(
		eventsInput,
	) as {
		data: { events?: AnalyticsEvent[] } | undefined;
		isLoading: boolean;
	};

	const events = eventsData?.events ?? [];

	return (
		<div className="space-y-4">
			<div className="flex gap-3">
				<input
					type="text"
					placeholder="Filter by event type…"
					value={typeFilter}
					onChange={(e) => {
						setTypeFilter(e.target.value);
						setPage(1);
					}}
					className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
				/>
			</div>

			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead className="border-border border-b bg-muted/30 text-left">
						<tr>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								Type
							</th>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								Product
							</th>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								Session
							</th>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								Value
							</th>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								Time
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border bg-card">
						{isLoading ? (
							<tr>
								<td
									colSpan={5}
									className="py-12 text-center text-muted-foreground"
								>
									Loading&hellip;
								</td>
							</tr>
						) : events.length === 0 ? (
							<tr>
								<td
									colSpan={5}
									className="py-12 text-center text-muted-foreground"
								>
									No events found.
								</td>
							</tr>
						) : (
							events.map((ev) => (
								<tr key={ev.id} className="hover:bg-muted/30">
									<td className="px-4 py-3">
										<EventTypeBadge type={ev.type} />
									</td>
									<td className="px-4 py-3 font-mono text-muted-foreground text-xs">
										{ev.productId ? `${ev.productId.slice(0, 12)}…` : "—"}
									</td>
									<td className="px-4 py-3 font-mono text-muted-foreground text-xs">
										{ev.sessionId ? `${ev.sessionId.slice(0, 10)}…` : "—"}
									</td>
									<td className="px-4 py-3 text-foreground/70">
										{ev.value != null ? formatCurrency(ev.value) : "—"}
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{timeAgo(ev.createdAt)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{events.length > 0 && (
				<div className="flex items-center justify-between text-muted-foreground text-sm">
					<span>
						Page {page} &middot; {events.length} events
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1}
							className="rounded border px-3 py-1 hover:bg-muted/30 disabled:opacity-40"
						>
							&larr; Prev
						</button>
						<button
							type="button"
							onClick={() => setPage((p) => p + 1)}
							disabled={events.length < 50}
							className="rounded border px-3 py-1 hover:bg-muted/30 disabled:opacity-40"
						>
							Next &rarr;
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

// ── Top Products Tab ─────────────────────────────────────────────────────────

function TopProductsTab({
	topProducts,
	loading,
}: {
	topProducts: ProductStats[];
	loading: boolean;
}) {
	if (loading) return <LoadingState />;
	if (topProducts.length === 0)
		return <EmptyState message="No product events recorded yet." />;

	const chartData = topProducts.map((p) => ({
		name: p.productId.slice(0, 8),
		fullId: p.productId,
		views: p.views,
		purchases: p.purchases,
	}));

	return (
		<div className="space-y-6">
			{/* Views vs Purchases bar chart */}
			<ChartCard title="Product Views vs. Purchases">
				<div style={{ width: "100%", height: 280 }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={chartData}
							margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
						>
							<CartesianGrid strokeDasharray="3 3" opacity={0.15} />
							<XAxis dataKey="name" tick={{ fontSize: 10 }} />
							<YAxis tick={{ fontSize: 11 }} />
							<Tooltip content={<TopProductsTooltip />} />
							<Legend
								formatter={(value: string) => (
									<span className="text-muted-foreground text-xs">{value}</span>
								)}
							/>
							<Bar
								dataKey="views"
								name="Views"
								fill="#3b82f6"
								radius={[4, 4, 0, 0]}
							/>
							<Bar
								dataKey="purchases"
								name="Purchases"
								fill="#22c55e"
								radius={[4, 4, 0, 0]}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</ChartCard>

			{/* Detailed table */}
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead className="border-border border-b bg-muted/30 text-left">
						<tr>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								#
							</th>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								Product ID
							</th>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								Views
							</th>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								Purchases
							</th>
							<th
								scope="col"
								className="px-4 py-3 font-medium text-muted-foreground"
							>
								Conversion
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border bg-card">
						{topProducts.map((p, i) => {
							const conv =
								p.views > 0
									? `${((p.purchases / p.views) * 100).toFixed(1)}%`
									: "—";
							return (
								<tr key={p.productId} className="hover:bg-muted/30">
									<td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
									<td className="px-4 py-3 font-mono text-foreground/70 text-xs">
										{p.productId}
									</td>
									<td className="px-4 py-3 font-medium text-foreground">
										{p.views.toLocaleString()}
									</td>
									<td className="px-4 py-3 font-medium text-green-600 dark:text-green-400">
										{p.purchases.toLocaleString()}
									</td>
									<td className="px-4 py-3 text-muted-foreground">{conv}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function TopProductsTooltip({ active, payload, label }: ChartTooltipProps) {
	if (!active || !payload?.length) return null;
	const item = payload[0]?.payload;
	return (
		<div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
			<p className="mb-1 font-medium font-mono text-foreground text-xs">
				{(item?.fullId as string | undefined) ?? label}
			</p>
			{payload.map((entry) => (
				<div key={entry.dataKey} className="flex items-center gap-2 text-xs">
					<span
						className="inline-block h-2 w-2 rounded-full"
						style={{ backgroundColor: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-medium text-foreground">
						{typeof entry.value === "number"
							? entry.value.toLocaleString()
							: (entry.value ?? "")}
					</span>
				</div>
			))}
			{item && typeof item.views === "number" && item.views > 0 && (
				<p className="mt-1 text-muted-foreground text-xs">
					Conversion: {((Number(item.purchases) / item.views) * 100).toFixed(1)}
					%
				</p>
			)}
		</div>
	);
}

// ── Search Tab ──────────────────────────────────────────────────────────────

interface SearchQueryStatsUI {
	query: string;
	count: number;
	avgResultCount: number;
	lastSearchedAt: string;
}

interface SearchAnalyticsUI {
	totalSearches: number;
	uniqueQueries: number;
	zeroResultCount: number;
	topQueries: SearchQueryStatsUI[];
	zeroResultQueries: SearchQueryStatsUI[];
}

function SearchTab({
	since,
	range,
}: {
	since: string | undefined;
	range: DateRange;
}) {
	const api = useAnalyticsAdminApi();
	const searchInput: Record<string, string> = { limit: "20" };
	if (since) searchInput.since = since;

	const { data: searchData, isLoading } = api.getSearchAnalytics.useQuery(
		searchInput,
	) as {
		data: { analytics?: SearchAnalyticsUI } | undefined;
		isLoading: boolean;
	};

	if (isLoading) return <LoadingState />;

	const analytics = searchData?.analytics;
	if (!analytics || analytics.totalSearches === 0) {
		return (
			<EmptyState message="No search data yet. Search events will appear once customers use your store's search." />
		);
	}

	const zeroResultRate =
		analytics.totalSearches > 0
			? ((analytics.zeroResultCount / analytics.totalSearches) * 100).toFixed(1)
			: "0";

	return (
		<div className="space-y-6">
			{/* Summary cards */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatCard
					label="Total Searches"
					value={analytics.totalSearches}
					sub={range === "all" ? "all time" : `last ${range}`}
				/>
				<StatCard label="Unique Queries" value={analytics.uniqueQueries} />
				<StatCard
					label="Zero-Result Searches"
					value={analytics.zeroResultCount}
					sub={`${zeroResultRate}% of all searches`}
				/>
				<StatCard
					label="Avg. Results"
					value={
						analytics.topQueries.length > 0
							? Math.round(
									analytics.topQueries.reduce(
										(sum, q) => sum + q.avgResultCount,
										0,
									) / analytics.topQueries.length,
								)
							: 0
					}
					sub="per query"
				/>
			</div>

			{/* Top queries table */}
			{analytics.topQueries.length > 0 && (
				<ChartCard title="Top Search Queries">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="border-border border-b bg-muted/30 text-left">
								<tr>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										#
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Query
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Searches
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Avg. Results
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Last Searched
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{analytics.topQueries.map((q, i) => (
									<tr key={q.query} className="hover:bg-muted/30">
										<td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
										<td className="px-4 py-2 font-medium text-foreground">
											{q.query}
										</td>
										<td className="px-4 py-2 text-foreground/70">
											{q.count.toLocaleString()}
										</td>
										<td className="px-4 py-2">
											{q.avgResultCount === 0 ? (
												<span className="inline-block rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800 text-xs dark:bg-red-900/30 dark:text-red-400">
													0
												</span>
											) : (
												<span className="text-foreground/70">
													{q.avgResultCount.toLocaleString()}
												</span>
											)}
										</td>
										<td className="px-4 py-2 text-muted-foreground">
											{timeAgo(q.lastSearchedAt)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</ChartCard>
			)}

			{/* Zero-result queries */}
			{analytics.zeroResultQueries.length > 0 && (
				<ChartCard title="Zero-Result Queries">
					<p className="mb-3 text-muted-foreground text-xs">
						Customers searched for these terms but found nothing. Consider
						adding products or adjusting tags to match these queries.
					</p>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="border-border border-b bg-muted/30 text-left">
								<tr>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Query
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Searches
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Last Searched
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{analytics.zeroResultQueries.map((q) => (
									<tr key={q.query} className="hover:bg-muted/30">
										<td className="px-4 py-2 font-medium text-foreground">
											{q.query}
										</td>
										<td className="px-4 py-2 text-foreground/70">
											{q.count.toLocaleString()}
										</td>
										<td className="px-4 py-2 text-muted-foreground">
											{timeAgo(q.lastSearchedAt)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</ChartCard>
			)}
		</div>
	);
}

// ── Main Component ───────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
	{ key: "overview", label: "Overview" },
	{ key: "revenue", label: "Revenue" },
	{ key: "funnel", label: "Funnel" },
	{ key: "search", label: "Search" },
	{ key: "events", label: "Events" },
	{ key: "products", label: "Top Products" },
];

const RANGE_OPTIONS: { key: DateRange; label: string }[] = [
	{ key: "7d", label: "7d" },
	{ key: "30d", label: "30d" },
	{ key: "90d", label: "90d" },
	{ key: "all", label: "All time" },
];

export function AnalyticsAdmin() {
	const api = useAnalyticsAdminApi();
	const [tab, setTab] = useState<Tab>("overview");
	const [range, setRange] = useState<DateRange>("30d");

	const since = useMemo(() => sinceDate(range), [range]);

	const statsInput: Record<string, string> = {};
	if (since) statsInput.since = since;

	const topProductsInput: Record<string, string> = { limit: "10" };
	if (since) topProductsInput.since = since;

	const {
		data: statsData,
		isLoading: loadingStats,
		isError: statsError,
		refetch: refetchStats,
	} = api.getStats.useQuery(statsInput) as {
		data: { stats?: EventStats[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: topProductsData, isLoading: loadingTopProducts } =
		api.getTopProducts.useQuery(topProductsInput) as {
			data: { products?: ProductStats[] } | undefined;
			isLoading: boolean;
		};

	if (statsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load analytics data
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchStats()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const stats = statsData?.stats ?? [];
	const topProducts = topProductsData?.products ?? [];
	const loadingOverview = loadingStats || loadingTopProducts;

	const totalEvents = stats.reduce((sum, s) => sum + s.count, 0);
	const pageViews = stats.find((s) => s.type === "pageView")?.count ?? 0;
	const purchases = stats.find((s) => s.type === "purchase")?.count ?? 0;
	const addToCarts = stats.find((s) => s.type === "addToCart")?.count ?? 0;

	const tabContent =
		tab === "overview" ? (
			<OverviewTab
				stats={stats}
				loading={loadingOverview}
				range={range}
				pageViews={pageViews}
				purchases={purchases}
				addToCarts={addToCarts}
				totalEvents={totalEvents}
			/>
		) : tab === "revenue" ? (
			<RevenueTab since={since} range={range} />
		) : tab === "funnel" ? (
			<FunnelTab since={since} />
		) : tab === "search" ? (
			<SearchTab since={since} range={range} />
		) : tab === "events" ? (
			<EventsTab since={since} />
		) : (
			<TopProductsTab topProducts={topProducts} loading={loadingTopProducts} />
		);

	return (
		<AnalyticsAdminTemplate
			rangeOptions={RANGE_OPTIONS}
			range={range}
			onRangeChange={setRange}
			tabs={TABS}
			tab={tab}
			onTabChange={setTab}
			tabContent={tabContent}
		/>
	);
}
