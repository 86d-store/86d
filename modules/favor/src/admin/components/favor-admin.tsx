"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import FavorAdminTemplate from "./favor-admin.mdx";

interface DeliveryItem {
	id: string;
	orderId: string;
	status: string;
	fee: number;
	tip: number;
	runnerName?: string;
	trackingUrl?: string;
	createdAt: string;
}

interface ServiceAreaItem {
	id: string;
	name: string;
	isActive: boolean;
	zipCodes: string[];
	deliveryFee: number;
	estimatedMinutes: number;
}

interface FavorSettings {
	status: "configured" | "not_configured";
	configured: boolean;
	sandbox: boolean;
	apiKeyMasked: string | null;
	merchantIdMasked: string | null;
}

interface FavorStats {
	totalDeliveries: number;
	totalPending: number;
	totalCompleted: number;
	totalCancelled: number;
	totalFees: number;
	totalTips: number;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount / 100);
}

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	"en-route":
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	arrived:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-muted text-muted-foreground",
};

function useFavorAdminApi() {
	const client = useModuleClient();
	return {
		settings: client.module("favor").admin["/admin/favor/settings"],
		list: client.module("favor").admin["/admin/favor/deliveries"],
		updateStatus:
			client.module("favor").admin["/admin/favor/deliveries/:id/status"],
		areas: client.module("favor").admin["/admin/favor/service-areas"],
		stats: client.module("favor").admin["/admin/favor/stats"],
	};
}

