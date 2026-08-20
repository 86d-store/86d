"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { ShoppingBagIcon } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "~/components/status-badge";
import { buttonVariants } from "~/components/ui/button";
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

// ── Orders Page ─────────────────────────────────────────────────────────────

export default function OrdersPage() {
	const client = useModuleClient();
	const [page, setPage] = useState(1);

	const ordersApi = client.module("orders").store["/orders/me"];

	const { data, isLoading, isError, refetch } = ordersApi.useQuery({
		page: String(page),
		limit: "10",
	}) as {
		data: OrderListResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const orders = data?.orders ?? [];
	const pages = data?.pages ?? 1;
	const total = data?.total ?? 0;

	return (
		<div>
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h2 className="font-bold font-display text-foreground text-xl tracking-tight sm:text-2xl">
						Order History
					</h2>
					{total > 0 && (
						<p className="mt-1 text-muted-foreground text-sm">
							{total} order{total !== 1 ? "s" : ""}
						</p>
					)}
				</div>
			</div>

			{isError ? (
				<div
					className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					<p>Failed to load your orders.</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-1 font-medium underline"
					>
						Try again
					</button>
				</div>
			) : isLoading ? (
				<div className="flex flex-col gap-3">
					{[1, 2, 3, 4, 5].map((n) => (
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
							Browse products
						</a>
					</EmptyContent>
				</Empty>
			) : (
				<>
					{/* Desktop table */}
					<div className="hidden overflow-hidden rounded-xl border border-border sm:block">
						<table className="w-full">
							<thead>
								<tr className="border-border border-b bg-muted/40">
									<th
										scope="col"
										className="px-4 py-3 text-left font-medium text-muted-foreground text-xs"
									>
										Order
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-medium text-muted-foreground text-xs"
									>
										Date
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-medium text-muted-foreground text-xs"
									>
										Status
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-medium text-muted-foreground text-xs"
									>
										Payment
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"
									>
										Total
									</th>
									<th scope="col" className="w-10 px-4 py-3" />
								</tr>
							</thead>
							<tbody>
								{orders.map((order) => (
									<tr
										key={order.id}
										className="border-border border-b transition-colors last:border-0 hover:bg-muted/30"
									>
										<td className="px-4 py-3.5">
											<a
												href={`/account/orders/${order.id}`}
												className="font-medium text-foreground text-sm hover:underline"
											>
												{order.orderNumber}
											</a>
										</td>
										<td className="px-4 py-3.5 text-muted-foreground text-sm">
											{formatDate(order.createdAt)}
										</td>
										<td className="px-4 py-3.5">
											<StatusBadge status={order.status} />
										</td>
										<td className="px-4 py-3.5">
											<StatusBadge status={order.paymentStatus} />
										</td>
										<td className="px-4 py-3.5 text-right font-medium text-foreground text-sm tabular-nums">
											{formatPrice(order.total, order.currency)}
										</td>
										<td className="px-4 py-3.5">
											<a
												href={`/account/orders/${order.id}`}
												className="text-muted-foreground transition-colors hover:text-foreground"
											>
												<span className="sr-only">
													View order {order.orderNumber}
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
													aria-hidden="true"
												>
													<path d="m9 18 6-6-6-6" />
												</svg>
											</a>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{/* Mobile list */}
					<div className="overflow-hidden rounded-xl border border-border sm:hidden">
						{orders.map((order) => (
							<a
								key={order.id}
								href={`/account/orders/${order.id}`}
								className="flex items-center justify-between gap-3 border-border border-b px-4 py-4 transition-colors last:border-0 hover:bg-muted/40"
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
								<span className="shrink-0 font-medium text-foreground text-sm tabular-nums">
									{formatPrice(order.total, order.currency)}
								</span>
							</a>
						))}
					</div>

					{/* Pagination */}
					{pages > 1 && (
						<div className="mt-6 flex items-center justify-center gap-2">
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
		</div>
	);
}
