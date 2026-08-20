"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

// ── Types ────────────────────────────────────────────────────────────────────

interface InventoryHealth {
	totalSkus: number;
	lowStock: number;
	outOfStock: number;
	fbaCount: number;
	fbmCount: number;
}

interface InventorySync {
	id: string;
	status: string;
	totalSkus: number;
	updatedSkus: number;
	failedSkus: number;
	error?: string;
	startedAt: string;
	completedAt?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

const SYNC_STATUS_STYLES: Record<string, string> = {
	synced:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	syncing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// ── API hook ─────────────────────────────────────────────────────────────────

function useInventoryApi() {
	const client = useModuleClient();
	const mod = client.module("amazon");
	return {
		settings: mod.admin["/admin/amazon/settings"],
		health: mod.admin["/admin/amazon/inventory/health"],
		syncInventory: mod.admin["/admin/amazon/inventory/sync"],
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
	variant,
}: {
	label: string;
	value: string;
	detail?: string;
	variant?: "danger" | "warning" | "default";
}) {
	const valueColor =
		variant === "danger"
			? "text-red-600 dark:text-red-400"
			: variant === "warning"
				? "text-yellow-600 dark:text-yellow-400"
				: "text-foreground";

	return (
		<div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className={`font-semibold text-2xl tabular-nums ${valueColor}`}>
				{value}
			</span>
			{detail && (
				<span className="text-muted-foreground text-xs">{detail}</span>
			)}
		</div>
	);
}

// ── Main component ───────────────────────────────────────────────────────────

export function AmazonInventory() {
	const api = useInventoryApi();

	const { data: settingsData, isLoading: settingsLoading } =
		api.settings.useQuery({}) as {
			data: { status: "connected" | "not_configured" | "error" } | undefined;
			isLoading: boolean;
		};

	const {
		data: healthData,
		isLoading: healthLoading,
		refetch: refetchHealth,
	} = api.health.useQuery({}) as {
		data: { health: InventoryHealth } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const syncMutation = api.syncInventory.useMutation() as {
		mutate: (params: Record<string, never>) => void;
		isPending: boolean;
		data: { sync: InventorySync } | undefined;
	};

	const handleSync = () => {
		syncMutation.mutate({});
		setTimeout(() => refetchHealth(), 3000);
	};

	const health = healthData?.health;
	const lastSync = syncMutation.data?.sync;

	// ── Loading state ────────────────────────────────────────────────────────

	if (settingsLoading || healthLoading) {
		return (
			<div className="space-y-6 p-1">
				<Skeleton className="h-6 w-48" />
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
					{Array.from({ length: 5 }, (_, i) => (
						<Skeleton key={i} className="h-24 rounded-lg" />
					))}
				</div>
				<Skeleton className="h-32 w-full rounded-lg" />
			</div>
		);
	}

	// ── Main render ──────────────────────────────────────────────────────────

	return (
		<div className="space-y-8 p-1">
			{/* Header */}
			<div>
				<h2 className="font-semibold text-foreground text-lg">
					Amazon Inventory
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Monitor stock levels across FBA and FBM channels, and sync inventory
					from Amazon.
				</p>
			</div>

			{/* Health metrics */}
			{health ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
					<StatCard label="Total SKUs" value={String(health.totalSkus)} />
					<StatCard
						label="Out of Stock"
						value={String(health.outOfStock)}
						variant={health.outOfStock > 0 ? "danger" : "default"}
						detail={health.outOfStock > 0 ? "Needs attention" : "All stocked"}
					/>
					<StatCard
						label="Low Stock"
						value={String(health.lowStock)}
						variant={health.lowStock > 0 ? "warning" : "default"}
						detail="5 or fewer units"
					/>
					<StatCard
						label="FBA"
						value={String(health.fbaCount)}
						detail="Amazon fulfilled"
					/>
					<StatCard
						label="FBM"
						value={String(health.fbmCount)}
						detail="Merchant fulfilled"
					/>
				</div>
			) : (
				<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
					<p className="font-medium text-foreground text-sm">
						No inventory data
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Sync inventory from Amazon to view stock health metrics.
					</p>
				</div>
			)}

			{/* Sync panel */}
			<div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
				<div className="flex flex-col gap-0.5">
					<span className="font-medium text-foreground text-sm">
						Inventory Sync
					</span>
					{lastSync ? (
						<span className="text-muted-foreground text-xs">
							Last sync {formatDateTime(lastSync.startedAt)} —{" "}
							<span
								className={`font-medium ${
									lastSync.status === "synced"
										? "text-green-700 dark:text-green-400"
										: lastSync.status === "failed"
											? "text-red-700 dark:text-red-400"
											: ""
								}`}
							>
								{lastSync.status}
							</span>
							{lastSync.status === "synced" &&
								` (${lastSync.updatedSkus}/${lastSync.totalSkus} updated)`}
							{lastSync.failedSkus > 0 && ` — ${lastSync.failedSkus} failed`}
							{lastSync.error && ` — ${lastSync.error}`}
						</span>
					) : (
						<span className="text-muted-foreground text-xs">
							Pulls current stock quantities from Amazon SP-API
						</span>
					)}
				</div>
				<button
					type="button"
					disabled={
						syncMutation.isPending || settingsData?.status !== "connected"
					}
					onClick={handleSync}
					className="rounded-md bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
				>
					{syncMutation.isPending ? "Syncing..." : "Sync Inventory"}
				</button>
			</div>

			{/* Sync result details */}
			{lastSync && (
				<div className="rounded-lg border border-border bg-card p-5">
					<h3 className="mb-4 font-medium text-foreground text-sm">
						Last Sync Result
					</h3>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<div className="flex flex-col gap-0.5">
							<span className="text-muted-foreground text-xs">Status</span>
							<span
								className={`inline-flex w-fit rounded-full px-2 py-0.5 font-medium text-xs ${SYNC_STATUS_STYLES[lastSync.status] ?? ""}`}
							>
								{lastSync.status}
							</span>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-muted-foreground text-xs">Total SKUs</span>
							<span className="font-medium text-foreground text-sm tabular-nums">
								{lastSync.totalSkus}
							</span>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-muted-foreground text-xs">Updated</span>
							<span className="font-medium text-foreground text-sm tabular-nums">
								{lastSync.updatedSkus}
							</span>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-muted-foreground text-xs">Failed</span>
							<span
								className={`font-medium text-sm tabular-nums ${
									lastSync.failedSkus > 0
										? "text-red-600 dark:text-red-400"
										: "text-foreground"
								}`}
							>
								{lastSync.failedSkus}
							</span>
						</div>
					</div>
					{lastSync.completedAt && (
						<p className="mt-3 text-muted-foreground text-xs">
							Completed {formatDateTime(lastSync.completedAt)}
						</p>
					)}
					{lastSync.error && (
						<p className="mt-3 rounded bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
							{lastSync.error}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
