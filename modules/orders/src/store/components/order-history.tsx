"use client";

import { useCallback, useState } from "react";
import { useOrdersApi } from "./_hooks";
import type { Order, OrderListResponse } from "./_types";
import {
	formatDate,
	formatPrice,
	PAYMENT_STYLES,
	STATUS_STYLES,
} from "./_utils";
import OrderHistoryTemplate from "./order-history.mdx";
import { StatusBadge } from "./status-badge";

function OrderRow({
	order,
	onSelect,
}: {
	order: Order;
	onSelect: (id: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(order.id)}
			className="flex w-full items-center justify-between gap-4 border-border border-b px-4 py-4 text-left transition-colors hover:bg-muted/40"
		>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="font-medium text-foreground text-sm">
						{order.orderNumber}
					</span>
					<StatusBadge value={order.status} styles={STATUS_STYLES} />
					<StatusBadge value={order.paymentStatus} styles={PAYMENT_STYLES} />
				</div>
				<p className="mt-0.5 text-muted-foreground text-xs">
					{formatDate(order.createdAt)}
				</p>
			</div>
			<span className="shrink-0 font-medium text-foreground text-sm">
				{formatPrice(order.total, order.currency)}
			</span>
		</button>
	);
}

export function OrderHistory({
	onSelectOrder,
	pageSize = 10,
}: {
	onSelectOrder?: ((id: string) => void) | undefined;
	pageSize?: number | undefined;
}) {
	const api = useOrdersApi();
	const [page, setPage] = useState(1);

	const { data, isLoading, isError, error } = api.listMyOrders.useQuery({
		page: String(page),
		limit: String(pageSize),
	}) as {
		data: OrderListResponse | undefined;
		isLoading: boolean;
		isError: boolean;
		error: Error | null;
	};

	const handleSelect = useCallback(
		(id: string) => {
			if (onSelectOrder) {
				onSelectOrder(id);
			} else {
				const url = new URL(window.location.href);
				url.searchParams.set("order", id);
				window.location.href = url.toString();
			}
		},
		[onSelectOrder],
	);

	if (isLoading) {
		return (
			<section className="py-8">
				<div className="mb-4 h-7 w-36 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-3">
					{[1, 2, 3].map((n) => (
						<div key={n} className="h-16 animate-pulse rounded-lg bg-muted" />
					))}
				</div>
			</section>
		);
	}

	if (isError) {
		const is401 = (error as Error & { status?: number }).status === 401;
		return (
			<section className="py-8">
				<h2 className="mb-4 font-semibold text-foreground text-xl">
					My Orders
				</h2>
				<div className="rounded-xl border border-border bg-muted/30 py-12 text-center">
					<p className="text-muted-foreground text-sm">
						{is401
							? "Please sign in to view your orders."
							: "Failed to load orders."}
					</p>
				</div>
			</section>
		);
	}

	const orders = data?.orders ?? [];
	const pages = data?.pages ?? 1;

	const orderListContent =
		orders.length === 0 ? null : (
			<div className="overflow-hidden rounded-xl border border-border">
				{orders.map((order) => (
					<OrderRow key={order.id} order={order} onSelect={handleSelect} />
				))}
			</div>
		);

	const paginationContent =
		pages > 1 ? (
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
		) : null;

	return (
		<OrderHistoryTemplate
			isEmpty={orders.length === 0}
			orderListContent={orderListContent}
			paginationContent={paginationContent}
		/>
	);
}
