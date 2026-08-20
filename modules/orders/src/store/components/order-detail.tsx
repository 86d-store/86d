"use client";

import { useCallback, useState } from "react";
import { useOrdersApi } from "./_hooks";
import type {
	FulfillmentWithItems,
	OrderAddress,
	OrderWithDetails,
} from "./_types";
import {
	extractError,
	FULFILLMENT_STYLES,
	formatDate,
	formatPrice,
	PAYMENT_STYLES,
	STATUS_STYLES,
} from "./_utils";
import OrderDetailTemplate from "./order-detail.mdx";
import { StatusBadge } from "./status-badge";

function AddressCard({
	title,
	address,
}: {
	title: string;
	address: OrderAddress;
}) {
	return (
		<div className="rounded-xl border border-border p-4">
			<h3 className="mb-2 font-medium text-foreground text-sm">{title}</h3>
			<div className="space-y-0.5 text-muted-foreground text-sm">
				<p>
					{address.firstName} {address.lastName}
				</p>
				{address.company && <p>{address.company}</p>}
				<p>{address.line1}</p>
				{address.line2 && <p>{address.line2}</p>}
				<p>
					{address.city}, {address.state} {address.postalCode}
				</p>
				<p>{address.country}</p>
				{address.phone && <p>{address.phone}</p>}
			</div>
		</div>
	);
}

