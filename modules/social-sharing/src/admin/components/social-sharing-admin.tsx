"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import SocialSharingAdminTemplate from "./social-sharing-admin.mdx";

// ── Types ────────────────────────────────────────────────────────────────────

interface ShareEvent {
	id: string;
	targetType: string;
	targetId: string;
	network: string;
	url: string;
	referrer?: string | null;
	sessionId?: string | null;
	createdAt: string;
}

interface ShareSettings {
	id: string;
	enabledNetworks: string[];
	defaultMessage?: string | null;
	hashtags: string[];
	customTemplates: Record<string, string>;
	updatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const NETWORKS = [
	"twitter",
	"facebook",
	"pinterest",
	"linkedin",
	"whatsapp",
	"email",
	"copy-link",
] as const;

const TARGET_TYPES = [
	"product",
	"collection",
	"page",
	"blog-post",
	"custom",
] as const;

const NETWORK_COLORS: Record<string, string> = {
	twitter: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
	facebook: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	pinterest: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	linkedin: "bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300",
	whatsapp:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	email: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	"copy-link": "bg-muted text-muted-foreground",
};

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

// ── API Hook ─────────────────────────────────────────────────────────────────

function useSocialSharingAdminApi() {
	const client = useModuleClient();
	return {
		listShares: client.module("social-sharing").admin["/admin/social-sharing"],
		stats: client.module("social-sharing").admin["/admin/social-sharing/stats"],
		top: client.module("social-sharing").admin["/admin/social-sharing/top"],
		getSettings:
			client.module("social-sharing").admin["/admin/social-sharing/settings"],
		updateSettings:
			client.module("social-sharing").admin[
				"/admin/social-sharing/settings/update"
			],
	};
}

// ── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({
	onClose,
	onSaved,
}: {
	onClose: () => void;
	onSaved: () => void;
}) {
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);
	const api = useSocialSharingAdminApi();
	const [error, setError] = useState("");
	const [enabledNetworks, setEnabledNetworks] = useState<string[]>([]);
	const [defaultMessage, setDefaultMessage] = useState("");
	const [hashtags, setHashtags] = useState("");
	const [loaded, setLoaded] = useState(false);

	const { isLoading: settingsLoading } = api.getSettings.useQuery({}) as {
		data: { settings: ShareSettings | null } | undefined;
		isLoading: boolean;
	};

	// Load settings once
	const { data: settingsData } = api.getSettings.useQuery({}) as {
		data: { settings: ShareSettings | null } | undefined;
		isLoading: boolean;
	};
	if (settingsData && !loaded) {
		const s = settingsData.settings;
		if (s) {
			setEnabledNetworks(s.enabledNetworks);
			setDefaultMessage(s.defaultMessage ?? "");
			setHashtags(s.hashtags.join(", "));
		} else {
			setEnabledNetworks([...NETWORKS]);
		}
		setLoaded(true);
	}

	const saveMutation = api.updateSettings.useMutation({
		onSuccess: () => {
			void api.getSettings.invalidate();
			onSaved();
		},
		onError: (err: Error) => {
			setError(extractError(err));
		},
	});

	const toggleNetwork = (network: string) => {
		setEnabledNetworks((prev: string[]) =>
			prev.includes(network)
				? prev.filter((n: string) => n !== network)
				: [...prev, network],
		);
	};

	const handleSave = () => {
		setError("");
		const hashtagList = hashtags
			.split(",")
			.map((t: string) => t.trim())
			.filter(Boolean);
		saveMutation.mutate({
			enabledNetworks: enabledNetworks.join(","),
			defaultMessage: defaultMessage || "",
			hashtags: hashtagList.join(","),
		});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl"
			>
				<div className="px-6 py-5">
					<h2 className="font-semibold text-foreground text-lg">
						Share Settings
					</h2>

					{error && (
						<div
							role="alert"
							className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
						>
							{error}
						</div>
					)}

					{settingsLoading ? (
						<div className="mt-4 space-y-3">
							<div className="h-4 w-48 animate-pulse rounded bg-muted" />
							<div className="h-4 w-32 animate-pulse rounded bg-muted" />
						</div>
					) : (
						<div className="mt-4 space-y-5">
							<div>
								<span className="mb-2 block font-medium text-foreground text-sm">
									Enabled Networks
								</span>
								<div className="flex flex-wrap gap-2">
									{NETWORKS.map((network) => (
										<button
											key={network}
											type="button"
											onClick={() => toggleNetwork(network)}
											className={`rounded-full border px-3 py-1 text-sm transition-colors ${
												enabledNetworks.includes(network)
													? `${NETWORK_COLORS[network] ?? "bg-muted text-foreground"} border-transparent`
													: "border-border text-muted-foreground hover:bg-muted"
											}`}
										>
											{network}
										</button>
									))}
								</div>
							</div>

							<div>
								<label
									htmlFor="social-sharing-default-message"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Default Message
								</label>
								<input
									ref={firstInputRef}
									id="social-sharing-default-message"
									type="text"
									value={defaultMessage}
									onChange={(e) => setDefaultMessage(e.target.value)}
									placeholder="Check out this amazing product!"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>

							<div>
								<label
									htmlFor="social-sharing-hashtags"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Hashtags
								</label>
								<input
									id="social-sharing-hashtags"
									type="text"
									value={hashtags}
									onChange={(e) => setHashtags(e.target.value)}
									placeholder="shop, sale, trending"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
								<p className="mt-1 text-muted-foreground text-xs">
									Comma-separated list of hashtags (without #)
								</p>
							</div>
						</div>
					)}

					<div className="mt-6 flex justify-end gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={saveMutation.isPending}
							className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
						>
							{saveMutation.isPending ? "Saving..." : "Save Settings"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ── Main Component ───────────────────────────────────────────────────────────

export function SocialSharingAdmin() {
	const api = useSocialSharingAdminApi();
	const [page, setPage] = useState(1);
	const [targetTypeFilter, setTargetTypeFilter] = useState("");
	const [networkFilter, setNetworkFilter] = useState("");
	const [showSettings, setShowSettings] = useState(false);
	const pageSize = 20;

	// Stats
	const { data: statsData, isLoading: statsLoading } = api.stats.useQuery(
		{},
	) as {
		data: { stats: Record<string, number>; total: number } | undefined;
		isLoading: boolean;
	};

	// Top shared
	const topQuery: Record<string, string> = {};
	if (targetTypeFilter) topQuery.targetType = targetTypeFilter;
	const { data: topData, isLoading: topLoading } = api.top.useQuery(
		topQuery,
	) as {
		data:
			| {
					top: Array<{
						targetType: string;
						targetId: string;
						count: number;
					}>;
			  }
			| undefined;
		isLoading: boolean;
	};

	// Shares list
	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(pageSize),
	};
	if (targetTypeFilter) queryInput.targetType = targetTypeFilter;
	if (networkFilter) queryInput.network = networkFilter;

	const { data: sharesData, isLoading: sharesLoading } =
		api.listShares.useQuery(queryInput) as {
			data: { shares: ShareEvent[]; total: number } | undefined;
			isLoading: boolean;
		};

	const shares = sharesData?.shares ?? [];
	const total = sharesData?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const stats = statsData?.stats ?? {};
	const statsTotal = statsData?.total ?? 0;
	const topItems = topData?.top ?? [];

	// Stats section
	const statsContent = statsLoading ? (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{(["k0", "k1", "k2", "k3"] as const).map((key) => (
				<div key={key} className="rounded-lg border border-border bg-card p-4">
					<div className="h-3 w-16 animate-pulse rounded bg-muted" />
					<div className="mt-2 h-6 w-10 animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	) : (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="text-muted-foreground text-xs uppercase tracking-wide">
					Total Shares
				</p>
				<p className="mt-1 font-bold text-2xl text-foreground">{statsTotal}</p>
			</div>
			{Object.entries(stats)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 3)
				.map(([network, count]) => (
					<div
						key={network}
						className="rounded-lg border border-border bg-card p-4"
					>
						<p className="text-muted-foreground text-xs uppercase tracking-wide">
							{network}
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">{count}</p>
					</div>
				))}
		</div>
	);

	// Top shared content
	const topContent = topLoading ? (
		<div className="space-y-2">
			{(["k0", "k1", "k2"] as const).map((key) => (
				<div
					key={key}
					className="flex items-center justify-between rounded-md border border-border px-4 py-3"
				>
					<div className="h-4 w-32 animate-pulse rounded bg-muted" />
					<div className="h-4 w-10 animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	) : topItems.length === 0 ? (
		<p className="text-muted-foreground text-sm">No shared content yet.</p>
	) : (
		<div className="space-y-2">
			{topItems.slice(0, 5).map((item) => (
				<div
					key={`${item.targetType}-${item.targetId}`}
					className="flex items-center justify-between rounded-md border border-border px-4 py-3"
				>
					<div className="flex items-center gap-3">
						<span
							className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${NETWORK_COLORS["copy-link"]}`}
						>
							{item.targetType}
						</span>
						<span className="truncate text-foreground text-sm">
							{item.targetId}
						</span>
					</div>
					<span className="font-medium text-foreground text-sm">
						{item.count} shares
					</span>
				</div>
			))}
		</div>
	);

	// Table body
	const tableBody = sharesLoading ? (
		(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
			<tr key={key}>
				{(["k0", "k1", "k2", "k3", "k4", "k5"] as const).map((key) => (
					<td key={key} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : shares.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">
					No share events found
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Share events will appear here when visitors share content.
				</p>
			</td>
		</tr>
	) : (
		shares.map((share) => (
			<tr key={share.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3">
					<span
						className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${NETWORK_COLORS[share.network] ?? "bg-muted text-muted-foreground"}`}
					>
						{share.network}
					</span>
				</td>
				<td className="px-4 py-3">
					<span
						className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${NETWORK_COLORS["copy-link"]}`}
					>
						{share.targetType}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-foreground text-sm md:table-cell">
					<span className="truncate">{share.targetId}</span>
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm lg:table-cell">
					<span className="max-w-[200px] truncate">{share.url}</span>
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm xl:table-cell">
					{share.referrer || "\u2014"}
				</td>
				<td className="px-4 py-3 text-right text-muted-foreground text-xs">
					{timeAgo(share.createdAt)}
				</td>
			</tr>
		))
	);

	return (
		<SocialSharingAdminTemplate
			statsContent={statsContent}
			topContent={topContent}
			targetTypeFilter={targetTypeFilter}
			onTargetTypeFilterChange={(v: string) => {
				setTargetTypeFilter(v);
				setPage(1);
			}}
			networkFilter={networkFilter}
			onNetworkFilterChange={(v: string) => {
				setNetworkFilter(v);
				setPage(1);
			}}
			targetTypes={TARGET_TYPES}
			networks={NETWORKS}
			tableBody={tableBody}
			showPagination={totalPages > 1}
			page={page}
			totalPages={totalPages}
			total={total}
			onPrevPage={() => setPage((p: number) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p: number) => Math.min(totalPages, p + 1))}
			onOpenSettings={() => setShowSettings(true)}
			settingsModal={
				showSettings ? (
					<SettingsPanel
						onClose={() => setShowSettings(false)}
						onSaved={() => setShowSettings(false)}
					/>
				) : null
			}
		/>
	);
}
