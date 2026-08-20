"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsData {
	status: "connected" | "not_configured" | "error";
	error?: string;
	configured: boolean;
	pageId: string | null;
	catalogId: string | null;
	commerceAccountId: string | null;
	accessToken: string | null;
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

interface Collection {
	id: string;
	name: string;
	externalId?: string;
	productIds: string[];
	status: string;
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

const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
const labelCls = "mb-1 block font-medium text-foreground text-sm";

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

function useFacebookApi() {
	const client = useModuleClient();
	const mod = client.module("facebook-shop");
	return {
		settings: mod.admin["/admin/facebook-shop/settings"],
		stats: mod.admin["/admin/facebook-shop/stats"],
		listings: mod.admin["/admin/facebook-shop/listings"],
		createListing: mod.admin["/admin/facebook-shop/listings/create"],
		updateListing: mod.admin["/admin/facebook-shop/listings/:id/update"],
		deleteListing: mod.admin["/admin/facebook-shop/listings/:id/delete"],
		syncProducts: mod.admin["/admin/facebook-shop/products/sync"],
		orders: mod.admin["/admin/facebook-shop/orders"],
		updateOrderStatus: mod.admin["/admin/facebook-shop/orders/:id/status"],
		syncOrders: mod.admin["/admin/facebook-shop/orders/sync"],
		collections: mod.admin["/admin/facebook-shop/collections"],
		createCollection: mod.admin["/admin/facebook-shop/collections/create"],
		deleteCollection: mod.admin["/admin/facebook-shop/collections/:id/delete"],
	};
}

// ── FbListingSheet ────────────────────────────────────────────────────────────

interface FbListingSheetProps {
	listing?: Listing;
	onSaved: () => void;
	onCancel: () => void;
	api: ReturnType<typeof useFacebookApi>;
}

function FbListingSheet({
	listing,
	onSaved,
	onCancel,
	api,
}: FbListingSheetProps) {
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onCancel]);
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const isEditing = !!listing;
	const [localProductId, setLocalProductId] = useState(
		listing?.localProductId ?? "",
	);
	const [title, setTitle] = useState(listing?.title ?? "");
	const [status, setStatus] = useState(listing?.status ?? "draft");
	const [error, setError] = useState("");

	const createMutation = api.createListing.useMutation({
		onSuccess: () => {
			void api.listings.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const updateMutation = api.updateListing.useMutation({
		onSuccess: () => {
			void api.listings.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!localProductId.trim() || !title.trim()) {
			setError("Product ID and title are required.");
			return;
		}
		if (isEditing) {
			updateMutation.mutate({
				params: { id: listing.id },
				body: {
					localProductId: localProductId.trim(),
					title: title.trim(),
					status: status as
						| "draft"
						| "pending"
						| "active"
						| "rejected"
						| "suspended",
				},
			});
		} else {
			createMutation.mutate({
				body: {
					localProductId: localProductId.trim(),
					title: title.trim(),
					status: status as
						| "draft"
						| "pending"
						| "active"
						| "rejected"
						| "suspended",
				},
			});
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<button
				type="button"
				className="absolute inset-0 cursor-default bg-black/40"
				aria-label="Close panel"
				onClick={onCancel}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-border border-l bg-background shadow-2xl"
			>
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						{isEditing ? "Edit Listing" : "New Listing"}
					</h2>
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close"
					>
						✕
					</button>
				</div>
				<form
					onSubmit={handleSubmit}
					className="flex flex-1 flex-col gap-5 px-6 py-6"
				>
					{error ? (
						<div
							role="alert"
							className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
						>
							{error}
						</div>
					) : null}
					<div className="space-y-4">
						<div>
							<label htmlFor="fls-productid" className={labelCls}>
								Local product ID <span className="text-destructive">*</span>
							</label>
							<input
								id="fls-productid"
								ref={firstInputRef}
								className={inputCls}
								value={localProductId}
								onChange={(e) => setLocalProductId(e.target.value)}
								placeholder="prod_123abc"
							/>
						</div>
						<div>
							<label htmlFor="fls-title" className={labelCls}>
								Title <span className="text-destructive">*</span>
							</label>
							<input
								id="fls-title"
								className={inputCls}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Product title on Facebook"
							/>
						</div>
						<div>
							<label htmlFor="fls-status" className={labelCls}>
								Status
							</label>
							<select
								id="fls-status"
								className={inputCls}
								value={status}
								onChange={(e) => setStatus(e.target.value)}
							>
								<option value="draft">Draft</option>
								<option value="pending">Pending</option>
								<option value="active">Active</option>
								<option value="rejected">Rejected</option>
								<option value="suspended">Suspended</option>
							</select>
						</div>
					</div>
					<div className="mt-auto flex justify-end gap-2 border-border border-t pt-4">
						<button
							type="button"
							onClick={onCancel}
							className="rounded-lg border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{isPending
								? isEditing
									? "Saving..."
									: "Creating..."
								: isEditing
									? "Save Changes"
									: "Create Listing"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ── FbCollectionSheet ─────────────────────────────────────────────────────────

interface FbCollectionSheetProps {
	onSaved: () => void;
	onCancel: () => void;
	api: ReturnType<typeof useFacebookApi>;
}

function FbCollectionSheet({ onSaved, onCancel, api }: FbCollectionSheetProps) {
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onCancel]);
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const [name, setName] = useState("");
	const [productIds, setProductIds] = useState("");
	const [error, setError] = useState("");

	const createMutation = api.createCollection.useMutation({
		onSuccess: () => {
			void api.collections.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!name.trim()) {
			setError("Collection name is required.");
			return;
		}
		const ids = productIds
			.split(/[\n,]+/)
			.map((s) => s.trim())
			.filter(Boolean);
		createMutation.mutate({
			body: { name: name.trim(), productIds: ids },
		});
	}

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<button
				type="button"
				className="absolute inset-0 cursor-default bg-black/40"
				aria-label="Close panel"
				onClick={onCancel}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-border border-l bg-background shadow-2xl"
			>
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						New Collection
					</h2>
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close"
					>
						✕
					</button>
				</div>
				<form
					onSubmit={handleSubmit}
					className="flex flex-1 flex-col gap-5 px-6 py-6"
				>
					{error ? (
						<div
							role="alert"
							className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
						>
							{error}
						</div>
					) : null}
					<div className="space-y-4">
						<div>
							<label htmlFor="fcs-name" className={labelCls}>
								Name <span className="text-destructive">*</span>
							</label>
							<input
								id="fcs-name"
								ref={firstInputRef}
								className={inputCls}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Summer Collection"
							/>
						</div>
						<div>
							<label htmlFor="fcs-products" className={labelCls}>
								Product IDs{" "}
								<span className="font-normal text-muted-foreground">
									(one per line or comma-separated)
								</span>
							</label>
							<textarea
								id="fcs-products"
								rows={4}
								className={inputCls}
								value={productIds}
								onChange={(e) => setProductIds(e.target.value)}
								placeholder={"prod_abc123\nprod_def456"}
							/>
						</div>
					</div>
					<div className="mt-auto flex justify-end gap-2 border-border border-t pt-4">
						<button
							type="button"
							onClick={onCancel}
							className="rounded-lg border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create Collection"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
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
						<span className="text-muted-foreground text-xs">Page ID</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.pageId}
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">Catalog ID</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.catalogId}
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">Access Token</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.accessToken}
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
						Action required
					</span>
				</div>
				<p className="break-words text-muted-foreground text-sm">
					{settings.error ??
						"Meta rejected the credentials. Verify the access token hasn't expired and the app still has access to the catalog."}
				</p>
				<p className="text-muted-foreground text-xs">
					Page access tokens expire or get revoked when an admin rotates app
					permissions. Regenerate a long-lived token from Meta Business Suite
					and update{" "}
					<code className="rounded bg-muted px-1">FACEBOOK_ACCESS_TOKEN</code>.
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
				<code className="rounded bg-muted px-1 text-xs">
					FACEBOOK_ACCESS_TOKEN
				</code>
				,{" "}
				<code className="rounded bg-muted px-1 text-xs">FACEBOOK_PAGE_ID</code>,{" "}
				<code className="rounded bg-muted px-1 text-xs">
					FACEBOOK_CATALOG_ID
				</code>
				, and{" "}
				<code className="rounded bg-muted px-1 text-xs">
					FACEBOOK_COMMERCE_ACCOUNT_ID
				</code>{" "}
				environment variables to connect your Facebook Shop.
			</p>
		</div>
	);
}

// ── Main component ───────────────────────────────────────────────────────────

export function FacebookShopAdmin() {
	const api = useFacebookApi();
	const [listingPage, setListingPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const [orderPage, setOrderPage] = useState(1);
	const [orderStatusFilter, setOrderStatusFilter] = useState("");
	const [activeTab, setActiveTab] = useState<
		"listings" | "orders" | "collections"
	>("listings");
	const [showCreateListing, setShowCreateListing] = useState(false);
	const [editListing, setEditListing] = useState<Listing | null>(null);
	const [showCreateCollection, setShowCreateCollection] = useState(false);

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

	const { data: collectionsData, isLoading: collectionsLoading } =
		api.collections.useQuery({}) as {
			data: { collections: Collection[] } | undefined;
			isLoading: boolean;
		};

	const syncMutation = api.syncProducts.useMutation() as {
		mutate: (params: Record<string, never>) => void;
		isPending: boolean;
	};

	const deleteListingMutation = api.deleteListing.useMutation({
		onSuccess: () => void api.listings.invalidate(),
	});

	const updateOrderStatusMutation = api.updateOrderStatus.useMutation({
		onSuccess: () => void api.orders.invalidate(),
	});

	const deleteCollectionMutation = api.deleteCollection.useMutation({
		onSuccess: () => void api.collections.invalidate(),
	});

	const handleSync = () => {
		syncMutation.mutate({});
		setTimeout(() => refetchListings(), 2000);
	};

	const stats = statsData?.stats;
	const listings = listingsData?.listings ?? [];
	const listingsTotal = listingsData?.total ?? 0;
	const orders = ordersData?.orders ?? [];
	const ordersTotal = ordersData?.total ?? 0;
	const collections = collectionsData?.collections ?? [];

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
			{showCreateListing ? (
				<FbListingSheet
					onSaved={() => setShowCreateListing(false)}
					onCancel={() => setShowCreateListing(false)}
					api={api}
				/>
			) : null}
			{editListing ? (
				<FbListingSheet
					listing={editListing}
					onSaved={() => setEditListing(null)}
					onCancel={() => setEditListing(null)}
					api={api}
				/>
			) : null}
			{showCreateCollection ? (
				<FbCollectionSheet
					onSaved={() => setShowCreateCollection(false)}
					onCancel={() => setShowCreateCollection(false)}
					api={api}
				/>
			) : null}
			<div>
				<h2 className="font-semibold text-foreground text-lg">Facebook Shop</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your Facebook Shop catalog, collections, and track orders from
					Meta Commerce.
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
				<button
					type="button"
					onClick={() => setActiveTab("collections")}
					className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
						activeTab === "collections"
							? "border-foreground text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					Collections
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
						<button
							type="button"
							onClick={() => setShowCreateListing(true)}
							className="rounded-md bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90"
						>
							Add Listing
						</button>
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
									: "Products will appear here once synced from your Facebook catalog."}
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
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Actions
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
												<td className="px-5 py-3">
													<div className="flex gap-1">
														<button
															type="button"
															onClick={() => setEditListing(listing)}
															className="rounded px-2 py-1 text-xs hover:bg-muted"
														>
															Edit
														</button>
														<button
															type="button"
															onClick={() => {
																if (
																	window.confirm(
																		`Delete listing "${listing.title}"?`,
																	)
																) {
																	deleteListingMutation.mutate({
																		params: { id: listing.id },
																	});
																}
															}}
															disabled={deleteListingMutation.isPending}
															className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
														>
															Delete
														</button>
													</div>
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
												{Array.from({ length: 5 }, (_, j) => (
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
									: "Orders from Facebook Shop will appear here."}
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
												Date
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Update Status
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
												<td className="px-5 py-3 text-muted-foreground">
													{formatDate(order.createdAt)}
												</td>
												<td className="px-5 py-3">
													<select
														value={order.status}
														onChange={(e) =>
															updateOrderStatusMutation.mutate({
																params: { id: order.id },
																body: {
																	status: e.target.value as
																		| "pending"
																		| "confirmed"
																		| "shipped"
																		| "delivered"
																		| "cancelled"
																		| "refunded",
																},
															})
														}
														disabled={updateOrderStatusMutation.isPending}
														className="rounded border border-border bg-background px-2 py-1 text-xs"
													>
														<option value="pending">Pending</option>
														<option value="confirmed">Confirmed</option>
														<option value="shipped">Shipped</option>
														<option value="delivered">Delivered</option>
														<option value="cancelled">Cancelled</option>
														<option value="refunded">Refunded</option>
													</select>
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

			{activeTab === "collections" && (
				<div>
					<div className="mb-4 flex justify-end">
						<button
							type="button"
							onClick={() => setShowCreateCollection(true)}
							className="rounded-md bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90"
						>
							Create Collection
						</button>
					</div>
					{collectionsLoading ? (
						<div className="space-y-3">
							{Array.from({ length: 3 }, (_, i) => (
								<Skeleton
									key={`collection-skeleton-${i}`}
									className="h-16 rounded-lg"
								/>
							))}
						</div>
					) : collections.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">
								No collections
							</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Product collections will appear here once created.
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{collections.map((collection) => (
								<div
									key={collection.id}
									className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4"
								>
									<div className="flex flex-col gap-0.5">
										<span className="font-medium text-foreground text-sm">
											{collection.name}
										</span>
										<span className="text-muted-foreground text-xs">
											{collection.productIds.length} products &middot; Created{" "}
											{formatDate(collection.createdAt)}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<span
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${
												collection.status === "active"
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{collection.status}
										</span>
										<button
											type="button"
											onClick={() => {
												if (
													window.confirm(
														`Delete collection "${collection.name}"?`,
													)
												) {
													deleteCollectionMutation.mutate({
														params: { id: collection.id },
													});
												}
											}}
											disabled={deleteCollectionMutation.isPending}
											className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
										>
											Delete
										</button>
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
