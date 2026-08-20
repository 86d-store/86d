"use client";

import { useState } from "react";
import {
	extractError,
	inputCls,
	labelCls,
	useVendorsApi,
	type Vendor,
} from "./_shared";

interface PayoutStats {
	totalPaid: number;
	totalPending: number;
	totalProcessing: number;
	payoutCount: number;
}

interface Payout {
	id: string;
	vendorId: string;
	amount: number;
	currency: string;
	status: string;
	method?: string;
	reference?: string;
	periodStart: string;
	periodEnd: string;
	notes?: string;
	createdAt: string;
}

function formatCurrency(amount: number, currency = "USD") {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(amount / 100);
}

const PAYOUT_SKELETON_IDS = ["a", "b", "c"] as const;

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
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

export function VendorPayouts() {
	const api = useVendorsApi();
	const [selectedVendorId, setSelectedVendorId] = useState("");
	const [showCreatePayout, setShowCreatePayout] = useState(false);
	const [payoutAmount, setPayoutAmount] = useState("");
	const [payoutCurrency, setPayoutCurrency] = useState("USD");
	const [payoutMethod, setPayoutMethod] = useState("");
	const [payoutReference, setPayoutReference] = useState("");
	const [payoutPeriodStart, setPayoutPeriodStart] = useState("");
	const [payoutPeriodEnd, setPayoutPeriodEnd] = useState("");
	const [payoutNotes, setPayoutNotes] = useState("");
	const [payoutError, setPayoutError] = useState("");

	const { data: statsData } = api.payoutStats.useQuery({}) as {
		data: { stats?: PayoutStats } | undefined;
	};

	const { data: vendorsData } = api.listVendors.useQuery({}) as {
		data: { vendors?: Vendor[] } | undefined;
	};

	const { data: payoutsData, isLoading: loadingPayouts } =
		api.vendorPayouts.useQuery(
			selectedVendorId
				? { vendorId: selectedVendorId }
				: { vendorId: "__skip__" },
			{ enabled: !!selectedVendorId },
		) as {
			data: { payouts?: Payout[]; total?: number } | undefined;
			isLoading: boolean;
		};

	const createPayoutMutation = api.createPayout.useMutation({
		onSuccess: () => {
			void api.vendorPayouts.invalidate();
			void api.payoutStats.invalidate();
			setShowCreatePayout(false);
			setPayoutAmount("");
			setPayoutReference("");
			setPayoutPeriodStart("");
			setPayoutPeriodEnd("");
			setPayoutNotes("");
			setPayoutError("");
		},
		onError: (err: Error) => setPayoutError(extractError(err)),
	});

	const updatePayoutStatusMutation = api.updatePayoutStatus.useMutation({
		onSuccess: () => {
			void api.vendorPayouts.invalidate();
			void api.payoutStats.invalidate();
		},
	});

	const stats = statsData?.stats;
	const vendors = vendorsData?.vendors ?? [];
	const payouts = payoutsData?.payouts ?? [];

	const handleCreatePayout = (e: React.FormEvent) => {
		e.preventDefault();
		setPayoutError("");
		if (!selectedVendorId) {
			setPayoutError("Select a vendor first.");
			return;
		}
		const amount = Math.round(Number.parseFloat(payoutAmount) * 100);
		if (Number.isNaN(amount) || amount <= 0) {
			setPayoutError("Enter a valid amount.");
			return;
		}
		if (!payoutPeriodStart || !payoutPeriodEnd) {
			setPayoutError("Period start and end dates are required.");
			return;
		}
		createPayoutMutation.mutate({
			params: { vendorId: selectedVendorId },
			body: {
				amount,
				currency: payoutCurrency,
				periodStart: new Date(payoutPeriodStart),
				periodEnd: new Date(payoutPeriodEnd),
				...(payoutMethod.trim() ? { method: payoutMethod.trim() } : {}),
				...(payoutReference.trim()
					? { reference: payoutReference.trim() }
					: {}),
				...(payoutNotes.trim() ? { notes: payoutNotes.trim() } : {}),
			},
		});
	};

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">Vendor Payouts</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Track and manage vendor payouts
				</p>
			</div>

			{/* Stats */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total Paid
						</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{formatCurrency(stats.totalPaid)}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Pending
						</p>
						<p className="mt-1 font-bold text-2xl text-yellow-600">
							{formatCurrency(stats.totalPending)}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Processing
						</p>
						<p className="mt-1 font-bold text-2xl text-blue-600">
							{formatCurrency(stats.totalProcessing)}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total Payouts
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.payoutCount}
						</p>
					</div>
				</div>
			) : null}

			{/* Vendor selector */}
			<div className="mb-5 flex flex-wrap items-center gap-3">
				<select
					value={selectedVendorId}
					onChange={(e) => {
						setSelectedVendorId(e.target.value);
						setShowCreatePayout(false);
					}}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
				>
					<option value="">Select a vendor…</option>
					{vendors.map((v) => (
						<option key={v.id} value={v.id}>
							{v.name}
						</option>
					))}
				</select>
				{selectedVendorId ? (
					<button
						type="button"
						onClick={() => setShowCreatePayout(!showCreatePayout)}
						className="rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90"
					>
						{showCreatePayout ? "Cancel" : "Create Payout"}
					</button>
				) : null}
			</div>

			{/* Create payout form */}
			{showCreatePayout && selectedVendorId ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New Payout
					</h2>
					{payoutError ? (
						<div
							role="alert"
							className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
						>
							{payoutError}
						</div>
					) : null}
					<form onSubmit={handleCreatePayout} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-3">
							<div>
								<label htmlFor="po-amount" className={labelCls}>
									Amount ($) <span className="text-destructive">*</span>
								</label>
								<input
									id="po-amount"
									type="number"
									step="0.01"
									min="0.01"
									className={inputCls}
									value={payoutAmount}
									onChange={(e) => setPayoutAmount(e.target.value)}
									placeholder="100.00"
								/>
							</div>
							<div>
								<label htmlFor="po-currency" className={labelCls}>
									Currency
								</label>
								<input
									id="po-currency"
									className={inputCls}
									value={payoutCurrency}
									onChange={(e) =>
										setPayoutCurrency(e.target.value.toUpperCase())
									}
									maxLength={3}
									placeholder="USD"
								/>
							</div>
							<div>
								<label htmlFor="po-method" className={labelCls}>
									Method
								</label>
								<input
									id="po-method"
									className={inputCls}
									value={payoutMethod}
									onChange={(e) => setPayoutMethod(e.target.value)}
									placeholder="bank_transfer"
								/>
							</div>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label htmlFor="po-start" className={labelCls}>
									Period start <span className="text-destructive">*</span>
								</label>
								<input
									id="po-start"
									type="date"
									className={inputCls}
									value={payoutPeriodStart}
									onChange={(e) => setPayoutPeriodStart(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="po-end" className={labelCls}>
									Period end <span className="text-destructive">*</span>
								</label>
								<input
									id="po-end"
									type="date"
									className={inputCls}
									value={payoutPeriodEnd}
									onChange={(e) => setPayoutPeriodEnd(e.target.value)}
								/>
							</div>
						</div>
						<div>
							<label htmlFor="po-reference" className={labelCls}>
								Reference
							</label>
							<input
								id="po-reference"
								className={inputCls}
								value={payoutReference}
								onChange={(e) => setPayoutReference(e.target.value)}
								placeholder="Transaction ID or check number"
							/>
						</div>
						<div>
							<label htmlFor="po-notes" className={labelCls}>
								Notes
							</label>
							<input
								id="po-notes"
								className={inputCls}
								value={payoutNotes}
								onChange={(e) => setPayoutNotes(e.target.value)}
								placeholder="Optional notes"
							/>
						</div>
						<button
							type="submit"
							disabled={createPayoutMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createPayoutMutation.isPending ? "Creating..." : "Create Payout"}
						</button>
					</form>
				</div>
			) : null}

			{/* Payout list */}
			{!selectedVendorId ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						Select a vendor above to view their payouts.
					</p>
				</div>
			) : loadingPayouts ? (
				<div className="space-y-2">
					{PAYOUT_SKELETON_IDS.map((id) => (
						<div
							key={`pay-skel-${id}`}
							className="h-12 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : payouts.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">No payouts yet.</p>
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
									Amount
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Period
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
									<td className="px-4 py-2 font-medium text-foreground">
										{formatCurrency(p.amount, p.currency)}
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{p.method ?? "—"}
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
										<select
											value={p.status}
											onChange={(e) =>
												updatePayoutStatusMutation.mutate({
													params: { id: p.id },
													body: {
														status: e.target.value as
															| "pending"
															| "processing"
															| "completed"
															| "failed",
													},
												})
											}
											disabled={updatePayoutStatusMutation.isPending}
											className="rounded border border-border bg-background px-2 py-1 text-xs"
										>
											<option value="pending">Pending</option>
											<option value="processing">Processing</option>
											<option value="completed">Completed</option>
											<option value="failed">Failed</option>
										</select>
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
