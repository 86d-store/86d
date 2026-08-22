"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { StatusBadge } from "~/components/status-badge";
import { Skeleton } from "~/components/ui/skeleton";

/* ── helpers ───────────────────────────────────────────────── */

function formatCurrency(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function timeAgo(dateStr: string | Date): string {
	const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
	const now = Date.now();
	const diff = now - date.getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return date.toLocaleDateString();
}

/* ── API hook ──────────────────────────────────────────────── */

function useDashboardApi() {
	const client = useModuleClient();
	return {
		/* products */
		listProducts: client.module("products").admin["/admin/products/list"],
		listCategories: client.module("products").admin["/admin/categories/list"],
		/* orders */
		listOrders: client.module("orders").admin["/admin/orders"],
		/* customers */
		listCustomers: client.module("customers").admin["/admin/customers"],
		/* analytics */
		revenue: client.module("analytics").admin["/admin/analytics/revenue"],
		/* inventory */
		lowStock: client.module("inventory").admin["/admin/inventory/low-stock"],
		/* reviews */
		listReviews: client.module("reviews").admin["/admin/reviews"],
	};
}

/* ── types ─────────────────────────────────────────────────── */

interface RevenueSummary {
	totalRevenue: number;
	orderCount: number;
	averageOrderValue: number;
	previousRevenue: number;
	previousOrders: number;
}

interface OrderRow {
	id: string;
	orderNumber: string;
	customerId?: string;
	guestEmail?: string;
	status: string;
	paymentStatus: string;
	total: number;
	currency: string;
	createdAt: string;
}

interface InventoryItem {
	id: string;
	productId: string;
	variantId?: string;
	productName?: string;
	variantName?: string;
	quantity: number;
	reserved: number;
	available: number;
	lowStockThreshold?: number;
}

/* ── small components ──────────────────────────────────────── */

function StatCard({
	label,
	value,
	subtext,
	loading,
	trend,
}: {
	label: string;
	value: string | number;
	subtext?: string | undefined;
	loading?: boolean | undefined;
	trend?: { value: number; label: string } | undefined;
}) {
	return (
		<div
			className="rounded-lg border border-border bg-card p-5"
			data-testid="stat-card"
		>
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</p>
			{loading ? (
				<Skeleton className="mt-2 h-8 w-24" />
			) : (
				<>
					<p
						className="mt-2 font-bold text-3xl text-foreground"
						data-testid="stat-value"
					>
						{value}
					</p>
					{trend && trend.value !== 0 && (
						<p
							className={`mt-1 text-xs ${trend.value > 0 ? "text-status-success" : "text-status-danger"}`}
						>
							{trend.value > 0 ? "+" : ""}
							{trend.value.toFixed(0)}% {trend.label}
						</p>
					)}
					{subtext && (
						<p className="mt-1 text-muted-foreground text-xs">{subtext}</p>
					)}
				</>
			)}
		</div>
	);
}

/* ── icon components (inline SVG) ──────────────────────────── */

function IconPlus() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M5 12h14" />
			<path d="M12 5v14" />
		</svg>
	);
}

function IconExternal() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
			<polyline points="15 3 21 3 21 9" />
			<line x1="10" x2="21" y1="14" y2="3" />
		</svg>
	);
}

function IconPackage() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M16.5 9.4 7.55 4.24" />
			<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
			<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
			<line x1="12" x2="12" y1="22.08" y2="12" />
		</svg>
	);
}

function IconShoppingBag() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
			<path d="M3 6h18" />
			<path d="M16 10a4 4 0 0 1-8 0" />
		</svg>
	);
}

function IconBarChart() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<line x1="12" x2="12" y1="20" y2="10" />
			<line x1="18" x2="18" y1="20" y2="4" />
			<line x1="6" x2="6" y1="20" y2="16" />
		</svg>
	);
}

function IconAlertTriangle() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
			<path d="M12 9v4" />
			<path d="M12 17h.01" />
		</svg>
	);
}

/* ── main component ────────────────────────────────────────── */

