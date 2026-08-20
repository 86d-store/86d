"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import AbandonedCartOverviewTemplate from "./abandoned-cart-overview.mdx";

interface CartItemSnapshot {
	productId: string;
	variantId?: string;
	name: string;
	price: number;
	quantity: number;
	imageUrl?: string;
}

interface AbandonedCart {
	id: string;
	cartId: string;
	customerId?: string;
	email?: string;
	items: CartItemSnapshot[];
	cartTotal: number;
	currency: string;
	status: "active" | "recovered" | "expired" | "dismissed";
	recoveryToken: string;
	attemptCount: number;
	lastActivityAt: string;
	abandonedAt: string;
	recoveredAt?: string;
	recoveredOrderId?: string;
	createdAt: string;
	updatedAt: string;
}

interface RecoveryAttempt {
	id: string;
	abandonedCartId: string;
	channel: "email" | "sms" | "push";
	recipient: string;
	status: string;
	subject?: string;
	sentAt: string;
}

interface Stats {
	totalAbandoned: number;
	totalRecovered: number;
	totalExpired: number;
	totalDismissed: number;
	recoveryRate: number;
	totalRecoveredValue: number;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(amount);
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
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	recovered:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	expired: "bg-muted text-muted-foreground",
	dismissed: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

function useAbandonedCartAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("abandoned-carts").admin["/admin/abandoned-carts"],
		stats:
			client.module("abandoned-carts").admin["/admin/abandoned-carts/stats"],
		get: client.module("abandoned-carts").admin["/admin/abandoned-carts/:id"],
		recover:
			client.module("abandoned-carts").admin[
				"/admin/abandoned-carts/:id/recover"
			],
		dismiss:
			client.module("abandoned-carts").admin[
				"/admin/abandoned-carts/:id/dismiss"
			],
		deleteCart:
			client.module("abandoned-carts").admin[
				"/admin/abandoned-carts/:id/delete"
			],
		bulkExpire:
			client.module("abandoned-carts").admin[
				"/admin/abandoned-carts/bulk-expire"
			],
	};
}

function StatsBar({ stats }: { stats: Stats }) {
	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="text-muted-foreground text-xs">Active</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{stats.totalAbandoned}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="text-muted-foreground text-xs">Recovered</p>
				<p className="mt-1 font-semibold text-2xl text-green-600 dark:text-green-400">
					{stats.totalRecovered}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="text-muted-foreground text-xs">Recovery Rate</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{(stats.recoveryRate * 100).toFixed(1)}%
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="text-muted-foreground text-xs">Recovered Value</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{formatCurrency(stats.totalRecoveredValue, "USD")}
				</p>
			</div>
		</div>
	);
}

