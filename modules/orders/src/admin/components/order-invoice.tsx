"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useEffect, useState } from "react";
import OrderInvoiceTemplate from "./order-invoice.mdx";

// ── Types ──────────────────────────────────────────────────────────────────

interface InvoiceLineItem {
	name: string;
	sku?: string | null;
	quantity: number;
	unitPrice: number;
	subtotal: number;
}

interface InvoiceAddress {
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

interface InvoiceData {
	invoiceNumber: string;
	orderNumber: string;
	orderId: string;
	issueDate: string;
	dueDate: string;
	status: string;
	customerName: string;
	customerEmail?: string | null;
	billingAddress?: InvoiceAddress | null;
	shippingAddress?: InvoiceAddress | null;
	lineItems: InvoiceLineItem[];
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	total: number;
	currency: string;
	storeName: string;
	notes?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

const STATUS_COLORS: Record<string, string> = {
	paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	issued: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	draft: "bg-muted text-muted-foreground",
	void: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// ── Component ──────────────────────────────────────────────────────────────

export function OrderInvoice({ orderId }: { orderId: string }) {
	const client = useModuleClient();
	const api = client.module("orders").admin["/admin/orders/:id/invoice"];

	const [invoice, setInvoice] = useState<InvoiceData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const fetchInvoice = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const res = (await api.fetch({ params: { id: orderId } })) as {
				invoice?: InvoiceData;
				error?: string;
			};
			if (res.error) {
				setError(res.error);
			} else if (res.invoice) {
				setInvoice(res.invoice);
			}
		} catch {
			setError("Failed to load invoice");
		} finally {
			setLoading(false);
		}
	}, [api, orderId]);

	useEffect(() => {
		fetchInvoice();
	}, [fetchInvoice]);

	const handlePrint = useCallback(() => {
		window.print();
	}, []);

	if (loading) {
		const content = (
			<div className="flex min-h-[400px] items-center justify-center">
				<p className="text-muted-foreground text-sm">Loading invoice...</p>
			</div>
		);
		return <OrderInvoiceTemplate content={content} />;
	}

	if (error || !invoice) {
		const content = (
			<div className="flex min-h-[400px] items-center justify-center">
				<p className="text-red-600 text-sm">{error || "Invoice not found"}</p>
			</div>
		);
		return <OrderInvoiceTemplate content={content} />;
	}