export default function AdminDashboard() {
	const api = useDashboardApi();

	/* Revenue summary from analytics */
	const { data: revenueData, isLoading: loadingRevenue } = api.revenue.useQuery(
		{},
	) as {
		data: { summary?: RevenueSummary } | undefined;
		isLoading: boolean;
	};
	const rev = revenueData?.summary;

	/* Total orders */
	const { data: allOrders, isLoading: loadingOrders } = api.listOrders.useQuery(
		{ limit: "1" },
	) as {
		data: { total?: number } | undefined;
		isLoading: boolean;
	};

	/* Pending orders */
	const { data: pendingOrders } = api.listOrders.useQuery({
		limit: "1",
		status: "pending",
	}) as {
		data: { total?: number } | undefined;
	};

	/* Processing orders */
	const { data: processingOrders } = api.listOrders.useQuery({
		limit: "1",
		status: "processing",
	}) as {
		data: { total?: number } | undefined;
	};

	/* Recent orders (latest 5) */
	const { data: recentOrdersData, isLoading: loadingRecent } =
		api.listOrders.useQuery({ limit: "5" }) as {
			data: { orders?: OrderRow[] } | undefined;
			isLoading: boolean;
		};

	/* Total customers */
	const { data: customersData, isLoading: loadingCustomers } =
		api.listCustomers.useQuery({ limit: "1" }) as {
			data: { total?: number } | undefined;
			isLoading: boolean;
		};

	/* Total products */
	const { data: productsData, isLoading: loadingProducts } =
		api.listProducts.useQuery({ limit: "1" }) as {
			data: { total?: number } | undefined;
			isLoading: boolean;
		};

	/* Active products */
	const { data: activeProducts } = api.listProducts.useQuery({
		limit: "1",
		status: "active",
	}) as {
		data: { total?: number } | undefined;
	};

	/* Low stock items */
	const { data: lowStockData, isLoading: loadingLowStock } =
		api.lowStock.useQuery({}) as {
			data: { items?: InventoryItem[] } | undefined;
			isLoading: boolean;
		};

	/* Pending reviews */
	const { data: pendingReviewsData } = api.listReviews.useQuery({
		status: "pending",
		take: "1",
	}) as {
		data: { total?: number } | undefined;
	};

	const statsLoading =
		loadingRevenue || loadingOrders || loadingCustomers || loadingProducts;

	/* Compute trends */
	const revenueTrend =
		rev && rev.previousRevenue > 0
			? ((rev.totalRevenue - rev.previousRevenue) / rev.previousRevenue) * 100
			: undefined;

	const orderTrend =
		rev && rev.previousOrders > 0
			? ((rev.orderCount - rev.previousOrders) / rev.previousOrders) * 100
			: undefined;

	const lowStockCount = lowStockData?.items?.length ?? 0;
	const pendingReviewCount = pendingReviewsData?.total ?? 0;

	return (
		<div>
			{/* Header */}
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Dashboard</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Overview of your store
				</p>
			</div>

			{/* Primary metrics */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label="Total Revenue"
					value={rev ? formatCurrency(rev.totalRevenue) : "$0.00"}
					loading={statsLoading}
					trend={
						revenueTrend !== undefined
							? { value: revenueTrend, label: "vs prev period" }
							: undefined
					}
				/>
				<StatCard
					label="Orders"
					value={allOrders?.total ?? 0}
					loading={statsLoading}
					trend={
						orderTrend !== undefined
							? { value: orderTrend, label: "vs prev period" }
							: undefined
					}
				/>
				<StatCard
					label="Avg Order Value"
					value={rev ? formatCurrency(rev.averageOrderValue) : "$0.00"}
					loading={statsLoading}
				/>
				<StatCard
					label="Customers"
					value={customersData?.total ?? 0}
					loading={statsLoading}
				/>
			</div>

			{/* Secondary metrics */}
			<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label="Pending Orders"
					value={pendingOrders?.total ?? 0}
					loading={statsLoading}
					subtext="awaiting fulfillment"
				/>
				<StatCard
					label="Processing"
					value={processingOrders?.total ?? 0}
					loading={statsLoading}
					subtext="currently in progress"
				/>
				<StatCard
					label="Products"
					value={`${activeProducts?.total ?? 0} / ${productsData?.total ?? 0}`}
					loading={statsLoading}
					subtext="active / total"
				/>
				<StatCard
					label="Needs Attention"
					value={lowStockCount + pendingReviewCount}
					loading={statsLoading}
					subtext={`${lowStockCount} low stock · ${pendingReviewCount} pending reviews`}
				/>
			</div>

			{/* Content sections */}
			<div className="mt-8 grid gap-6 lg:grid-cols-3">
				{/* Recent orders */}
				<div className="rounded-lg border border-border bg-card lg:col-span-2">
					<div className="flex items-center justify-between border-border border-b px-5 py-4">
						<h2 className="font-semibold text-foreground text-sm">
							Recent Orders
						</h2>
						<a
							href="/admin/orders"
							className="text-muted-foreground text-xs hover:text-foreground"
						>
							View all
						</a>
					</div>
					{loadingRecent ? (
						<div className="flex flex-col gap-3 p-5">
							{(["k0", "k1", "k2"] as const).map((key) => (
								<Skeleton key={key} className="h-10 rounded" />
							))}
						</div>
					) : recentOrdersData?.orders?.length ? (
						<div className="divide-y divide-border">
							{recentOrdersData.orders.map((order) => (
								<a
									key={order.id}
									href={`/admin/orders/${order.id}`}
									className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/50"
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="font-medium text-foreground text-sm">
												#{order.orderNumber}
											</span>
											<StatusBadge status={order.status} />
										</div>
										<p className="mt-0.5 truncate text-muted-foreground text-xs">
											{order.guestEmail ?? order.customerId ?? "Guest"}
										</p>
									</div>
									<div className="text-right">
										<p className="font-medium text-foreground text-sm">
											{formatCurrency(order.total)}
										</p>
										<p className="text-muted-foreground text-xs">
											{timeAgo(order.createdAt)}
										</p>
									</div>
								</a>
							))}
						</div>
					) : (
						<div className="p-8 text-center text-muted-foreground text-sm">
							No orders yet. Share your store to start selling.
						</div>
					)}
				</div>

				{/* Right column */}
				<div className="flex flex-col gap-6">
					{/* Low stock alerts */}
					<div className="rounded-lg border border-border bg-card">
						<div className="flex items-center justify-between border-border border-b px-5 py-4">
							<h2 className="flex items-center gap-2 font-semibold text-foreground text-sm">
								<IconAlertTriangle />
								Low Stock
							</h2>
							<a
								href="/admin/inventory"
								className="text-muted-foreground text-xs hover:text-foreground"
							>
								Manage
							</a>
						</div>
						{loadingLowStock ? (
							<div className="flex flex-col gap-2 p-5">
								{(["k0", "k1"] as const).map((key) => (
									<Skeleton key={key} className="h-8 rounded" />
								))}
							</div>
						) : lowStockCount > 0 ? (
							<div className="divide-y divide-border">
								{lowStockData?.items?.slice(0, 5).map((item) => (
									<div
										key={item.id}
										className="flex items-center justify-between px-5 py-3"
									>
										<p className="truncate text-foreground text-sm">
											{item.productName ?? item.productId.slice(0, 8)}
											{item.variantName
												? ` · ${item.variantName}`
												: item.variantId
													? ` / ${item.variantId.slice(0, 8)}`
													: ""}
										</p>
										<span
											className={`font-medium text-sm ${item.available <= 0 ? "text-status-danger" : "text-status-warning"}`}
										>
											{item.available} left
										</span>
									</div>
								))}
								{lowStockCount > 5 && (
									<div className="px-5 py-2 text-muted-foreground text-xs">
										+{lowStockCount - 5} more items
									</div>
								)}
							</div>
						) : (
							<div className="p-5 text-center text-muted-foreground text-sm">
								All stock levels healthy
							</div>
						)}
					</div>

					{/* Quick actions */}
					<div className="rounded-lg border border-border bg-card p-5">
						<h2 className="mb-3 font-semibold text-foreground text-sm">
							Quick Actions
						</h2>
						<div className="flex flex-col gap-2">
							<QuickAction
								href="/admin/products/new"
								icon={<IconPlus />}
								label="Add new product"
							/>
							<QuickAction
								href="/admin/orders"
								icon={<IconShoppingBag />}
								label="View orders"
							/>
							<QuickAction
								href="/admin/analytics"
								icon={<IconBarChart />}
								label="Analytics"
							/>
							<QuickAction
								href="/admin/inventory"
								icon={<IconPackage />}
								label="Manage inventory"
							/>
							<QuickAction
								href="/products"
								icon={<IconExternal />}
								label="View storefront"
								external
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function QuickAction({
	href,
	icon,
	label,
	external,
}: {
	href: string;
	icon: React.ReactNode;
	label: string;
	external?: boolean | undefined;
}) {
	return (
		<a
			href={href}
			className="flex items-center gap-3 rounded-md border border-border px-4 py-2.5 font-medium text-foreground text-sm transition-colors hover:bg-muted"
			{...(external ? { target: "_blank", rel: "noreferrer" } : {})}
		>
			{icon}
			{label}
		</a>
	);
}