function DetailPanel({
	cartId,
	onClose,
}: {
	cartId: string;
	onClose: () => void;
}) {
	const api = useAbandonedCartAdminApi();
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");

	const { data: cartData, isLoading } = api.get.useQuery({
		params: { id: cartId },
	}) as {
		data: { cart: AbandonedCart & { attempts: RecoveryAttempt[] } } | undefined;
		isLoading: boolean;
	};

	const cart = cartData?.cart;
	const attempts = cart?.attempts ?? [];

	const recoverMutation = api.recover.useMutation({
		onSettled: () => {
			setEmail("");
			void api.get.invalidate();
			void api.list.invalidate();
			void api.stats.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to send recovery."));
		},
	});

	const dismissMutation = api.dismiss.useMutation({
		onSettled: () => {
			void api.get.invalidate();
			void api.list.invalidate();
			void api.stats.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to dismiss."));
		},
	});

	const handleSendRecovery = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const recipient = email || cart?.email;
		if (!recipient) {
			setError("No email address available.");
			return;
		}
		recoverMutation.mutate({
			params: { id: cartId },
			channel: "email" as const,
			recipient,
			subject: "You left something in your cart",
		});
	};

	if (isLoading) {
		return (
			<div className="animate-pulse space-y-5">
				<div className="flex items-center justify-between">
					<div className="h-4 w-24 rounded bg-muted" />
					<div className="h-5 w-16 rounded-full bg-muted" />
				</div>
				<div className="rounded-lg border border-border bg-card p-5">
					<div className="flex items-start justify-between">
						<div>
							<div className="h-6 w-28 rounded bg-muted" />
							<div className="mt-1.5 h-4 w-40 rounded bg-muted" />
						</div>
						<div className="h-3 w-32 rounded bg-muted" />
					</div>
					<div className="mt-4 grid grid-cols-2 gap-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i}>
								<div className="h-3 w-16 rounded bg-muted" />
								<div className="mt-1.5 h-4 w-28 rounded bg-muted" />
							</div>
						))}
					</div>
				</div>
				<div className="rounded-lg border border-border bg-card">
					<div className="border-border border-b px-5 py-3">
						<div className="h-4 w-24 rounded bg-muted" />
					</div>
					<div className="divide-y divide-border">
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center justify-between px-5 py-3"
							>
								<div className="h-4 w-32 rounded bg-muted" />
								<div className="h-3 w-20 rounded bg-muted" />
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (!cart) {
		return (
			<div className="py-8 text-center text-muted-foreground text-sm">
				Abandoned cart not found.
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onClose}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back to list
				</button>
				<span
					className={`rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_COLORS[cart.status] ?? ""}`}
				>
					{cart.status}
				</span>
			</div>

			<div className="rounded-lg border border-border bg-card p-5">
				<div className="flex items-start justify-between">
					<div>
						<p className="font-semibold text-foreground text-lg">
							{formatCurrency(cart.cartTotal, cart.currency)}
						</p>
						<p className="mt-0.5 text-muted-foreground text-sm">
							{cart.email ?? "No email"}
						</p>
					</div>
					<p className="text-muted-foreground text-xs">
						Abandoned {formatDate(cart.abandonedAt)}
					</p>
				</div>

				<div className="mt-4 grid grid-cols-2 gap-4">
					<div>
						<p className="text-muted-foreground text-xs">Cart ID</p>
						<p className="mt-0.5 font-mono text-foreground text-sm">
							{cart.cartId}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Attempts</p>
						<p className="mt-0.5 text-foreground text-sm">
							{cart.attemptCount}
						</p>
					</div>
					{cart.customerId && (
						<div>
							<p className="text-muted-foreground text-xs">Customer</p>
							<p className="mt-0.5 font-mono text-foreground text-sm">
								{cart.customerId}
							</p>
						</div>
					)}
					{cart.recoveredOrderId && (
						<div>
							<p className="text-muted-foreground text-xs">Order</p>
							<p className="mt-0.5 font-mono text-foreground text-sm">
								{cart.recoveredOrderId}
							</p>
						</div>
					)}
				</div>

				{cart.status === "active" && (
					<div className="mt-4 flex gap-2">
						<button
							type="button"
							onClick={() => dismissMutation.mutate({ params: { id: cartId } })}
							className="rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							Dismiss
						</button>
					</div>
				)}
			</div>

			{error && (
				<div
					role="alert"
					className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
				>
					{error}
				</div>
			)}

			{/* Items */}
			<div className="rounded-lg border border-border bg-card">
				<div className="border-border border-b px-5 py-3">
					<h3 className="font-semibold text-foreground text-sm">
						Cart Items ({cart.items.length})
					</h3>
				</div>
				{cart.items.length === 0 ? (
					<div className="px-5 py-6 text-center text-muted-foreground text-sm">
						No items.
					</div>
				) : (
					<div className="divide-y divide-border">
						{cart.items.map((item: CartItemSnapshot, idx: number) => (
							<div
								key={`${item.productId}-${idx}`}
								className="flex items-center justify-between px-5 py-3"
							>
								<div>
									<p className="font-medium text-foreground text-sm">
										{item.name}
									</p>
									<p className="text-muted-foreground text-xs">
										{item.productId}
										{item.variantId ? ` / ${item.variantId}` : ""}
									</p>
								</div>
								<div className="text-right">
									<p className="text-foreground text-sm">
										{formatCurrency(item.price, cart.currency)} x{" "}
										{item.quantity}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Recovery */}
			{cart.status === "active" && (
				<div className="rounded-lg border border-border bg-card p-5">
					<h3 className="mb-3 font-semibold text-foreground text-sm">
						Send Recovery Email
					</h3>
					<form onSubmit={handleSendRecovery} className="flex items-end gap-3">
						<label className="flex-1">
							<span className="mb-1 block text-muted-foreground text-xs">
								Email
							</span>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								placeholder={cart.email ?? "customer@example.com"}
							/>
						</label>
						<button
							type="submit"
							disabled={recoverMutation.isPending}
							className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{recoverMutation.isPending ? "Sending..." : "Send"}
						</button>
					</form>
				</div>
			)}

			{/* Attempt history */}
			{attempts.length > 0 && (
				<div className="rounded-lg border border-border bg-card">
					<div className="border-border border-b px-5 py-3">
						<h3 className="font-semibold text-foreground text-sm">
							Recovery Attempts ({attempts.length})
						</h3>
					</div>
					<div className="divide-y divide-border">
						{attempts.map((attempt) => (
							<div
								key={attempt.id}
								className="flex items-center justify-between px-5 py-3"
							>
								<div>
									<p className="text-foreground text-sm">
										{attempt.channel} to {attempt.recipient}
									</p>
									{attempt.subject && (
										<p className="text-muted-foreground text-xs">
											{attempt.subject}
										</p>
									)}
								</div>
								<div className="text-right">
									<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
										{attempt.status}
									</span>
									<p className="mt-0.5 text-muted-foreground text-xs">
										{formatDate(attempt.sentAt)}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export function AbandonedCartOverview() {
	const api = useAbandonedCartAdminApi();
	const [skip, setSkip] = useState(0);
	const [statusFilter, setStatusFilter] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [error, setError] = useState("");

	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats: Stats } | undefined;
	};

	const { data: listData, isLoading } = api.list.useQuery({
		take: String(PAGE_SIZE),
		skip: String(skip),
		...(statusFilter ? { status: statusFilter } : {}),
	}) as {
		data: { carts: AbandonedCart[]; total: number } | undefined;
		isLoading: boolean;
	};

	const stats = statsData?.stats;
	const carts = listData?.carts ?? [];
	const total = listData?.total ?? 0;

	const deleteMutation = api.deleteCart.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.list.invalidate();
			void api.stats.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to delete."));
		},
	});

	const handleDelete = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	if (selectedId) {
		return (
			<DetailPanel cartId={selectedId} onClose={() => setSelectedId(null)} />
		);
	}

	const tableContent =
		carts.length === 0 ? (
			<div className="px-5 py-8 text-center text-muted-foreground text-sm">
				No abandoned carts found.
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
									Email
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Items
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Value
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
									Abandoned
								</th>
								<th
									scope="col"
									className="px-5 py-2.5 font-medium text-muted-foreground"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{carts.map((cart) => (
								<tr
									key={cart.id}
									className="cursor-pointer hover:bg-muted/30"
									onClick={() => setSelectedId(cart.id)}
								>
									<td className="px-5 py-3">
										<p className="font-medium text-foreground">
											{cart.email ?? "—"}
										</p>
										{cart.customerId && (
											<p className="mt-0.5 font-mono text-muted-foreground text-xs">
												{cart.customerId}
											</p>
										)}
									</td>
									<td className="px-5 py-3 text-foreground">
										{cart.items.length}
									</td>
									<td className="px-5 py-3 text-foreground">
										{formatCurrency(cart.cartTotal, cart.currency)}
									</td>
									<td className="px-5 py-3">
										<span
											className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[cart.status] ?? ""}`}
										>
											{cart.status}
										</span>
									</td>
									<td className="px-5 py-3 text-muted-foreground">
										{formatDate(cart.abandonedAt)}
									</td>
									<td
										className="px-5 py-3"
										onClick={(e) => e.stopPropagation()}
										onKeyDown={(e) => e.stopPropagation()}
									>
										{deleteConfirm === cart.id ? (
											<span className="space-x-2">
												<button
													type="button"
													onClick={() => handleDelete(cart.id)}
													className="font-medium text-destructive text-xs hover:opacity-80"
												>
													Confirm
												</button>
												<button
													type="button"
													onClick={() => setDeleteConfirm(null)}
													className="text-muted-foreground text-xs hover:text-foreground"
												>
													Cancel
												</button>
											</span>
										) : (
											<button
												type="button"
												onClick={() => setDeleteConfirm(cart.id)}
												className="text-muted-foreground text-xs hover:text-destructive"
											>
												Delete
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="divide-y divide-border md:hidden">
					{carts.map((cart) => (
						<button
							key={cart.id}
							type="button"
							onClick={() => setSelectedId(cart.id)}
							className="w-full px-5 py-3 text-left"
						>
							<div className="flex items-start justify-between">
								<div>
									<p className="font-medium text-foreground text-sm">
										{cart.email ?? "No email"}
									</p>
									<p className="mt-0.5 text-muted-foreground text-sm">
										{cart.items.length} items &middot;{" "}
										{formatCurrency(cart.cartTotal, cart.currency)}
									</p>
								</div>
								<span
									className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[cart.status] ?? ""}`}
								>
									{cart.status}
								</span>
							</div>
						</button>
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

	return (
		<AbandonedCartOverviewTemplate
			stats={stats ? <StatsBar stats={stats} /> : null}
			statusFilter={statusFilter}
			onStatusFilterChange={(v: string) => {
				setStatusFilter(v);
				setSkip(0);
			}}
			error={error}
			loading={isLoading}
			tableContent={tableContent}
		/>
	);
}
