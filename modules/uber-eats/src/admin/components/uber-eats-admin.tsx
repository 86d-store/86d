"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useState } from "react";
import UberEatsAdminTemplate from "./uber-eats-admin.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface UberEatsSettings {
	status: "connected" | "not_configured" | "error";
	error?: string;
	missingScopes: string[];
	configured: boolean;
	clientIdMasked: string | null;
	clientSecretMasked: string | null;
	restaurantIdMasked: string | null;
	webhookUrl: string;
}

interface UberEatsOrder {
	id: string;
	externalOrderId: string;
	status: string;
	total: number;
	customerName?: string;
	orderType?: string;
	createdAt: string;
}

interface MenuSyncRecord {
	id: string;
	status: string;
	itemCount: number;
	error?: string;
	startedAt: string;
	completedAt?: string;
	createdAt: string;
}

interface OrderStats {
	total: number;
	pending: number;
	accepted: number;
	preparing: number;
	ready: number;
	delivered: number;
	cancelled: number;
	totalRevenue: number;
}

// ── API hook ─────────────────────────────────────────────────────────────────

function useUberEatsAdminApi() {
	const client = useModuleClient();
	const mod = client.module("uber-eats");
	return {
		getSettings: mod.admin["/admin/uber-eats/settings"],
		listOrders: mod.admin["/admin/uber-eats/orders"],
		orderStats: mod.admin["/admin/uber-eats/stats"],
		listMenuSyncs: mod.admin["/admin/uber-eats/menu-syncs"],
		syncMenu: mod.admin["/admin/uber-eats/menu-syncs/create"],
	};
}

// ── Reusable components ──────────────────────────────────────────────────────

function SettingsCard({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="rounded-lg border border-border bg-card p-5">
			<h3 className="mb-3 font-semibold text-foreground text-sm">{label}</h3>
			{children}
		</div>
	);
}

