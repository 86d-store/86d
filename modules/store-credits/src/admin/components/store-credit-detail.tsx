"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import StoreCreditDetailTemplate from "./store-credit-detail.mdx";

interface CreditAccount {
	id: string;
	customerId: string;
	balance: number;
	lifetimeCredited: number;
	lifetimeDebited: number;
	currency: string;
	status: "active" | "frozen" | "closed";
	createdAt: string;
	updatedAt: string;
}

interface CreditTransaction {
	id: string;
	accountId: string;
	type: "credit" | "debit";
	amount: number;
	balanceAfter: number;
	reason: string;
	description: string;
	referenceType?: string;
	referenceId?: string;
	createdAt: string;
}

function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(amount);
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
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

function StatusBadge({ status }: { status: CreditAccount["status"] }) {
	const styles: Record<CreditAccount["status"], string> = {
		active:
			"bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
		frozen: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
		closed: "bg-muted/30 text-foreground/80 ",
	};

	return (
		<span
			className={`inline-block rounded-full px-2.5 py-0.5 font-medium text-xs capitalize ${styles[status]}`}
		>
			{status}
		</span>
	);
}

function TransactionTypeBadge({ type }: { type: "credit" | "debit" }) {
	return type === "credit" ? (
		<span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 text-xs dark:bg-emerald-950 dark:text-emerald-300">
			credit
		</span>
	) : (
		<span className="inline-block rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 text-xs dark:bg-red-950 dark:text-red-300">
			debit
		</span>
	);
}