function FulfillmentCard({ f }: { f: FulfillmentWithItems }) {
	return (
		<div className="rounded-xl border border-border p-4">
			<div className="flex items-center gap-2">
				<StatusBadge value={f.status} styles={FULFILLMENT_STYLES} />
				{f.carrier && (
					<span className="text-muted-foreground text-sm">{f.carrier}</span>
				)}
			</div>
			{f.trackingNumber && (
				<p className="mt-1.5 font-mono text-foreground text-sm">
					{f.trackingNumber}
				</p>
			)}
			{f.trackingUrl && (
				<a
					href={f.trackingUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-1.5 inline-block text-primary text-sm underline-offset-4 hover:underline"
				>
					Track your package &rarr;
				</a>
			)}
			{f.shippedAt && (
				<p className="mt-1 text-muted-foreground text-xs">
					Shipped {formatDate(f.shippedAt)}
				</p>
			)}
		</div>
	);
}

export function OrderDetail({
	orderId,
	onBack,
}: {
	orderId: string;
	onBack?: (() => void) | undefined;
}) {
	const api = useOrdersApi();

	const { data, isLoading, isError, error } = api.getMyOrder.useQuery({
		params: { id: orderId },
	}) as {
		data: { order: OrderWithDetails } | undefined;
		isLoading: boolean;
		isError: boolean;
		error: Error | null;
	};

	const { data: fulfillmentData } = api.getMyFulfillments.useQuery({
		params: { id: orderId },
	}) as {
		data: { fulfillments: FulfillmentWithItems[] } | undefined;
	};

	const fulfillments = fulfillmentData?.fulfillments ?? [];

	const order = data?.order ?? null;
	const [cancelError, setCancelError] = useState("");

	const cancelMutation = api.cancelMyOrder.useMutation({
		onError: (err: Error) => {
			setCancelError(extractError(err, "Failed to cancel order."));
		},
	});

	const handleBack = useCallback(() => {
		if (onBack) {
			onBack();
		} else {
			const url = new URL(window.location.href);
			url.searchParams.delete("order");
			window.location.href = url.toString();
		}
	}, [onBack]);

	if (isLoading) {
		return (
			<section className="py-8">
				<div className="mb-4 h-5 w-20 animate-pulse rounded bg-muted" />
				<div className="mb-6 h-7 w-48 animate-pulse rounded-lg bg-muted" />
				<div className="space-y-3">
					{[1, 2, 3].map((n) => (
						<div key={n} className="h-14 animate-pulse rounded-lg bg-muted" />
					))}
				</div>
			</section>
		);
	}

	if (isError || !order) {
		const status = (error as Error & { status?: number }).status;
		const message =
			status === 401
				? "Please sign in to view this order."
				: status === 404
					? "Order not found."
					: cancelError || "Failed to load order.";
		return (
			<section className="py-8">
				<button
					type="button"
					onClick={handleBack}
					className="mb-4 text-primary text-sm underline-offset-4 hover:underline"
				>
					&larr; Back to orders
				</button>
				<div className="rounded-xl border border-border bg-muted/30 py-12 text-center">
					<p className="text-muted-foreground text-sm">{message}</p>
				</div>
			</section>
		);
	}

	const displayOrder =
		(cancelMutation.data as { order: OrderWithDetails } | undefined)?.order ??
		order;
	const cancellable = ["pending", "processing", "on_hold"].includes(
		displayOrder.status,
	);
	const shipping = displayOrder.addresses.find((a) => a.type === "shipping");
	const billing = displayOrder.addresses.find((a) => a.type === "billing");

	const statusBadges = (
		<div className="mt-2 flex gap-2">
			<StatusBadge value={displayOrder.status} styles={STATUS_STYLES} />
			<StatusBadge value={displayOrder.paymentStatus} styles={PAYMENT_STYLES} />
		</div>
	);

	const itemsContent = (
		<div className="mb-6 overflow-hidden rounded-xl border border-border">
			<div className="border-border border-b bg-muted/40 px-4 py-2.5">
				<h3 className="font-medium text-foreground text-sm">Items</h3>
			</div>
			{displayOrder.items.map((item) => (
				<div
					key={item.id}
					className="flex items-center justify-between gap-4 border-border border-b px-4 py-3 last:border-0"
				>
					<div className="min-w-0 flex-1">
						<p className="font-medium text-foreground text-sm">{item.name}</p>
						<p className="text-muted-foreground text-xs">
							Qty: {item.quantity}
							{item.sku ? ` · SKU: ${item.sku}` : ""}
						</p>
					</div>
					<span className="shrink-0 text-foreground text-sm">
						{formatPrice(item.subtotal, displayOrder.currency)}
					</span>
				</div>
			))}
		</div>
	);

	const fulfillmentsContent =
		fulfillments.length > 0 ? (
			<div className="mb-6 space-y-3">
				{fulfillments.map((f) => (
					<FulfillmentCard key={f.id} f={f} />
				))}
			</div>
		) : null;

	const totalsContent = (
		<div className="mb-6 rounded-xl border border-border p-4">
			<div className="space-y-1.5 text-sm">
				<div className="flex justify-between">
					<span className="text-muted-foreground">Subtotal</span>
					<span className="text-foreground">
						{formatPrice(displayOrder.subtotal, displayOrder.currency)}
					</span>
				</div>
				{displayOrder.discountAmount > 0 && (
					<div className="flex justify-between">
						<span className="text-muted-foreground">Discount</span>
						<span className="text-emerald-600 dark:text-emerald-400">
							-{formatPrice(displayOrder.discountAmount, displayOrder.currency)}
						</span>
					</div>
				)}
				{displayOrder.shippingAmount > 0 && (
					<div className="flex justify-between">
						<span className="text-muted-foreground">Shipping</span>
						<span className="text-foreground">
							{formatPrice(displayOrder.shippingAmount, displayOrder.currency)}
						</span>
					</div>
				)}
				{displayOrder.taxAmount > 0 && (
					<div className="flex justify-between">
						<span className="text-muted-foreground">Tax</span>
						<span className="text-foreground">
							{formatPrice(displayOrder.taxAmount, displayOrder.currency)}
						</span>
					</div>
				)}
				<div className="flex justify-between border-border border-t pt-1.5 font-medium">
					<span className="text-foreground">Total</span>
					<span className="text-foreground">
						{formatPrice(displayOrder.total, displayOrder.currency)}
					</span>
				</div>
			</div>
		</div>
	);

	const addressesContent =
		shipping || billing ? (
			<div className="grid gap-4 sm:grid-cols-2">
				{shipping && (
					<AddressCard title="Shipping Address" address={shipping} />
				)}
				{billing && <AddressCard title="Billing Address" address={billing} />}
			</div>
		) : null;

	return (
		<OrderDetailTemplate
			onBack={handleBack}
			orderNumber={displayOrder.orderNumber}
			date={formatDate(displayOrder.createdAt)}
			statusBadges={statusBadges}
			cancellable={cancellable}
			cancelPending={cancelMutation.isPending}
			onCancel={() => cancelMutation.mutate({ params: { id: orderId } })}
			cancelError={cancelError || null}
			itemsContent={itemsContent}
			fulfillmentsContent={fulfillmentsContent}
			totalsContent={totalsContent}
			addressesContent={addressesContent}
			notes={displayOrder.notes ?? null}
		/>
	);
}
