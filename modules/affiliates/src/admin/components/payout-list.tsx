"use client";

import { useState } from "react";
import { formatCurrency, formatDate, useAffiliatesApi } from "./_shared";

interface Payout {
	id: string;
	affiliateId: string;
	amount: number;
	method: string;
	reference?: string;
	status: string;
	notes?: string;
	createdAt: string;
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

const PAYOUT_STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function PayoutList() {
	const api = useAffiliatesApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [payoutAffiliateId, setPayoutAffiliateId] = useState("");
	const [payoutAmount, setPayoutAmount] = useState(0);
	const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
	const [payoutNotes, setPayoutNotes] = useState("");
	const [error, setError] = useState("");

	const { data, isLoading } = api.listPayouts.useQuery({
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { payouts?: Payout[]; total?: number } | undefined;
		isLoading: boolean;
	};

	const createMutation = api.createPayout.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const completeMutation = api.completePayout.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const failMutation = api.failPayout.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const payouts = data?.payouts ?? [];

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!payoutAffiliateId.trim() || payoutAmount <= 0) {
			setError("Affiliate ID and a positive amount are required.");
			return;
		}
		try {
			await createMutation.mutateAsync({
				body: {
					affiliateId: payoutAffiliateId.trim(),
					amount: payoutAmount,
					method: payoutMethod,
					notes: payoutNotes.trim() || undefined,
				},
			});
			setPayoutAffiliateId("");
			setPayoutAmount(0);
			setPayoutMethod("bank_transfer");
			setPayoutNotes("");
			setShowCreate(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleComplete = async (id: string) => {
		try {
			await completeMutation.mutateAsync({
				params: { id },
				body: { id },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleFail = async (id: string) => {
		try {
			await failMutation.mutateAsync({
				params: { id },
				body: { id },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Payouts</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage affiliate payouts
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					{showCreate ? "Cancel" : "Create Payout"}
				</button>
			</div>

			{/* Create form */}
			{showCreate ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New Payout
					</h2>
					{error ? (
						<div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					) : null}
					<form onSubmit={handleCreate} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Affiliate ID
								</span>
								<input
									type="text"
									value={payoutAffiliateId}
									onChange={(e) => setPayoutAffiliateId(e.target.value)}
									placeholder="Affiliate ID"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Amount (cents)
								</span>
								<input
									type="number"
									value={payoutAmount}
									onChange={(e) =>
										setPayoutAmount(Number.parseInt(e.target.value, 10) || 0)
									}
									min={1}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Method</span>
								<select
									value={payoutMethod}
									onChange={(e) => setPayoutMethod(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								>
									<option value="bank_transfer">Bank Transfer</option>
									<option value="paypal">PayPal</option>
									<option value="store_credit">Store Credit</option>
									<option value="check">Check</option>
								</select>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Notes</span>
								<input
									type="text"
									value={payoutNotes}
									onChange={(e) => setPayoutNotes(e.target.value)}
									placeholder="Optional notes"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create Payout"}
						</button>
					</form>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All statuses</option>
					<option value="pending">Pending</option>
					<option value="processing">Processing</option>
					<option value="completed">Completed</option>
					<option value="failed">Failed</option>
				</select>
			</div>

			{/* Payout list */}
			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2", "k3"] as const).map((key) => (
						<div
							key={key}
							className="h-14 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : payouts.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">No payouts found.</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-border border-b bg-muted">
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Affiliate
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Amount
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Method
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Date
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{payouts.map((p) => (
								<tr key={p.id} className="transition-colors hover:bg-muted/50">
									<td className="px-4 py-2 font-mono text-foreground text-xs">
										{p.affiliateId.slice(0, 8)}...
									</td>
									<td className="px-4 py-2 text-foreground">
										{formatCurrency(p.amount)}
									</td>
									<td className="px-4 py-2 text-foreground text-xs">
										{p.method}
									</td>
									<td className="px-4 py-2">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${PAYOUT_STATUS_COLORS[p.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{p.status}
										</span>
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{formatDate(p.createdAt)}
									</td>
									<td className="px-4 py-2">
										{p.status === "pending" || p.status === "processing" ? (
											<div className="flex gap-1">
												<button
													type="button"
													onClick={() => handleComplete(p.id)}
													className="rounded px-2 py-1 text-green-700 text-xs hover:bg-green-50 dark:hover:bg-green-900/20"
												>
													Complete
												</button>
												<button
													type="button"
													onClick={() => handleFail(p.id)}
													className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
												>
													Fail
												</button>
											</div>
										) : null}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
