"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import CheckoutDetailTemplate from "./checkout-detail.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckoutAddress {
	firstName: string;
	lastName: string;
	company?: string | null;
	line1: string;
	line2?: string | null;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string | null;
}

interface CheckoutLineItem {
	productId: string;
	variantId?: string | null;
	name: string;
	sku?: string | null;
	price: number;
	quantity: number;
}

interface CheckoutSession {
	id: string;
	cartId?: string | null;
	customerId?: string | null;
	guestEmail?: string | null;
	status: string;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	total: number;
	currency: string;
	discountCode?: string | null;
	giftCardCode?: string | null;
	shippingAddress?: CheckoutAddress | null;
	billingAddress?: CheckoutAddress | null;
	paymentMethod?: string | null;
	paymentIntentId?: string | null;
	paymentStatus?: string | null;
	orderId?: string | null;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
}

interface DetailResult {
	session: CheckoutSession;
	lineItems: CheckoutLineItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function formatDate(dateStr: string): string {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(dateStr));
}

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	abandoned:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	expired: "bg-muted text-muted-foreground",
};

function useCheckoutAdminApi() {
	const client = useModuleClient();
	return {
		getSession: client.module("checkout").admin["/admin/checkout/sessions/:id"],
	};
}

function AddressCard({
	label,
	address,
}: {
	label: string;
	address: CheckoutAddress;
}) {
	return (
		<div className="rounded-lg border border-border p-4">
			<h3 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</h3>
			<p className="text-foreground text-sm">
				{address.firstName} {address.lastName}
			</p>
			{address.company && (
				<p className="text-muted-foreground text-sm">{address.company}</p>
			)}
			<p className="text-muted-foreground text-sm">{address.line1}</p>
			{address.line2 && (
				<p className="text-muted-foreground text-sm">{address.line2}</p>
			)}
			<p className="text-muted-foreground text-sm">
				{address.city}, {address.state} {address.postalCode}
			</p>
			<p className="text-muted-foreground text-sm">{address.country}</p>
			{address.phone && (
				<p className="mt-1 text-muted-foreground text-sm">{address.phone}</p>
			)}
		</div>
	);
}

// ─── CheckoutDetail ───────────────────────────────────────────────────────────

