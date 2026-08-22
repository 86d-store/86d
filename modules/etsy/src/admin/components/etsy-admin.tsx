"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsData {
	status: "connected" | "not_configured" | "error";
	error?: string;
	configured: boolean;
	shopId: string | null;
	apiKey: string | null;
}

interface ChannelStats {
	totalListings: number;
	active: number;
	draft: number;
	expired: number;
	inactive: number;
	soldOut: number;
	totalOrders: number;
	totalRevenue: number;
	totalViews: number;
	totalFavorites: number;
	averageRating: number;
	totalReviews: number;
}

interface EtsyListing {
	id: string;
	localProductId: string;
	etsyListingId?: string;
	title: string;
	status: string;
	state: string;
	price: number;
	quantity: number;
	views: number;
	favorites: number;
	renewalDate?: string;
	lastSyncedAt?: string;
	error?: string;
	createdAt: string;
}

interface EtsyOrder {
	id: string;
	etsyReceiptId: string;
	status: string;
	subtotal: number;
	shippingCost: number;
	etsyFee: number;
	total: number;
	buyerName?: string;
	giftMessage?: string;
	createdAt: string;
}

interface EtsyReview {
	id: string;
	etsyTransactionId: string;
	rating: number;
	review?: string;
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

function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

const LISTING_STATUS_STYLES: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	draft: "bg-muted text-muted-foreground",
	expired:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	inactive:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	"sold-out": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
	open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	paid: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	shipped:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// ── API hook ─────────────────────────────────────────────────────────────────

function useEtsyApi() {
	const client = useModuleClient();
	const mod = client.module("etsy");
	return {
		settings: mod.admin["/admin/etsy/settings"],
		stats: mod.admin["/admin/etsy/stats"],
		listings: mod.admin["/admin/etsy/listings"],
		orders: mod.admin["/admin/etsy/orders"],
		reviews: mod.admin["/admin/etsy/reviews"],
		averageRating: mod.admin["/admin/etsy/reviews/average"],
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
			<div
				data-testid="etsy-status-connected"
				className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
			>
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
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">Shop ID</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.shopId}
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">API Key</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.apiKey}
						</span>
					</div>
				</div>
			</div>
		);
	}

	if (settings.status === "error") {
		return (
			<div
				data-testid="etsy-status-error"
				className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-5"
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="size-2.5 rounded-full bg-red-500" />
						<span className="font-medium text-foreground text-sm">
							Connection error
						</span>
					</div>
					<span className="rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-800 text-xs dark:bg-red-900/30 dark:text-red-400">
						Check credentials
					</span>
				</div>
				<p className="text-red-700 text-sm dark:text-red-300">
					Etsy rejected the configured credentials. Listing, order, and review
					sync is paused until the connection is repaired.
				</p>
				{settings.error && (
					<p
						data-testid="etsy-status-error-message"
						className="font-mono text-red-600/90 text-xs dark:text-red-400/90"
					>
						{settings.error}
					</p>
				)}
				<p className="text-muted-foreground text-xs">
					Verify that{" "}
					<code className="rounded bg-muted px-1 text-xs">ETSY_API_KEY</code>,{" "}
					<code className="rounded bg-muted px-1 text-xs">ETSY_SHOP_ID</code>,
					and{" "}
					<code className="rounded bg-muted px-1 text-xs">
						ETSY_ACCESS_TOKEN
					</code>{" "}
					are current and the OAuth token has not expired.
				</p>
			</div>
		);
	}

	return (
		<div
			data-testid="etsy-status-not-configured"
			className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-5"
		>
			<div className="flex items-center gap-2">
				<div className="size-2.5 rounded-full bg-amber-500" />
				<span className="font-medium text-foreground text-sm">
					Not Configured
				</span>
			</div>
			<p className="text-muted-foreground text-sm">
				Set the{" "}
				<code className="rounded bg-muted px-1 text-xs">ETSY_API_KEY</code>,{" "}
				<code className="rounded bg-muted px-1 text-xs">ETSY_SHOP_ID</code>, and{" "}
				<code className="rounded bg-muted px-1 text-xs">ETSY_ACCESS_TOKEN</code>{" "}
				environment variables to connect your Etsy shop.
			</p>
		</div>
	);
}