	const content = (
		<div className="mx-auto max-w-3xl">
			{/* Actions bar — hidden when printing */}
			<div className="mb-6 flex items-center justify-between print:hidden">
				<h2 className="font-semibold text-foreground text-lg">Invoice</h2>
				<button
					type="button"
					onClick={handlePrint}
					className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm transition-colors hover:bg-foreground/90"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 256 256"
						fill="currentColor"
						aria-hidden="true"
					>
						<path d="M214.67,166H200V136a8,8,0,0,0-8-8H64a8,8,0,0,0-8,8v30H41.33C27.36,166,16,177.05,16,190.67v26.66C16,230.95,27.36,242,41.33,242H214.67C228.64,242,240,230.95,240,217.33V190.67C240,177.05,228.64,166,214.67,166ZM72,144H184v22H72Zm152,73.33A9.34,9.34,0,0,1,214.67,226H41.33A9.34,9.34,0,0,1,32,217.33V190.67A9.34,9.34,0,0,1,41.33,182H56v10a8,8,0,0,0,8,8H192a8,8,0,0,0,8-8V182h14.67A9.34,9.34,0,0,1,224,190.67ZM72,108V40a8,8,0,0,1,16,0v68a8,8,0,0,1-16,0Zm48,0V40a8,8,0,0,1,16,0v68a8,8,0,0,1-16,0Zm48,0V40a8,8,0,0,1,16,0v68a8,8,0,0,1-16,0Z" />
					</svg>
					Print / Download PDF
				</button>
			</div>

			{/* Invoice document */}
			<div className="rounded-lg border border-border bg-white p-8 dark:bg-background">
				{/* Invoice header */}
				<div className="mb-8 flex items-start justify-between">
					<div>
						<h1 className="font-bold text-2xl text-foreground">INVOICE</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							{invoice.invoiceNumber}
						</p>
					</div>
					<div className="text-right">
						<p className="font-semibold text-foreground text-lg">
							{invoice.storeName}
						</p>
						<span
							className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_COLORS[invoice.status] ?? "bg-muted text-muted-foreground"}`}
						>
							{invoice.status.toUpperCase()}
						</span>
					</div>
				</div>

				{/* Meta row */}
				<div className="mb-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
					<div>
						<p className="font-medium text-muted-foreground text-xs uppercase">
							Order
						</p>
						<p className="mt-1 text-foreground text-sm">
							{invoice.orderNumber}
						</p>
					</div>
					<div>
						<p className="font-medium text-muted-foreground text-xs uppercase">
							Issue Date
						</p>
						<p className="mt-1 text-foreground text-sm">{invoice.issueDate}</p>
					</div>
					{invoice.status !== "paid" && invoice.status !== "void" && (
						<div>
							<p className="font-medium text-muted-foreground text-xs uppercase">
								Due Date
							</p>
							<p className="mt-1 text-foreground text-sm">{invoice.dueDate}</p>
						</div>
					)}
					{invoice.customerEmail && (
						<div>
							<p className="font-medium text-muted-foreground text-xs uppercase">
								Email
							</p>
							<p className="mt-1 text-foreground text-sm">
								{invoice.customerEmail}
							</p>
						</div>
					)}
				</div>

				{/* Addresses */}
				<div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
					<div>
						<p className="mb-2 font-semibold text-foreground text-sm">
							Bill To
						</p>
						<p className="text-foreground text-sm">{invoice.customerName}</p>
						{invoice.billingAddress && (
							<div className="mt-1 text-muted-foreground text-sm">
								{invoice.billingAddress.company && (
									<p>{invoice.billingAddress.company}</p>
								)}
								<p>{invoice.billingAddress.line1}</p>
								{invoice.billingAddress.line2 && (
									<p>{invoice.billingAddress.line2}</p>
								)}
								<p>
									{invoice.billingAddress.city}, {invoice.billingAddress.state}{" "}
									{invoice.billingAddress.postalCode}
								</p>
								<p>{invoice.billingAddress.country}</p>
							</div>
						)}
					</div>
					{invoice.shippingAddress && (
						<div>
							<p className="mb-2 font-semibold text-foreground text-sm">
								Ship To
							</p>
							<p className="text-foreground text-sm">
								{invoice.shippingAddress.firstName}{" "}
								{invoice.shippingAddress.lastName}
							</p>
							<div className="mt-1 text-muted-foreground text-sm">
								{invoice.shippingAddress.company && (
									<p>{invoice.shippingAddress.company}</p>
								)}
								<p>{invoice.shippingAddress.line1}</p>
								{invoice.shippingAddress.line2 && (
									<p>{invoice.shippingAddress.line2}</p>
								)}
								<p>
									{invoice.shippingAddress.city},{" "}
									{invoice.shippingAddress.state}{" "}
									{invoice.shippingAddress.postalCode}
								</p>
								<p>{invoice.shippingAddress.country}</p>
							</div>
						</div>
					)}
				</div>

				{/* Line items table */}
				<div className="overflow-hidden rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/50">
								<th
									scope="col"
									className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs uppercase"
								>
									Item
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 text-center font-medium text-muted-foreground text-xs uppercase"
								>
									Qty
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs uppercase"
								>
									Price
								</th>
								<th
									scope="col"
									className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs uppercase"
								>
									Amount
								</th>
							</tr>
						</thead>
						<tbody>
							{invoice.lineItems.map((item) => (
								<tr
									key={`${item.name}-${item.quantity}`}
									className="border-border border-b last:border-b-0"
								>
									<td className="px-4 py-3">
										<p className="text-foreground">{item.name}</p>
										{item.sku && (
											<p className="text-muted-foreground text-xs">
												SKU: {item.sku}
											</p>
										)}
									</td>
									<td className="px-4 py-3 text-center text-foreground">
										{item.quantity}
									</td>
									<td className="px-4 py-3 text-right text-foreground">
										{formatPrice(item.unitPrice, invoice.currency)}
									</td>
									<td className="px-4 py-3 text-right font-medium text-foreground">
										{formatPrice(item.subtotal, invoice.currency)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Totals */}
				<div className="mt-6 flex justify-end">
					<div className="w-64 space-y-2">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Subtotal</span>
							<span className="text-foreground">
								{formatPrice(invoice.subtotal, invoice.currency)}
							</span>
						</div>
						{invoice.discountAmount > 0 && (
							<div className="flex justify-between text-sm">
								<span className="text-green-600">Discount</span>
								<span className="text-green-600">
									-{formatPrice(invoice.discountAmount, invoice.currency)}
								</span>
							</div>
						)}
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Shipping</span>
							<span className="text-foreground">
								{invoice.shippingAmount === 0
									? "Free"
									: formatPrice(invoice.shippingAmount, invoice.currency)}
							</span>
						</div>
						{invoice.taxAmount > 0 && (
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Tax</span>
								<span className="text-foreground">
									{formatPrice(invoice.taxAmount, invoice.currency)}
								</span>
							</div>
						)}
						<div className="flex justify-between border-border border-t pt-2">
							<span className="font-semibold text-foreground">Total</span>
							<span className="font-semibold text-foreground text-lg">
								{formatPrice(invoice.total, invoice.currency)}
							</span>
						</div>
					</div>
				</div>

				{/* Notes */}
				{invoice.notes && (
					<div className="mt-8 border-border border-t pt-6">
						<p className="mb-1 font-semibold text-foreground text-sm">Notes</p>
						<p className="text-muted-foreground text-sm">{invoice.notes}</p>
					</div>
				)}
			</div>
		</div>
	);

	return <OrderInvoiceTemplate content={content} />;
}
