"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import PaymentsAdminTemplate from "./payments-admin.mdx";

interface PaymentIntent {
	id: string;
	providerIntentId?: string | null;
	customerId?: string | null;
	email?: string | null;
	amount: number;
	currency: string;
	status: string;
	orderId?: string | null;
	createdAt: string;
}

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

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

const INTENT_STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	succeeded:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	cancelled: "bg-muted text-muted-foreground",
	refunded:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const REFUND_STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	succeeded:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function usePaymentsAdminApi() {
	const client = useModuleClient();
	return {
		listIntents: client.module("payments").admin["/admin/payments"],
		getIntent: client.module("payments").admin["/admin/payments/:id"],
		refundIntent: client.module("payments").admin["/admin/payments/:id/refund"],
		listRefunds: client.module("payments").admin["/admin/payments/:id/refunds"],
	};
}

function RefundModal({
	intent,
	onClose,
	onSuccess,
}: {
	intent: PaymentIntent;
	onClose: () => void;
	onSuccess: () => void;
}) {
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const api = usePaymentsAdminApi();
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	const [error, setError] = useState("");

	const refundMutation = api.refundIntent.useMutation({
		onSuccess: () => {
			void api.listIntents.invalidate();
			onSuccess();
		},
		onError: () => {
			setError("Refund failed. Please try again.");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const body: Record<string, unknown> = { params: { id: intent.id } };
		if (reason) body.reason = reason;
		if (amount) {
			const parsed = Math.round(Number.parseFloat(amount) * 100);
			if (Number.isNaN(parsed) || parsed <= 0) {
				setError("Invalid amount");
				return;
			}
			body.amount = parsed;
		}
		refundMutation.mutate(body);
	};

	const maxAmount = intent.amount / 100;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
			>
				<div className="flex items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						Issue Refund
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="rounded-md p-1 text-muted-foreground hover:bg-muted"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>

				<div className="px-6 py-4">
					<div className="mb-4 rounded-lg bg-muted/50 p-3 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Intent ID</span>
							<span className="font-mono text-foreground text-xs">
								{intent.id.slice(0, 8)}&hellip;
							</span>
						</div>
						<div className="mt-1 flex justify-between">
							<span className="text-muted-foreground">Original amount</span>
							<span className="font-medium text-foreground">
								{formatPrice(intent.amount, intent.currency)}
							</span>
						</div>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label
								htmlFor="refund-amount"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Refund amount{" "}
								<span className="font-normal text-muted-foreground">
									(leave blank for full refund)
								</span>
							</label>
							<div className="relative">
								<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
									$
								</span>
								<input
									id="refund-amount"
									type="number"
									ref={firstInputRef}
									step="0.01"
									min="0.01"
									max={maxAmount}
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									placeholder={String(maxAmount.toFixed(2))}
									className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-7 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="refund-reason"
								className="mb-1 block font-medium text-foreground text-sm"
							>
								Reason{" "}
								<span className="font-normal text-muted-foreground">
									(optional)
								</span>
							</label>
							<input
								id="refund-reason"
								type="text"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								placeholder="e.g. customer request, duplicate charge"
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						{error && (
							<p className="rounded-md bg-red-50 px-3 py-2 text-red-600 text-sm dark:bg-red-900/20 dark:text-red-400">
								{error}
							</p>
						)}

						<div className="flex justify-end gap-2 pt-2">
							<button
								type="button"
								onClick={onClose}
								className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={refundMutation.isPending}
								className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
							>
								{refundMutation.isPending ? "Processing…" : "Issue refund"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}

function IntentsTab() {
	const api = usePaymentsAdminApi();
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const [refundTarget, setRefundTarget] = useState<PaymentIntent | null>(null);
	const pageSize = 20;

	const queryInput: Record<string, string> = {
		take: String(pageSize),
		skip: String((page - 1) * pageSize),
	};
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data,
		isLoading: loading,
		isError: intentsError,
		refetch: refetchIntents,
	} = api.listIntents.useQuery(queryInput) as {
		data: { intents: PaymentIntent[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (intentsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load payment intents
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchIntents()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const intents = data?.intents ?? [];
	const total = data?.total ?? intents.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const handleRefundSuccess = () => {
		setRefundTarget(null);
	};

	return (
		<>
			<div className="mb-4 flex flex-wrap gap-3">
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => {
						setStatusFilter(e.target.value);
						setPage(1);
					}}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">All statuses</option>
					<option value="pending">Pending</option>
					<option value="processing">Processing</option>
					<option value="succeeded">Succeeded</option>
					<option value="failed">Failed</option>
					<option value="cancelled">Cancelled</option>
					<option value="refunded">Refunded</option>
				</select>
			</div>

			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								ID
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Customer
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Status
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Amount
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Date
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{loading ? (
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={`skeleton-${i}`}>
									{Array.from({ length: 6 }).map((_, j) => (
										<td key={`skeleton-cell-${j}`} className="px-4 py-3">
											<div className="h-4 w-24 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : intents.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No payment intents found
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Payment intents will appear here once customers initiate
										checkout
									</p>
								</td>
							</tr>
						) : (
							intents.map((intent) => (
								<tr
									key={intent.id}
									className="transition-colors hover:bg-muted/30"
								>
									<td className="px-4 py-3">
										<span className="font-mono text-foreground text-xs">
											{intent.providerIntentId
												? `${intent.providerIntentId.slice(0, 16)}…`
												: `${intent.id.slice(0, 8)}…`}
										</span>
									</td>
									<td className="hidden px-4 py-3 text-foreground text-sm sm:table-cell">
										{intent.email ?? (
											<span className="text-muted-foreground">&mdash;</span>
										)}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${INTENT_STATUS_COLORS[intent.status] ?? "bg-muted text-muted-foreground"}`}
										>
											{intent.status}
										</span>
									</td>
									<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
										{formatPrice(intent.amount, intent.currency)}
									</td>
									<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
										{timeAgo(intent.createdAt)}
									</td>
									<td className="px-4 py-3 text-right">
										{intent.status === "succeeded" && (
											<button
												type="button"
												onClick={() => setRefundTarget(intent)}
												className="rounded-md px-2 py-1 font-medium text-destructive text-xs hover:bg-destructive/10"
											>
												Refund
											</button>
										)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="mt-4 flex items-center justify-center gap-2">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page === 1}
						className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
					>
						Previous
					</button>
					<span className="text-muted-foreground text-sm">
						Page {page} of {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page === totalPages}
						className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
					>
						Next
					</button>
				</div>
			)}

			{refundTarget && (
				<RefundModal
					intent={refundTarget}
					onClose={() => setRefundTarget(null)}
					onSuccess={handleRefundSuccess}
				/>
			)}
		</>
	);
}

function RefundsTab() {
	const api = usePaymentsAdminApi();

	const { data: intentsData, isLoading: loadingIntents } =
		api.listIntents.useQuery({ limit: "100" }) as {
			data: { intents: PaymentIntent[] } | undefined;
			isLoading: boolean;
		};

	const refundedIntents = (intentsData?.intents ?? []).filter(
		(i) => i.status === "refunded",
	);

	return (
		<div className="overflow-hidden rounded-lg border border-border bg-card">
			<table className="w-full">
				<thead>
					<tr className="border-border border-b bg-muted/50">
						<th
							scope="col"
							className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
						>
							Intent ID
						</th>
						<th
							scope="col"
							className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
						>
							Customer
						</th>
						<th
							scope="col"
							className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
						>
							Status
						</th>
						<th
							scope="col"
							className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
						>
							Amount
						</th>
						<th
							scope="col"
							className="hidden px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
						>
							Date
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{loadingIntents ? (
						Array.from({ length: 4 }).map((_, i) => (
							<tr key={`skeleton-${i}`}>
								{Array.from({ length: 5 }).map((_, j) => (
									<td key={`skeleton-cell-${j}`} className="px-4 py-3">
										<div className="h-4 w-24 animate-pulse rounded bg-muted" />
									</td>
								))}
							</tr>
						))
					) : refundedIntents.length === 0 ? (
						<tr>
							<td colSpan={5} className="px-4 py-12 text-center">
								<p className="font-medium text-foreground text-sm">
									No refunds issued
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Refunds will appear here after being processed
								</p>
							</td>
						</tr>
					) : (
						refundedIntents.map((intent) => (
							<tr
								key={intent.id}
								className="transition-colors hover:bg-muted/30"
							>
								<td className="px-4 py-3">
									<span className="font-mono text-foreground text-xs">
										{intent.providerIntentId
											? `${intent.providerIntentId.slice(0, 16)}…`
											: `${intent.id.slice(0, 8)}…`}
									</span>
								</td>
								<td className="hidden px-4 py-3 text-foreground text-sm sm:table-cell">
									{intent.email ?? (
										<span className="text-muted-foreground">&mdash;</span>
									)}
								</td>
								<td className="px-4 py-3">
									<span
										className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${REFUND_STATUS_COLORS.succeeded}`}
									>
										refunded
									</span>
								</td>
								<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
									{formatPrice(intent.amount, intent.currency)}
								</td>
								<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs lg:table-cell">
									{timeAgo(intent.createdAt)}
								</td>
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}

export function PaymentsAdmin() {
	const [tab, setTab] = useState<"intents" | "refunds">("intents");

	return (
		<PaymentsAdminTemplate
			tab={tab}
			onTabChange={setTab}
			tabContent={tab === "intents" ? <IntentsTab /> : <RefundsTab />}
		/>
	);
}
