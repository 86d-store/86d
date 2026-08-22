"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { ShoppingBagIcon } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "~/components/status-badge";
import { buttonVariants } from "~/components/ui/button-variants";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

interface Order {
	id: string;
	orderNumber: string;
	status: string;
	paymentStatus: string;
	subtotal: number;
	total: number;
	currency: string;
	createdAt: string;
}

interface OrderListResponse {
	orders: Order[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

// ── Account Page ────────────────────────────────────────────────────────────

export default function AccountPage() {
	const client = useModuleClient();
	const [page, setPage] = useState(1);

	const ordersApi = client.module("orders").store["/orders/me"];

	const {
		data: ordersData,
		isLoading: ordersLoading,
		isError: ordersError,
		refetch: ordersRefetch,
	} = ordersApi.useQuery({
		page: String(page),
		limit: "5",
	}) as {
		data: OrderListResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const orders = ordersData?.orders ?? [];
	const pages = ordersData?.pages ?? 1;

	return (
		<div>
			{/* Quick nav cards — visible on mobile where sidebar is hidden */}
			<div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden">
				<QuickNavCard
					href="/account/orders"
					label="Orders"
					sub="Order history"
				/>
				<QuickNavCard href="/account/profile" label="Profile" sub="Edit info" />
				<QuickNavCard
					href="/account/addresses"
					label="Addresses"
					sub="Address book"
				/>
				<QuickNavCard
					href="/account/wishlist"
					label="Wishlist"
					sub="Saved items"
				/>
				<QuickNavCard
					href="/account/subscriptions"
					label="Subscriptions"
					sub="Plans"
				/>
				<QuickNavCard
					href="/account/downloads"
					label="Downloads"
					sub="Digital files"
				/>
				<QuickNavCard
					href="/account/reviews"
					label="Reviews"
					sub="Your feedback"
				/>
			</div>

			{/* Recent orders */}
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-semibold text-foreground text-lg">
						Recent Orders
					</h2>
					{ordersData && ordersData.total > 0 && (
						<a
							href="/account/orders"
							className="text-muted-foreground text-sm transition-colors hover:text-foreground"
						>
							View all &rarr;
						</a>
					)}
				</div>

				{ordersError ? (
					<div
						className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
						role="alert"
					>
						<p>Failed to load your recent orders.</p>
						<button
							type="button"
							onClick={() => ordersRefetch()}
							className="mt-1 font-medium underline"
						>
							Try again
						</button>
					</div>
				) : ordersLoading ? (
					<div className="flex flex-col gap-3">
						{[1, 2, 3].map((n) => (
							<Skeleton key={n} className="h-[72px] rounded-xl" />
						))}
					</div>
				) : orders.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<ShoppingBagIcon />
							</EmptyMedia>
							<EmptyTitle>No orders yet</EmptyTitle>
							<EmptyDescription>
								Your order history will appear here after your first purchase.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<a href="/products" className={buttonVariants()}>
								Start shopping
							</a>
						</EmptyContent>
					</Empty>
				) : (
					<>
						<div className="overflow-hidden rounded-xl border border-border">
							{orders.map((order) => (
								<a
									key={order.id}
									href={`/account/orders/${order.id}`}
									className="flex items-center justify-between gap-4 border-border border-b px-4 py-4 transition-colors last:border-0 hover:bg-muted/40"
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="font-medium text-foreground text-sm">
												{order.orderNumber}
											</span>
											<StatusBadge status={order.status} />
										</div>
										<p className="mt-0.5 text-muted-foreground text-xs">
											{formatDate(order.createdAt)}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-3">
										<span className="font-medium text-foreground text-sm tabular-nums">
											{formatPrice(order.total, order.currency)}
										</span>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
											className="text-muted-foreground"
											aria-hidden="true"
										>
											<path d="m9 18 6-6-6-6" />
										</svg>
									</div>
								</a>
							))}
						</div>

						{/* Pagination */}
						{pages > 1 && (
							<div className="mt-4 flex items-center justify-center gap-2">
								<button
									type="button"
									disabled={page <= 1}
									onClick={() => setPage((p) => p - 1)}
									className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
								>
									Previous
								</button>
								<span className="px-2 text-muted-foreground text-sm">
									Page {page} of {pages}
								</span>
								<button
									type="button"
									disabled={page >= pages}
									onClick={() => setPage((p) => p + 1)}
									className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-40"
								>
									Next
								</button>
							</div>
						)}
					</>
				)}
			</section>
		</div>
	);
}

function QuickNavCard({
	href,
	label,
	sub,
}: {
	href: string;
	label: string;
	sub: string;
}) {
	return (
		<a
			href={href}
			className="rounded-xl border border-border p-3 transition-colors hover:bg-muted/40"
		>
			<p className="font-medium text-foreground text-sm">{label}</p>
			<p className="text-muted-foreground text-xs">{sub}</p>
		</a>
	);
}
