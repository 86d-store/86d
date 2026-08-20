"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import StoreCreditsDashboardTemplate from "./store-credits-dashboard.mdx";

interface CreditAccount {
	id: string;
	customerId: string;
	customerEmail?: string;
	balance: number;
	lifetimeCredited: number;
	lifetimeDebited: number;
	currency: string;
	status: "active" | "frozen" | "closed";
	createdAt: string;
	updatedAt: string;
}

interface CreditSummary {
	totalAccounts: number;
	totalOutstandingBalance: number;
	totalLifetimeCredited: number;
	totalLifetimeDebited: number;
}

type StatusFilter = "all" | "active" | "frozen" | "closed";

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Active", value: "active" },
	{ label: "Frozen", value: "frozen" },
	{ label: "Closed", value: "closed" },
];

const PAGE_SIZE = 25;

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(amount);
}

function StatusBadge({ status }: { status: CreditAccount["status"] }) {
	const styles: Record<CreditAccount["status"], string> = {
		active:
			"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
		frozen: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
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

function useStoreCreditApi() {
	const client = useModuleClient();
	return {
		listAccounts:
			client.module("store-credits").admin["/admin/store-credits/accounts"],
		summary:
			client.module("store-credits").admin["/admin/store-credits/summary"],
	};
}

export function StoreCreditsDashboard() {
	const api = useStoreCreditApi();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [skip, setSkip] = useState(0);

	const queryInput: Record<string, string> = {
		take: String(PAGE_SIZE),
		skip: String(skip),
	};
	if (statusFilter !== "all") queryInput.status = statusFilter;

	const {
		data: accountsData,
		isLoading: accountsLoading,
		isError: accountsError,
		refetch: refetchAccounts,
	} = api.listAccounts.useQuery(queryInput) as {
		data: { accounts: CreditAccount[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: summaryData, isLoading: summaryLoading } = api.summary.useQuery(
		{},
	) as {
		data: CreditSummary | undefined;
		isLoading: boolean;
	};

	if (accountsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load store credit accounts
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchAccounts()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const accounts = accountsData?.accounts ?? [];
	const summary = summaryData ?? null;

	const handleFilterChange = (filter: StatusFilter) => {
		setStatusFilter(filter);
		setSkip(0);
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
					Total Accounts
				</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{summary.totalAccounts}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Outstanding Balance
				</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{formatCurrency(summary.totalOutstandingBalance, "USD")}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Lifetime Credited
				</p>
				<p className="mt-1 font-semibold text-2xl text-emerald-600 dark:text-emerald-400">
					{formatCurrency(summary.totalLifetimeCredited, "USD")}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Lifetime Debited
				</p>
				<p className="mt-1 font-semibold text-2xl text-red-600 dark:text-red-400">
					{formatCurrency(summary.totalLifetimeDebited, "USD")}
				</p>
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
					No credit accounts found.
				</td>
			</tr>
		) : (
			accounts.map((account) => (
				<tr
					key={account.id}
					className="border-border border-b last:border-0 hover:bg-muted/20"
				>
					<td className="px-4 py-3 text-foreground text-sm">
						{account.customerEmail ?? `${account.customerId.slice(0, 8)}…`}
					</td>
					<td className="px-4 py-3 font-medium text-foreground">
						{formatCurrency(account.balance, account.currency)}
					</td>
					<td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">
						{formatCurrency(account.lifetimeCredited, account.currency)}
					</td>
					<td className="px-4 py-3 text-red-600 dark:text-red-400">
						{formatCurrency(account.lifetimeDebited, account.currency)}
					</td>
					<td className="px-4 py-3">
						<StatusBadge status={account.status} />
					</td>
					<td className="px-4 py-3 text-right">
						<a
							href={`/admin/store-credits/${account.customerId}`}
							className="rounded px-2 py-1 font-medium text-foreground text-xs hover:bg-muted"
						>
							Manage
						</a>
					</td>
				</tr>
			))
		);

	return (
		<StoreCreditsDashboardTemplate
			summaryCards={summaryCards}
			statusFilters={STATUS_FILTERS}
			statusFilter={statusFilter}
			onFilterChange={handleFilterChange}
			tableBody={tableBody}
			hasPrev={hasPrev}
			hasNext={hasNext}
			loading={accountsLoading}
			onPrevPage={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
			onNextPage={() => setSkip((s) => s + PAGE_SIZE)}
		/>
	);
}
