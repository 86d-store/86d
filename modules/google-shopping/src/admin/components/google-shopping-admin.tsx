"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsData {
	status: "connected" | "not_configured" | "error";
	error?: string;
	configured: boolean;
	merchantId: string | null;
	targetCountry: string;
	contentLanguage: string;
	apiKey: string | null;
}

interface ChannelStats {
	totalFeedItems: number;
	active: number;
	pending: number;
	disapproved: number;
	expiring: number;
	totalOrders: number;
	totalRevenue: number;
}

interface FeedItem {
	id: string;
	localProductId: string;
	googleProductId?: string;
	title: string;
	status: string;
	price: number;
	brand?: string;
	lastSyncedAt?: string;
	createdAt: string;
}

interface FeedSubmission {
	id: string;
	status: string;
	totalProducts: number;
	approvedProducts: number;
	disapprovedProducts: number;
	error?: string;
	submittedAt: string;
	completedAt?: string;
}

interface DiagnosticsData {
	statusBreakdown: Array<{ status: string; count: number }>;
	disapprovalReasons: Array<{ reason: string; count: number }>;
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

function formatDateTime(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

const FEED_STATUS_STYLES: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	disapproved: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	expiring:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const SUBMISSION_STATUS_STYLES: Record<string, string> = {
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// ── API hook ─────────────────────────────────────────────────────────────────

function useGoogleShoppingApi() {
	const client = useModuleClient();
	const mod = client.module("google-shopping");
	return {
		settings: mod.admin["/admin/google-shopping/settings"],
		stats: mod.admin["/admin/google-shopping/stats"],
		diagnostics: mod.admin["/admin/google-shopping/diagnostics"],
		feedItems: mod.admin["/admin/google-shopping/feed-items"],
		submitFeed: mod.admin["/admin/google-shopping/submit"],
		submissions: mod.admin["/admin/google-shopping/submissions"],
		orders: mod.admin["/admin/google-shopping/orders"],
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
						<span className="text-muted-foreground text-xs">Merchant ID</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.merchantId}
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">API Key</span>
						<span className="font-medium font-mono text-foreground text-sm">
							{settings.apiKey}
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<span className="text-muted-foreground text-xs">
							Target Country
						</span>
						<span className="font-medium text-foreground text-sm">
							{settings.targetCountry} / {settings.contentLanguage}
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
						"Google Merchant Center rejected the credentials. Verify the API key is valid and the Content API for Shopping is enabled on the project."}
				</p>
				<p className="text-muted-foreground text-xs">
					API keys can be revoked or scoped too narrowly. Issue a new key from
					the Google Cloud Console with Content API for Shopping access and
					update <code className="rounded bg-muted px-1">GOOGLE_API_KEY</code>.
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
					GOOGLE_MERCHANT_ID
				</code>{" "}
				and{" "}
				<code className="rounded bg-muted px-1 text-xs">GOOGLE_API_KEY</code>{" "}
				environment variables to connect your Google Merchant Center account.
			</p>
		</div>
	);
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: DiagnosticsData }) {
	if (
		diagnostics.statusBreakdown.length === 0 &&
		diagnostics.disapprovalReasons.length === 0
	) {
		return null;
	}

	return (
		<div className="flex flex-col gap-4">
			<h3 className="font-medium text-foreground text-sm">Feed Diagnostics</h3>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{diagnostics.statusBreakdown.length > 0 && (
					<div className="rounded-lg border border-border bg-card p-4">
						<h4 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Status Breakdown
						</h4>
						<div className="flex flex-col gap-2">
							{diagnostics.statusBreakdown.map((s) => (
								<div
									key={s.status}
									className="flex items-center justify-between"
								>
									<span className="text-foreground text-sm capitalize">
										{s.status}
									</span>
									<span className="font-medium text-foreground text-sm tabular-nums">
										{s.count}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
				{diagnostics.disapprovalReasons.length > 0 && (
					<div className="rounded-lg border border-border bg-card p-4">
						<h4 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Disapproval Reasons
						</h4>
						<div className="flex flex-col gap-2">
							{diagnostics.disapprovalReasons.map((r) => (
								<div
									key={r.reason}
									className="flex items-center justify-between gap-4"
								>
									<span className="text-foreground text-sm">{r.reason}</span>
									<span className="shrink-0 font-medium text-destructive text-sm tabular-nums">
										{r.count}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// ── Main component ───────────────────────────────────────────────────────────

export function GoogleShoppingAdmin() {
	const api = useGoogleShoppingApi();
	const [feedPage, setFeedPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const [activeTab, setActiveTab] = useState<"feed" | "orders">("feed");

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
		data: feedData,
		isLoading: feedLoading,
		refetch: refetchFeed,
	} = api.feedItems.useQuery({
		page: String(feedPage),
		limit: String(PAGE_SIZE),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { items: FeedItem[]; total: number } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const { data: diagnosticsData } = api.diagnostics.useQuery({}) as {
		data: { diagnostics: DiagnosticsData } | undefined;
		isLoading: boolean;
	};

	const { data: submissionsData } = api.submissions.useQuery({
		limit: "1",
	}) as {
		data: { submissions: FeedSubmission[] } | undefined;
		isLoading: boolean;
	};

	const { data: ordersData, isLoading: ordersLoading } = api.orders.useQuery({
		limit: String(PAGE_SIZE),
	}) as {
		data:
			| {
					orders: Array<{
						id: string;
						googleOrderId: string;
						status: string;
						total: number;
						createdAt: string;
					}>;
					total: number;
			  }
			| undefined;
		isLoading: boolean;
	};

	const submitMutation = api.submitFeed.useMutation() as {
		mutate: (params: Record<string, never>) => void;
		isPending: boolean;
	};

	const handleSubmitFeed = () => {
		submitMutation.mutate({});
		setTimeout(() => refetchFeed(), 2000);
	};

	const stats = statsData?.stats;
	const feedItems = feedData?.items ?? [];
	const feedTotal = feedData?.total ?? 0;
	const lastSubmission = submissionsData?.submissions?.[0];
	const orders = ordersData?.orders ?? [];

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
					Google Shopping
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your Google Merchant Center product feed, monitor approval
					status, and track orders.
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
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard
						label="Feed Items"
						value={String(stats.totalFeedItems)}
						detail={`${stats.active} active`}
					/>
					<StatCard
						label="Pending"
						value={String(stats.pending)}
						detail="Awaiting review"
					/>
					<StatCard
						label="Disapproved"
						value={String(stats.disapproved)}
						detail={
							stats.expiring > 0
								? `${stats.expiring} expiring`
								: "Check diagnostics"
						}
					/>
					<StatCard
						label="Revenue"
						value={formatCurrency(stats.totalRevenue)}
						detail={`${stats.totalOrders} orders`}
					/>
				</div>
			) : null}

			{/* Diagnostics */}
			{diagnosticsData?.diagnostics && (
				<DiagnosticsPanel diagnostics={diagnosticsData.diagnostics} />
			)}

			{/* Feed submission */}
			<div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
				<div className="flex flex-col gap-0.5">
					<span className="font-medium text-foreground text-sm">
						Feed Submission
					</span>
					{lastSubmission ? (
						<span className="text-muted-foreground text-xs">
							Last submitted {formatDateTime(lastSubmission.submittedAt)} —{" "}
							<span
								className={`font-medium ${
									SUBMISSION_STATUS_STYLES[lastSubmission.status]
										? lastSubmission.status === "completed"
											? "text-green-700 dark:text-green-400"
											: lastSubmission.status === "failed"
												? "text-red-700 dark:text-red-400"
												: ""
										: ""
								}`}
							>
								{lastSubmission.status}
							</span>
							{lastSubmission.status === "completed" &&
								` (${lastSubmission.approvedProducts}/${lastSubmission.totalProducts} approved)`}
							{lastSubmission.error && ` — ${lastSubmission.error}`}
						</span>
					) : (
						<span className="text-muted-foreground text-xs">
							No submissions yet
						</span>
					)}
				</div>
				<button
					type="button"
					disabled={
						submitMutation.isPending || settingsData?.status !== "connected"
					}
					onClick={handleSubmitFeed}
					className="rounded-md bg-foreground px-3.5 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
				>
					{submitMutation.isPending ? "Submitting..." : "Submit Feed"}
				</button>
			</div>

			{/* Tab bar */}
			<div className="flex gap-1 border-border border-b">
				<button
					type="button"
					onClick={() => setActiveTab("feed")}
					className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
						activeTab === "feed"
							? "border-foreground text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					Feed Items
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

			{/* Feed Items tab */}
			{activeTab === "feed" && (
				<div className="space-y-4">
					{/* Status filter */}
					<div className="flex items-center gap-2">
						<select
							value={statusFilter}
							onChange={(e) => {
								setStatusFilter(e.target.value);
								setFeedPage(1);
							}}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">All Statuses</option>
							<option value="active">Active</option>
							<option value="pending">Pending</option>
							<option value="disapproved">Disapproved</option>
							<option value="expiring">Expiring</option>
						</select>
					</div>

					{/* Feed items table */}
					{feedLoading ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<tbody className="divide-y divide-border">
										{Array.from({ length: 5 }, (_, i) => `skel-row-${i}`).map(
											(key) => (
												<tr key={key}>
													{Array.from(
														{ length: 4 },
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
					) : feedItems.length === 0 ? (
						<div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
							<p className="font-medium text-foreground text-sm">
								No feed items
							</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{statusFilter
									? "No items match the selected filter."
									: "Products will appear here once synced to Google Merchant Center."}
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
												Price
											</th>
											<th
												scope="col"
												className="px-5 py-2.5 font-medium text-muted-foreground"
											>
												Brand
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
										{feedItems.map((item) => (
											<tr key={item.id} className="hover:bg-muted/30">
												<td className="max-w-[240px] truncate px-5 py-3 text-foreground">
													{item.title}
												</td>
												<td className="px-5 py-3">
													<span
														className={`rounded-full px-2 py-0.5 font-medium text-xs ${FEED_STATUS_STYLES[item.status] ?? ""}`}
													>
														{item.status}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatCurrency(item.price)}
												</td>
												<td className="px-5 py-3 text-muted-foreground">
													{item.brand ?? "—"}
												</td>
												<td className="px-5 py-3 text-muted-foreground">
													{item.lastSyncedAt
														? formatDate(item.lastSyncedAt)
														: "Never"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Mobile list */}
							<div className="divide-y divide-border md:hidden">
								{feedItems.map((item) => (
									<div key={item.id} className="px-5 py-3">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-foreground text-sm">
													{item.title}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(item.price)}
												</p>
											</div>
											<span
												className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${FEED_STATUS_STYLES[item.status] ?? ""}`}
											>
												{item.status}
											</span>
										</div>
									</div>
								))}
							</div>

							{/* Pagination */}
							{feedTotal > PAGE_SIZE && (
								<div className="flex items-center justify-between border-border border-t px-5 py-3">
									<span className="text-muted-foreground text-sm">
										Page {feedPage}
									</span>
									<span className="space-x-2">
										<button
											type="button"
											onClick={() => setFeedPage((p) => Math.max(1, p - 1))}
											disabled={feedPage === 1}
											className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
										>
											Previous
										</button>
										<button
											type="button"
											onClick={() => setFeedPage((p) => p + 1)}
											disabled={feedItems.length < PAGE_SIZE}
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
				<div>
					{ordersLoading ? (
						<div className="rounded-lg border border-border bg-card">
							<div className="hidden md:block">
								<table className="w-full text-left text-sm">
									<tbody className="divide-y divide-border">
										{Array.from({ length: 5 }, (_, i) => `skel-row-${i}`).map(
											(key) => (
												<tr key={key}>
													{Array.from(
														{ length: 4 },
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
								Orders from Google Shopping will appear here.
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
												Google Order ID
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
												Created
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{orders.map((order) => (
											<tr key={order.id} className="hover:bg-muted/30">
												<td className="px-5 py-3 font-mono text-foreground text-xs">
													{order.googleOrderId}
												</td>
												<td className="px-5 py-3">
													<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs capitalize">
														{order.status}
													</span>
												</td>
												<td className="px-5 py-3 text-foreground tabular-nums">
													{formatCurrency(order.total)}
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
										<div className="flex items-start justify-between">
											<div>
												<p className="font-medium font-mono text-foreground text-sm">
													{order.googleOrderId}
												</p>
												<p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
													{formatCurrency(order.total)}
												</p>
											</div>
											<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs capitalize">
												{order.status}
											</span>
										</div>
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
