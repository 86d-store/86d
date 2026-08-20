"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChannelStats {
	totalProducts: number;
	activeProducts: number;
	totalOrders: number;
	totalRevenue: number;
	pendingShipments: number;
	disabledProducts: number;
}

interface WishProduct {
	id: string;
	localProductId: string;
	wishProductId?: string;
	title: string;
	status: string;
	price: number;
	shippingPrice: number;
	quantity: number;
	parentSku?: string;
	lastSyncedAt?: string;
	error?: string;
	createdAt: string;
}

interface WishOrder {
	id: string;
	wishOrderId: string;
	status: string;
	orderTotal: number;
	shippingTotal: number;
	wishFee: number;
	customerName?: string;
	trackingNumber?: string;
	carrier?: string;
	shipByDate?: string;
	createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function formatDate(iso: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

function extractError(err: unknown, fallback = "Something went wrong"): string {
	const e = err as { message?: string } | null;
	return typeof e?.message === "string" ? e.message : fallback;
}

const STATUS_COLORS: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	disabled: "bg-muted text-muted-foreground",
	"pending-review":
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	shipped:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	delivered:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	refunded: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	cancelled: "bg-muted text-muted-foreground",
};

const PAGE_SIZE = 20;
const SKELETON_IDS = ["a", "b", "c", "d"] as const;

// ── API hook ──────────────────────────────────────────────────────────────────

function useWishAdminApi() {
	const client = useModuleClient();
	return {
		stats: client.module("wish").admin["/admin/wish/stats"],
		listProducts: client.module("wish").admin["/admin/wish/products"],
		listOrders: client.module("wish").admin["/admin/wish/orders"],
		pendingShipments: client.module("wish").admin["/admin/wish/orders/pending"],
		createProduct: client.module("wish").admin["/admin/wish/products/create"],
		disableProduct:
			client.module("wish").admin["/admin/wish/products/:id/disable"],
		shipOrder: client.module("wish").admin["/admin/wish/orders/:id/ship"],
	};
}

// ── Sub-sections ──────────────────────────────────────────────────────────────

function StatsBar({
	stats,
	loading,
}: {
	stats?: ChannelStats | undefined;
	loading: boolean;
}) {
	const items = [
		{ label: "Total products", value: stats?.totalProducts ?? 0 },
		{ label: "Active", value: stats?.activeProducts ?? 0 },
		{ label: "Orders", value: stats?.totalOrders ?? 0 },
		{ label: "Revenue", value: stats ? formatPrice(stats.totalRevenue) : "$0" },
		{ label: "Pending shipments", value: stats?.pendingShipments ?? 0 },
	];
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
			{items.map((item) => (
				<div
					key={item.label}
					className="rounded-lg border border-border bg-card px-4 py-3"
				>
					{loading ? (
						<div className="space-y-1.5">
							<div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
							<div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
						</div>
					) : (
						<>
							<p className="text-muted-foreground text-xs">{item.label}</p>
							<p className="mt-0.5 font-semibold text-foreground tabular-nums">
								{item.value}
							</p>
						</>
					)}
				</div>
			))}
		</div>
	);
}

