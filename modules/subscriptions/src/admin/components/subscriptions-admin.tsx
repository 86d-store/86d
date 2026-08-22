"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import SubscriptionsAdminTemplate from "./subscriptions-admin.mdx";

// ── Types ──────────────────────────────────────────────────────────────────

interface SubscriptionPlan {
	id: string;
	name: string;
	description?: string | null;
	price: number;
	currency: string;
	interval: string;
	intervalCount: number;
	trialDays?: number | null;
	isActive: boolean;
}

interface Subscription {
	id: string;
	planId: string;
	email: string;
	status: string;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	cancelAtPeriodEnd: boolean;
	createdAt: string;
}

interface PlanForm {
	name: string;
	description: string;
	price: string;
	currency: string;
	interval: string;
	intervalCount: string;
	trialDays: string;
	isActive: boolean;
}

const DEFAULT_PLAN: PlanForm = {
	name: "",
	description: "",
	price: "",
	currency: "USD",
	interval: "month",
	intervalCount: "1",
	trialDays: "",
	isActive: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function formatDate(dateStr: string): string {
	return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
		new Date(dateStr),
	);
}

function intervalLabel(interval: string, count: number): string {
	const suffix = count === 1 ? interval : `${count} ${interval}s`;
	return `/ ${suffix}`;
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

const STATUS_COLORS: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	trialing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	cancelled: "bg-muted text-muted-foreground",
	expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	past_due:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

// ── Hook ───────────────────────────────────────────────────────────────────

function useSubscriptionsAdminApi() {
	const client = useModuleClient();
	return {
		listSubscriptions:
			client.module("subscriptions").admin["/admin/subscriptions"],
		getSubscription:
			client.module("subscriptions").admin["/admin/subscriptions/:id"],
		cancelSubscription:
			client.module("subscriptions").admin["/admin/subscriptions/:id/cancel"],
		renewSubscription:
			client.module("subscriptions").admin["/admin/subscriptions/:id/renew"],
		listPlans:
			client.module("subscriptions").admin["/admin/subscriptions/plans"],
		createPlan:
			client.module("subscriptions").admin["/admin/subscriptions/plans/create"],
		updatePlan:
			client.module("subscriptions").admin[
				"/admin/subscriptions/plans/:id/update"
			],
		deletePlan:
			client.module("subscriptions").admin[
				"/admin/subscriptions/plans/:id/delete"
			],
	};
}

// ── Plans tab ──────────────────────────────────────────────────────────────

function PlansTab() {
	const api = useSubscriptionsAdminApi();
	const planNameRef = useRef<HTMLInputElement>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState<PlanForm>(DEFAULT_PLAN);
	const [error, setError] = useState("");

	const {
		data: plansData,
		isLoading: loading,
		isError: plansError,
		refetch: refetchPlans,
	} = api.listPlans.useQuery() as {
		data: { plans: SubscriptionPlan[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	const plans = plansData?.plans ?? [];

	useEffect(() => {
		if (!showCreate) return;
		planNameRef.current?.focus();
	}, [showCreate]);
	useEffect(() => {
		if (!showCreate) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowCreate(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showCreate]);

	const createPlanMutation = api.createPlan.useMutation({
		onSettled: () => {
			void api.listPlans.invalidate();
		},
	});

	const updatePlanMutation = api.updatePlan.useMutation({
		onSettled: () => {
			void api.listPlans.invalidate();
		},
	});

	const deletePlanMutation = api.deletePlan.useMutation({
		onSettled: () => {
			void api.listPlans.invalidate();
		},
	});

	if (plansError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load subscription plans
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchPlans()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		const body: Record<string, unknown> = {
			name: form.name,
			price: Math.round(Number(form.price) * 100),
			currency: form.currency,
			interval: form.interval,
			intervalCount: Number(form.intervalCount),
			isActive: form.isActive,
		};
		if (form.description) body.description = form.description;
		if (form.trialDays) body.trialDays = Number(form.trialDays);

		createPlanMutation.mutate(body, {
			onSuccess: () => {
				setShowCreate(false);
				setForm(DEFAULT_PLAN);
			},
			onError: (err) => {
				setError(extractError(err, "Failed to create plan"));
			},
		});
	}

	function handleToggle(plan: SubscriptionPlan) {
		updatePlanMutation.mutate({
			params: { id: plan.id },
			isActive: !plan.isActive,
		});
	}

	function handleDelete(id: string) {
		if (
			!confirm("Delete this plan? Existing subscriptions will not be affected.")
		)
			return;
		deletePlanMutation.mutate({ params: { id } });
	}

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<p className="text-muted-foreground text-sm">
					{plans.length} plan{plans.length !== 1 ? "s" : ""}
				</p>
				<button
					type="button"
					onClick={() => {
						setForm(DEFAULT_PLAN);
						setShowCreate(true);
					}}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90"
				>
					New plan
				</button>
			</div>

			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b bg-muted/50">
							<th
								scope="col"
								className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
							>
								Plan
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Price
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
							>
								Billing
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
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{loading ? (
							(["k0", "k1", "k2"] as const).map((key) => (
								<tr key={key}>
									{(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
										<td key={key} className="px-4 py-3">
											<div className="h-4 w-24 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : plans.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No plans yet
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Create a subscription plan to start collecting recurring
										revenue
									</p>
								</td>
							</tr>
						) : (
							plans.map((plan) => (
								<tr
									key={plan.id}
									className="transition-colors hover:bg-muted/30"
								>
									<td className="px-4 py-3">
										<div className="font-medium text-foreground text-sm">
											{plan.name}
										</div>
										{plan.description && (
											<div className="mt-0.5 text-muted-foreground text-xs">
												{plan.description}
											</div>
										)}
									</td>
									<td className="hidden px-4 py-3 text-right text-foreground text-sm tabular-nums sm:table-cell">
										{formatPrice(plan.price, plan.currency)}
									</td>
									<td className="hidden px-4 py-3 text-muted-foreground text-sm md:table-cell">
										{intervalLabel(plan.interval, plan.intervalCount)}
										{plan.trialDays ? (
											<span className="ml-2 text-xs">
												({plan.trialDays}d trial)
											</span>
										) : null}
									</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => handleToggle(plan)}
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${
												plan.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{plan.isActive ? "Active" : "Inactive"}
										</button>
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => handleDelete(plan.id)}
											className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
										>
											Delete
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Create Plan Modal */}
			{showCreate && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div
						role="dialog"
						aria-modal="true"
						className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
					>
						<h2 className="mb-4 font-semibold text-foreground text-lg">
							Create subscription plan
						</h2>
						{error && (
							<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
								{error}
							</p>
						)}
						<form onSubmit={(e) => handleCreate(e)} className="space-y-4">
							<div>
								<label
									htmlFor="sub-plan-name"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Name <span className="text-red-500">*</span>
								</label>
								<input
									ref={planNameRef}
									id="sub-plan-name"
									required
									value={form.name}
									onChange={(e) =>
										setForm((f) => ({ ...f, name: e.target.value }))
									}
									placeholder="e.g. Monthly Pro, Annual Business"
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div>
								<label
									htmlFor="sub-plan-description"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Description
								</label>
								<input
									id="sub-plan-description"
									value={form.description}
									onChange={(e) =>
										setForm((f) => ({ ...f, description: e.target.value }))
									}
									placeholder="optional"
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label
										htmlFor="sub-plan-price"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										Price <span className="text-red-500">*</span>
									</label>
									<input
										id="sub-plan-price"
										required
										type="number"
										min={0}
										step="0.01"
										value={form.price}
										onChange={(e) =>
											setForm((f) => ({ ...f, price: e.target.value }))
										}
										placeholder="9.99"
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
								<div>
									<label
										htmlFor="sub-plan-currency"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										Currency
									</label>
									<input
										id="sub-plan-currency"
										value={form.currency}
										onChange={(e) =>
											setForm((f) => ({ ...f, currency: e.target.value }))
										}
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label
										htmlFor="sub-plan-interval"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										Billing interval
									</label>
									<select
										id="sub-plan-interval"
										value={form.interval}
										onChange={(e) =>
											setForm((f) => ({ ...f, interval: e.target.value }))
										}
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									>
										<option value="day">Daily</option>
										<option value="week">Weekly</option>
										<option value="month">Monthly</option>
										<option value="year">Yearly</option>
									</select>
								</div>
								<div>
									<label
										htmlFor="sub-plan-intervalCount"
										className="mb-1 block font-medium text-foreground text-sm"
									>
										Every N periods
									</label>
									<input
										id="sub-plan-intervalCount"
										type="number"
										min={1}
										value={form.intervalCount}
										onChange={(e) =>
											setForm((f) => ({
												...f,
												intervalCount: e.target.value,
											}))
										}
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
								</div>
							</div>
							<div>
								<label
									htmlFor="sub-plan-trialDays"
									className="mb-1 block font-medium text-foreground text-sm"
								>
									Trial days
								</label>
								<input
									id="sub-plan-trialDays"
									type="number"
									min={0}
									value={form.trialDays}
									onChange={(e) =>
										setForm((f) => ({ ...f, trialDays: e.target.value }))
									}
									placeholder="0 = no trial"
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								/>
							</div>
							<label className="flex cursor-pointer items-center gap-2 text-foreground text-sm">
								<input
									type="checkbox"
									checked={form.isActive}
									onChange={(e) =>
										setForm((f) => ({ ...f, isActive: e.target.checked }))
									}
									className="rounded"
								/>
								Active immediately
							</label>
							<div className="flex justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => setShowCreate(false)}
									className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={createPlanMutation.isPending}
									className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
								>
									{createPlanMutation.isPending ? "Creating…" : "Create plan"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

// ── Subscribers tab ────────────────────────────────────────────────────────

function SubscriberRow({ sub }: { sub: Subscription }) {
	const api = useSubscriptionsAdminApi();
	const [expanded, setExpanded] = useState(false);

	const cancelMutation = api.cancelSubscription.useMutation({
		onSettled: () => {
			void api.listSubscriptions.invalidate();
		},
	});

	const renewMutation = api.renewSubscription.useMutation({
		onSettled: () => {
			void api.listSubscriptions.invalidate();
		},
	});

	function handleCancel(immediate: boolean) {
		const msg = immediate
			? "Cancel this subscription immediately? The customer will lose access right away."
			: "Cancel at period end? The customer retains access until the current billing period expires.";
		if (!confirm(msg)) return;
		cancelMutation.mutate({
			params: { id: sub.id },
			cancelAtPeriodEnd: !immediate,
		});
	}

	function handleRenew() {
		if (!confirm("Renew this subscription? A new billing period will begin."))
			return;
		renewMutation.mutate({ params: { id: sub.id } });
	}

	const canCancel =
		sub.status === "active" ||
		sub.status === "trialing" ||
		sub.status === "past_due";
	const canRenew = sub.status === "cancelled" || sub.status === "expired";
	const isPending = cancelMutation.isPending || renewMutation.isPending;

	return (
		<>
			<tr
				className="cursor-pointer transition-colors hover:bg-muted/30"
				onClick={() => setExpanded((e) => !e)}
			>
				<td className="px-4 py-3 text-foreground text-sm">
					{sub.email}
					{sub.cancelAtPeriodEnd && (
						<span className="ml-2 text-muted-foreground text-xs">
							(cancels at period end)
						</span>
					)}
				</td>
				<td className="hidden px-4 py-3 sm:table-cell">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[sub.status] ?? "bg-muted text-muted-foreground"}`}
					>
						{sub.status.replace(/_/g, " ")}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm md:table-cell">
					{formatDate(sub.currentPeriodStart)} –{" "}
					{formatDate(sub.currentPeriodEnd)}
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm lg:table-cell">
					{formatDate(sub.createdAt)}
				</td>
				<td className="px-4 py-3 text-right">
					<span className="text-muted-foreground text-xs">
						{expanded ? "▲" : "▼"}
					</span>
				</td>
			</tr>
			{expanded && (
				<tr>
					<td
						colSpan={5}
						className="border-border border-b bg-muted/20 px-4 py-4"
					>
						<div className="space-y-3">
							<div className="grid gap-3 sm:grid-cols-3">
								<div>
									<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
										Subscription ID
									</p>
									<p className="mt-1 font-mono text-foreground text-sm">
										{sub.id.slice(0, 12)}...
									</p>
								</div>
								<div>
									<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
										Plan
									</p>
									<p className="mt-1 font-mono text-foreground text-sm">
										{sub.planId.slice(0, 12)}...
									</p>
								</div>
								<div>
									<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
										Status
									</p>
									<p className="mt-1 text-foreground text-sm">
										{sub.status.replace(/_/g, " ")}
										{sub.cancelAtPeriodEnd && " (pending cancellation)"}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap gap-2 pt-1">
								{canCancel && !sub.cancelAtPeriodEnd && (
									<>
										<button
											type="button"
											disabled={isPending}
											onClick={(e) => {
												e.stopPropagation();
												handleCancel(false);
											}}
											className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted disabled:opacity-50"
										>
											{cancelMutation.isPending
												? "Cancelling…"
												: "Cancel at period end"}
										</button>
										<button
											type="button"
											disabled={isPending}
											onClick={(e) => {
												e.stopPropagation();
												handleCancel(true);
											}}
											className="rounded-md border border-red-300 px-3 py-1.5 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
										>
											Cancel immediately
										</button>
									</>
								)}
								{canRenew && (
									<button
										type="button"
										disabled={isPending}
										onClick={(e) => {
											e.stopPropagation();
											handleRenew();
										}}
										className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
									>
										{renewMutation.isPending ? "Renewing…" : "Renew"}
									</button>
								)}
							</div>
							{(cancelMutation.isError || renewMutation.isError) && (
								<p className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
									{extractError(
										cancelMutation.error ?? renewMutation.error,
										"Action failed",
									)}
								</p>
							)}
						</div>
					</td>
				</tr>
			)}
		</>
	);
}

function SubscribersTab() {
	const api = useSubscriptionsAdminApi();
	const [emailFilter, setEmailFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 20;

	const queryInput: Record<string, string> = {
		take: String(pageSize),
		skip: String((page - 1) * pageSize),
	};
	if (emailFilter) queryInput.email = emailFilter;
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data: subsData,
		isLoading: loading,
		isError: subsError,
		refetch: refetchSubs,
	} = api.listSubscriptions.useQuery(queryInput) as {
		data: { subscriptions: Subscription[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	const subscriptions = subsData?.subscriptions ?? [];
	const total = subsData?.total ?? 0;

	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	if (subsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load subscribers
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchSubs()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<p className="mr-auto text-muted-foreground text-sm">
					{total} subscriber{total !== 1 ? "s" : ""}
				</p>
				<input
					type="search"
					aria-label="Filter subscriptions by email"
					placeholder="Filter by email…"
					value={emailFilter}
					onChange={(e) => {
						setEmailFilter(e.target.value);
						setPage(1);
					}}
					className="h-9 rounded-md border border-border bg-background px-3 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
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
					<option value="active">Active</option>
					<option value="trialing">Trialing</option>
					<option value="cancelled">Cancelled</option>
					<option value="expired">Expired</option>
					<option value="past_due">Past due</option>
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
								Email
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
							>
								Status
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
							>
								Current period
							</th>
							<th
								scope="col"
								className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:table-cell"
							>
								Subscribed
							</th>
							<th scope="col" className="w-10 px-4 py-3" />
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{loading ? (
							(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
								<tr key={key}>
									{(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
										<td key={key} className="px-4 py-3">
											<div className="h-4 w-28 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : subscriptions.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-12 text-center">
									<p className="font-medium text-foreground text-sm">
										No subscribers
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Subscribers will appear here once customers subscribe to a
										plan
									</p>
								</td>
							</tr>
						) : (
							subscriptions.map((sub) => (
								<SubscriberRow key={sub.id} sub={sub} />
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
		</div>
	);
}

// ── Page ───────────────────────────────────────────────────────────────────

export function SubscriptionsAdmin() {
	const [tab, setTab] = useState<"subscribers" | "plans">("subscribers");

	return (
		<SubscriptionsAdminTemplate
			tab={tab}
			onTabChange={setTab}
			tabContent={tab === "subscribers" ? <SubscribersTab /> : <PlansTab />}
		/>
	);
}
