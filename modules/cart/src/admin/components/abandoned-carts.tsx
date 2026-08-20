"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import AbandonedCartsTemplate from "./abandoned-carts.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
	id: string;
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string | null;
	variantName?: string | null;
	quantity: number;
	price: number;
}

interface AbandonedCart {
	id: string;
	customerId?: string | null;
	guestId?: string | null;
	status: string;
	items: CartItem[];
	itemCount: number;
	subtotal: number;
	recoveryEmailSentAt: string | null;
	recoveryEmailCount: number;
	updatedAt: string;
	createdAt: string;
}

interface AbandonedListResult {
	carts: AbandonedCart[];
	page: number;
	limit: number;
	total: number;
}

const STAT_SKELETON_IDS = ["revenue", "orders", "carts", "conversion"] as const;
const LIST_SKELETON_IDS = ["a", "b", "c", "d", "e"] as const;

interface RecoveryStats {
	totalAbandoned: number;
	recoverySent: number;
	recovered: number;
	recoveryRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const hours = Math.floor(diff / (1000 * 60 * 60));
	if (hours < 1) return "< 1 hour ago";
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function useCartAdminApi() {
	const client = useModuleClient();
	return {
		listAbandoned: client.module("cart").admin["/admin/carts/abandoned"],
		sendRecovery: client.module("cart").admin["/admin/carts/:id/send-recovery"],
		recoveryStats: client.module("cart").admin["/admin/carts/recovery-stats"],
	};
}

// ─── RecoveryStatsCard ────────────────────────────────────────────────────────

function RecoveryStatsCard() {
	const api = useCartAdminApi();
	const { data, isLoading } = api.recoveryStats.useQuery({}) as {
		data: RecoveryStats | undefined;
		isLoading: boolean;
	};

	if (isLoading) {
		return (
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{STAT_SKELETON_IDS.map((id) => (
					<div
						key={`stat-skeleton-${id}`}
						className="h-20 animate-pulse rounded-md bg-muted"
					/>
				))}
			</div>
		);
	}

	if (!data) return null;

	const stats = [
		{ label: "Abandoned", value: data.totalAbandoned },
		{ label: "Emails Sent", value: data.recoverySent },
		{ label: "Recovered", value: data.recovered },
		{ label: "Recovery Rate", value: `${data.recoveryRate}%` },
	];

	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{stats.map((stat) => (
				<div
					key={stat.label}
					className="rounded-md border border-border bg-card p-4"
				>
					<p className="text-muted-foreground text-xs">{stat.label}</p>
					<p className="mt-1 font-semibold text-foreground text-xl">
						{stat.value}
					</p>
				</div>
			))}
		</div>
	);
}

// ─── SendRecoveryForm ─────────────────────────────────────────────────────────