function ProductsSection() {
	const api = useWishAdminApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState("");
	const [error, setError] = useState("");

	const { data, isLoading } = api.listProducts.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { products: WishProduct[]; total: number } | undefined;
		isLoading: boolean;
	};

	const products = data?.products ?? [];
	const total = data?.total ?? 0;

	const disableMutation = api.disableProduct.useMutation({
		onSuccess: () => {
			void api.listProducts.invalidate();
			void api.stats.invalidate();
		},
		onError: (err: Error) =>
			setError(extractError(err, "Failed to disable product.")),
	});

	return (
		<div className="space-y-3">
			{error && (
				<div
					role="alert"
					className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}
			<div className="flex items-center gap-3">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => {
						setStatusFilter(e.target.value);
						setSkip(0);
					}}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">All statuses</option>
					<option value="active">Active</option>
					<option value="disabled">Disabled</option>
					<option value="pending-review">Pending review</option>
					<option value="rejected">Rejected</option>
				</select>
			</div>

			{isLoading ? (
				<div className="overflow-hidden rounded-lg border border-border">
					{SKELETON_IDS.map((id) => (
						<div
							key={`skel-${id}`}
							className="flex items-center gap-3 border-border border-b px-4 py-3 last:border-b-0"
						>
							<div className="flex-1 space-y-1.5">
								<div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
								<div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
							</div>
							<div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
						</div>
					))}
				</div>
			) : products.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-10 text-center">
					<p className="font-medium text-foreground text-sm">No products yet</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Create your first Wish product listing to start selling.
					</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-left text-sm">
						<thead className="border-border border-b bg-muted/50">
							<tr>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Product
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Price
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Qty
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Synced
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								/>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{products.map((p) => (
								<tr key={p.id} className="hover:bg-muted/30">
									<td className="px-4 py-3">
										<p className="font-medium text-foreground text-sm">
											{p.title}
										</p>
										{p.wishProductId && (
											<p className="font-mono text-muted-foreground text-xs">
												{p.wishProductId}
											</p>
										)}
										{p.error && (
											<p className="text-destructive text-xs">{p.error}</p>
										)}
									</td>
									<td className="px-4 py-3 text-foreground text-sm tabular-nums">
										{formatPrice(p.price)}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm tabular-nums">
										{p.quantity}
									</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[p.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{p.status}
										</span>
									</td>
									<td className="px-4 py-3 text-muted-foreground text-xs">
										{p.lastSyncedAt ? formatDate(p.lastSyncedAt) : "—"}
									</td>
									<td className="px-4 py-3">
										{p.status === "active" && (
											<button
												type="button"
												onClick={() =>
													disableMutation.mutate({ params: { id: p.id } })
												}
												disabled={disableMutation.isPending}
												className="text-muted-foreground text-xs hover:text-destructive disabled:opacity-50"
											>
												Disable
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{total > PAGE_SIZE && (
						<div className="flex items-center justify-between border-border border-t px-4 py-2.5">
							<span className="text-muted-foreground text-xs">
								{skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
							</span>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={skip === 0}
									onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
									className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
								>
									Prev
								</button>
								<button
									type="button"
									disabled={skip + PAGE_SIZE >= total}
									onClick={() => setSkip((s) => s + PAGE_SIZE)}
									className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
								>
									Next
								</button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function OrdersSection() {
	const api = useWishAdminApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState("");

	const { data, isLoading } = api.listOrders.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { orders: WishOrder[]; total: number } | undefined;
		isLoading: boolean;
	};

	const orders = data?.orders ?? [];
	const total = data?.total ?? 0;

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-3">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => {
						setStatusFilter(e.target.value);
						setSkip(0);
					}}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">All statuses</option>
					<option value="pending">Pending</option>
					<option value="approved">Approved</option>
					<option value="shipped">Shipped</option>
					<option value="delivered">Delivered</option>
					<option value="refunded">Refunded</option>
					<option value="cancelled">Cancelled</option>
				</select>
			</div>

			{isLoading ? (
				<div className="overflow-hidden rounded-lg border border-border">
					{SKELETON_IDS.map((id) => (
						<div
							key={`skel-${id}`}
							className="flex items-center gap-3 border-border border-b px-4 py-3 last:border-b-0"
						>
							<div className="flex-1 space-y-1.5">
								<div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
								<div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
							</div>
							<div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
						</div>
					))}
				</div>
			) : orders.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-10 text-center">
					<p className="font-medium text-foreground text-sm">No orders yet</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Wish orders will appear here once you start selling.
					</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-left text-sm">
						<thead className="border-border border-b bg-muted/50">
							<tr>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Order ID
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Customer
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Total
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Date
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{orders.map((o) => (
								<tr key={o.id} className="hover:bg-muted/30">
									<td className="px-4 py-3 font-mono text-foreground text-xs">
										{o.wishOrderId}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{o.customerName ?? "—"}
									</td>
									<td className="px-4 py-3 text-foreground text-sm tabular-nums">
										{formatPrice(o.orderTotal)}
									</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[o.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{o.status}
										</span>
									</td>
									<td className="px-4 py-3 text-muted-foreground text-xs">
										{formatDate(o.createdAt)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{total > PAGE_SIZE && (
						<div className="flex items-center justify-between border-border border-t px-4 py-2.5">
							<span className="text-muted-foreground text-xs">
								{skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
							</span>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={skip === 0}
									onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
									className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
								>
									Prev
								</button>
								<button
									type="button"
									disabled={skip + PAGE_SIZE >= total}
									onClick={() => setSkip((s) => s + PAGE_SIZE)}
									className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
								>
									Next
								</button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function PendingShipmentsSection() {
	const api = useWishAdminApi();
	const [shippingId, setShippingId] = useState("");
	const [carrier, setCarrier] = useState("");
	const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data, isLoading, refetch } = api.pendingShipments.useQuery({}) as {
		data: { orders: WishOrder[] } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const shipMutation = api.shipOrder.useMutation({
		onSuccess: () => {
			setShippingOrderId(null);
			setShippingId("");
			setCarrier("");
			setError("");
			void refetch();
			void api.stats.invalidate();
		},
		onError: (err: Error) =>
			setError(extractError(err, "Failed to mark as shipped.")),
	});

	const orders = data?.orders ?? [];

	return (
		<div className="space-y-3">
			{error && (
				<div
					role="alert"
					className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}
			{isLoading ? (
				<div className="overflow-hidden rounded-lg border border-border">
					{SKELETON_IDS.map((id) => (
						<div
							key={`skel-${id}`}
							className="flex items-center gap-3 border-border border-b px-4 py-3 last:border-b-0"
						>
							<div className="flex-1 space-y-1.5">
								<div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
								<div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
							</div>
						</div>
					))}
				</div>
			) : orders.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-10 text-center">
					<p className="font-medium text-foreground text-sm">
						No pending shipments
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						All orders are either shipped or not yet approved.
					</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-left text-sm">
						<thead className="border-border border-b bg-muted/50">
							<tr>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Order ID
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Customer
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Total
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								>
									Ship by
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 font-medium text-muted-foreground text-xs"
								/>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{orders.map((o) => (
								<tr key={o.id} className="hover:bg-muted/30">
									<td className="px-4 py-3 font-mono text-foreground text-xs">
										{o.wishOrderId}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{o.customerName ?? "—"}
									</td>
									<td className="px-4 py-3 text-foreground text-sm tabular-nums">
										{formatPrice(o.orderTotal)}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-xs">
										{o.shipByDate ? formatDate(o.shipByDate) : "—"}
									</td>
									<td className="px-4 py-3">
										{shippingOrderId === o.id ? (
											<div className="flex items-center gap-2">
												<input
													type="text"
													value={shippingId}
													onChange={(e) => setShippingId(e.target.value)}
													placeholder="Tracking number"
													className="w-32 rounded border border-border bg-background px-2 py-1 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
												/>
												<input
													type="text"
													value={carrier}
													onChange={(e) => setCarrier(e.target.value)}
													placeholder="Carrier"
													className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
												/>
												<button
													type="button"
													disabled={
														!shippingId.trim() ||
														!carrier.trim() ||
														shipMutation.isPending
													}
													onClick={() =>
														shipMutation.mutate({
															params: { id: o.id },
															trackingNumber: shippingId.trim(),
															carrier: carrier.trim(),
														})
													}
													className="rounded bg-foreground px-2 py-1 font-medium text-background text-xs hover:opacity-90 disabled:opacity-50"
												>
													{shipMutation.isPending
														? "Saving..."
														: "Mark Shipped"}
												</button>
												<button
													type="button"
													onClick={() => setShippingOrderId(null)}
													className="text-muted-foreground text-xs hover:text-foreground"
												>
													Cancel
												</button>
											</div>
										) : (
											<button
												type="button"
												onClick={() => {
													setShippingOrderId(o.id);
													setShippingId("");
													setCarrier("");
												}}
												className="rounded border border-border px-2.5 py-1 text-foreground text-xs hover:bg-muted"
											>
												Ship
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = "products" | "orders" | "shipments";

export function WishAdmin() {
	const api = useWishAdminApi();
	const [activeTab, setActiveTab] = useState<Tab>("products");

	const { data: statsData, isLoading: statsLoading } = api.stats.useQuery(
		{},
	) as {
		data: { stats: ChannelStats } | undefined;
		isLoading: boolean;
	};

	const tabs: { id: Tab; label: string }[] = [
		{ id: "products", label: "Products" },
		{ id: "orders", label: "Orders" },
		{ id: "shipments", label: "Pending Shipments" },
	];

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Wish</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage your Wish Marketplace products, orders, and shipments.
					</p>
				</div>
			</div>

			<StatsBar stats={statsData?.stats} loading={statsLoading} />

			<div>
				<div className="flex gap-1 border-border border-b">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`px-4 py-2 font-medium text-sm transition-colors ${
								activeTab === tab.id
									? "border-foreground border-b-2 text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
				<div className="pt-5">
					{activeTab === "products" && <ProductsSection />}
					{activeTab === "orders" && <OrdersSection />}
					{activeTab === "shipments" && <PendingShipmentsSection />}
				</div>
			</div>
		</div>
	);
}
