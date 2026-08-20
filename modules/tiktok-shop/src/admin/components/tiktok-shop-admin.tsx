"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsData {
	status: "connected" | "not_configured" | "error";
	error?: string;
	configured: boolean;
	shopId: string | null;
	sandbox: boolean;
	appKey: string | null;
}

interface ChannelStats {
	totalListings: number;
	activeListings: number;
	pendingListings: number;
	failedListings: number;
	totalOrders: number;
	pendingOrders: number;
	shippedOrders: number;
	deliveredOrders: number;
	cancelledOrders: number;
	totalRevenue: number;
}

interface Listing {
	id: string;
	localProductId: string;
	externalProductId?: string;
	title: string;
	status: string;
	syncStatus: string;
	lastSyncedAt?: string;
	error?: string;
	createdAt: string;
}

interface ChannelOrder {
	id: string;
	externalOrderId: string;
	status: string;
	subtotal: number;
	shippingFee: number;
	platformFee: number;
	total: number;
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
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

const STATUS_STYLES: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	draft: "bg-muted text-muted-foreground",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	suspended:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const SYNC_STYLES: Record<string, string> = {
	synced:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	outdated:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const ORDER_STYLES: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	shipped:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	delivered:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	refunded:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

// ── API hook ─────────────────────────────────────────────────────────────────

function useTikTokApi() {
	const client = useModuleClient();
	const mod = client.module("tiktok-shop");
	return {
		settings: mod.admin["/admin/tiktok-shop/settings"],
		stats: mod.admin["/admin/tiktok-shop/stats"],
		listings: mod.admin["/admin/tiktok-shop/listings"],
		syncProducts: mod.admin["/admin/tiktok-shop/products/sync"],
		orders: mod.admin["/admin/tiktok-shop/orders"],
		syncOrders: mod.admin["/admin/tiktok-shop/orders/sync"],
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
						{settings.sandbox ? "Sandbox" : "Production"}
					</span>
				</div>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">Shop ID</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.shopId ?? "—"}
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">App Key</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.appKey}
						</span>
					</div>
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
						{settings.sandbox ? "Sandbox" : "Production"}
					</span>
				</div>
				<p className="break-words text-muted-foreground text-sm">
					{settings.error ??
						"TikTok Shop rejected the credentials. Verify the access token hasn't expired and the app has the required scopes."}
				</p>
				<p className="text-muted-foreground text-xs">
					Access tokens expire periodically. Regenerate one from the TikTok Shop
					Partner Center and update{" "}
					<code className="rounded bg-muted px-1">TIKTOK_ACCESS_TOKEN</code>.
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
				<code className="rounded bg-muted px-1 text-xs">TIKTOK_APP_KEY</code>,{" "}
				<code className="rounded bg-muted px-1 text-xs">TIKTOK_APP_SECRET</code>
				, and{" "}
				<code className="rounded bg-muted px-1 text-xs">
					TIKTOK_ACCESS_TOKEN
				</code>{" "}
				environment variables to connect your TikTok Shop.
			</p>
		</div>
	);
}

// ── Main component ───────────────────────────────────────────────────────────

export function TikTokShopAdmin() {
	const api = useTikTokApi();
	const [listingPage, setListingPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const [orderPage, setOrderPage] = useState(1);
	const [orderStatusFilter, setOrderStatusFilter] = useState("");
	const [activeTab, setActiveTab] = useState<"listings" | "orders">("listings");

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

	const {
		data: listingsData,
		isLoading: listingsLoading,
		refetch: refetchListings,
	} = api.listings.useQuery({
		page: String(listingPage),
		limit: String(PAGE_SIZE),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { listings: Listing[]; total: number } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const { data: ordersData, isLoading: ordersLoading } = api.orders.useQuery({
		page: String(orderPage),
		limit: String(PAGE_SIZE),
		...(orderStatusFilter ? { status: orderStatusFilter } : {}),
	}) as {
		data: { orders: ChannelOrder[]; total: number } | undefined;
		isLoading: boolean;
	};

	const syncMutation = api.syncProducts.useMutation() as {
		mutate: (params: Record<string, never>) => void;
		isPending: boolean;
	};

	const handleSync = () => {
		syncMutation.mutate({});
		setTimeout(() => refetchListings(), 2000);
	};

	const stats = statsData?.stats;
	const listings = listingsData?.listings ?? [];
	const listingsTotal = listingsData?.total ?? 0;
	const orders = ordersData?.orders ?? [];
	const ordersTotal = ordersData?.total ?? 0;

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

	return (
		<div className="space-y-8 p-1">
			<div>
				<h2 className="font-semibold text-foreground text-lg">TikTok Shop</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your TikTok Shop product listings, sync catalog, and track
					orders.
				</p>
			</div>

			{settingsData && <ConnectionStatus settings={settingsData} />}

			{statsLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => (
						<Skeleton key={i} className="h-24 rounded-lg" />
					))}
				</div>
			) : stats ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard
						label="Listings"
						value={String(stats.totalListings)}
						detail={`${stats.activeListings} active`}
					/>
					<StatCard
						label="Pending"
						value={String(stats.pendingListings)}
						detail={
							stats.failedListings > 0
								? `${stats.failedListings} failed`
								: "Awaiting review"
						}
					/>
					<StatCard
						label="Orders"
						value={String(stats.totalOrders)}
						detail={`${stats.shippedOrders} shipped, ${stats.deliveredOrders} delivered`}
					/>
					<StatCard
						label="Revenue"
						value={formatCurrency(stats.totalRevenue)}
						detail={`${stats.pendingOrders} pending`}
					/>
				</div>
			) : null}

			<div className="flex gap-1 border-border border-b">
				<button
					type="button"
					onClick={() => setActiveTab("listings")}
					className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
						activeTab === "listings"
							? "border-foreground text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					Listings
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

			{activeTab === "listings" && (
				<div className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						<select
							value={statusFilter}
							onChange={(e) => {
								setStatusFilter(e.target.value);
								setListingPage(1);
							}}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">All Statuses</option>
							<option value="active">Active</option>
							<option value="draft">Draft</option>
							<option value="pending">Pending</option>
							<option value="rejected">Rejected</option>
							<option value="suspended">Suspended</option>
						</select>
						<div className="flex-1" />
						<button
							type="button"
							disabled={
								syncMutation.isPending || settingsData?.status !== "connected"
							}
							onClick={handleSync}
							className="rounded-md bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
						>
							{syncMutation.isPending ? "Syncing..." : "Sync Products"}
						</button>
					</div>

					{listingsLoading ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<tbody className="divide-y divide-border">
										{Array.from({ length: 5 }, (_, i) => (
											<tr key={`listing-skeleton-${i}`}>
												{Array.from({ length: 4 }, (_, j) => (
													<td
														key={`listing-skeleton-cell-${j}`}
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
										key={`listing-mobile-skeleton-${i}`}
										className="h-16 rounded-lg"
									/>
								))}
							</div>
						</div>
					) : listings.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">No listings</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{statusFilter
									? "No listings match the selected filter."
									: "Products will appear here once synced from TikTok Shop."}
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
												Product
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
												Sync
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Last Synced
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{listings.map((listing) => (
											<tr key={listing.id} className="hover:bg-muted/30">
												<td className="max-w-[280px] truncate px-5 py-3 text-foreground">
													{listing.title}
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_STYLES[listing.status] ?? ""}`}
													>
														{listing.status}
													</span>
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${SYNC_STYLES[listing.syncStatus] ?? ""}`}
													>
														{listing.syncStatus}
													</span>
												</td>
												<td className="px-5 py-3 text-muted-foreground">
													{listing.lastSyncedAt
														? formatDate(listing.lastSyncedAt)
														: "Never"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							<div className="divide-y divide-border md:hidden">
								{listings.map((listing) => (
									<div key={listing.id} className="px-5 py-3">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-foreground text-sm">
													{listing.title}
												</p>
												<div className="mt-1 flex gap-1.5">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_STYLES[listing.status] ?? ""}`}
													>
														{listing.status}
													</span>
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${SYNC_STYLES[listing.syncStatus] ?? ""}`}
													>
														{listing.syncStatus}
													</span>
												</div>
											</div>
										</div>
									</div>
								))}
							</div>

							{listingsTotal > PAGE_SIZE && (
								<div className="flex items-center justify-between border-border border-t px-5 py-3">
									<span className="text-muted-foreground text-sm">
										Page {listingPage}
									</span>
									<span className="space-x-2">
										<button
											type="button"
											onClick={() => setListingPage((p) => Math.max(1, p - 1))}
											disabled={listingPage === 1}
											className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
										>
											Previous
										</button>
										<button
											type="button"
											onClick={() => setListingPage((p) => p + 1)}
											disabled={listings.length < PAGE_SIZE}
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

			{activeTab === "orders" && (
				<div className="space-y-4">
					<div className="flex items-center gap-2">
						<select
							value={orderStatusFilter}
							onChange={(e) => {
								setOrderStatusFilter(e.target.value);
								setOrderPage(1);
							}}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">All Statuses</option>
							<option value="pending">Pending</option>
							<option value="confirmed">Confirmed</option>
							<option value="shipped">Shipped</option>
							<option value="delivered">Delivered</option>
							<option value="cancelled">Cancelled</option>
							<option value="refunded">Refunded</option>
						</select>
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
									: "Orders from TikTok Shop will appear here."}
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
												Order ID
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
												Status
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
												Platform Fee
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
													{order.externalOrderId}
												</td>
												<td className="px-5 py-3 text-foreground">
													{order.customerName ?? "—"}
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${ORDER_STYLES[order.status] ?? ""}`}
													>
														{order.status}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatCurrency(order.total)}
												</td>
												<td className="px-5 py-3 text-muted-foreground tabular-nums">
													{formatCurrency(order.platformFee)}
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
												<p className="font-medium text-foreground text-sm">
													{order.customerName ?? order.externalOrderId}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(order.total)}
												</p>
											</div>
											<span
												className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${ORDER_STYLES[order.status] ?? ""}`}
											>
												{order.status}
											</span>
										</div>
									</div>
								))}
							</div>

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