function StatusRow({
	label,
	value,
	mono,
	badge,
	badgeClass,
}: {
	label: string;
	value: string;
	mono?: boolean;
	badge?: string;
	badgeClass?: string;
}) {
	return (
		<div className="flex items-center justify-between py-2">
			<span className="text-muted-foreground text-sm">{label}</span>
			<div className="flex items-center gap-2">
				{badge && (
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${badgeClass ?? "bg-muted text-muted-foreground"}`}
					>
						{badge}
					</span>
				)}
				<span
					className={`text-foreground text-sm ${mono ? "font-mono text-xs" : ""}`}
				>
					{value}
				</span>
			</div>
		</div>
	);
}

function StatBlock({
	label,
	value,
	color,
}: {
	label: string;
	value: number | string;
	color: string;
}) {
	return (
		<div className="flex flex-col items-center rounded-lg border border-border bg-card p-4">
			<span className={`font-bold text-2xl ${color}`}>{value}</span>
			<span className="mt-1 text-muted-foreground text-xs">{label}</span>
		</div>
	);
}

const ORDER_STATUS_BADGE: Record<string, { label: string; className: string }> =
	{
		pending: {
			label: "pending",
			className:
				"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
		},
		accepted: {
			label: "accepted",
			className:
				"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
		},
		preparing: {
			label: "preparing",
			className:
				"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
		},
		ready: {
			label: "ready",
			className:
				"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		},
		"picked-up": {
			label: "picked up",
			className:
				"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
		},
		delivered: {
			label: "delivered",
			className:
				"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		},
		cancelled: {
			label: "cancelled",
			className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
		},
	};

const SYNC_STATUS_BADGE: Record<string, { label: string; className: string }> =
	{
		synced: {
			label: "synced",
			className:
				"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		},
		syncing: {
			label: "syncing",
			className:
				"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
		},
		pending: {
			label: "pending",
			className:
				"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
		},
		failed: {
			label: "failed",
			className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
		},
	};

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount);
}

// ── Main component ───────────────────────────────────────────────────────────

export function UberEatsAdmin() {
	const api = useUberEatsAdminApi();

	// ── Settings ─────────────────────────────────────────────────────────
	const { data: settingsData, isLoading: settingsLoading } =
		api.getSettings.useQuery({}) as {
			data: UberEatsSettings | undefined;
			isLoading: boolean;
		};

	// ── Order stats ──────────────────────────────────────────────────────
	const { data: statsData, isLoading: statsLoading } = api.orderStats.useQuery(
		{},
	) as {
		data: { stats: OrderStats } | undefined;
		isLoading: boolean;
	};

	// ── Orders ───────────────────────────────────────────────────────────
	const { data: ordersData, isLoading: ordersLoading } =
		api.listOrders.useQuery({}) as {
			data: { orders: UberEatsOrder[]; total: number } | undefined;
			isLoading: boolean;
		};

	// ── Menu syncs ───────────────────────────────────────────────────────
	const { data: syncsData, isLoading: syncsLoading } =
		api.listMenuSyncs.useQuery({}) as {
			data: { syncs: MenuSyncRecord[]; total: number } | undefined;
			isLoading: boolean;
		};

	// ── Sync menu action ─────────────────────────────────────────────────
	const [syncing, setSyncing] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);

	const syncMenuMutation = api.syncMenu.useMutation({
		onSuccess: () => {
			void api.listMenuSyncs.invalidate();
			void api.orderStats.invalidate();
		},
		onError: (err: Error) => {
			setSyncError(err.message);
		},
		onSettled: () => {
			setSyncing(false);
		},
	});

	const handleSyncMenu = useCallback(() => {
		setSyncError(null);
		setSyncing(true);
		syncMenuMutation.mutate({ itemCount: 0 });
	}, [syncMenuMutation]);

	// ── Loading skeleton ─────────────────────────────────────────────────
	if (settingsLoading) {
		return (
			<UberEatsAdminTemplate
				content={
					<div className="space-y-4">
						{(["k0", "k1", "k2", "k3"] as const).map((key) => (
							<div
								key={key}
								className="h-32 animate-pulse rounded-lg border border-border bg-muted/30"
							/>
						))}
					</div>
				}
			/>
		);
	}

	const settings = settingsData;
	const stats = statsData?.stats;
	const orders = ordersData?.orders ?? [];
	const syncs = syncsData?.syncs ?? [];

	return (
		<UberEatsAdminTemplate
			content={
				<div className="space-y-6">
					{/* ── Connection status ────────────────────────────── */}
					<SettingsCard label="Connection">
						<div className="divide-y divide-border">
							<StatusRow
								label="Status"
								value={
									settings?.status === "connected"
										? "Connected"
										: settings?.status === "error"
											? "Connection error"
											: "Not configured"
								}
								badge={
									settings?.status === "connected"
										? "active"
										: settings?.status === "error"
											? "error"
											: "inactive"
								}
								badgeClass={
									settings?.status === "connected"
										? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										: settings?.status === "error"
											? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
											: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
								}
							/>
							{settings?.clientIdMasked && (
								<StatusRow
									label="Client ID"
									value={settings.clientIdMasked}
									mono
								/>
							)}
							{settings?.clientSecretMasked && (
								<StatusRow
									label="Client secret"
									value={settings.clientSecretMasked}
									mono
								/>
							)}
							{settings?.restaurantIdMasked && (
								<StatusRow
									label="Restaurant ID"
									value={settings.restaurantIdMasked}
									mono
								/>
							)}
							<StatusRow
								label="Webhook endpoint"
								value={settings?.webhookUrl ?? "/api/uber-eats/webhook"}
								mono
							/>
						</div>

						{settings?.status === "error" && (
							<div className="mt-3 rounded-md bg-red-50 p-3 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300">
								<p className="break-words font-medium">
									{settings.error ??
										"Uber Eats rejected the supplied credentials."}
								</p>
								<p className="mt-1 text-xs opacity-80">
									Verify the client ID and secret in the Uber Developer Portal
									and that the application is authorized for this restaurant.
								</p>
							</div>
						)}

						{settings?.status === "connected" &&
							settings.missingScopes.length > 0 && (
								<div className="mt-3 rounded-md bg-amber-50 p-3 text-amber-800 text-sm dark:bg-amber-900/20 dark:text-amber-300">
									<p className="font-medium">Missing OAuth scopes</p>
									<p className="mt-1 text-xs opacity-80">
										Re-authorize the application to grant:{" "}
										{settings.missingScopes.join(", ")}
									</p>
								</div>
							)}

						{settings?.status === "not_configured" && (
							<div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
								Add your Uber Eats client ID, client secret, and restaurant ID
								to the module configuration to enable marketplace integration.
							</div>
						)}
					</SettingsCard>

					{/* ── Order stats ──────────────────────────────────── */}
					<SettingsCard label="Order overview">
						{statsLoading ? (
							<div className="grid grid-cols-4 gap-3">
								{(["k0", "k1", "k2", "k3"] as const).map((key) => (
									<div
										key={key}
										className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
									/>
								))}
							</div>
						) : stats && stats.total > 0 ? (
							<>
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
									<StatBlock
										label="Total orders"
										value={stats.total}
										color="text-foreground"
									/>
									<StatBlock
										label="Pending"
										value={stats.pending}
										color="text-yellow-600 dark:text-yellow-400"
									/>
									<StatBlock
										label="Delivered"
										value={stats.delivered}
										color="text-green-600 dark:text-green-400"
									/>
									<StatBlock
										label="Revenue"
										value={formatCurrency(stats.totalRevenue)}
										color="text-foreground"
									/>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{stats.accepted > 0 && (
										<span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700 text-xs dark:bg-blue-900/20 dark:text-blue-300">
											{stats.accepted} accepted
										</span>
									)}
									{stats.preparing > 0 && (
										<span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700 text-xs dark:bg-indigo-900/20 dark:text-indigo-300">
											{stats.preparing} preparing
										</span>
									)}
									{stats.ready > 0 && (
										<span className="rounded-md bg-green-50 px-2 py-1 text-green-700 text-xs dark:bg-green-900/20 dark:text-green-300">
											{stats.ready} ready
										</span>
									)}
									{stats.cancelled > 0 && (
										<span className="rounded-md bg-red-50 px-2 py-1 text-red-700 text-xs dark:bg-red-900/20 dark:text-red-300">
											{stats.cancelled} cancelled
										</span>
									)}
								</div>
							</>
						) : (
							<p className="text-muted-foreground text-sm">
								No orders yet. Orders will appear here once Uber Eats starts
								sending them.
							</p>
						)}
					</SettingsCard>

					{/* ── Recent orders ────────────────────────────────── */}
					<SettingsCard label="Recent orders">
						{ordersLoading ? (
							<div className="space-y-2">
								{(["k0", "k1", "k2"] as const).map((key) => (
									<div
										key={key}
										className="h-14 animate-pulse rounded-md border border-border bg-muted/30"
									/>
								))}
							</div>
						) : orders.length === 0 ? (
							<p className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
								No orders received yet. Orders from Uber Eats will appear here
								automatically via webhooks.
							</p>
						) : (
							<div className="space-y-2">
								{orders.map((o) => {
									const badge = ORDER_STATUS_BADGE[o.status] ?? {
										label: o.status,
										className: "bg-muted text-muted-foreground",
									};
									return (
										<div
											key={o.id}
											className="flex items-center justify-between rounded-md border border-border p-3"
										>
											<div className="flex flex-col gap-0.5">
												<div className="flex items-center gap-2">
													<span className="font-mono text-foreground text-sm">
														{o.externalOrderId}
													</span>
													{o.orderType && (
														<span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
															{o.orderType.replace(/_/g, " ").toLowerCase()}
														</span>
													)}
												</div>
												<span className="text-muted-foreground text-xs">
													{o.customerName ?? "Guest"}
													{" · "}
													{formatCurrency(o.total)}
													{" · "}
													{new Date(o.createdAt).toLocaleString()}
												</span>
											</div>
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${badge.className}`}
											>
												{badge.label}
											</span>
										</div>
									);
								})}
							</div>
						)}
					</SettingsCard>

					{/* ── Menu sync ────────────────────────────────────── */}
					<SettingsCard label="Menu sync">
						<div className="mb-3 flex items-center justify-between">
							<p className="text-muted-foreground text-xs">
								Sync your local menu to Uber Eats. This fetches the current menu
								state from the Uber Eats API.
							</p>
							<button
								type="button"
								onClick={handleSyncMenu}
								disabled={syncing || settings?.status !== "connected"}
								className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-xs transition-colors hover:bg-foreground/90 disabled:opacity-50"
							>
								{syncing ? "Syncing…" : "Sync now"}
							</button>
						</div>

						{syncError && (
							<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300">
								{syncError}
							</p>
						)}

						{syncsLoading ? (
							<div className="space-y-2">
								{(["k0", "k1"] as const).map((key) => (
									<div
										key={key}
										className="h-12 animate-pulse rounded-md border border-border bg-muted/30"
									/>
								))}
							</div>
						) : syncs.length === 0 ? (
							<p className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
								No menu syncs yet. Click "Sync now" to fetch menu data from Uber
								Eats.
							</p>
						) : (
							<div className="space-y-2">
								{syncs.map((s) => {
									const badge = SYNC_STATUS_BADGE[s.status] ?? {
										label: s.status,
										className: "bg-muted text-muted-foreground",
									};
									return (
										<div
											key={s.id}
											className="flex items-center justify-between rounded-md border border-border p-3"
										>
											<div className="flex flex-col gap-0.5">
												<div className="flex items-center gap-2">
													<span className="text-foreground text-sm">
														{s.itemCount} items
													</span>
													<span className="text-muted-foreground text-xs">
														{new Date(s.createdAt).toLocaleString()}
													</span>
												</div>
												{s.error && (
													<span className="text-red-600 text-xs dark:text-red-400">
														{s.error}
													</span>
												)}
											</div>
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${badge.className}`}
											>
												{badge.label}
											</span>
										</div>
									);
								})}
							</div>
						)}
					</SettingsCard>

					{/* ── Webhook events ───────────────────────────────── */}
					<SettingsCard label="Supported webhook events">
						<div className="flex flex-wrap gap-2">
							{[
								"orders.notification",
								"orders.cancel",
								"orders.failure",
								"orders.release",
								"orders.scheduled.notification",
								"store.provisioned",
								"store.deprovisioned",
								"store.status.changed",
							].map((event) => (
								<span
									key={event}
									className="rounded-md bg-muted px-2 py-1 font-mono text-muted-foreground text-xs"
								>
									{event}
								</span>
							))}
						</div>
					</SettingsCard>
				</div>
			}
		/>
	);
}
