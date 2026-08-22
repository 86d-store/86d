"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsData {
	status: "connected" | "not_configured" | "error";
	error?: string;
	sellerId: string | null;
	marketplaceId: string | null;
	region: string;
	clientId: string | null;
}

interface ChannelStats {
	totalListings: number;
	active: number;
	inactive: number;
	suppressed: number;
	incomplete: number;
	fba: number;
	fbm: number;
	totalOrders: number;
	totalRevenue: number;
}

interface Listing {
	id: string;
	localProductId: string;
	asin?: string;
	sku: string;
	title: string;
	status: string;
	fulfillmentChannel: string;
	price: number;
	quantity: number;
	condition: string;
	buyBoxOwned: boolean;
	lastSyncedAt?: string;
	error?: string;
	createdAt: string;
}

interface AmazonOrder {
	id: string;
	amazonOrderId: string;
	status: string;
	fulfillmentChannel: string;
	orderTotal: number;
	shippingTotal: number;
	marketplaceFee: number;
	netProceeds: number;
	buyerName?: string;
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

const LISTING_STATUS_STYLES: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	inactive: "bg-muted text-muted-foreground",
	suppressed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	incomplete:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	unshipped: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	shipped:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	returned:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

// ── API hook ─────────────────────────────────────────────────────────────────

function useAmazonApi() {
	const client = useModuleClient();
	const mod = client.module("amazon");
	return {
		settings: mod.admin["/admin/amazon/settings"],
		stats: mod.admin["/admin/amazon/stats"],
		listings: mod.admin["/admin/amazon/listings"],
		syncListings: mod.admin["/admin/amazon/listings/sync"],
		orders: mod.admin["/admin/amazon/orders"],
		syncOrders: mod.admin["/admin/amazon/orders/sync"],
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
						Active
					</span>
				</div>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">Seller ID</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.sellerId}
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">Client ID</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.clientId}
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">
							Region / Marketplace
						</span>
						<span className="font-medium text-foreground text-sm">
							{settings.region}
							{settings.marketplaceId ? ` (${settings.marketplaceId})` : ""}
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
						{settings.region}
					</span>
				</div>
				<p className="break-words text-muted-foreground text-sm">
					{settings.error ??
						"Amazon SP-API rejected the supplied credentials. Verify the seller ID, LWA client ID, secret, and refresh token."}
				</p>
				<p className="text-muted-foreground text-xs">
					LWA refresh tokens are revoked if the seller disables the app in
					Seller Central. Re-authorize from the Amazon Developer Console if
					needed.
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
				<code className="rounded bg-muted px-1 text-xs">AMAZON_SELLER_ID</code>,{" "}
				<code className="rounded bg-muted px-1 text-xs">AMAZON_CLIENT_ID</code>,{" "}
				<code className="rounded bg-muted px-1 text-xs">
					AMAZON_CLIENT_SECRET
				</code>
				, and{" "}
				<code className="rounded bg-muted px-1 text-xs">
					AMAZON_REFRESH_TOKEN
				</code>{" "}
				environment variables to connect your Amazon Seller Central account.
			</p>
		</div>
	);
}

// ── Main component ───────────────────────────────────────────────────────────

export function AmazonAdmin() {
	const api = useAmazonApi();
	const [listingPage, setListingPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const [channelFilter, setChannelFilter] = useState("");
	const [orderPage, setOrderPage] = useState(1);
	const [orderStatusFilter, setOrderStatusFilter] = useState("");
	const [activeTab, setActiveTab] = useState<"listings" | "orders">("listings");

	const { data: settingsData, isLoading: settingsLoading } =
		api.settings.useQuery({}) as {
			data: SettingsData | undefined;
			isLoading: boolean;
		};

	const {
		data: statsData,
		isLoading: statsLoading,
		refetch: refetchStats,
	} = api.stats.useQuery({}) as {
		data: { stats: ChannelStats } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const {
		data: listingsData,
		isLoading: listingsLoading,
		refetch: refetchListings,
	} = api.listings.useQuery({
		page: String(listingPage),
		limit: String(PAGE_SIZE),
		...(statusFilter ? { status: statusFilter } : {}),
		...(channelFilter ? { fulfillmentChannel: channelFilter } : {}),
	}) as {
		data: { listings: Listing[]; total: number } | undefined;
		isLoading: boolean;
		refetch: () => void;
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
		data: { orders: AmazonOrder[]; total: number } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const syncListingsMutation = api.syncListings.useMutation() as {
		mutate: (params: Record<string, never>) => void;
		isPending: boolean;
	};

	const syncOrdersMutation = api.syncOrders.useMutation() as {
		mutate: (params: Record<string, never>) => void;
		isPending: boolean;
	};

	const handleSyncListings = () => {
		syncListingsMutation.mutate({});
		setTimeout(() => {
			refetchListings();
			refetchStats();
		}, 2000);
	};

	const handleSyncOrders = () => {
		syncOrdersMutation.mutate({});
		setTimeout(() => {
			refetchOrders();
			refetchStats();
		}, 2000);
	};

	const stats = statsData?.stats;
	const listings = listingsData?.listings ?? [];
	const listingsTotal = listingsData?.total ?? 0;
	const orders = ordersData?.orders ?? [];
	const ordersTotal = ordersData?.total ?? 0;

	// ── Loading state ────────────────────────────────────────────────────────

	if (settingsLoading) {
		return (
			<div className="space-y-6 p-1">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-28 w-full rounded-lg" />
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }, (_, _i) => (
						<Skeleton key={key} className="h-24 rounded-lg" />
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
					Amazon Marketplace
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your Amazon SP-API listings, sync orders, and monitor channel
					performance.
				</p>
			</div>

			{/* Connection status */}
			{settingsData && <ConnectionStatus settings={settingsData} />}

			{/* Stats */}
			{statsLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }, (_, _i) => (
						<Skeleton key={key} className="h-24 rounded-lg" />
					))}
				</div>
			) : stats ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard
						label="Total Listings"
						value={String(stats.totalListings)}
						detail={`${stats.active} active`}
					/>
					<StatCard
						label="Fulfillment"
						value={`${stats.fba} FBA`}
						detail={`${stats.fbm} FBM`}
					/>
					<StatCard
						label="Issues"
						value={String(stats.suppressed + stats.incomplete)}
						detail={`${stats.suppressed} suppressed, ${stats.incomplete} incomplete`}
					/>
					<StatCard
						label="Revenue"
						value={formatCurrency(stats.totalRevenue)}
						detail={`${stats.totalOrders} orders`}
					/>
				</div>
			) : null}

			{/* Tab bar */}
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

			{/* Listings tab */}
			{activeTab === "listings" && (
				<div className="space-y-4">
					{/* Filters + sync button */}
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
							<option value="inactive">Inactive</option>
							<option value="suppressed">Suppressed</option>
							<option value="incomplete">Incomplete</option>
						</select>
						<select
							value={channelFilter}
							onChange={(e) => {
								setChannelFilter(e.target.value);
								setListingPage(1);
							}}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">All Channels</option>
							<option value="FBA">FBA</option>
							<option value="FBM">FBM</option>
						</select>
						<div className="flex-1" />
						<button
							type="button"
							disabled={
								syncListingsMutation.isPending ||
								settingsData?.status !== "connected"
							}
							onClick={handleSyncListings}
							className="rounded-md bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
						>
							{syncListingsMutation.isPending
								? "Syncing..."
								: "Sync from Amazon"}
						</button>
					</div>

					{/* Listings table */}
					{listingsLoading ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<tbody className="divide-y divide-border">
										{Array.from({ length: 5 }, (_, _i) => (
											<tr key={rowKey}>
												{Array.from({ length: 6 }, (_, _j) => (
													<td key={cellKey} className="px-5 py-3">
														<Skeleton className="h-4 rounded" />
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className="space-y-3 p-4 md:hidden">
								{Array.from({ length: 3 }, (_, _i) => (
									<Skeleton key={key} className="h-16 rounded-lg" />
								))}
							</div>
						</div>
					) : listings.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">No listings</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{statusFilter || channelFilter
									? "No listings match the selected filters."
									: "Listings will appear here once synced from Amazon Seller Central."}
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
												SKU / ASIN
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
												Channel
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
										{listings.map((listing) => (
											<tr key={listing.id} className="hover:bg-muted/30">
												<td className="max-w-[200px] truncate px-5 py-3 text-foreground">
													{listing.title}
												</td>
												<td className="px-5 py-3">
													<span className="font-mono text-foreground text-xs">
														{listing.sku}
													</span>
													{listing.asin && (
														<span className="ml-1 text-muted-foreground text-xs">
															({listing.asin})
														</span>
													)}
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${LISTING_STATUS_STYLES[listing.status] ?? ""}`}
													>
														{listing.status}
													</span>
												</td>
												<td className="px-5 py-3">
													<span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
														{listing.fulfillmentChannel}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatCurrency(listing.price)}
												</td>
												<td className="px-5 py-3 tabular-nums">
													<span
														className={
															listing.quantity === 0
																? "font-medium text-red-600 dark:text-red-400"
																: listing.quantity <= 5
																	? "font-medium text-yellow-600 dark:text-yellow-400"
																	: "text-foreground"
														}
													>
														{listing.quantity}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Mobile list */}
							<div className="divide-y divide-border md:hidden">
								{listings.map((listing) => (
									<div key={listing.id} className="px-5 py-3">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-foreground text-sm">
													{listing.title}
												</p>
												<p className="mt-0.5 font-mono text-muted-foreground text-xs">
													{listing.sku}
													{listing.asin ? ` / ${listing.asin}` : ""}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(listing.price)} &middot; Qty:{" "}
													{listing.quantity} &middot;{" "}
													{listing.fulfillmentChannel}
												</p>
											</div>
											<span
												className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${LISTING_STATUS_STYLES[listing.status] ?? ""}`}
											>
												{listing.status}
											</span>
										</div>
									</div>
								))}
							</div>

							{/* Pagination */}
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
							<option value="pending">Pending</option>
							<option value="unshipped">Unshipped</option>
							<option value="shipped">Shipped</option>
							<option value="cancelled">Cancelled</option>
							<option value="returned">Returned</option>
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
										{Array.from({ length: 5 }, (_, _i) => (
											<tr key={rowKey}>
												{Array.from({ length: 6 }, (_, _j) => (
													<td key={cellKey} className="px-5 py-3">
														<Skeleton className="h-4 rounded" />
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className="space-y-3 p-4 md:hidden">
								{Array.from({ length: 3 }, (_, _i) => (
									<Skeleton key={key} className="h-16 rounded-lg" />
								))}
							</div>
						</div>
					) : orders.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">No orders</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{orderStatusFilter
									? "No orders match the selected filter."
									: "Orders from Amazon will appear here once synced."}
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
												Amazon Order ID
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
												Channel
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
												Net
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
													{order.amazonOrderId}
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${ORDER_STATUS_STYLES[order.status] ?? ""}`}
													>
														{order.status}
													</span>
												</td>
												<td className="px-5 py-3">
													<span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
														{order.fulfillmentChannel}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatCurrency(order.orderTotal)}
												</td>
												<td className="px-5 py-3 text-green-700 tabular-nums dark:text-green-400">
													{formatCurrency(order.netProceeds)}
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
													{order.amazonOrderId}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(order.orderTotal)} &middot;{" "}
													{order.fulfillmentChannel}
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
