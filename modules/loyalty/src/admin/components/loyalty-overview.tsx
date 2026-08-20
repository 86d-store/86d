"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import LoyaltyOverviewTemplate from "./loyalty-overview.mdx";

interface LoyaltyAccount {
	id: string;
	customerId: string;
	balance: number;
	lifetimeEarned: number;
	lifetimeRedeemed: number;
	tier: "bronze" | "silver" | "gold" | "platinum";
	status: "active" | "suspended" | "closed";
	createdAt: string;
	updatedAt: string;
}

interface LoyaltySummary {
	totalAccounts: number;
	totalPointsOutstanding: number;
	totalLifetimeEarned: number;
	tierBreakdown: Array<{ tier: string; count: number }>;
}

type TierFilter = "all" | "bronze" | "silver" | "gold" | "platinum";
type StatusFilter = "all" | "active" | "suspended" | "closed";

const TIER_FILTERS: { label: string; value: TierFilter }[] = [
	{ label: "All Tiers", value: "all" },
	{ label: "Bronze", value: "bronze" },
	{ label: "Silver", value: "silver" },
	{ label: "Gold", value: "gold" },
	{ label: "Platinum", value: "platinum" },
];

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Active", value: "active" },
	{ label: "Suspended", value: "suspended" },
	{ label: "Closed", value: "closed" },
];

const TIER_COLORS: Record<string, string> = {
	bronze:
		"bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
	silver: "bg-muted/30 text-foreground/80 ",
	gold: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
	platinum:
		"bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

const PAGE_SIZE = 25;

function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function TierBadge({ tier }: { tier: string }) {
	return (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs capitalize ${TIER_COLORS[tier] ?? "bg-muted text-muted-foreground"}`}
		>
			{tier}
		</span>
	);
}

function StatusBadge({ status }: { status: LoyaltyAccount["status"] }) {
	const styles: Record<LoyaltyAccount["status"], string> = {
		active:
			"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
		suspended:
			"bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
		closed: "bg-muted/30 text-foreground/80 ",
	};

	return (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs capitalize ${styles[status]}`}
		>
			{status}
		</span>
	);
}

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

// ── Account actions (adjust, suspend, reactivate) ──────────────────────────

interface AccountActionsProps {
	account: LoyaltyAccount;
	onUpdated: () => void;
}

