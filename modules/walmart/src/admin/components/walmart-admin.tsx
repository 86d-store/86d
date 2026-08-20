"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsData {
	status: "connected" | "not_configured" | "error";
	error?: string;
	mode: "sandbox" | "live";
	configured: boolean;
	channelType: string | null;
	clientId: string | null;
}

interface ChannelStats {
	totalItems: number;
	publishedItems: number;
	totalOrders: number;
	totalRevenue: number;
	pendingFeeds: number;
	errorItems: number;
}

interface Item {
	id: string;
	localProductId: string;
	walmartItemId?: string;
	sku: string;
	title: string;
	status: string;
	fulfillmentType: string;
	price: number;
	quantity: number;
	lastSyncedAt?: string;
	error?: string;
	createdAt: string;
}

interface WalmartOrder {
	id: string;
	purchaseOrderId: string;
	status: string;
	orderTotal: number;
	shippingTotal: number;
	tax: number;
	customerName?: string;
	createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount / 100);
}

function formatDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

const ITEM_STATUS_STYLES: Record<string, string> = {
	published:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	unpublished: "bg-muted text-muted-foreground",
	retired:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	"system-error":
		"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
	created:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	acknowledged:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	shipped:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	delivered:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	refunded:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

// ── API hook ─────────────────────────────────────────────────────────────────

function useWalmartApi() {
	const client = useModuleClient();
	const mod = client.module("walmart");
	return {
		settings: mod.admin["/admin/walmart/settings"],
		stats: mod.admin["/admin/walmart/stats"],
		items: mod.admin["/admin/walmart/items"],
		orders: mod.admin["/admin/walmart/orders"],
		syncOrders: mod.admin["/admin/walmart/sync-orders"],
	};
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function StatCard({
	label,
	value,
	detail,
}: {
	label: string;
	value: string;
	detail?: string;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="font-semibold text-2xl text-foreground tabular-nums">
				{value}
			</span>
			{detail && (
				<span className="text-muted-foreground text-xs">{detail}</span>
			)}
		</div>
	);
}

function ConnectionStatus({ settings }: { settings: SettingsData }) {
	if (settings.status === "connected") {
		return (
			<div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="size-2.5 rounded-full bg-green-500" />
						<span className="font-medium text-foreground text-sm">
							Connected
						</span>
					</div>
					<span className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
						{settings.mode === "sandbox" ? "Sandbox" : "Live"}
					</span>
				</div>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">Client ID</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.clientId}
						</span>
					</div>
					{settings.channelType && (
						<div className="flex flex-col gap-0.5">
							<span className="text-muted-foreground text-xs">
								Channel Type
							</span>
							<span className="font-medium text-foreground text-sm">
								{settings.channelType}
							</span>
						</div>
					)}
				</div>
			</div>
		);
	}

	if (settings.status === "error") {
		return (
			<div className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="size-2.5 rounded-full bg-red-500" />
						<span className="font-medium text-foreground text-sm">
							Connection Error
						</span>
					</div>
					<span className="rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-800 text-xs dark:bg-red-900/30 dark:text-red-400">
						{settings.mode === "sandbox" ? "Sandbox" : "Live"}
					</span>
				</div>
				<p className="break-words text-muted-foreground text-sm">
					{settings.error ??
						"Walmart rejected the supplied credentials. Verify the client ID and secret are for the correct environment."}
				</p>
				<p className="text-muted-foreground text-xs">
					Rotate the client secret from the Walmart Seller Center if it has been
					compromised or revoked.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-5">
			<div className="flex items-center gap-2">
				<div className="size-2.5 rounded-full bg-amber-500" />
				<span className="font-medium text-foreground text-sm">
					Not Configured
				</span>
			</div>
			<p className="text-muted-foreground text-sm">
				Set the{" "}
				<code className="rounded bg-muted px-1 text-xs">WALMART_CLIENT_ID</code>{" "}
				and{" "}
				<code className="rounded bg-muted px-1 text-xs">
					WALMART_CLIENT_SECRET
				</code>{" "}
				environment variables to connect your Walmart Marketplace account.
			</p>
		</div>
	);
}

// ── Main component ───────────────────────────────────────────────────────────

export function WalmartAdmin() {
	const api = useWalmartApi();
	const [itemPage, setItemPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const [fulfillmentFilter, setFulfillmentFilter] = useState("");
	const [orderPage, setOrderPage] = useState(1);
	const [orderStatusFilter, setOrderStatusFilter] = useState("");
	const [activeTab, setActiveTab] = useState<"items" | "orders">("items");

	const { data: settingsData, isLoading: settingsLoading } =
		api.settings.useQuery({}) as {
			data: SettingsData | undefined;
			isLoading: boolean;
		};

	const { data: statsData, isLoading: statsLoading } = api.stats.useQuery(
		{},
	) as {
		data: { stats: ChannelStats } | undefined;
		isLoading: boolean;
	};

	const { data: itemsData, isLoading: itemsLoading } = api.items.useQuery({
		page: String(itemPage),
		limit: String(PAGE_SIZE),
		...(statusFilter ? { status: statusFilter } : {}),
		...(fulfillmentFilter ? { fulfillmentType: fulfillmentFilter } : {}),
	}) as {
		data: { items: Item[]; total: number } | undefined;
		isLoading: boolean;
	};

	const {
		data: ordersData,
		isLoading: ordersLoading,
		refetch: refetchOrders,
	} = api.orders.useQuery({
		page: String(orderPage),
		limit: String(PAGE_SIZE),
		...(orderStatusFilter ? { status: orderStatusFilter } : {}),
	}) as {
		data: { orders: WalmartOrder[]; total: number } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const syncOrdersMutation = api.syncOrders.useMutation() as {
		mutate: (params: Record<string, never>) => void;
		isPending: boolean;
	};

	const handleSyncOrders = () => {
		syncOrdersMutation.mutate({});
		setTimeout(() => {
			refetchOrders();
		}, 2000);
	};

	const stats = statsData?.stats;
	const items = itemsData?.items ?? [];
	const itemsTotal = itemsData?.total ?? 0;
	const orders = ordersData?.orders ?? [];
	const ordersTotal = ordersData?.total ?? 0;

	// ── Loading state ────────────────────────────────────────────────────────

	if (settingsLoading) {
		return (
			<div className="space-y-6 p-1">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-28 w-full rounded-lg" />
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => (
						<Skeleton key={i} className="h-24 rounded-lg" />
					))}
				</div>
				<Skeleton className="h-64 w-full rounded-lg" />
			</div>
		);
	}

	// ── Main render ──────────────────────────────────────────────────────────

	return (
		<div className="space-y-8 p-1">
			{/* Header */}
			<div>
				<h2 className="font-semibold text-foreground text-lg">
					Walmart Marketplace
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your Walmart items, sync orders, and monitor channel
					performance.
				</p>
			</div>

			{/* Connection status */}
			{settingsData && <ConnectionStatus settings={settingsData} />}

			{/* Stats */}
			{statsLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => (
						<Skeleton key={i} className="h-24 rounded-lg" />
					))}
				</div>
			) : stats ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard
						label="Total Items"
						value={String(stats.totalItems)}
						detail={`${stats.publishedItems} published`}
					/>
					<StatCard
						label="Issues"
						value={String(stats.errorItems)}
						detail={`${stats.pendingFeeds} pending feeds`}
					/>
					<StatCard
						label="Revenue"
						value={formatCurrency(stats.totalRevenue)}
						detail={`${stats.totalOrders} orders`}
					/>
					<StatCard label="Orders" value={String(stats.totalOrders)} />
				</div>
			) : null}

			{/* Tab bar */}
			<div className="flex gap-1 border-border border-b">
				<button
					type="button"
					onClick={() => setActiveTab("items")}
					className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
						activeTab === "items"
							? "border-foreground text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					Items
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("orders")}
					className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
						activeTab === "orders"
							? "border-foreground text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					Orders
				</button>
			</div>

			{/* Items tab */}
			{activeTab === "items" && (
				<div className="space-y-4">
					{/* Filters */}
					<div className="flex flex-wrap items-center gap-2">
						<select
							value={statusFilter}
							onChange={(e) => {
								setStatusFilter(e.target.value);
								setItemPage(1);
							}}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">All Statuses</option>
							<option value="published">Published</option>
							<option value="unpublished">Unpublished</option>
							<option value="retired">Retired</option>
							<option value="system-error">System Error</option>
						</select>
						<select
							value={fulfillmentFilter}
							onChange={(e) => {
								setFulfillmentFilter(e.target.value);
								setItemPage(1);
							}}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">All Fulfillment</option>
							<option value="seller">Seller</option>
							<option value="wfs">WFS</option>
						</select>
					</div>

					{/* Items table */}
					{itemsLoading ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<tbody className="divide-y divide-border">
										{Array.from({ length: 5 }, (_, i) => (
											<tr key={`item-skeleton-${i}`}>
												{Array.from({ length: 5 }, (_, j) => (
													<td
														key={`item-skeleton-cell-${j}`}
														className="px-5 py-3"
													>
														<Skeleton className="h-4 rounded" />
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className="space-y-3 p-4 md:hidden">
								{Array.from({ length: 3 }, (_, i) => (
									<Skeleton
										key={`item-mobile-skeleton-${i}`}
										className="h-16 rounded-lg"
									/>
								))}
							</div>
						</div>
					) : items.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">No items</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{statusFilter || fulfillmentFilter
									? "No items match the selected filters."
									: "Items will appear here once created or synced from Walmart."}
							</p>
						</div>
					) : (
						<div className="rounded-lg border border-border bg-card">
							{/* Desktop table */}
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<thead className="border-border border-b bg-muted/50">
										<tr>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Product
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												SKU
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
												Fulfillment
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Price
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Qty
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{items.map((item) => (
											<tr key={item.id} className="hover:bg-muted/30">
												<td className="max-w-[200px] truncate px-5 py-3 text-foreground">
													{item.title}
												</td>
												<td className="px-5 py-3">
													<span className="font-mono text-foreground text-xs">
														{item.sku}
													</span>
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${ITEM_STATUS_STYLES[item.status] ?? ""}`}
													>
														{item.status}
													</span>
												</td>
												<td className="px-5 py-3">
													<span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs uppercase">
														{item.fulfillmentType}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatCurrency(item.price)}
												</td>
												<td className="px-5 py-3 tabular-nums">
													<span
														className={
															item.quantity === 0
																? "font-medium text-red-600 dark:text-red-400"
																: item.quantity <= 5
																	? "font-medium text-yellow-600 dark:text-yellow-400"
																	: "text-foreground"
														}
													>
														{item.quantity}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Mobile list */}
							<div className="divide-y divide-border md:hidden">
								{items.map((item) => (
									<div key={item.id} className="px-5 py-3">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-foreground text-sm">
													{item.title}
												</p>
												<p className="mt-0.5 font-mono text-muted-foreground text-xs">
													{item.sku}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(item.price)} &middot; Qty:{" "}
													{item.quantity} &middot;{" "}
													{item.fulfillmentType?.toUpperCase() ?? "—"}
												</p>
											</div>
											<span
												className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${ITEM_STATUS_STYLES[item.status] ?? ""}`}
											>
												{item.status}
											</span>
										</div>
									</div>
								))}
							</div>

							{/* Pagination */}
							{itemsTotal > PAGE_SIZE && (
								<div className="flex items-center justify-between border-border border-t px-5 py-3">
									<span className="text-muted-foreground text-sm">
										Page {itemPage}
									</span>
									<span className="space-x-2">
										<button
											type="button"
											onClick={() => setItemPage((p) => Math.max(1, p - 1))}
											disabled={itemPage === 1}
											className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
										>
											Previous
										</button>
										<button
											type="button"
											onClick={() => setItemPage((p) => p + 1)}
											disabled={items.length < PAGE_SIZE}
											className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
										>
											Next
										</button>
									</span>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* Orders tab */}
			{activeTab === "orders" && (
				<div className="space-y-4">
					{/* Filter + sync button */}
					<div className="flex flex-wrap items-center gap-2">
						<select
							value={orderStatusFilter}
							onChange={(e) => {
								setOrderStatusFilter(e.target.value);
								setOrderPage(1);
							}}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">All Statuses</option>
							<option value="created">Created</option>
							<option value="acknowledged">Acknowledged</option>
							<option value="shipped">Shipped</option>
							<option value="delivered">Delivered</option>
							<option value="cancelled">Cancelled</option>
							<option value="refunded">Refunded</option>
						</select>
						<div className="flex-1" />
						<button
							type="button"
							disabled={
								syncOrdersMutation.isPending ||
								settingsData?.status !== "connected"
							}
							onClick={handleSyncOrders}
							className="rounded-md bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
						>
							{syncOrdersMutation.isPending ? "Syncing..." : "Sync Orders"}
						</button>
					</div>

					{ordersLoading ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<tbody className="divide-y divide-border">
										{Array.from({ length: 5 }, (_, i) => (
											<tr key={`order-skeleton-${i}`}>
												{Array.from({ length: 4 }, (_, j) => (
													<td
														key={`order-skeleton-cell-${j}`}
														className="px-5 py-3"
													>
														<Skeleton className="h-4 rounded" />
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className="space-y-3 p-4 md:hidden">
								{Array.from({ length: 3 }, (_, i) => (
									<Skeleton
										key={`order-mobile-skeleton-${i}`}
										className="h-16 rounded-lg"
									/>
								))}
							</div>
						</div>
					) : orders.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">No orders</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{orderStatusFilter
									? "No orders match the selected filter."
									: "Orders from Walmart will appear here once synced."}
							</p>
						</div>
					) : (
						<div className="rounded-lg border border-border bg-card">
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<thead className="border-border border-b bg-muted/50">
										<tr>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												PO Number
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
												Customer
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Total
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Shipping
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Date
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{orders.map((order) => (
											<tr key={order.id} className="hover:bg-muted/30">
												<td className="px-5 py-3 font-mono text-foreground text-xs">
													{order.purchaseOrderId}
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${ORDER_STATUS_STYLES[order.status] ?? ""}`}
													>
														{order.status}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground">
													{order.customerName ?? "-"}
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatCurrency(order.orderTotal)}
												</td>
												<td className="px-5 py-3 text-muted-foreground tabular-nums">
													{formatCurrency(order.shippingTotal)}
												</td>
												<td className="px-5 py-3 text-muted-foreground">
													{formatDate(order.createdAt)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							<div className="divide-y divide-border md:hidden">
								{orders.map((order) => (
									<div key={order.id} className="px-5 py-3">
										<div className="flex items-start justify-between gap-2">
											<div>
												<p className="font-medium font-mono text-foreground text-sm">
													{order.purchaseOrderId}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm">
													{order.customerName ?? "Unknown"}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(order.orderTotal)}
												</p>
											</div>
											<span
												className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${ORDER_STATUS_STYLES[order.status] ?? ""}`}
											>
												{order.status}
											</span>
										</div>
									</div>
								))}
							</div>

							{/* Pagination */}
							{ordersTotal > PAGE_SIZE && (
								<div className="flex items-center justify-between border-border border-t px-5 py-3">
									<span className="text-muted-foreground text-sm">
										Page {orderPage}
									</span>
									<span className="space-x-2">
										<button
											type="button"
											onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
											disabled={orderPage === 1}
											className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
										>
											Previous
										</button>
										<button
											type="button"
											onClick={() => setOrderPage((p) => p + 1)}
											disabled={orders.length < PAGE_SIZE}
											className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
										>
											Next
										</button>
									</span>
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