export function FavorAdmin() {
	const api = useFavorAdminApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState("");
	const [activeTab, setActiveTab] = useState<"deliveries" | "areas">(
		"deliveries",
	);

	const { data: settingsData, isLoading: settingsLoading } =
		api.settings.useQuery({}) as {
			data: FavorSettings | undefined;
			isLoading: boolean;
		};

	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats: FavorStats } | undefined;
	};

	const {
		data: listData,
		isLoading: listLoading,
		isError: deliveriesError,
		refetch: refetchDeliveries,
	} = api.list.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { deliveries: DeliveryItem[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: areasData, isLoading: areasLoading } = api.areas.useQuery(
		{},
	) as {
		data: { areas: ServiceAreaItem[] } | undefined;
		isLoading: boolean;
	};

	if (deliveriesError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load deliveries
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchDeliveries()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const settings = settingsData;
	const stats = statsData?.stats;
	const deliveries = listData?.deliveries ?? [];
	const total = listData?.total ?? 0;
	const areas = areasData?.areas ?? [];

	// ── Connection status ───────────────────────────────────────────

	const connectionBadge = settingsLoading ? null : settings?.status ===
		"configured" ? (
		<span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
			<span className="h-1.5 w-1.5 rounded-full bg-current" />
			{settings.sandbox ? "Configured (sandbox)" : "Configured"}
		</span>
	) : (
		<span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground text-xs">
			<span className="h-1.5 w-1.5 rounded-full bg-current" />
			Not configured
		</span>
	);

	// ── Stats section ───────────────────────────────────────────────

	const statsSection = stats ? (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{[
				{ label: "Total", value: stats.totalDeliveries },
				{ label: "Pending", value: stats.totalPending },
				{ label: "Completed", value: stats.totalCompleted },
				{
					label: "Revenue",
					value: formatCurrency(stats.totalFees + stats.totalTips),
					isText: true,
				},
			].map(({ label, value, isText }) => (
				<div
					key={label}
					className="rounded-lg border border-border bg-card p-3"
				>
					<p className="text-muted-foreground text-xs">{label}</p>
					<p className="mt-0.5 font-semibold text-foreground text-lg">
						{isText ? value : String(value)}
					</p>
				</div>
			))}
		</div>
	) : null;

	// ── Credential info ─────────────────────────────────────────────

	const credentialRows =
		settings?.configured && settings.apiKeyMasked ? (
			<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
				<div className="rounded-md border border-border bg-muted/40 px-3 py-2">
					<p className="text-muted-foreground text-xs">API Key</p>
					<p className="mt-0.5 font-mono text-foreground text-sm">
						{settings.apiKeyMasked}
					</p>
				</div>
				{settings.merchantIdMasked && (
					<div className="rounded-md border border-border bg-muted/40 px-3 py-2">
						<p className="text-muted-foreground text-xs">Merchant ID</p>
						<p className="mt-0.5 font-mono text-foreground text-sm">
							{settings.merchantIdMasked}
						</p>
					</div>
				)}
			</div>
		) : !settings?.configured ? (
			<p className="mt-2 text-muted-foreground text-sm">
				Add your Favor API key and merchant ID to module options to enable
				integration. Favor delivery integration requires a business partnership
				with Favor.
			</p>
		) : null;

	// ── Deliveries skeleton ─────────────────────────────────────────

	const deliverySkeleton = (
		<div className="divide-y divide-border">
			{Array.from({ length: 5 }, (_, i) => `skel-${i}`).map((key) => (
				<div key={key} className="flex items-center gap-4 px-5 py-3">
					<div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
					<div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
					<div className="ml-auto h-3.5 w-12 animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	);

	// ── Deliveries table ────────────────────────────────────────────

	const tableContent =
		deliveries.length === 0 ? (
			<div className="px-5 py-8 text-center text-muted-foreground text-sm">
				No deliveries found.
			</div>
		) : (
			<>
				<div className="hidden md:block">
					<table className="w-full text-left text-sm">
						<thead className="border-border border-b bg-muted/50">
							<tr>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Order
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
									Fee
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Runner
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
							{deliveries.map((d) => (
								<tr key={d.id} className="hover:bg-muted/30">
									<td className="px-5 py-3 font-mono text-foreground text-xs">
										{d.orderId}
									</td>
									<td className="px-5 py-3">
										<span
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[d.status] ?? ""}`}
										>
											{d.status}
										</span>
									</td>
									<td className="px-5 py-3 text-foreground">
										{formatCurrency(d.fee)}
									</td>
									<td className="px-5 py-3 text-muted-foreground text-sm">
										{d.runnerName ?? "--"}
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{formatDate(d.createdAt)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="divide-y divide-border md:hidden">
					{deliveries.map((d) => (
						<div key={d.id} className="px-5 py-3">
							<div className="flex items-start justify-between">
								<div>
									<p className="font-medium font-mono text-foreground text-sm">
										{d.orderId}
									</p>
									<p className="mt-0.5 text-muted-foreground text-sm">
										{formatCurrency(d.fee)}
									</p>
								</div>
								<span
									className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[d.status] ?? ""}`}
								>
									{d.status}
								</span>
							</div>
						</div>
					))}
				</div>

				{total > PAGE_SIZE && (
					<div className="flex items-center justify-between border-border border-t px-5 py-3">
						<span className="text-muted-foreground text-sm">
							Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
						</span>
						<span className="space-x-2">
							<button
								type="button"
								onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
								disabled={skip === 0}
								className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
							>
								Previous
							</button>
							<button
								type="button"
								onClick={() => setSkip((s) => s + PAGE_SIZE)}
								disabled={skip + PAGE_SIZE >= total}
								className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
							>
								Next
							</button>
						</span>
					</div>
				)}
			</>
		);

	// ── Service areas table ─────────────────────────────────────────

	const areasContent = areasLoading ? (
		<div className="divide-y divide-border">
			{Array.from({ length: 3 }, (_, i) => `area-skel-${i}`).map((key) => (
				<div key={key} className="flex items-center gap-4 px-5 py-3">
					<div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
					<div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	) : areas.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No service areas configured.
		</div>
	) : (
		<table className="w-full text-left text-sm">
			<thead className="border-border border-b bg-muted/50">
				<tr>
					<th
						scope="col"
						className="px-5 py-2.5 font-medium text-muted-foreground"
					>
						Name
					</th>
					<th
						scope="col"
						className="px-5 py-2.5 font-medium text-muted-foreground"
					>
						Zip Codes
					</th>
					<th
						scope="col"
						className="px-5 py-2.5 font-medium text-muted-foreground"
					>
						Fee
					</th>
					<th
						scope="col"
						className="px-5 py-2.5 font-medium text-muted-foreground"
					>
						ETA
					</th>
					<th
						scope="col"
						className="px-5 py-2.5 font-medium text-muted-foreground"
					>
						Status
					</th>
				</tr>
			</thead>
			<tbody className="divide-y divide-border">
				{areas.map((a) => (
					<tr key={a.id} className="hover:bg-muted/30">
						<td className="px-5 py-3 font-medium text-foreground text-sm">
							{a.name}
						</td>
						<td className="px-5 py-3 text-muted-foreground text-sm">
							{(a.zipCodes ?? []).slice(0, 3).join(", ")}
							{(a.zipCodes?.length ?? 0) > 3
								? ` +${(a.zipCodes?.length ?? 0) - 3}`
								: ""}
						</td>
						<td className="px-5 py-3 text-foreground">
							{formatCurrency(a.deliveryFee)}
						</td>
						<td className="px-5 py-3 text-muted-foreground">
							{a.estimatedMinutes} min
						</td>
						<td className="px-5 py-3">
							<span
								className={`rounded-full px-2 py-0.5 font-medium text-xs ${a.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}
							>
								{a.isActive ? "Active" : "Inactive"}
							</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);

	return (
		<FavorAdminTemplate
			connectionBadge={connectionBadge}
			credentialRows={credentialRows}
			statsSection={statsSection}
			activeTab={activeTab}
			onTabChange={(t: "deliveries" | "areas") => setActiveTab(t)}
			statusFilter={statusFilter}
			onStatusFilterChange={(v: string) => {
				setStatusFilter(v);
				setSkip(0);
			}}
			listLoading={listLoading}
			deliverySkeleton={deliverySkeleton}
			tableContent={tableContent}
			areasContent={areasContent}
		/>
	);
}