function AccountActions({ account, onUpdated }: AccountActionsProps) {
	const client = useModuleClient();
	const admin = client.module("loyalty").admin;

	const [open, setOpen] = useState(false);
	const [showAdjustForm, setShowAdjustForm] = useState(false);
	const [adjustPoints, setAdjustPoints] = useState("");
	const [adjustDesc, setAdjustDesc] = useState("");
	const [adjustError, setAdjustError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const adjustMutation = admin[
		"/admin/loyalty/accounts/:customerId/adjust"
	].useMutation({
		onSuccess: () => {
			setShowAdjustForm(false);
			setAdjustPoints("");
			setAdjustDesc("");
			setAdjustError("");
			onUpdated();
		},
		onError: (err: Error) => {
			setAdjustError(extractError(err, "Failed to adjust points"));
		},
		onSettled: () => setSubmitting(false),
	});

	const suspendMutation = admin[
		"/admin/loyalty/accounts/:customerId/suspend"
	].useMutation({
		onSuccess: onUpdated,
	});

	const reactivateMutation = admin[
		"/admin/loyalty/accounts/:customerId/reactivate"
	].useMutation({
		onSuccess: onUpdated,
	});

	// Close dropdown when clicking outside
	useEffect(() => {
		if (!open) return;
		function handler(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	function handleAdjustSubmit(e: React.FormEvent) {
		e.preventDefault();
		const pts = Number.parseInt(adjustPoints, 10);
		if (!Number.isInteger(pts) || pts === 0) {
			setAdjustError("Enter a non-zero integer (negative to deduct).");
			return;
		}
		if (!adjustDesc.trim()) {
			setAdjustError("Description is required.");
			return;
		}
		setAdjustError("");
		setSubmitting(true);
		adjustMutation.mutate({
			params: { customerId: account.customerId },
			body: { points: pts, description: adjustDesc.trim() },
		});
	}

	return (
		<div className="flex items-center justify-end gap-1">
			{/* Adjust Points button */}
			<button
				type="button"
				onClick={() => {
					setShowAdjustForm((v) => !v);
					setOpen(false);
				}}
				className="rounded px-2 py-1 font-medium text-foreground text-xs hover:bg-muted"
				aria-label="Adjust points"
			>
				Adjust Points
			</button>

			{/* Status action dropdown */}
			{account.status !== "closed" && (
				<div className="relative" ref={menuRef}>
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						className="rounded px-1.5 py-1 text-muted-foreground text-xs hover:bg-muted"
						aria-label="More actions"
					>
						···
					</button>
					{open && (
						<div className="absolute top-full right-0 z-10 mt-1 w-36 rounded-md border border-border bg-popover py-1 shadow-md">
							{account.status === "active" && (
								<button
									type="button"
									disabled={suspendMutation.isPending}
									className="w-full px-3 py-1.5 text-left text-amber-700 text-xs hover:bg-muted disabled:opacity-50 dark:text-amber-400"
									onClick={() => {
										setOpen(false);
										suspendMutation.mutate({
											params: { customerId: account.customerId },
											body: {},
										});
									}}
								>
									Suspend
								</button>
							)}
							{account.status === "suspended" && (
								<button
									type="button"
									disabled={reactivateMutation.isPending}
									className="w-full px-3 py-1.5 text-left text-emerald-700 text-xs hover:bg-muted disabled:opacity-50 dark:text-emerald-400"
									onClick={() => {
										setOpen(false);
										reactivateMutation.mutate({
											params: { customerId: account.customerId },
											body: {},
										});
									}}
								>
									Reactivate
								</button>
							)}
						</div>
					)}
				</div>
			)}

			{/* Inline adjust form — shown below the row via a portal-like overlay */}
			{showAdjustForm && (
				<div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
					<form
						role="dialog"
						aria-modal="true"
						onSubmit={handleAdjustSubmit}
						className="w-80 rounded-lg border border-border bg-background p-5 shadow-lg"
					>
						<h3 className="mb-4 font-semibold text-foreground text-sm">
							Adjust Points
						</h3>
						<p className="mb-3 text-muted-foreground text-xs">
							Customer:{" "}
							<code className="rounded bg-muted px-1">
								{account.customerId}
							</code>
						</p>
						<label
							htmlFor="adjust-pts"
							className="mb-1 block font-medium text-foreground text-xs"
						>
							Points (positive to add, negative to deduct)
						</label>
						<input
							id="adjust-pts"
							type="number"
							value={adjustPoints}
							onChange={(e) => setAdjustPoints(e.target.value)}
							placeholder="e.g. 100 or -50"
							className="mb-3 w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
						<label
							htmlFor="adjust-desc"
							className="mb-1 block font-medium text-foreground text-xs"
						>
							Reason
						</label>
						<input
							id="adjust-desc"
							type="text"
							value={adjustDesc}
							onChange={(e) => setAdjustDesc(e.target.value)}
							placeholder="e.g. Goodwill gesture"
							className="mb-3 w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
						{adjustError && (
							<p className="mb-2 text-destructive text-xs">{adjustError}</p>
						)}
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setShowAdjustForm(false);
									setAdjustError("");
								}}
								className="rounded-md px-3 py-1.5 text-muted-foreground text-sm hover:bg-muted"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={submitting}
								className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
							>
								{submitting ? "Saving…" : "Apply"}
							</button>
						</div>
					</form>
				</div>
			)}
		</div>
	);
}

function useLoyaltyApi() {
	const client = useModuleClient();
	return {
		listAccounts: client.module("loyalty").admin["/admin/loyalty/accounts"],
		summary: client.module("loyalty").admin["/admin/loyalty/summary"],
	};
}

export function LoyaltyOverview() {
	const api = useLoyaltyApi();
	const [tierFilter, setTierFilter] = useState<TierFilter>("all");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [skip, setSkip] = useState(0);
	const [refreshKey, setRefreshKey] = useState(0);

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
		skip: String(skip),
	};
	if (tierFilter !== "all") queryInput.tier = tierFilter;
	if (statusFilter !== "all") queryInput.status = statusFilter;

	const {
		data: accountsData,
		isLoading: accountsLoading,
		refetch,
	} = api.listAccounts.useQuery({ ...queryInput, _r: String(refreshKey) }) as {
		data: { accounts: LoyaltyAccount[]; total: number } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const {
		data: summaryData,
		isLoading: summaryLoading,
		refetch: refetchSummary,
	} = api.summary.useQuery({ _r: String(refreshKey) }) as {
		data: LoyaltySummary | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const accounts = accountsData?.accounts ?? [];
	const summary = summaryData ?? null;

	const handleTierChange = (filter: TierFilter) => {
		setTierFilter(filter);
		setSkip(0);
	};

	const handleStatusChange = (filter: StatusFilter) => {
		setStatusFilter(filter);
		setSkip(0);
	};

	const handleAccountUpdated = () => {
		setRefreshKey((k) => k + 1);
		refetch();
		refetchSummary();
	};

	const hasPrev = skip > 0;
	const hasNext = accounts.length === PAGE_SIZE;

	const summaryCards = summaryLoading ? (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{[1, 2, 3, 4].map((i) => (
				<div key={i} className="rounded-lg border border-border bg-card p-4">
					<Skeleton className="mb-2 h-3 w-2/3" />
					<Skeleton className="h-7 w-1/2" />
				</div>
			))}
		</div>
	) : summary ? (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Total Members
				</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{formatNumber(summary.totalAccounts)}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Points Outstanding
				</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{formatNumber(summary.totalPointsOutstanding)}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Lifetime Earned
				</p>
				<p className="mt-1 font-semibold text-2xl text-emerald-600 dark:text-emerald-400">
					{formatNumber(summary.totalLifetimeEarned)}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Tier Breakdown
				</p>
				<div className="mt-1 flex flex-wrap gap-1.5">
					{summary.tierBreakdown.map((tb) => (
						<span key={tb.tier} className="text-foreground text-sm">
							<TierBadge tier={tb.tier} />{" "}
							<span className="text-muted-foreground">{tb.count}</span>
						</span>
					))}
					{summary.tierBreakdown.length === 0 && (
						<span className="text-muted-foreground text-sm">No members</span>
					)}
				</div>
			</div>
		</div>
	) : null;

	const tableBody =
		accountsLoading && accounts.length === 0 ? (
			Array.from({ length: 5 }, (_, i) => (
				<tr key={`sk-${i}`}>
					{Array.from({ length: 6 }, (_, j) => (
						<td key={`sk-cell-${j}`} className="px-4 py-3">
							<Skeleton className="h-4" />
						</td>
					))}
				</tr>
			))
		) : accounts.length === 0 ? (
			<tr>
				<td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
					No loyalty accounts found.
				</td>
			</tr>
		) : (
			accounts.map((account) => (
				<tr
					key={account.id}
					className="border-border border-b last:border-0 hover:bg-muted/20"
				>
					<td className="px-4 py-3">
						<code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
							{account.customerId}
						</code>
					</td>
					<td className="px-4 py-3 font-medium text-foreground">
						{formatNumber(account.balance)}
					</td>
					<td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">
						{formatNumber(account.lifetimeEarned)}
					</td>
					<td className="px-4 py-3">
						<TierBadge tier={account.tier} />
					</td>
					<td className="px-4 py-3">
						<StatusBadge status={account.status} />
					</td>
					<td className="px-4 py-3 text-right">
						<AccountActions
							account={account}
							onUpdated={handleAccountUpdated}
						/>
					</td>
				</tr>
			))
		);

	return (
		<LoyaltyOverviewTemplate
			summaryCards={summaryCards}
			tierFilters={TIER_FILTERS}
			tierFilter={tierFilter}
			onTierChange={handleTierChange}
			statusFilters={STATUS_FILTERS}
			statusFilter={statusFilter}
			onStatusChange={handleStatusChange}
			tableBody={tableBody}
			hasPrev={hasPrev}
			hasNext={hasNext}
			loading={accountsLoading}
			onPrevPage={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
			onNextPage={() => setSkip((s) => s + PAGE_SIZE)}
		/>
	);
}
