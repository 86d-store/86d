"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useEffect, useRef, useState } from "react";
import ToastAdminTemplate from "./toast-admin.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface ToastSettings {
	status: "connected" | "not_configured" | "error";
	error?: string;
	configured: boolean;
	sandbox: boolean;
	menuCount?: number;
	apiKeyMasked: string | null;
	restaurantGuidMasked: string | null;
}

interface SyncRecord {
	id: string;
	entityType: string;
	entityId: string;
	externalId: string;
	direction: string;
	status: string;
	error?: string;
	syncedAt?: string;
	createdAt: string;
}

interface MenuMapping {
	id: string;
	localProductId: string;
	externalMenuItemId: string;
	isActive: boolean;
	lastSyncedAt?: string;
	createdAt: string;
}

interface SyncStats {
	total: number;
	pending: number;
	synced: number;
	failed: number;
	byEntityType: Record<string, number>;
}

// ── API hook ─────────────────────────────────────────────────────────────────

function useToastAdminApi() {
	const client = useModuleClient();
	const mod = client.module("toast");
	return {
		getSettings: mod.admin["/admin/toast/settings"],
		listSyncRecords: mod.admin["/admin/toast/sync-records"],
		syncStats: mod.admin["/admin/toast/sync-stats"],
		listMenuMappings: mod.admin["/admin/toast/menu-mappings"],
		createMenuMapping: mod.admin["/admin/toast/menu-mappings/create"],
		deleteMenuMapping: mod.admin["/admin/toast/menu-mappings/:id/delete"],
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
	value: number;
	color: string;
}) {
	return (
		<div className="flex flex-col items-center rounded-lg border border-border bg-card p-4">
			<span className={`font-bold text-2xl ${color}`}>{value}</span>
			<span className="mt-1 text-muted-foreground text-xs">{label}</span>
		</div>
	);
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
	synced: {
		label: "synced",
		className:
			"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
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

function extractError(err: unknown, fallback: string): string {
	if (err instanceof Error) return err.message;
	return fallback;
}

// ── Main component ───────────────────────────────────────────────────────────

export function ToastAdmin() {
	const api = useToastAdminApi();

	// ── Settings ─────────────────────────────────────────────────────────
	const { data: settingsData, isLoading: settingsLoading } =
		api.getSettings.useQuery({}) as {
			data: ToastSettings | undefined;
			isLoading: boolean;
		};

	// ── Sync stats ───────────────────────────────────────────────────────
	const { data: statsData, isLoading: statsLoading } = api.syncStats.useQuery(
		{},
	) as {
		data: { stats: SyncStats } | undefined;
		isLoading: boolean;
	};

	// ── Sync records ─────────────────────────────────────────────────────
	const { data: recordsData, isLoading: recordsLoading } =
		api.listSyncRecords.useQuery({}) as {
			data: { records: SyncRecord[]; total: number } | undefined;
			isLoading: boolean;
		};

	// ── Menu mappings ────────────────────────────────────────────────────
	const { data: mappingsData, isLoading: mappingsLoading } =
		api.listMenuMappings.useQuery({}) as {
			data: { mappings: MenuMapping[]; total: number } | undefined;
			isLoading: boolean;
		};

	// ── Create mapping form ──────────────────────────────────────────────
	const mappingFirstInputRef = useRef<HTMLInputElement>(null);
	const [showCreateMapping, setShowCreateMapping] = useState(false);
	const [mappingForm, setMappingForm] = useState({
		localProductId: "",
		externalMenuItemId: "",
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const createMappingMutation = api.createMenuMapping.useMutation({
		onSuccess: () => {
			setShowCreateMapping(false);
			setMappingForm({ localProductId: "", externalMenuItemId: "" });
			void api.listMenuMappings.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create mapping"));
		},
		onSettled: () => {
			setSaving(false);
		},
	});

	useEffect(() => {
		if (!showCreateMapping) return;
		mappingFirstInputRef.current?.focus();
	}, [showCreateMapping]);
	useEffect(() => {
		if (!showCreateMapping) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowCreateMapping(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showCreateMapping]);

	const handleCreateMapping = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			setError(null);
			setSaving(true);
			createMappingMutation.mutate({
				localProductId: mappingForm.localProductId.trim(),
				externalMenuItemId: mappingForm.externalMenuItemId.trim(),
			});
		},
		[createMappingMutation, mappingForm],
	);

	// ── Delete mapping ───────────────────────────────────────────────────
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const deleteMappingMutation = api.deleteMenuMapping.useMutation({
		onSuccess: () => {
			void api.listMenuMappings.invalidate();
		},
		onSettled: () => {
			setDeletingId(null);
		},
	});

	const handleDelete = useCallback(
		(id: string) => {
			setDeletingId(id);
			deleteMappingMutation.mutate({ id });
		},
		[deleteMappingMutation],
	);

	// ── Loading skeleton ─────────────────────────────────────────────────
	if (settingsLoading) {
		return (
			<ToastAdminTemplate
				content={
					<div className="space-y-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={`skeleton-${i}`}
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
	const records = recordsData?.records ?? [];
	const mappings = mappingsData?.mappings ?? [];

	return (
		<ToastAdminTemplate
			content={
				<div className="space-y-6">
					{/* ── Connection settings ────────────────────────────── */}
					<SettingsCard label="Connection">
						<div className="divide-y divide-border">
							{(() => {
								const status = settings?.status ?? "not_configured";
								if (status === "connected") {
									return (
										<StatusRow
											label="Status"
											value="Connected"
											badge="connected"
											badgeClass="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										/>
									);
								}
								if (status === "error") {
									return (
										<StatusRow
											label="Status"
											value="Connection error"
											badge="error"
											badgeClass="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
										/>
									);
								}
								return (
									<StatusRow
										label="Status"
										value="Not configured"
										badge="inactive"
										badgeClass="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
									/>
								);
							})()}
							{settings?.apiKeyMasked && (
								<StatusRow
									label="API key"
									value={settings.apiKeyMasked}
									mono
									badge={settings.sandbox ? "sandbox" : "production"}
									badgeClass={
										settings.sandbox
											? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
											: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
									}
								/>
							)}
							{settings?.restaurantGuidMasked && (
								<StatusRow
									label="Restaurant GUID"
									value={settings.restaurantGuidMasked}
									mono
								/>
							)}
							{settings?.status === "connected" &&
								typeof settings.menuCount === "number" && (
									<StatusRow
										label="Menus synced"
										value={String(settings.menuCount)}
									/>
								)}
							<StatusRow
								label="Webhook endpoint"
								value="/api/store/toast/webhook"
								mono
							/>
						</div>

						{settings?.status === "error" && (
							<div
								data-testid="toast-status-error-details"
								className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-red-600 text-sm dark:text-red-400"
							>
								<p className="font-medium">
									Toast rejected the configured credentials.
								</p>
								{settings.error && (
									<p className="mt-1 font-mono text-xs opacity-90">
										{settings.error}
									</p>
								)}
								<p className="mt-2 text-muted-foreground text-xs">
									Menu and order sync is paused until the connection is
									repaired. Verify the API key is active and the restaurant GUID
									is correct, then reload this page.
								</p>
							</div>
						)}
						{settings?.status === "not_configured" && (
							<div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
								Add your Toast API key and restaurant GUID to the module
								configuration to enable POS integration.
							</div>
						)}
					</SettingsCard>

					{/* ── Sync stats ─────────────────────────────────────── */}
					<SettingsCard label="Sync overview">
						{statsLoading ? (
							<div className="grid grid-cols-4 gap-3">
								{Array.from({ length: 4 }).map((_, i) => (
									<div
										key={`stat-skel-${i}`}
										className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
									/>
								))}
							</div>
						) : stats && stats.total > 0 ? (
							<>
								<div className="grid grid-cols-4 gap-3">
									<StatBlock
										label="Total"
										value={stats.total}
										color="text-foreground"
									/>
									<StatBlock
										label="Synced"
										value={stats.synced}
										color="text-green-600 dark:text-green-400"
									/>
									<StatBlock
										label="Pending"
										value={stats.pending}
										color="text-yellow-600 dark:text-yellow-400"
									/>
									<StatBlock
										label="Failed"
										value={stats.failed}
										color="text-red-600 dark:text-red-400"
									/>
								</div>
								{Object.keys(stats.byEntityType).length > 0 && (
									<div className="mt-3 flex flex-wrap gap-2">
										{Object.entries(stats.byEntityType).map(([type, count]) => (
											<span
												key={type}
												className="rounded-md bg-muted px-2 py-1 font-mono text-muted-foreground text-xs"
											>
												{type}: {count}
											</span>
										))}
									</div>
								)}
							</>
						) : (
							<p className="text-muted-foreground text-sm">
								No sync activity yet. Sync records will appear here once Toast
								POS data starts flowing.
							</p>
						)}
					</SettingsCard>

					{/* ── Menu mappings ───────────────────────────────────── */}
					<SettingsCard label="Menu mappings">
						<div className="mb-3 flex items-center justify-between">
							<p className="text-muted-foreground text-xs">
								Map local products to Toast menu items for bidirectional sync.
							</p>
							<button
								type="button"
								onClick={() => setShowCreateMapping(true)}
								className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-xs transition-colors hover:bg-foreground/90"
							>
								Add mapping
							</button>
						</div>

						{mappingsLoading ? (
							<div className="space-y-2">
								{Array.from({ length: 3 }).map((_, i) => (
									<div
										key={`map-skel-${i}`}
										className="h-12 animate-pulse rounded-md border border-border bg-muted/30"
									/>
								))}
							</div>
						) : mappings.length === 0 ? (
							<p className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
								No menu mappings configured. Add a mapping to link a local
								product to a Toast menu item.
							</p>
						) : (
							<div className="space-y-2">
								{mappings.map((m) => (
									<div
										key={m.id}
										className="flex items-center justify-between rounded-md border border-border p-3"
									>
										<div className="flex flex-col gap-0.5">
											<div className="flex items-center gap-2">
												<span className="font-mono text-foreground text-xs">
													{m.localProductId}
												</span>
												<span className="text-muted-foreground text-xs">→</span>
												<span className="font-mono text-foreground text-xs">
													{m.externalMenuItemId}
												</span>
											</div>
											<span className="text-muted-foreground text-xs">
												{m.isActive ? "Active" : "Inactive"}
												{m.lastSyncedAt
													? ` · Last synced ${new Date(m.lastSyncedAt).toLocaleDateString()}`
													: " · Never synced"}
											</span>
										</div>
										<button
											type="button"
											onClick={() => handleDelete(m.id)}
											disabled={deletingId === m.id}
											className="rounded-md px-2 py-1 text-red-600 text-xs transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
										>
											{deletingId === m.id ? "Removing…" : "Remove"}
										</button>
									</div>
								))}
							</div>
						)}
					</SettingsCard>

					{/* ── Recent sync records ────────────────────────────── */}
					<SettingsCard label="Recent sync records">
						{recordsLoading ? (
							<div className="space-y-2">
								{Array.from({ length: 3 }).map((_, i) => (
									<div
										key={`rec-skel-${i}`}
										className="h-12 animate-pulse rounded-md border border-border bg-muted/30"
									/>
								))}
							</div>
						) : records.length === 0 ? (
							<p className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
								No sync records yet. Records will appear here when menu items,
								orders, or inventory are synced with Toast.
							</p>
						) : (
							<div className="space-y-2">
								{records.map((r) => {
									const badge = STATUS_BADGE[r.status] ?? {
										label: r.status,
										className: "bg-muted text-muted-foreground",
									};
									return (
										<div
											key={r.id}
											className="flex items-center justify-between rounded-md border border-border p-3"
										>
											<div className="flex flex-col gap-0.5">
												<div className="flex items-center gap-2">
													<span className="font-medium text-foreground text-sm">
														{r.entityType}
													</span>
													<span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
														{r.direction}
													</span>
												</div>
												{r.error && (
													<span className="text-red-600 text-xs dark:text-red-400">
														{r.error}
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

					{/* ── Supported webhook events ───────────────────────── */}
					<SettingsCard label="Supported webhook events">
						<div className="flex flex-wrap gap-2">
							{[
								"menu.item.created",
								"menu.item.updated",
								"order.created",
								"order.updated",
								"stock.updated",
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

					{/* ── Create mapping modal ───────────────────────────── */}
					{showCreateMapping && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
							<div
								role="dialog"
								aria-modal="true"
								className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
							>
								<h2 className="mb-4 font-semibold text-foreground text-lg">
									Add menu mapping
								</h2>
								{error && (
									<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300">
										{error}
									</p>
								)}
								<form onSubmit={handleCreateMapping} className="space-y-4">
									<div>
										<label
											htmlFor="toast-local-product"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Local product ID <span className="text-red-500">*</span>
										</label>
										<input
											ref={mappingFirstInputRef}
											id="toast-local-product"
											required
											value={mappingForm.localProductId}
											onChange={(e) =>
												setMappingForm((f) => ({
													...f,
													localProductId: e.target.value,
												}))
											}
											placeholder="e.g. prod_abc123"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="toast-external-item"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Toast menu item GUID{" "}
											<span className="text-red-500">*</span>
										</label>
										<input
											id="toast-external-item"
											required
											value={mappingForm.externalMenuItemId}
											onChange={(e) =>
												setMappingForm((f) => ({
													...f,
													externalMenuItemId: e.target.value,
												}))
											}
											placeholder="e.g. a1b2c3d4-e5f6-..."
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
									<div className="flex justify-end gap-3 pt-2">
										<button
											type="button"
											onClick={() => {
												setShowCreateMapping(false);
												setError(null);
											}}
											className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-muted"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving}
											className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm transition-colors hover:bg-foreground/90 disabled:opacity-50"
										>
											{saving ? "Creating…" : "Create mapping"}
										</button>
									</div>
								</form>
							</div>
						</div>
					)}
				</div>
			}
		/>
	);
}
