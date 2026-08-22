"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsData {
	status: "connected" | "not_configured" | "error";
	error?: string;
	configured: boolean;
	username?: string;
	accountType?: "BUSINESS" | "PINNER";
	adAccountId: string | null;
	catalogId: string | null;
	accessToken: string | null;
}

interface ChannelStats {
	totalCatalogItems: number;
	activeCatalogItems: number;
	totalPins: number;
	totalImpressions: number;
	totalClicks: number;
	totalSaves: number;
}

interface CatalogItem {
	id: string;
	localProductId: string;
	pinterestItemId?: string;
	title: string;
	status: string;
	availability: string;
	price: number;
	salePrice?: number;
	link: string;
	imageUrl: string;
	lastSyncedAt?: string;
	error?: string;
	createdAt: string;
}

interface ShoppingPin {
	id: string;
	catalogItemId: string;
	pinId?: string;
	title: string;
	link: string;
	imageUrl: string;
	impressions: number;
	saves: number;
	clicks: number;
	createdAt: string;
}

interface CatalogSync {
	id: string;
	status: string;
	totalItems: number;
	syncedItems: number;
	failedItems: number;
	error?: string;
	startedAt: string;
	completedAt?: string;
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

const ITEM_STATUS_STYLES: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	inactive: "bg-muted text-muted-foreground",
	disapproved: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const AVAILABILITY_STYLES: Record<string, string> = {
	"in-stock":
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	"out-of-stock":
		"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	preorder: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const SYNC_STATUS_STYLES: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	syncing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	synced:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// ── API hook ─────────────────────────────────────────────────────────────────

function usePinterestShopApi() {
	const client = useModuleClient();
	const mod = client.module("pinterest-shop");
	return {
		settings: mod.admin["/admin/pinterest-shop/settings"],
		stats: mod.admin["/admin/pinterest-shop/stats"],
		items: mod.admin["/admin/pinterest-shop/items"],
		pins: mod.admin["/admin/pinterest-shop/pins"],
		syncs: mod.admin["/admin/pinterest-shop/syncs"],
		syncCatalog: mod.admin["/admin/pinterest-shop/sync"],
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
						{settings.accountType === "BUSINESS" ? "Business" : "Personal"}
					</span>
				</div>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{settings.username && (
						<div className="flex flex-col gap-0.5">
							<span className="text-muted-foreground text-xs">Account</span>
							<span className="font-medium font-mono text-foreground text-sm">
								@{settings.username}
							</span>
						</div>
					)}
					{settings.accessToken && (
						<div className="flex flex-col gap-0.5">
							<span className="text-muted-foreground text-xs">
								Access Token
							</span>
							<span className="font-medium font-mono text-foreground text-sm">
								{settings.accessToken}
							</span>
						</div>
					)}
					{settings.adAccountId && (
						<div className="flex flex-col gap-0.5">
							<span className="text-muted-foreground text-xs">
								Ad Account ID
							</span>
							<span className="font-medium font-mono text-foreground text-sm">
								{settings.adAccountId}
							</span>
						</div>
					)}
					{settings.catalogId && (
						<div className="flex flex-col gap-0.5">
							<span className="text-muted-foreground text-xs">Catalog ID</span>
							<span className="font-medium font-mono text-foreground text-sm">
								{settings.catalogId}
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
						Invalid
					</span>
				</div>
				<p className="break-words text-muted-foreground text-sm">
					{settings.error ??
						"Pinterest rejected the access token. Verify it hasn't expired and has the required scopes."}
				</p>
				<p className="text-muted-foreground text-xs">
					Access tokens expire after 30 days. Regenerate one from the Pinterest
					Developer portal and update{" "}
					<code className="rounded bg-muted px-1">PINTEREST_ACCESS_TOKEN</code>.
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
					PINTEREST_ACCESS_TOKEN
				</code>{" "}
				environment variable to connect your Pinterest account. Optionally set{" "}
				<code className="rounded bg-muted px-1 text-xs">
					PINTEREST_AD_ACCOUNT_ID
				</code>{" "}
				and{" "}
				<code className="rounded bg-muted px-1 text-xs">
					PINTEREST_CATALOG_ID
				</code>{" "}
				for advertising and catalog features.
			</p>
		</div>
	);
}

// ── Main component ───────────────────────────────────────────────────────────

export function PinterestShopAdmin() {
	const api = usePinterestShopApi();
	const [activeTab, setActiveTab] = useState<"items" | "pins" | "syncs">(
		"items",
	);
	const [itemPage, setItemPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const [availabilityFilter, setAvailabilityFilter] = useState("");
	const [pinPage, setPinPage] = useState(1);

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
		...(availabilityFilter ? { availability: availabilityFilter } : {}),
	}) as {
		data: { items: CatalogItem[]; total: number } | undefined;
		isLoading: boolean;
	};

	const { data: pinsData, isLoading: pinsLoading } = api.pins.useQuery({
		page: String(pinPage),
		limit: String(PAGE_SIZE),
	}) as {
		data: { pins: ShoppingPin[]; total: number } | undefined;
		isLoading: boolean;
	};

	const {
		data: syncsData,
		isLoading: syncsLoading,
		refetch: refetchSyncs,
	} = api.syncs.useQuery({}) as {
		data: { syncs: CatalogSync[] } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const syncMutation = api.syncCatalog.useMutation() as {
		mutate: (params: Record<string, never>) => void;
		isPending: boolean;
	};

	const handleSync = () => {
		syncMutation.mutate({});
		setTimeout(() => {
			refetchSyncs();
		}, 2000);
	};

	const stats = statsData?.stats;
	const items = itemsData?.items ?? [];
	const itemsTotal = itemsData?.total ?? 0;
	const pins = pinsData?.pins ?? [];
	const pinsTotal = pinsData?.total ?? 0;
	const syncs = syncsData?.syncs ?? [];

	// ── Loading state ────────────────────────────────────────────────────────

	if (settingsLoading) {
		return (
			<div className="space-y-6 p-1">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-28 w-full rounded-lg" />
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
					{Array.from({ length: 3 }, (_, _i) => (
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
					Pinterest Shop
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your Pinterest catalog, shopping pins, and sync status.
				</p>
			</div>

			{/* Connection status */}
			{settingsData && <ConnectionStatus settings={settingsData} />}

			{/* Stats */}
			{statsLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
					{Array.from({ length: 3 }, (_, _i) => (
						<Skeleton key={key} className="h-24 rounded-lg" />
					))}
				</div>
			) : stats ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
					<StatCard
						label="Catalog Items"
						value={String(stats.totalCatalogItems)}
						detail={`${stats.activeCatalogItems} active`}
					/>
					<StatCard
						label="Shopping Pins"
						value={String(stats.totalPins)}
						detail={`${formatNumber(stats.totalImpressions)} impressions`}
					/>
					<StatCard
						label="Engagement"
						value={formatNumber(stats.totalClicks)}
						detail={`${formatNumber(stats.totalSaves)} saves`}
					/>
				</div>
			) : null}

			{/* Tab bar */}
			<div className="flex gap-1 border-border border-b">
				{(["items", "pins", "syncs"] as const).map((tab) => (
					<button
						key={tab}
						type="button"
						onClick={() => setActiveTab(tab)}
						className={`border-b-2 px-4 py-2 font-medium text-sm capitalize transition-colors ${
							activeTab === tab
								? "border-foreground text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
					>
						{tab}
					</button>
				))}
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
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
							<option value="disapproved">Disapproved</option>
						</select>
						<select
							value={availabilityFilter}
							onChange={(e) => {
								setAvailabilityFilter(e.target.value);
								setItemPage(1);
							}}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">All Availability</option>
							<option value="in-stock">In Stock</option>
							<option value="out-of-stock">Out of Stock</option>
							<option value="preorder">Preorder</option>
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
							{syncMutation.isPending ? "Syncing..." : "Sync Catalog"}
						</button>
					</div>

					{/* Items table */}
					{itemsLoading ? (
						<div className="py-16 text-center">
							<Skeleton className="mx-auto h-8 w-8 rounded-full" />
							<p className="mt-4 text-muted-foreground text-sm">
								Loading items...
							</p>
						</div>
					) : items.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">No items</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{statusFilter || availabilityFilter
									? "No items match the selected filters."
									: "Items will appear here once added to the Pinterest catalog."}
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
												Status
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Availability
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
												Last Synced
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{items.map((item) => (
											<tr key={item.id} className="hover:bg-muted/30">
												<td className="max-w-[240px] truncate px-5 py-3 text-foreground">
													{item.title}
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${ITEM_STATUS_STYLES[item.status] ?? ""}`}
													>
														{item.status}
													</span>
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${AVAILABILITY_STYLES[item.availability] ?? ""}`}
													>
														{item.availability}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatCurrency(item.price)}
													{item.salePrice != null && (
														<span className="ml-1 text-muted-foreground text-xs line-through">
															{formatCurrency(item.salePrice)}
														</span>
													)}
												</td>
												<td className="px-5 py-3 text-muted-foreground">
													{item.lastSyncedAt
														? formatDate(item.lastSyncedAt)
														: "—"}
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
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(item.price)} &middot;{" "}
													{item.availability}
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

			{/* Pins tab */}
			{activeTab === "pins" && (
				<div className="space-y-4">
					{pinsLoading ? (
						<div className="py-16 text-center">
							<Skeleton className="mx-auto h-8 w-8 rounded-full" />
							<p className="mt-4 text-muted-foreground text-sm">
								Loading pins...
							</p>
						</div>
					) : pins.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">No pins</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Shopping pins will appear here once created from catalog items.
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
												Pin
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Impressions
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Clicks
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Saves
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Created
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{pins.map((pin) => (
											<tr key={pin.id} className="hover:bg-muted/30">
												<td className="max-w-[240px] truncate px-5 py-3 text-foreground">
													{pin.title}
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatNumber(pin.impressions)}
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatNumber(pin.clicks)}
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatNumber(pin.saves)}
												</td>
												<td className="px-5 py-3 text-muted-foreground">
													{formatDate(pin.createdAt)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							<div className="divide-y divide-border md:hidden">
								{pins.map((pin) => (
									<div key={pin.id} className="px-5 py-3">
										<p className="truncate font-medium text-foreground text-sm">
											{pin.title}
										</p>
										<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
											{formatNumber(pin.impressions)} impressions &middot;{" "}
											{formatNumber(pin.clicks)} clicks &middot;{" "}
											{formatNumber(pin.saves)} saves
										</p>
									</div>
								))}
							</div>

							{pinsTotal > PAGE_SIZE && (
								<div className="flex items-center justify-between border-border border-t px-5 py-3">
									<span className="text-muted-foreground text-sm">
										Page {pinPage}
									</span>
									<span className="space-x-2">
										<button
											type="button"
											onClick={() => setPinPage((p) => Math.max(1, p - 1))}
											disabled={pinPage === 1}
											className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
										>
											Previous
										</button>
										<button
											type="button"
											onClick={() => setPinPage((p) => p + 1)}
											disabled={pins.length < PAGE_SIZE}
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

			{/* Syncs tab */}
			{activeTab === "syncs" && (
				<div className="space-y-4">
					<div className="flex items-center justify-end">
						<button
							type="button"
							disabled={
								syncMutation.isPending || settingsData?.status !== "connected"
							}
							onClick={handleSync}
							className="rounded-md bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
						>
							{syncMutation.isPending ? "Syncing..." : "Sync Now"}
						</button>
					</div>

					{syncsLoading ? (
						<div className="py-16 text-center">
							<Skeleton className="mx-auto h-8 w-8 rounded-full" />
							<p className="mt-4 text-muted-foreground text-sm">
								Loading sync history...
							</p>
						</div>
					) : syncs.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">
								No syncs yet
							</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Sync your catalog to push items to Pinterest.
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
												Status
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Items
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Synced
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Failed
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Started
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{syncs.map((sync) => (
											<tr key={sync.id} className="hover:bg-muted/30">
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${SYNC_STATUS_STYLES[sync.status] ?? ""}`}
													>
														{sync.status}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{sync.totalItems}
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{sync.syncedItems}
												</td>
												<td className="px-5 py-3 tabular-nums">
													<span
														className={
															sync.failedItems > 0
																? "font-medium text-red-600 dark:text-red-400"
																: "text-foreground"
														}
													>
														{sync.failedItems}
													</span>
												</td>
												<td className="px-5 py-3 text-muted-foreground">
													{formatDate(sync.startedAt)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							<div className="divide-y divide-border md:hidden">
								{syncs.map((sync) => (
									<div key={sync.id} className="px-5 py-3">
										<div className="flex items-start justify-between gap-2">
											<div>
												<p className="text-muted-foreground text-sm">
													{formatDate(sync.startedAt)}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{sync.syncedItems}/{sync.totalItems} synced
													{sync.failedItems > 0 &&
														` · ${sync.failedItems} failed`}
												</p>
											</div>
											<span
												className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${SYNC_STATUS_STYLES[sync.status] ?? ""}`}
											>
												{sync.status}
											</span>
										</div>
										{sync.error && (
											<p className="mt-1 text-red-600 text-xs dark:text-red-400">
												{sync.error}
											</p>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