export function CheckoutDetail({
	params,
}: {
	params?: Record<string, string>;
}) {
	const id = params?.id ?? "";
	const api = useCheckoutAdminApi();

	const { data, isLoading, error } = api.getSession.useQuery({
		id,
	}) as {
		data: DetailResult | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	if (isLoading) {
		const content = (
			<div className="space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted" />
				<div className="h-32 animate-pulse rounded-lg bg-muted" />
				<div className="h-48 animate-pulse rounded-lg bg-muted" />
			</div>
		);
		return <CheckoutDetailTemplate content={content} />;
	}

	if (error || !data) {
		const content = (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center"
			>
				<p className="font-medium text-destructive">
					{error?.message ?? "Checkout session not found"}
				</p>
				<button
					type="button"
					onClick={() => {
						window.location.href = "/admin/checkout";
					}}
					className="mt-3 rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
				>
					Back to Checkout
				</button>
			</div>
		);
		return <CheckoutDetailTemplate content={content} />;
	}

	const { session, lineItems } = data;

	const content = (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<button
						type="button"
						onClick={() => {
							window.location.href = "/admin/checkout";
						}}
						className="mb-2 text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to Checkout
					</button>
					<h1 className="font-bold text-2xl text-foreground">
						Session{" "}
						<span className="font-mono text-lg">
							{session.id.slice(0, 8)}...
						</span>
					</h1>
					<div className="mt-2 flex items-center gap-3">
						<span
							className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_COLORS[session.status] ?? "bg-muted text-muted-foreground"}`}
						>
							{session.status}
						</span>
						{session.paymentStatus && (
							<span className="text-muted-foreground text-sm">
								Payment: {session.paymentStatus}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-lg border border-border p-4">
					<p className="text-muted-foreground text-xs">Customer</p>
					<p className="mt-1 font-medium text-foreground text-sm">
						{session.guestEmail ??
							(session.customerId ? "Registered customer" : "Guest")}
					</p>
				</div>
				<div className="rounded-lg border border-border p-4">
					<p className="text-muted-foreground text-xs">Created</p>
					<p className="mt-1 font-medium text-foreground text-sm">
						{formatDate(session.createdAt)}
					</p>
				</div>
				<div className="rounded-lg border border-border p-4">
					<p className="text-muted-foreground text-xs">Expires</p>
					<p className="mt-1 font-medium text-foreground text-sm">
						{formatDate(session.expiresAt)}
					</p>
				</div>
				{session.orderId && (
					<div className="rounded-lg border border-border p-4">
						<p className="text-muted-foreground text-xs">Order</p>
						<button
							type="button"
							onClick={() => {
								window.location.href = `/admin/orders/${session.orderId}`;
							}}
							className="mt-1 font-medium font-mono text-foreground text-sm underline underline-offset-2 hover:text-foreground/80"
						>
							{session.orderId.slice(0, 8)}...
						</button>
					</div>
				)}
			</div>

			{/* Line Items */}
			<div className="rounded-lg border border-border bg-card">
				<div className="border-border border-b px-4 py-3">
					<h2 className="font-semibold text-foreground text-sm">
						Line Items ({lineItems.length})
					</h2>
				</div>
				{lineItems.length === 0 ? (
					<div className="px-4 py-8 text-center text-muted-foreground text-sm">
						No line items
					</div>
				) : (
					<table className="w-full">
						<thead>
							<tr className="border-border border-b bg-muted/50">
								<th
									scope="col"
									className="px-4 py-2 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									Product
								</th>
								<th
									scope="col"
									className="hidden px-4 py-2 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
								>
									SKU
								</th>
								<th
									scope="col"
									className="px-4 py-2 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									Price
								</th>
								<th
									scope="col"
									className="px-4 py-2 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									Qty
								</th>
								<th
									scope="col"
									className="px-4 py-2 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
								>
									Subtotal
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{lineItems.map((item) => (
								<tr key={`${item.productId}-${item.variantId ?? ""}`}>
									<td className="px-4 py-3">
										<p className="font-medium text-foreground text-sm">
											{item.name}
										</p>
										{item.variantId && (
											<p className="text-muted-foreground text-xs">
												Variant: {item.variantId}
											</p>
										)}
									</td>
									<td className="hidden px-4 py-3 text-muted-foreground text-sm sm:table-cell">
										{item.sku ?? "—"}
									</td>
									<td className="px-4 py-3 text-right text-foreground text-sm">
										{formatPrice(item.price, session.currency)}
									</td>
									<td className="px-4 py-3 text-right text-foreground text-sm">
										{item.quantity}
									</td>
									<td className="px-4 py-3 text-right font-medium text-foreground text-sm">
										{formatPrice(item.price * item.quantity, session.currency)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			{/* Order Summary */}
			<div className="rounded-lg border border-border bg-card p-4">
				<h2 className="mb-3 font-semibold text-foreground text-sm">
					Order Summary
				</h2>
				<div className="space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Subtotal</span>
						<span className="text-foreground">
							{formatPrice(session.subtotal, session.currency)}
						</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Tax</span>
						<span className="text-foreground">
							{formatPrice(session.taxAmount, session.currency)}
						</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Shipping</span>
						<span className="text-foreground">
							{formatPrice(session.shippingAmount, session.currency)}
						</span>
					</div>
					{session.discountAmount > 0 && (
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">
								Discount
								{session.discountCode ? ` (${session.discountCode})` : ""}
							</span>
							<span className="text-green-600 dark:text-green-400">
								-{formatPrice(session.discountAmount, session.currency)}
							</span>
						</div>
					)}
					{session.giftCardAmount > 0 && (
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">
								Gift Card
								{session.giftCardCode ? ` (${session.giftCardCode})` : ""}
							</span>
							<span className="text-green-600 dark:text-green-400">
								-{formatPrice(session.giftCardAmount, session.currency)}
							</span>
						</div>
					)}
					<div className="flex justify-between border-border border-t pt-2 font-semibold text-sm">
						<span className="text-foreground">Total</span>
						<span className="text-foreground">
							{formatPrice(session.total, session.currency)}
						</span>
					</div>
				</div>
			</div>

			{/* Addresses */}
			{(session.shippingAddress || session.billingAddress) && (
				<div className="grid gap-4 sm:grid-cols-2">
					{session.shippingAddress && (
						<AddressCard
							label="Shipping Address"
							address={session.shippingAddress}
						/>
					)}
					{session.billingAddress && (
						<AddressCard
							label="Billing Address"
							address={session.billingAddress}
						/>
					)}
				</div>
			)}

			{/* Payment & Reference Info */}
			{(session.paymentIntentId || session.cartId) && (
				<div className="rounded-lg border border-border bg-card p-4">
					<h2 className="mb-3 font-semibold text-foreground text-sm">
						References
					</h2>
					<div className="space-y-1 text-sm">
						{session.paymentIntentId && (
							<div className="flex gap-2">
								<span className="text-muted-foreground">Payment Intent:</span>
								<span className="font-mono text-foreground">
									{session.paymentIntentId}
								</span>
							</div>
						)}
						{session.cartId && (
							<div className="flex gap-2">
								<span className="text-muted-foreground">Cart:</span>
								<span className="font-mono text-foreground">
									{session.cartId}
								</span>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);

	return <CheckoutDetailTemplate content={content} />;
}
