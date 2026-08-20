"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useEffect, useRef, useState } from "react";
import DoorDashAdminTemplate from "./doordash-admin.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface DoordashSettings {
	status: "connected" | "not_configured" | "error";
	error?: string | undefined;
	accountName?: string | undefined;
	configured: boolean;
	apiConfigured: boolean;
	webhookConfigured: boolean;
	webhookStatus: "disabled";
	sandbox: boolean;
	developerIdMasked: string | null;
	keyIdMasked: string | null;
}

interface Delivery {
	id: string;
	orderId: string;
	status: string;
	fee: number;
	tip: number;
	driverName?: string;
	trackingUrl?: string;
	createdAt: string;
}

interface DeliveryZone {
	id: string;
	name: string;
	isActive: boolean;
	radius: number;
	centerLat: number;
	centerLng: number;
	minOrderAmount: number;
	deliveryFee: number;
	estimatedMinutes: number;
}

// ── API hook ─────────────────────────────────────────────────────────────────

function formatDeliveryDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleDateString();
}

function useDoordashAdminApi() {
	const client = useModuleClient();
	const mod = client.module("doordash");
	return {
		getSettings: mod.admin["/admin/doordash/settings"],
		listDeliveries: mod.admin["/admin/doordash/deliveries"],
		listZones: mod.admin["/admin/doordash/zones"],
		createZone: mod.admin["/admin/doordash/zones/create"],
		deleteZone: mod.admin["/admin/doordash/zones/:id/delete"],
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

const DELIVERY_STATUS_BADGE: Record<
	string,
	{ label: string; className: string }
> = {
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

function formatCurrency(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

// ── Main component ───────────────────────────────────────────────────────────

export function DoorDashAdmin() {
	const api = useDoordashAdminApi();

	// ── Settings ─────────────────────────────────────────────────────────
	const { data: settingsData, isLoading: settingsLoading } =
		api.getSettings.useQuery({}) as {
			data: DoordashSettings | undefined;
			isLoading: boolean;
		};

	// ── Deliveries ───────────────────────────────────────────────────────
	const { data: deliveriesData, isLoading: deliveriesLoading } =
		api.listDeliveries.useQuery({}) as {
			data: { deliveries: Delivery[]; total: number } | undefined;
			isLoading: boolean;
		};

	// ── Zones ────────────────────────────────────────────────────────────
	const { data: zonesData, isLoading: zonesLoading } = api.listZones.useQuery(
		{},
	) as {
		data: { zones: DeliveryZone[]; total: number } | undefined;
		isLoading: boolean;
	};

	// ── Create zone form ─────────────────────────────────────────────────
	const zoneNameRef = useRef<HTMLInputElement>(null);
	const [showCreateZone, setShowCreateZone] = useState(false);
	const [zoneForm, setZoneForm] = useState({
		name: "",
		radius: "5",
		centerLat: "0",
		centerLng: "0",
		minOrderAmount: "0",
		deliveryFee: "500",
		estimatedMinutes: "30",
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const createZoneMutation = api.createZone.useMutation({
		onSuccess: () => {
			setShowCreateZone(false);
			setZoneForm({
				name: "",
				radius: "5",
				centerLat: "0",
				centerLng: "0",
				minOrderAmount: "0",
				deliveryFee: "500",
				estimatedMinutes: "30",
			});
			void api.listZones.invalidate();
		},
		onError: (err: Error) => {
			setError(err.message);
		},
		onSettled: () => {
			setSaving(false);
		},
	});

	useEffect(() => {
		if (!showCreateZone) return;
		zoneNameRef.current?.focus();
	}, [showCreateZone]);
	useEffect(() => {
		if (!showCreateZone) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowCreateZone(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showCreateZone]);

	const handleCreateZone = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			setError(null);
			setSaving(true);
			createZoneMutation.mutate({
				name: zoneForm.name.trim(),
				radius: Number(zoneForm.radius),
				centerLat: Number(zoneForm.centerLat),
				centerLng: Number(zoneForm.centerLng),
				minOrderAmount: Number(zoneForm.minOrderAmount),
				deliveryFee: Number(zoneForm.deliveryFee),
				estimatedMinutes: Number(zoneForm.estimatedMinutes),
			});
		},
		[createZoneMutation, zoneForm],
	);

	// ── Delete zone ──────────────────────────────────────────────────────
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const deleteZoneMutation = api.deleteZone.useMutation({
		onSuccess: () => {
			void api.listZones.invalidate();
		},
		onSettled: () => {
			setDeletingId(null);
		},
	});

	const handleDeleteZone = useCallback(
		(id: string) => {
			setDeletingId(id);
			deleteZoneMutation.mutate({ id });
		},
		[deleteZoneMutation],
	);

	// ── Loading skeleton ─────────────────────────────────────────────────
	if (settingsLoading) {
		return (
			<DoorDashAdminTemplate>
				<div className="space-y-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={`skeleton-${i}`}
							className="h-32 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			</DoorDashAdminTemplate>
		);
	}

	const settings = settingsData;
	const deliveries = deliveriesData?.deliveries ?? [];
	const zones = zonesData?.zones ?? [];

	return (
		<DoorDashAdminTemplate>
			<div className="space-y-6">
				{/* ── Connection settings ────────────────────────────── */}
				<SettingsCard label="Connection">
					<div className="divide-y divide-border">
						<StatusRow
							label="Status"
							value={
								settings?.status === "connected"
									? (settings.accountName ?? "Connected")
									: settings?.status === "error"
										? "Error"
										: "Not configured"
							}
							badge={
								settings?.status === "connected"
									? "connected"
									: settings?.status === "error"
										? "error"
										: "inactive"
							}
							badgeClass={
								settings?.status === "connected"
									? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
									: settings?.status === "error"
										? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
										: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
							}
						/>
						{settings?.developerIdMasked && (
							<StatusRow
								label="Developer ID"
								value={settings.developerIdMasked}
								mono
								badge={settings.sandbox ? "sandbox" : "production"}
								badgeClass={
									settings.sandbox
										? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
										: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
								}
							/>
						)}
						{settings?.keyIdMasked && (
							<StatusRow label="Key ID" value={settings.keyIdMasked} mono />
						)}
						<StatusRow
							label="Webhook endpoint"
							value={
								settings?.webhookStatus === "disabled"
									? "Disabled"
									: "/api/store/doordash/webhook"
							}
							mono
						/>
					</div>

					{settings?.status === "error" && settings.error && (
						<div className="mt-3 rounded-md bg-red-50 p-3 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300">
							{settings.error}
						</div>
					)}

					{settings?.status === "not_configured" && (
						<div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
							Add your DoorDash developer ID, key ID, and signing secret to the
							module configuration to enable delivery integration.
						</div>
					)}
				</SettingsCard>

				{/* ── Delivery zones ─────────────────────────────────── */}
				<SettingsCard label="Delivery zones">
					<div className="mb-3 flex items-center justify-between">
						<p className="text-muted-foreground text-xs">
							Define geographic zones where DoorDash delivery is available.
						</p>
						<button
							type="button"
							onClick={() => setShowCreateZone(true)}
							className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-xs transition-colors hover:bg-foreground/90"
						>
							Add zone
						</button>
					</div>

					{zonesLoading ? (
						<div className="space-y-2">
							{Array.from({ length: 2 }).map((_, i) => (
								<div
									key={`zone-skel-${i}`}
									className="h-16 animate-pulse rounded-md border border-border bg-muted/30"
								/>
							))}
						</div>
					) : zones.length === 0 ? (
						<p className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
							No delivery zones configured. Add a zone to define where DoorDash
							deliveries are available.
						</p>
					) : (
						<div className="space-y-2">
							{zones.map((z) => (
								<div
									key={z.id}
									className="flex items-center justify-between rounded-md border border-border p-3"
								>
									<div className="flex flex-col gap-0.5">
										<div className="flex items-center gap-2">
											<span className="font-medium text-foreground text-sm">
												{z.name}
											</span>
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
													z.isActive
														? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
														: "bg-muted text-muted-foreground"
												}`}
											>
												{z.isActive ? "active" : "inactive"}
											</span>
										</div>
										<span className="text-muted-foreground text-xs">
											{z.radius} km radius · {formatCurrency(z.deliveryFee)} fee
											· ~{z.estimatedMinutes} min
											{z.minOrderAmount > 0
												? ` · Min order ${formatCurrency(z.minOrderAmount)}`
												: ""}
										</span>
									</div>
									<button
										type="button"
										onClick={() => handleDeleteZone(z.id)}
										disabled={deletingId === z.id}
										className="rounded-md px-2 py-1 text-red-600 text-xs transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
									>
										{deletingId === z.id ? "Removing…" : "Remove"}
									</button>
								</div>
							))}
						</div>
					)}
				</SettingsCard>

				{/* ── Deliveries ─────────────────────────────────────── */}
				<SettingsCard label="Recent deliveries">
					{deliveriesLoading ? (
						<div className="space-y-2">
							{Array.from({ length: 3 }).map((_, i) => (
								<div
									key={`del-skel-${i}`}
									className="h-14 animate-pulse rounded-md border border-border bg-muted/30"
								/>
							))}
						</div>
					) : deliveries.length === 0 ? (
						<p className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
							No deliveries yet. Deliveries will appear here when customers
							request DoorDash delivery at checkout.
						</p>
					) : (
						<div className="space-y-2">
							{deliveries.map((d) => {
								const badge = DELIVERY_STATUS_BADGE[d.status] ?? {
									label: d.status,
									className: "bg-muted text-muted-foreground",
								};
								return (
									<div
										key={d.id}
										className="flex items-center justify-between rounded-md border border-border p-3"
									>
										<div className="flex flex-col gap-0.5">
											<div className="flex items-center gap-2">
												<span className="font-medium text-foreground text-sm">
													Order {d.orderId}
												</span>
												{d.driverName && (
													<span className="text-muted-foreground text-xs">
														· {d.driverName}
													</span>
												)}
											</div>
											<span className="text-muted-foreground text-xs">
												{formatCurrency(d.fee)} fee
												{d.tip > 0 ? ` + ${formatCurrency(d.tip)} tip` : ""}
												{d.createdAt
													? ` · ${formatDeliveryDate(d.createdAt)}`
													: ""}
											</span>
										</div>
										<div className="flex items-center gap-2">
											{d.trackingUrl && (
												<a
													href={d.trackingUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-600 text-xs hover:underline dark:text-blue-400"
												>
													Track
												</a>
											)}
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${badge.className}`}
											>
												{badge.label}
											</span>
										</div>
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
							"doordash.delivery.created",
							"doordash.delivery.picked-up",
							"doordash.delivery.delivered",
							"doordash.delivery.cancelled",
							"doordash.webhook.received",
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

				{/* ── Create zone modal ──────────────────────────────── */}
				{showCreateZone && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
						<div
							role="dialog"
							aria-modal="true"
							className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
						>
							<h2 className="mb-4 font-semibold text-foreground text-lg">
								Add delivery zone
							</h2>
							{error && (
								<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300">
									{error}
								</p>
							)}
							<form onSubmit={handleCreateZone} className="space-y-4">
								<div>
									<label
										htmlFor="dd-zone-name"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										Zone name <span className="text-red-500">*</span>
									</label>
									<input
										ref={zoneNameRef}
										id="dd-zone-name"
										required
										value={zoneForm.name}
										onChange={(e) =>
											setZoneForm((f) => ({
												...f,
												name: e.target.value,
											}))
										}
										placeholder="e.g. Downtown"
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
									/>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label
											htmlFor="dd-zone-lat"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Center latitude
										</label>
										<input
											id="dd-zone-lat"
											type="number"
											step="any"
											value={zoneForm.centerLat}
											onChange={(e) =>
												setZoneForm((f) => ({
													...f,
													centerLat: e.target.value,
												}))
											}
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="dd-zone-lng"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Center longitude
										</label>
										<input
											id="dd-zone-lng"
											type="number"
											step="any"
											value={zoneForm.centerLng}
											onChange={(e) =>
												setZoneForm((f) => ({
													...f,
													centerLng: e.target.value,
												}))
											}
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
								</div>
								<div className="grid grid-cols-3 gap-3">
									<div>
										<label
											htmlFor="dd-zone-radius"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Radius (km)
										</label>
										<input
											id="dd-zone-radius"
											type="number"
											min="1"
											value={zoneForm.radius}
											onChange={(e) =>
												setZoneForm((f) => ({
													...f,
													radius: e.target.value,
												}))
											}
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="dd-zone-fee"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Fee (cents)
										</label>
										<input
											id="dd-zone-fee"
											type="number"
											min="0"
											value={zoneForm.deliveryFee}
											onChange={(e) =>
												setZoneForm((f) => ({
													...f,
													deliveryFee: e.target.value,
												}))
											}
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="dd-zone-time"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Est. minutes
										</label>
										<input
											id="dd-zone-time"
											type="number"
											min="1"
											value={zoneForm.estimatedMinutes}
											onChange={(e) =>
												setZoneForm((f) => ({
													...f,
													estimatedMinutes: e.target.value,
												}))
											}
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
								</div>
								<div>
									<label
										htmlFor="dd-zone-min"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										Min order amount (cents)
									</label>
									<input
										id="dd-zone-min"
										type="number"
										min="0"
										value={zoneForm.minOrderAmount}
										onChange={(e) =>
											setZoneForm((f) => ({
												...f,
												minOrderAmount: e.target.value,
											}))
										}
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
									/>
								</div>
								<div className="flex justify-end gap-3 pt-2">
									<button
										type="button"
										onClick={() => {
											setShowCreateZone(false);
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
										{saving ? "Creating…" : "Create zone"}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>
		</DoorDashAdminTemplate>
	);
}