function SendRecoveryForm({
	cartId,
	onClose,
	onSent,
}: {
	cartId: string;
	onClose: () => void;
	onSent: () => void;
}) {
	const api = useCartAdminApi();
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const mutation = api.sendRecovery.useMutation({
		onSettled: () => {
			void api.listAbandoned.invalidate();
			void api.recoveryStats.invalidate();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!email || !name) return;

		setSending(true);
		setError(null);

		mutation.mutate(
			{
				params: { id: cartId },
				body: {
					email,
					customerName: name,
					recoveryUrl: `${window.location.origin}/cart`,
					storeName: document.title || undefined,
				},
			},
			{
				onSuccess: () => {
					setSending(false);
					onSent();
				},
				onError: (err: unknown) => {
					setSending(false);
					setError(
						err instanceof Error
							? err.message
							: "Failed to send recovery email",
					);
				},
			},
		);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<div>
				<label
					htmlFor={`recovery-email-${cartId}`}
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Customer Email
				</label>
				<input
					id={`recovery-email-${cartId}`}
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					placeholder="customer@example.com"
					className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>
			<div>
				<label
					htmlFor={`recovery-name-${cartId}`}
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Customer Name
				</label>
				<input
					id={`recovery-name-${cartId}`}
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					placeholder="Jane Smith"
					className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>
			{error && <p className="text-destructive text-xs">{error}</p>}
			<div className="flex items-center gap-2">
				<button
					type="submit"
					disabled={sending || !email || !name}
					className="rounded-md bg-foreground px-4 py-1.5 font-medium text-background text-sm hover:bg-foreground/90 disabled:opacity-50"
				>
					{sending ? "Sending..." : "Send Recovery Email"}
				</button>
				<button
					type="button"
					onClick={onClose}
					className="text-muted-foreground text-sm hover:underline"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

// ─── AbandonedCarts ───────────────────────────────────────────────────────────

// ─── AbandonedCartDetail ──────────────────────────────────────────────────────

function AbandonedCartDetail({
	cart,
	onClose,
}: {
	cart: AbandonedCart | undefined;
	onClose: () => void;
}) {
	if (!cart) return null;

	return (
		<div className="space-y-3 rounded-md border border-border bg-card p-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-foreground text-sm">Cart Details</h3>
				<button
					type="button"
					onClick={onClose}
					className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label="Close details"
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
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			</div>

			{cart.items.length === 0 ? (
				<p className="text-muted-foreground text-sm">No items in this cart.</p>
			) : (
				<>
					<div className="overflow-x-auto rounded-md border border-border">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-border border-b bg-muted">
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Product
									</th>
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Variant
									</th>
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Qty
									</th>
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Price
									</th>
									<th
										scope="col"
										className="px-3 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Line Total
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{cart.items.map((item) => (
									<tr key={item.id}>
										<td className="px-3 py-1.5 text-foreground text-xs">
											{item.productName}
										</td>
										<td className="px-3 py-1.5 text-muted-foreground text-xs">
											{item.variantName ?? "—"}
										</td>
										<td className="px-3 py-1.5 text-foreground text-xs">
											{item.quantity}
										</td>
										<td className="px-3 py-1.5 text-foreground text-xs">
											{formatPrice(item.price)}
										</td>
										<td className="px-3 py-1.5 font-medium text-foreground text-xs">
											{formatPrice(item.price * item.quantity)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="flex items-center justify-between border-border border-t pt-2">
						<span className="text-muted-foreground text-sm">
							Subtotal ({cart.itemCount}{" "}
							{cart.itemCount === 1 ? "item" : "items"})
						</span>
						<span className="font-semibold text-foreground text-sm">
							{formatPrice(cart.subtotal)}
						</span>
					</div>
				</>
			)}
		</div>
	);
}

// ─── AbandonedCarts ───────────────────────────────────────────────────────────

export function AbandonedCarts() {
	const api = useCartAdminApi();
	const [page, setPage] = useState(1);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [recoveryFormId, setRecoveryFormId] = useState<string | null>(null);
	const limit = 20;

	const {
		data: listData,
		isLoading: loading,
		isError: cartsError,
		refetch: refetchCarts,
	} = api.listAbandoned.useQuery({
		page: String(page),
		limit: String(limit),
		thresholdHours: "1",
	}) as {
		data: AbandonedListResult | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (cartsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load abandoned carts
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchCarts()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const carts = listData?.carts ?? [];
	const total = listData?.total ?? 0;
	const totalPages = Math.ceil(total / limit);

	const content = (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-semibold text-foreground text-lg">
						Abandoned Cart Recovery
					</h2>
					<p className="text-muted-foreground text-sm">
						Active carts with no activity in the last hour
					</p>
				</div>
			</div>

			{/* Stats */}
			<RecoveryStatsCard />

			{/* List */}
			{loading ? (
				<div className="space-y-2">
					{LIST_SKELETON_IDS.map((id) => (
						<div
							key={`row-skeleton-${id}`}
							className="h-12 animate-pulse rounded-md bg-muted"
						/>
					))}
				</div>
			) : carts.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-20 text-center">
					<p className="font-medium text-base text-foreground">
						No abandoned carts
					</p>
					<p className="text-muted-foreground text-sm">
						All active carts have recent activity
					</p>
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
									Cart
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Customer
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Items
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Subtotal
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Last Active
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Recovery
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
							{carts.map((cart) => (
								<tr
									key={cart.id}
									className="transition-colors hover:bg-muted/50"
								>
									<td className="px-4 py-2">
										<button
											type="button"
											onClick={() =>
												setExpandedId(expandedId === cart.id ? null : cart.id)
											}
											className="font-mono text-foreground text-xs underline underline-offset-2 hover:text-foreground/80"
											title={cart.id}
										>
											{cart.id.slice(0, 8)}...
										</button>
									</td>
									<td className="px-4 py-2 text-foreground text-sm">
										{cart.customerId ? (
											<span title={cart.customerId}>Registered customer</span>
										) : cart.guestId ? (
											<span className="text-muted-foreground">Guest</span>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</td>
									<td className="px-4 py-2 text-foreground text-sm">
										{cart.itemCount}
									</td>
									<td className="px-4 py-2 font-medium text-foreground text-sm">
										{formatPrice(cart.subtotal)}
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{timeAgo(cart.updatedAt)}
									</td>
									<td className="px-4 py-2">
										{cart.recoveryEmailCount > 0 ? (
											<span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs">
												Sent ({cart.recoveryEmailCount})
											</span>
										) : (
											<span className="text-muted-foreground text-xs">
												Not sent
											</span>
										)}
									</td>
									<td className="px-4 py-2">
										<button
											type="button"
											onClick={() =>
												setRecoveryFormId(
													recoveryFormId === cart.id ? null : cart.id,
												)
											}
											className="rounded-md border border-border px-3 py-1 text-foreground text-xs hover:bg-muted"
										>
											Send Email
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Expanded cart detail */}
			{expandedId && (
				<AbandonedCartDetail
					cart={carts.find((c) => c.id === expandedId)}
					onClose={() => setExpandedId(null)}
				/>
			)}

			{/* Recovery email form */}
			{recoveryFormId && (
				<div className="rounded-md border border-border bg-card p-4">
					<h3 className="mb-3 font-semibold text-foreground text-sm">
						Send Recovery Email — Cart {recoveryFormId.slice(0, 8)}...
					</h3>
					<SendRecoveryForm
						cartId={recoveryFormId}
						onClose={() => setRecoveryFormId(null)}
						onSent={() => setRecoveryFormId(null)}
					/>
				</div>
			)}

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-2">
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

	return <AbandonedCartsTemplate content={content} />;
}
