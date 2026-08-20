"use client";

import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { useOrdersApi } from "./_hooks";
import type {
	FulfillmentWithItems,
	OrderAddress,
	OrderWithDetails,
} from "./_types";
import {
	FULFILLMENT_STYLES,
	formatDate,
	formatPrice,
	PAYMENT_STYLES,
	STATUS_STYLES,
} from "./_utils";
import OrderTrackerTemplate from "./order-tracker.mdx";
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
			{f.deliveredAt && (
				<p className="mt-1 text-muted-foreground text-xs">
					Delivered {formatDate(f.deliveredAt)}
				</p>
			)}
		</div>
	);
}

export function OrderTracker() {
	const api = useOrdersApi();
	const [orderNumber, setOrderNumber] = useState("");
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [order, setOrder] = useState<OrderWithDetails | null>(null);
	const [fulfillments, setFulfillments] = useState<FulfillmentWithItems[]>([]);

	const handleSubmit = useCallback(
		async (e: FormEvent) => {
			e.preventDefault();
			setError("");
			setLoading(true);

			try {
				const result = (await api.trackOrder.fetch({
					body: { orderNumber: orderNumber.trim(), email: email.trim() },
				})) as {
					order?: OrderWithDetails;
					fulfillments?: FulfillmentWithItems[];
					error?: string;
					status?: number;
				};

				if (result.error || !result.order) {
					setError(
						"No order found matching that order number and email address.",
					);
					setOrder(null);
					setFulfillments([]);
				} else {
					setOrder(result.order);
					setFulfillments(result.fulfillments ?? []);
				}
			} catch {
				setError(
					"No order found matching that order number and email address.",
				);
				setOrder(null);
				setFulfillments([]);
			} finally {
				setLoading(false);
			}
		},
		[api.trackOrder, orderNumber, email],
	);

	const handleReset = useCallback(() => {
		setOrder(null);
		setFulfillments([]);
		setError("");
		setOrderNumber("");
		setEmail("");
	}, []);

	const onOrderNumberChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => setOrderNumber(e.target.value),
		[],
	);

	const onEmailChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
		[],
	);

	const orderContent = order ? (
		<div>
			{/* Header */}
			<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 className="font-semibold text-foreground text-xl">
						{order.orderNumber}
					</h2>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Placed on {formatDate(order.createdAt)}
					</p>
					<div className="mt-2 flex gap-2">
						<StatusBadge value={order.status} styles={STATUS_STYLES} />
						<StatusBadge value={order.paymentStatus} styles={PAYMENT_STYLES} />
					</div>
				</div>
			</div>

			{/* Items */}
			<div className="mb-6 overflow-hidden rounded-xl border border-border">
				<div className="border-border border-b bg-muted/40 px-4 py-2.5">
					<h3 className="font-medium text-foreground text-sm">Items</h3>
				</div>
				{order.items.map((item) => (
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
							{formatPrice(item.subtotal, order.currency)}
						</span>
					</div>
				))}
			</div>

			{/* Fulfillments */}
			{fulfillments.length > 0 && (
				<div className="mb-6">
					<h3 className="mb-3 font-medium text-foreground text-sm">
						Shipments
					</h3>
					<div className="space-y-3">
						{fulfillments.map((f) => (
							<FulfillmentCard key={f.id} f={f} />
						))}
					</div>
				</div>
			)}

			{/* Totals */}
			<div className="mb-6 rounded-xl border border-border p-4">
				<div className="space-y-1.5 text-sm">
					<div className="flex justify-between">
						<span className="text-muted-foreground">Subtotal</span>
						<span className="text-foreground">
							{formatPrice(order.subtotal, order.currency)}
						</span>
					</div>
					{order.discountAmount > 0 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Discount</span>
							<span className="text-emerald-600 dark:text-emerald-400">
								-{formatPrice(order.discountAmount, order.currency)}
							</span>
						</div>
					)}
					{order.giftCardAmount > 0 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Gift Card</span>
							<span className="text-emerald-600 dark:text-emerald-400">
								-{formatPrice(order.giftCardAmount, order.currency)}
							</span>
						</div>
					)}
					{order.shippingAmount > 0 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Shipping</span>
							<span className="text-foreground">
								{formatPrice(order.shippingAmount, order.currency)}
							</span>
						</div>
					)}
					{order.taxAmount > 0 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Tax</span>
							<span className="text-foreground">
								{formatPrice(order.taxAmount, order.currency)}
							</span>
						</div>
					)}
					<div className="flex justify-between border-border border-t pt-1.5 font-medium">
						<span className="text-foreground">Total</span>
						<span className="text-foreground">
							{formatPrice(order.total, order.currency)}
						</span>
					</div>
				</div>
			</div>

			{/* Addresses */}
			{(order.addresses.find((a) => a.type === "shipping") ||
				order.addresses.find((a) => a.type === "billing")) && (
				<div className="grid gap-4 sm:grid-cols-2">
					{order.addresses.find((a) => a.type === "shipping") && (
						<AddressCard
							title="Shipping Address"
							address={
								order.addresses.find(
									(a) => a.type === "shipping",
								) as OrderAddress
							}
						/>
					)}
					{order.addresses.find((a) => a.type === "billing") && (
						<AddressCard
							title="Billing Address"
							address={
								order.addresses.find(
									(a) => a.type === "billing",
								) as OrderAddress
							}
						/>
					)}
				</div>
			)}
		</div>
	) : null;

	return (
		<OrderTrackerTemplate
			orderNumber={orderNumber}
			email={email}
			error={error}
			loading={loading}
			order={order}
			onSubmit={handleSubmit}
			onReset={handleReset}
			onOrderNumberChange={onOrderNumberChange}
			onEmailChange={onEmailChange}
			orderContent={orderContent}
		/>
	);
}