export function StoreCreditDetail(props: {
	customerId?: string;
	params?: Record<string, string>;
}) {
	const customerId = props.customerId ?? props.params?.customerId ?? "";
	const client = useModuleClient();
	const api = {
		getAccount:
			client.module("store-credits").admin[
				"/admin/store-credits/accounts/:customerId"
			],
		adjustCredit:
			client.module("store-credits").admin[
				"/admin/store-credits/accounts/:customerId/adjust"
			],
		freezeAccount:
			client.module("store-credits").admin[
				"/admin/store-credits/accounts/:customerId/freeze"
			],
		unfreezeAccount:
			client.module("store-credits").admin[
				"/admin/store-credits/accounts/:customerId/unfreeze"
			],
	};

	const [error, setError] = useState("");
	const [actionLoading, setActionLoading] = useState(false);
	const [showAdjustForm, setShowAdjustForm] = useState(false);
	const [adjustAmount, setAdjustAmount] = useState("");
	const [adjustDescription, setAdjustDescription] = useState("");

	const {
		data: accountData,
		isLoading: loading,
		error: queryError,
	} = api.getAccount.useQuery({ params: { customerId } }) as {
		data:
			| { account: CreditAccount | null; transactions: CreditTransaction[] }
			| undefined;
		isLoading: boolean;
		error: Error | null;
	};

	const account = accountData?.account ?? null;
	const transactions = accountData?.transactions ?? [];

	const adjustMutation = api.adjustCredit.useMutation({
		onSuccess: () => {
			setShowAdjustForm(false);
			setAdjustAmount("");
			setAdjustDescription("");
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to adjust credit."));
		},
		onSettled: () => {
			setActionLoading(false);
			void api.getAccount.invalidate();
		},
	});

	const freezeMutation = api.freezeAccount.useMutation({
		onError: (err: Error) => {
			setError(extractError(err, "Failed to freeze account."));
		},
		onSettled: () => {
			setActionLoading(false);
			void api.getAccount.invalidate();
		},
	});

	const unfreezeMutation = api.unfreezeAccount.useMutation({
		onError: (err: Error) => {
			setError(extractError(err, "Failed to unfreeze account."));
		},
		onSettled: () => {
			setActionLoading(false);
			void api.getAccount.invalidate();
		},
	});

	const handleAdjust = () => {
		const amount = Number.parseFloat(adjustAmount);
		if (Number.isNaN(amount) || amount === 0) {
			setError("Enter a nonzero amount.");
			return;
		}
		if (!adjustDescription.trim()) {
			setError("Description is required.");
			return;
		}
		setActionLoading(true);
		setError("");
		adjustMutation.mutate({
			params: { customerId },
			body: { amount, description: adjustDescription.trim() },
		});
	};

	const handleFreeze = () => {
		setActionLoading(true);
		setError("");
		freezeMutation.mutate({ params: { customerId } });
	};

	const handleUnfreeze = () => {
		setActionLoading(true);
		setError("");
		unfreezeMutation.mutate({ params: { customerId } });
	};

	if (loading) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-muted-foreground text-sm">Loading account...</p>
			</div>
		);
	}

	if (queryError || !account) {
		return (
			<div className="rounded-xl border border-border bg-card p-6">
				<p className="text-destructive text-sm" role="alert">
					{queryError
						? "Failed to load account."
						: "No credit account found for this customer."}
				</p>
				<div className="mt-4">
					<a
						href="/admin/store-credits"
						className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
					>
						Back to Store Credits
					</a>
				</div>
			</div>
		);
	}

	const accountInfo = (
		<div className="space-y-5 rounded-xl border border-border bg-card p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h3 className="font-semibold text-foreground text-lg">
							Customer Credit Account
						</h3>
						<StatusBadge status={account.status} />
					</div>
					<p className="text-muted-foreground text-sm">
						<code className="rounded bg-muted px-1.5 py-0.5 text-xs">
							{account.customerId}
						</code>
					</p>
				</div>
				<p className="font-bold text-2xl text-foreground">
					{formatCurrency(account.balance, account.currency)}
				</p>
			</div>

			<div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-3">
				<div>
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Lifetime Credited
					</p>
					<p className="mt-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
						{formatCurrency(account.lifetimeCredited, account.currency)}
					</p>
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Lifetime Debited
					</p>
					<p className="mt-0.5 font-semibold text-red-600 dark:text-red-400">
						{formatCurrency(account.lifetimeDebited, account.currency)}
					</p>
				</div>
				<div>
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Created
					</p>
					<p className="mt-0.5 text-foreground text-sm">
						{formatDate(account.createdAt)}
					</p>
				</div>
			</div>

			{error && (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			)}

			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => setShowAdjustForm(!showAdjustForm)}
					className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
				>
					Adjust Balance
				</button>
				{account.status === "active" ? (
					<button
						type="button"
						disabled={actionLoading}
						onClick={handleFreeze}
						className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
					>
						{actionLoading ? "Freezing..." : "Freeze Account"}
					</button>
				) : account.status === "frozen" ? (
					<button
						type="button"
						disabled={actionLoading}
						onClick={handleUnfreeze}
						className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
					>
						{actionLoading ? "Unfreezing..." : "Unfreeze Account"}
					</button>
				) : null}
			</div>

			{showAdjustForm && (
				<div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="block">
							<span className="mb-1 block font-medium text-foreground text-sm">
								Amount
							</span>
							<input
								type="number"
								step="0.01"
								value={adjustAmount}
								onChange={(e) => setAdjustAmount(e.target.value)}
								placeholder="Positive to credit, negative to debit"
								className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block font-medium text-foreground text-sm">
								Description
							</span>
							<input
								type="text"
								value={adjustDescription}
								onChange={(e) => setAdjustDescription(e.target.value)}
								placeholder="Reason for adjustment"
								maxLength={1000}
								className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</label>
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							disabled={actionLoading}
							onClick={handleAdjust}
							className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{actionLoading ? "Adjusting..." : "Apply Adjustment"}
						</button>
						<button
							type="button"
							onClick={() => {
								setShowAdjustForm(false);
								setAdjustAmount("");
								setAdjustDescription("");
								setError("");
							}}
							className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);

	const transactionRows =
		transactions.length === 0 ? (
			<tr>
				<td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
					No transactions yet.
				</td>
			</tr>
		) : (
			transactions.map((tx) => (
				<tr
					key={tx.id}
					className="border-border border-b last:border-0 hover:bg-muted/20"
				>
					<td className="whitespace-nowrap px-4 py-3">
						<TransactionTypeBadge type={tx.type} />
					</td>
					<td
						className={`px-4 py-3 font-medium ${
							tx.type === "credit"
								? "text-emerald-600 dark:text-emerald-400"
								: "text-red-600 dark:text-red-400"
						}`}
					>
						{tx.type === "credit" ? "+" : "-"}
						{formatCurrency(tx.amount, account.currency)}
					</td>
					<td className="px-4 py-3 text-muted-foreground">
						{formatCurrency(tx.balanceAfter, account.currency)}
					</td>
					<td className="px-4 py-3">
						<span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
							{tx.reason.replace(/_/g, " ")}
						</span>
					</td>
					<td className="max-w-xs px-4 py-3">
						<p className="truncate text-foreground text-sm">{tx.description}</p>
					</td>
					<td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-sm">
						{formatDate(tx.createdAt)}
					</td>
				</tr>
			))
		);

	const content = (
		<div className="space-y-6">
			{accountInfo}

			<div className="space-y-4">
				<h3 className="font-medium text-foreground">Recent Transactions</h3>
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/40">
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Type
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Amount
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Balance After
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Reason
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Description
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground"
								>
									Date
								</th>
							</tr>
						</thead>
						<tbody>{transactionRows}</tbody>
					</table>
				</div>
			</div>

			<div>
				<a
					href="/admin/store-credits"
					className="rounded-lg border border-border px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted"
				>
					Back to Store Credits
				</a>
			</div>
		</div>
	);

	return <StoreCreditDetailTemplate content={content} />;
}