function StarRating({ rating }: { rating: number }) {
	const full = Math.floor(rating);
	const half = rating - full >= 0.5;
	return (
		<span className="inline-flex items-center gap-0.5 text-yellow-500">
			{Array.from({ length: full }, (_, i) => `star-${i}`).map((key) => (
				<span key={key} className="text-sm">
					&#9733;
				</span>
			))}
			{half && <span className="text-sm">&#9734;</span>}
			<span className="ml-1 font-medium text-foreground text-sm tabular-nums">
				{rating.toFixed(1)}
			</span>
		</span>
	);
}

// ── Main component ───────────────────────────────────────────────────────────

export function EtsyAdmin() {
	const api = useEtsyApi();
	const [listingPage, setListingPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const [orderPage, setOrderPage] = useState(1);
	const [orderStatusFilter, setOrderStatusFilter] = useState("");
	const [activeTab, setActiveTab] = useState<"listings" | "orders" | "reviews">(
		"listings",
	);

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

	const { data: listingsData, isLoading: listingsLoading } =
		api.listings.useQuery({
			page: String(listingPage),
			limit: String(PAGE_SIZE),
			...(statusFilter ? { status: statusFilter } : {}),
		}) as {
			data: { listings: EtsyListing[]; total: number } | undefined;
			isLoading: boolean;
		};

	const { data: ordersData, isLoading: ordersLoading } = api.orders.useQuery({
		page: String(orderPage),
		limit: String(PAGE_SIZE),
		...(orderStatusFilter ? { status: orderStatusFilter } : {}),
	}) as {
		data: { orders: EtsyOrder[]; total: number } | undefined;
		isLoading: boolean;
	};

	const { data: reviewsData, isLoading: reviewsLoading } = api.reviews.useQuery(
		{
			limit: String(PAGE_SIZE),
		},
	) as {
		data: { reviews: EtsyReview[]; total: number } | undefined;
		isLoading: boolean;
	};

	const stats = statsData?.stats;
	const listings = listingsData?.listings ?? [];
	const listingsTotal = listingsData?.total ?? 0;
	const orders = ordersData?.orders ?? [];
	const ordersTotal = ordersData?.total ?? 0;
	const reviews = reviewsData?.reviews ?? [];

	// ── Loading state ────────────────────────────────────────────────────────

	if (settingsLoading) {
		return (
			<div className="space-y-6 p-1">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-28 w-full rounded-lg" />
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => `skel-${i}`).map((key) => (
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
					Etsy Marketplace
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your Etsy shop listings, track orders, and monitor reviews and
					shop performance.
				</p>
			</div>

			{/* Connection status */}
			{settingsData && <ConnectionStatus settings={settingsData} />}

			{/* Stats */}
			{statsLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => `skel-${i}`).map((key) => (
						<Skeleton key={key} className="h-24 rounded-lg" />
					))}
				</div>
			) : stats ? (
				<>
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
						<StatCard
							label="Listings"
							value={String(stats.totalListings)}
							detail={`${stats.active} active, ${stats.draft} draft`}
						/>
						<StatCard
							label="Revenue"
							value={formatCurrency(stats.totalRevenue)}
							detail={`${stats.totalOrders} orders`}
						/>
						<StatCard
							label="Engagement"
							value={formatNumber(stats.totalViews)}
							detail={`${formatNumber(stats.totalFavorites)} favorites`}
						/>
						<div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
							<span className="text-muted-foreground text-xs">Shop Rating</span>
							<StarRating rating={stats.averageRating} />
							<span className="text-muted-foreground text-xs">
								{stats.totalReviews} reviews
							</span>
						</div>
					</div>
					{(stats.expired > 0 || stats.soldOut > 0) && (
						<div className="flex flex-wrap gap-3">
							{stats.expired > 0 && (
								<span className="rounded-full bg-orange-100 px-3 py-1 font-medium text-orange-800 text-xs dark:bg-orange-900/30 dark:text-orange-400">
									{stats.expired} expired listing
									{stats.expired !== 1 ? "s" : ""}
								</span>
							)}
							{stats.soldOut > 0 && (
								<span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-800 text-xs dark:bg-red-900/30 dark:text-red-400">
									{stats.soldOut} sold out
								</span>
							)}
						</div>
					)}
				</>
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
				<button
					type="button"
					onClick={() => setActiveTab("reviews")}
					className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
						activeTab === "reviews"
							? "border-foreground text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					Reviews
				</button>
			</div>

			{/* Listings tab */}
			{activeTab === "listings" && (
				<div className="space-y-4">
					<div className="flex items-center gap-2">
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
							<option value="expired">Expired</option>
							<option value="inactive">Inactive</option>
							<option value="sold-out">Sold Out</option>
						</select>
					</div>

					{listingsLoading ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<tbody className="divide-y divide-border">
										{Array.from({ length: 5 }, (_, i) => `skel-row-${i}`).map(
											(key) => (
												<tr key={key}>
													{Array.from(
														{ length: 6 },
														(_, i) => `skel-cell-${i}`,
													).map((key) => (
														<td key={key} className="px-5 py-3">
															<Skeleton className="h-4 rounded" />
														</td>
													))}
												</tr>
											),
										)}
									</tbody>
								</table>
							</div>
							<div className="space-y-3 p-4 md:hidden">
								{Array.from({ length: 3 }, (_, i) => `skel-${i}`).map((key) => (
									<Skeleton key={key} className="h-16 rounded-lg" />
								))}
							</div>
						</div>
					) : listings.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">No listings</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{statusFilter
									? "No listings match the selected filter."
									: "Listings will appear here once synced from your Etsy shop."}
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
												Price
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Qty
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Views
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Favs
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{listings.map((listing) => (
											<tr key={listing.id} className="hover:bg-muted/30">
												<td className="max-w-[240px] truncate px-5 py-3 text-foreground">
													{listing.title}
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${LISTING_STATUS_STYLES[listing.status] ?? ""}`}
													>
														{listing.status}
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
																: "text-foreground"
														}
													>
														{listing.quantity}
													</span>
												</td>
												<td className="px-5 py-3 text-muted-foreground tabular-nums">
													{formatNumber(listing.views)}
												</td>
												<td className="px-5 py-3 text-muted-foreground tabular-nums">
													{formatNumber(listing.favorites)}
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
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(listing.price)} &middot; Qty:{" "}
													{listing.quantity}
												</p>
												<p className="mt-0.5 text-muted-foreground text-xs">
													{formatNumber(listing.views)} views &middot;{" "}
													{formatNumber(listing.favorites)} favs
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
							<option value="open">Open</option>
							<option value="paid">Paid</option>
							<option value="shipped">Shipped</option>
							<option value="completed">Completed</option>
							<option value="cancelled">Cancelled</option>
						</select>
					</div>

					{ordersLoading ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<tbody className="divide-y divide-border">
										{Array.from({ length: 5 }, (_, i) => `skel-row-${i}`).map(
											(key) => (
												<tr key={key}>
													{Array.from(
														{ length: 6 },
														(_, i) => `skel-cell-${i}`,
													).map((key) => (
														<td key={key} className="px-5 py-3">
															<Skeleton className="h-4 rounded" />
														</td>
													))}
												</tr>
											),
										)}
									</tbody>
								</table>
							</div>
							<div className="space-y-3 p-4 md:hidden">
								{Array.from({ length: 3 }, (_, i) => `skel-${i}`).map((key) => (
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
									: "Orders from Etsy will appear here."}
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
												Receipt ID
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Buyer
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
												Fees
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
													{order.etsyReceiptId}
												</td>
												<td className="px-5 py-3 text-foreground">
													{order.buyerName ?? "—"}
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${ORDER_STATUS_STYLES[order.status] ?? ""}`}
													>
														{order.status}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatCurrency(order.total)}
												</td>
												<td className="px-5 py-3 text-muted-foreground tabular-nums">
													{formatCurrency(order.etsyFee)}
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
													{order.buyerName ?? order.etsyReceiptId}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(order.total)}
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

			{/* Reviews tab */}
			{activeTab === "reviews" && (
				<div>
					{reviewsLoading ? (
						<div className="space-y-3">
							{Array.from({ length: 3 }, (_, i) => `skel-${i}`).map((key) => (
								<Skeleton key={key} className="h-20 rounded-lg" />
							))}
						</div>
					) : reviews.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">
								No reviews yet
							</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Customer reviews will appear here once received.
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{reviews.map((review) => (
								<div
									key={review.id}
									className="rounded-lg border border-border bg-card p-5"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<StarRating rating={review.rating} />
												{review.buyerName && (
													<span className="text-muted-foreground text-sm">
														by {review.buyerName}
													</span>
												)}
											</div>
											{review.review && (
												<p className="mt-2 text-foreground text-sm">
													{review.review}
												</p>
											)}
										</div>
										<span className="shrink-0 text-muted-foreground text-xs">
											{formatDate(review.createdAt)}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
