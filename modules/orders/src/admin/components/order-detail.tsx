"use client";

import { ModuleClientError } from "@86d-app/core/client/hooks";
import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OrderDetailTemplate from "./order-detail.mdx";

// ── Types ──────────────────────────────────────────────────────────────────

interface OrderItem {
	id: string;
	productId: string;
	variantId?: string | undefined;
	name: string;
	sku?: string | undefined;
	price: number;
	quantity: number;
	subtotal: number;
}

interface OrderAddress {
	id: string;
	type: string;
	firstName: string;
	lastName: string;
	company?: string | undefined;
	line1: string;
	line2?: string | undefined;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string | undefined;
}

interface OrderWithDetails {
	id: string;
	orderNumber: string;
	customerId?: string | null;
	guestEmail?: string | null;
	status: string;
	paymentStatus: string;
	subtotal: number;
	taxAmount: number;
	shippingAmount: number;
	discountAmount: number;
	giftCardAmount: number;
	total: number;
	currency: string;
	notes?: string | undefined;
	createdAt: string;
	updatedAt: string;
	items: OrderItem[];
	addresses: OrderAddress[];
}

interface FulfillmentItem {
	id: string;
	fulfillmentId: string;
	orderItemId: string;
	quantity: number;
}

interface FulfillmentWithItems {
	id: string;
	orderId: string;
	status: string;
	trackingNumber?: string | null;
	trackingUrl?: string | null;
	carrier?: string | null;
	notes?: string | null;
	shippedAt?: string | null;
	deliveredAt?: string | null;
	createdAt: string;
	updatedAt: string;
	items: FulfillmentItem[];
}

type OrderFulfillmentStatus =
	| "unfulfilled"
	| "partially_fulfilled"
	| "fulfilled";

interface ReturnItemData {
	id: string;
	returnRequestId: string;
	orderItemId: string;
	quantity: number;
	reason?: string | null;
}

interface ReturnRequestWithItems {
	id: string;
	orderId: string;
	status: string;
	type: string;
	reason: string;
	customerNotes?: string | null;
	adminNotes?: string | null;
	refundAmount?: number | null;
	trackingNumber?: string | null;
	trackingUrl?: string | null;
	carrier?: string | null;
	createdAt: string;
	updatedAt: string;
	items: ReturnItemData[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	on_hold:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-muted text-muted-foreground",
	refunded: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const FULFILLMENT_STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	in_transit:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	delivered:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const FULFILLMENT_ORDER_COLORS: Record<string, string> = {
	unfulfilled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	partially_fulfilled:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	fulfilled:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const RETURN_STATUS_COLORS: Record<string, string> = {
	requested:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	shipped_back:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	received:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	refunded:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function Badge({
	value,
	colors,
}: {
	value: string;
	colors: Record<string, string>;
}) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${colors[value] ?? "bg-muted text-muted-foreground"}`}
		>
			{value.replace(/_/g, " ")}
		</span>
	);
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
	unpaid: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	partially_paid:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	refunded:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	voided: "bg-muted text-muted-foreground",
};

const ORDER_STATUSES = [
	"pending",
	"processing",
	"on_hold",
	"completed",
	"cancelled",
	"refunded",
] as const;

const PAYMENT_STATUSES = [
	"unpaid",
	"paid",
	"partially_paid",
	"refunded",
	"voided",
] as const;

function useOrderAdminApi() {
	const client = useModuleClient();
	return {
		getOrder: client.module("orders").admin["/admin/orders/:id"],
		updateOrder: client.module("orders").admin["/admin/orders/:id/update"],
		listFulfillments:
			client.module("orders").admin["/admin/orders/:id/fulfillments"],
		createFulfillment:
			client.module("fulfillment").admin["/admin/fulfillment/create"],
		updateFulfillment:
			client.module("orders").admin["/admin/fulfillments/:id/update"],
		deleteFulfillment:
			client.module("orders").admin["/admin/fulfillments/:id/delete"],
		updateReturn:
			client.module("orders").admin["/admin/orders/returns/:id/update"],
		deleteReturn:
			client.module("orders").admin["/admin/orders/returns/:id/delete"],
		listOrderReturns:
			client.module("orders").admin["/admin/orders/:id/returns"],
	};
}

// ── Status Manager ────────────────────────────────────────────────────────

function StatusManager({
	orderId,
	currentStatus,
	currentPaymentStatus,
	onUpdated,
}: {
	orderId: string;
	currentStatus: string;
	currentPaymentStatus: string;
	onUpdated: () => void;
}) {
	const api = useOrderAdminApi();
	const [status, setStatus] = useState(currentStatus);
	const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus);
	const [success, setSuccess] = useState("");

	const statusDirty = status !== currentStatus;
	const paymentDirty = paymentStatus !== currentPaymentStatus;

	const updateMutation = api.updateOrder.useMutation({
		onSuccess: () => {
			setSuccess("Updated");
			onUpdated();
			setTimeout(() => setSuccess(""), 2000);
		},
	});

	const handleSave = () => {
		const body: Record<string, string> = {};
		if (statusDirty) body.status = status;
		if (paymentDirty) body.paymentStatus = paymentStatus;
		if (Object.keys(body).length === 0) return;
		updateMutation.mutate({ params: { id: orderId }, body });
	};

	return (
		<div className="rounded-lg border border-border p-4">
			<h3 className="mb-3 font-semibold text-foreground text-sm">
				Order Status
			</h3>
			<div className="space-y-3">
				<div>
					<label
						htmlFor="order-status-select"
						className="mb-1 block text-muted-foreground text-xs"
					>
						Status
					</label>
					<select
						id="order-status-select"
						value={status}
						onChange={(e) => setStatus(e.target.value)}
						className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
					>
						{ORDER_STATUSES.map((s) => (
							<option key={s} value={s}>
								{s.replace(/_/g, " ")}
							</option>
						))}
					</select>
				</div>
				<div>
					<label
						htmlFor="payment-status-select"
						className="mb-1 block text-muted-foreground text-xs"
					>
						Payment
					</label>
					<select
						id="payment-status-select"
						value={paymentStatus}
						onChange={(e) => setPaymentStatus(e.target.value)}
						className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
					>
						{PAYMENT_STATUSES.map((s) => (
							<option key={s} value={s}>
								{s.replace(/_/g, " ")}
							</option>
						))}
					</select>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						disabled={
							updateMutation.isPending || (!statusDirty && !paymentDirty)
						}
						onClick={handleSave}
						className="rounded-md bg-foreground px-3 py-1.5 text-background text-sm hover:bg-foreground/90 disabled:opacity-50"
					>
						{updateMutation.isPending ? "Saving..." : "Update Status"}
					</button>
					{success && (
						<span className="text-emerald-600 text-xs dark:text-emerald-400">
							{success}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

// ── Notes Manager ─────────────────────────────────────────────────────────

function NotesManager({
	orderId,
	currentNotes,
	onUpdated,
}: {
	orderId: string;
	currentNotes: string;
	onUpdated: () => void;
}) {
	const api = useOrderAdminApi();
	const [editing, setEditing] = useState(false);
	const [notes, setNotes] = useState(currentNotes);
	const [success, setSuccess] = useState("");

	const updateMutation = api.updateOrder.useMutation({
		onSuccess: () => {
			setEditing(false);
			setSuccess("Saved");
			onUpdated();
			setTimeout(() => setSuccess(""), 2000);
		},
	});

	const handleSave = () => {
		updateMutation.mutate({
			params: { id: orderId },
			body: { notes },
		});
	};

	return (
		<div className="rounded-lg border border-border p-4">
			<div className="mb-2 flex items-center justify-between">
				<h3 className="font-semibold text-foreground text-sm">Notes</h3>
				<div className="flex items-center gap-2">
					{success && (
						<span className="text-emerald-600 text-xs dark:text-emerald-400">
							{success}
						</span>
					)}
					{!editing && (
						<button
							type="button"
							onClick={() => setEditing(true)}
							className="rounded px-2 py-0.5 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
						>
							{currentNotes ? "Edit" : "Add note"}
						</button>
					)}
				</div>
			</div>
			{editing ? (
				<div>
					<textarea
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						rows={3}
						placeholder="Internal notes about this order..."
						className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							disabled={updateMutation.isPending}
							onClick={handleSave}
							className="rounded-md bg-foreground px-3 py-1.5 text-background text-sm hover:bg-foreground/90 disabled:opacity-50"
						>
							{updateMutation.isPending ? "Saving..." : "Save"}
						</button>
						<button
							type="button"
							onClick={() => {
								setEditing(false);
								setNotes(currentNotes);
							}}
							className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</div>
			) : currentNotes ? (
				<p className="whitespace-pre-wrap text-muted-foreground text-sm">
					{currentNotes}
				</p>
			) : (
				<p className="text-muted-foreground/60 text-sm italic">No notes yet</p>
			)}
		</div>
	);
}

// ── Timeline ──────────────────────────────────────────────────────────────

interface TimelineEvent {
	date: string;
	label: string;
	detail?: string | undefined;
	icon: "order" | "fulfillment" | "return" | "payment";
}

function OrderTimeline({
	order,
	fulfillments,
	returns,
}: {
	order: OrderWithDetails;
	fulfillments: FulfillmentWithItems[];
	returns: ReturnRequestWithItems[];
}) {
	const events = useMemo(() => {
		const list: TimelineEvent[] = [];

		// Order created
		list.push({
			date: order.createdAt,
			label: "Order placed",
			detail: `${order.orderNumber} — ${formatPrice(order.total, order.currency)}`,
			icon: "order",
		});

		// Payment status
		if (order.paymentStatus === "paid") {
			list.push({
				date: order.updatedAt,
				label: "Payment received",
				detail: formatPrice(order.total, order.currency),
				icon: "payment",
			});
		}

		// Fulfillment events
		for (const f of fulfillments) {
			list.push({
				date: f.createdAt,
				label: "Fulfillment created",
				detail: f.carrier
					? `${f.carrier}${f.trackingNumber ? ` — ${f.trackingNumber}` : ""}`
					: undefined,
				icon: "fulfillment",
			});
			if (f.shippedAt) {
				list.push({
					date: f.shippedAt,
					label: "Shipped",
					detail: f.carrier
						? `${f.carrier}${f.trackingNumber ? ` ${f.trackingNumber}` : ""}`
						: undefined,
					icon: "fulfillment",
				});
			}
			if (f.deliveredAt) {
				list.push({
					date: f.deliveredAt,
					label: "Delivered",
					icon: "fulfillment",
				});
			}
		}

		// Return events
		for (const r of returns) {
			list.push({
				date: r.createdAt,
				label: "Return requested",
				detail: r.reason.replace(/_/g, " "),
				icon: "return",
			});
		}

		// Order status changes (inferred from current status + updatedAt)
		if (order.status !== "pending" && order.updatedAt !== order.createdAt) {
			list.push({
				date: order.updatedAt,
				label: `Status changed to ${order.status.replace(/_/g, " ")}`,
				icon: "order",
			});
		}

		return list.sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		);
	}, [order, fulfillments, returns]);

	const ICON_COLORS = {
		order: "bg-blue-500",
		fulfillment: "bg-green-500",
		return: "bg-orange-500",
		payment: "bg-emerald-500",
	};

	if (events.length === 0) return null;

	return (
		<div className="rounded-lg border border-border p-4">
			<h3 className="mb-3 font-semibold text-foreground text-sm">Timeline</h3>
			<div className="relative space-y-0">
				{events.map((event, idx) => (
					<div
						key={`${event.date}-${event.label}`}
						className="relative flex gap-3 pb-4 last:pb-0"
					>
						{/* Vertical line */}
						{idx < events.length - 1 && (
							<div className="absolute top-4 left-[7px] h-full w-px bg-border" />
						)}
						{/* Dot */}
						<div
							className={`relative mt-1 size-[15px] shrink-0 rounded-full ${ICON_COLORS[event.icon]}`}
						/>
						{/* Content */}
						<div className="min-w-0 flex-1">
							<p className="font-medium text-foreground text-sm">
								{event.label}
							</p>
							{event.detail && (
								<p className="text-muted-foreground text-xs">{event.detail}</p>
							)}
							<p className="mt-0.5 text-muted-foreground/70 text-xs">
								{formatDate(event.date)}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// ── Print Button ──────────────────────────────────────────────────────────

function PrintOrderButton() {
	const handlePrint = useCallback(() => {
		window.print();
	}, []);

	return (
		<button
			type="button"
			onClick={handlePrint}
			className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 font-medium text-sm hover:bg-muted"
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
				<polyline points="6 9 6 2 18 2 18 9" />
				<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
				<rect width="12" height="8" x="6" y="14" />
			</svg>
			Print
		</button>
	);
}

// ── Fulfill Order Dialog ───────────────────────────────────────────────────

function FulfillDialog({
	order,
	onClose,
	onCreated,
}: {
	order: OrderWithDetails;
	onClose: () => void;
	onCreated: () => void;
}) {
	const api = useOrderAdminApi();
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const [carrier, setCarrier] = useState("");
	const [trackingNumber, setTrackingNumber] = useState("");
	const [notes, setNotes] = useState("");
	const [error, setError] = useState("");
	// Select all items by default with full quantities
	const [selectedItems, setSelectedItems] = useState<Record<string, number>>(
		() => {
			const m: Record<string, number> = {};
			for (const item of order.items) {
				m[item.id] = item.quantity;
			}
			return m;
		},
	);

	const toggleItem = useCallback((itemId: string, maxQty: number) => {
		setSelectedItems((prev) => {
			if (prev[itemId] !== undefined) {
				const next = { ...prev };
				delete next[itemId];
				return next;
			}
			return { ...prev, [itemId]: maxQty };
		});
	}, []);

	const setItemQty = useCallback((itemId: string, qty: number) => {
		setSelectedItems((prev) => ({ ...prev, [itemId]: qty }));
	}, []);

	const createMutation = api.createFulfillment.useMutation({
		onSuccess: () => {
			onCreated();
			onClose();
		},
		onError: (err: Error) => {
			const body = err instanceof ModuleClientError ? err.body : undefined;
			setError(
				typeof body?.error === "string"
					? body.error
					: "Failed to create fulfillment.",
			);
		},
	});

	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);

	const itemEntries = Object.entries(selectedItems).filter(
		([, qty]) => qty > 0,
	);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (itemEntries.length === 0) {
			setError("Select at least one item to fulfill.");
			return;
		}
		setError("");
		createMutation.mutate({
			body: {
				orderId: order.id,
				notes: notes || undefined,
				items: itemEntries.map(([lineItemId, quantity]) => ({
					lineItemId,
					quantity,
				})),
			},
		});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div
				role="dialog"
				aria-modal="true"
				className="mx-4 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg"
			>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-semibold text-foreground text-lg">
						Fulfill Order
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-muted-foreground hover:text-foreground"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<title>Close</title>
							<path d="M18 6 6 18" />
							<path d="m6 6 12 12" />
						</svg>
					</button>
				</div>

				<form onSubmit={handleSubmit}>
					{/* Items selection */}
					<div className="mb-4">
						<span className="mb-1.5 block font-medium text-foreground text-sm">
							Items to fulfill
						</span>
						<div className="space-y-2 rounded-lg border border-border p-3">
							{order.items.map((item) => {
								const checked = selectedItems[item.id] !== undefined;
								return (
									<div key={item.id} className="flex items-center gap-3">
										<input
											type="checkbox"
											checked={checked}
											onChange={() => toggleItem(item.id, item.quantity)}
											className="size-4 rounded border-border"
										/>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm">{item.name}</p>
										</div>
										{checked && (
											<input
												type="number"
												min={1}
												max={item.quantity}
												value={selectedItems[item.id] ?? 1}
												onChange={(e) =>
													setItemQty(
														item.id,
														Math.min(
															item.quantity,
															Math.max(
																1,
																Number.parseInt(e.target.value, 10) || 1,
															),
														),
													)
												}
												className="h-8 w-16 rounded border border-border bg-background px-2 text-center text-sm"
											/>
										)}
										<span className="text-muted-foreground text-xs">
											/ {item.quantity}
										</span>
									</div>
								);
							})}
						</div>
					</div>

					{/* Carrier */}
					<div className="mb-3">
						<label
							htmlFor="fulfill-carrier"
							className="mb-1 block text-muted-foreground text-sm"
						>
							Carrier
						</label>
						<select
							id="fulfill-carrier"
							value={carrier}
							onChange={(e) => setCarrier(e.target.value)}
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
						>
							<option value="">Select carrier...</option>
							<option value="UPS">UPS</option>
							<option value="USPS">USPS</option>
							<option value="FedEx">FedEx</option>
							<option value="DHL">DHL</option>
							<option value="Other">Other</option>
						</select>
					</div>

					{/* Tracking Number */}
					<div className="mb-3">
						<label
							htmlFor="fulfill-tracking"
							className="mb-1 block text-muted-foreground text-sm"
						>
							Tracking Number
						</label>
						<input
							ref={firstInputRef}
							id="fulfill-tracking"
							type="text"
							value={trackingNumber}
							onChange={(e) => setTrackingNumber(e.target.value)}
							placeholder="e.g., 1Z999AA10123456784"
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground"
						/>
					</div>

					{/* Notes */}
					<div className="mb-4">
						<label
							htmlFor="fulfill-notes"
							className="mb-1 block text-muted-foreground text-sm"
						>
							Notes (optional)
						</label>
						<textarea
							id="fulfill-notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={2}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
							placeholder="Internal notes about this shipment..."
						/>
					</div>

					{error && <p className="mb-3 text-destructive text-sm">{error}</p>}

					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={createMutation.isPending || itemEntries.length === 0}
							className="rounded-md bg-foreground px-4 py-2 text-background text-sm hover:bg-foreground/90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create Fulfillment"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ── Fulfillment Card ───────────────────────────────────────────────────────

function FulfillmentCard({
	fulfillment,
	orderItems,
	onUpdated,
}: {
	fulfillment: FulfillmentWithItems;
	orderItems: OrderItem[];
	onUpdated: () => void;
}) {
	const api = useOrderAdminApi();
	const [editing, setEditing] = useState(false);
	const [status, setStatus] = useState(fulfillment.status);
	const [trackingNumber, setTrackingNumber] = useState(
		fulfillment.trackingNumber ?? "",
	);
	const [carrier, setCarrier] = useState(fulfillment.carrier ?? "");

	const updateMutation = api.updateFulfillment.useMutation({
		onSuccess: () => {
			setEditing(false);
			onUpdated();
		},
	});

	const deleteMutation = api.deleteFulfillment.useMutation({
		onSuccess: () => onUpdated(),
	});

	const itemMap = new Map(orderItems.map((i) => [i.id, i]));

	return (
		<div className="rounded-lg border border-border">
			<div className="flex items-center justify-between border-border border-b bg-muted/30 px-4 py-2.5">
				<div className="flex items-center gap-2">
					<Badge
						value={fulfillment.status}
						colors={FULFILLMENT_STATUS_COLORS}
					/>
					{fulfillment.carrier && (
						<span className="text-muted-foreground text-xs">
							{fulfillment.carrier}
						</span>
					)}
					{fulfillment.trackingNumber && (
						<span className="font-mono text-muted-foreground text-xs">
							{fulfillment.trackingNumber}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setEditing(!editing)}
						className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
					>
						{editing ? "Cancel" : "Edit"}
					</button>
					<button
						type="button"
						disabled={deleteMutation.isPending}
						onClick={() => {
							if (window.confirm("Delete this fulfillment?")) {
								deleteMutation.mutate({ params: { id: fulfillment.id } });
							}
						}}
						className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
					>
						Delete
					</button>
				</div>
			</div>

			{/* Items in this fulfillment */}
			<div className="px-4 py-2">
				{fulfillment.items.map((fi) => {
					const orderItem = itemMap.get(fi.orderItemId);
					return (
						<div
							key={fi.id}
							className="flex items-center justify-between py-1 text-sm"
						>
							<span className="text-foreground">
								{orderItem?.name ?? fi.orderItemId}
							</span>
							<span className="text-muted-foreground">x{fi.quantity}</span>
						</div>
					);
				})}
			</div>

			{/* Tracking link */}
			{fulfillment.trackingUrl && !editing && (
				<div className="border-border border-t px-4 py-2">
					<a
						href={fulfillment.trackingUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary text-sm underline-offset-4 hover:underline"
					>
						Track shipment &rarr;
					</a>
				</div>
			)}

			{/* Dates */}
			<div className="border-border border-t px-4 py-2 text-muted-foreground text-xs">
				Created {formatDate(fulfillment.createdAt)}
				{fulfillment.shippedAt &&
					` · Shipped ${formatDate(fulfillment.shippedAt)}`}
				{fulfillment.deliveredAt &&
					` · Delivered ${formatDate(fulfillment.deliveredAt)}`}
			</div>

			{/* Edit form */}
			{editing && (
				<div className="border-border border-t p-4">
					<div className="mb-3 grid gap-3 sm:grid-cols-3">
						<div>
							<label
								htmlFor={`f-status-${fulfillment.id}`}
								className="mb-1 block text-muted-foreground text-xs"
							>
								Status
							</label>
							<select
								id={`f-status-${fulfillment.id}`}
								value={status}
								onChange={(e) => setStatus(e.target.value)}
								className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
							>
								<option value="pending">Pending</option>
								<option value="shipped">Shipped</option>
								<option value="in_transit">In Transit</option>
								<option value="delivered">Delivered</option>
								<option value="failed">Failed</option>
							</select>
						</div>
						<div>
							<label
								htmlFor={`f-carrier-${fulfillment.id}`}
								className="mb-1 block text-muted-foreground text-xs"
							>
								Carrier
							</label>
							<input
								id={`f-carrier-${fulfillment.id}`}
								type="text"
								value={carrier}
								onChange={(e) => setCarrier(e.target.value)}
								className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
							/>
						</div>
						<div>
							<label
								htmlFor={`f-tracking-${fulfillment.id}`}
								className="mb-1 block text-muted-foreground text-xs"
							>
								Tracking #
							</label>
							<input
								id={`f-tracking-${fulfillment.id}`}
								type="text"
								value={trackingNumber}
								onChange={(e) => setTrackingNumber(e.target.value)}
								className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
							/>
						</div>
					</div>
					<button
						type="button"
						disabled={updateMutation.isPending}
						onClick={() =>
							updateMutation.mutate({
								params: { id: fulfillment.id },
								body: {
									status: status || undefined,
									carrier: carrier || undefined,
									trackingNumber: trackingNumber || undefined,
								},
							})
						}
						className="rounded-md bg-foreground px-3 py-1.5 text-background text-sm hover:bg-foreground/90 disabled:opacity-50"
					>
						{updateMutation.isPending ? "Saving..." : "Save"}
					</button>
				</div>
			)}
		</div>
	);
}

// ── Return Card ──────────────────────────────────────────────────────────

function ReturnCard({
	returnRequest,
	orderItems,
	onUpdated,
}: {
	returnRequest: ReturnRequestWithItems;
	orderItems: OrderItem[];
	onUpdated: () => void;
}) {
	const api = useOrderAdminApi();
	const [editing, setEditing] = useState(false);
	const [status, setStatus] = useState(returnRequest.status);
	const [adminNotes, setAdminNotes] = useState(returnRequest.adminNotes ?? "");
	const [refundAmount, setRefundAmount] = useState(
		returnRequest.refundAmount != null
			? String(returnRequest.refundAmount)
			: "",
	);

	const updateMutation = api.updateReturn.useMutation({
		onSuccess: () => {
			setEditing(false);
			onUpdated();
		},
	});

	const deleteMutation = api.deleteReturn.useMutation({
		onSuccess: () => onUpdated(),
	});

	const itemMap = new Map(orderItems.map((i) => [i.id, i]));

	return (
		<div className="rounded-lg border border-border">
			<div className="flex items-center justify-between border-border border-b bg-muted/30 px-4 py-2.5">
				<div className="flex items-center gap-2">
					<Badge value={returnRequest.status} colors={RETURN_STATUS_COLORS} />
					<span className="text-muted-foreground text-xs capitalize">
						{returnRequest.type.replace(/_/g, " ")}
					</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setEditing(!editing)}
						className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
					>
						{editing ? "Cancel" : "Review"}
					</button>
					<button
						type="button"
						disabled={deleteMutation.isPending}
						onClick={() => {
							if (window.confirm("Delete this return request?")) {
								deleteMutation.mutate({ params: { id: returnRequest.id } });
							}
						}}
						className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
					>
						Delete
					</button>
				</div>
			</div>

			{/* Reason */}
			<div className="border-border border-b px-4 py-2">
				<p className="text-muted-foreground text-xs">Reason</p>
				<p className="text-foreground text-sm capitalize">
					{returnRequest.reason.replace(/_/g, " ")}
				</p>
				{returnRequest.customerNotes && (
					<p className="mt-1 text-muted-foreground text-sm">
						&ldquo;{returnRequest.customerNotes}&rdquo;
					</p>
				)}
			</div>

			{/* Items in this return */}
			<div className="px-4 py-2">
				{returnRequest.items.map((ri) => {
					const orderItem = itemMap.get(ri.orderItemId);
					return (
						<div
							key={ri.id}
							className="flex items-center justify-between py-1 text-sm"
						>
							<span className="text-foreground">
								{orderItem?.name ?? ri.orderItemId}
							</span>
							<span className="text-muted-foreground">x{ri.quantity}</span>
						</div>
					);
				})}
			</div>

			{/* Refund + tracking info */}
			{(returnRequest.refundAmount != null || returnRequest.trackingNumber) && (
				<div className="border-border border-t px-4 py-2 text-sm">
					{returnRequest.refundAmount != null && (
						<p className="text-muted-foreground">
							Refund: {formatPrice(returnRequest.refundAmount)}
						</p>
					)}
					{returnRequest.trackingNumber && (
						<p className="font-mono text-muted-foreground text-xs">
							{returnRequest.carrier && `${returnRequest.carrier}: `}
							{returnRequest.trackingNumber}
						</p>
					)}
				</div>
			)}

			{/* Admin notes */}
			{returnRequest.adminNotes && !editing && (
				<div className="border-border border-t px-4 py-2">
					<p className="text-muted-foreground text-xs">Admin notes</p>
					<p className="text-foreground text-sm">{returnRequest.adminNotes}</p>
				</div>
			)}

			{/* Date */}
			<div className="border-border border-t px-4 py-2 text-muted-foreground text-xs">
				Requested {formatDate(returnRequest.createdAt)}
			</div>

			{/* Edit form */}
			{editing && (
				<div className="border-border border-t p-4">
					<div className="mb-3 grid gap-3 sm:grid-cols-2">
						<div>
							<label
								htmlFor={`r-status-${returnRequest.id}`}
								className="mb-1 block text-muted-foreground text-xs"
							>
								Status
							</label>
							<select
								id={`r-status-${returnRequest.id}`}
								value={status}
								onChange={(e) => setStatus(e.target.value)}
								className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
							>
								<option value="requested">Requested</option>
								<option value="approved">Approved</option>
								<option value="rejected">Rejected</option>
								<option value="shipped_back">Shipped Back</option>
								<option value="received">Received</option>
								<option value="refunded">Refunded</option>
								<option value="completed">Completed</option>
							</select>
						</div>
						<div>
							<label
								htmlFor={`r-refund-${returnRequest.id}`}
								className="mb-1 block text-muted-foreground text-xs"
							>
								Refund Amount (cents)
							</label>
							<input
								id={`r-refund-${returnRequest.id}`}
								type="number"
								min="0"
								value={refundAmount}
								onChange={(e) => setRefundAmount(e.target.value)}
								placeholder="e.g., 1999"
								className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
							/>
						</div>
					</div>
					<div className="mb-3">
						<label
							htmlFor={`r-notes-${returnRequest.id}`}
							className="mb-1 block text-muted-foreground text-xs"
						>
							Admin Notes
						</label>
						<textarea
							id={`r-notes-${returnRequest.id}`}
							value={adminNotes}
							onChange={(e) => setAdminNotes(e.target.value)}
							rows={2}
							className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
						/>
					</div>
					<button
						type="button"
						disabled={updateMutation.isPending}
						onClick={() =>
							updateMutation.mutate({
								params: { id: returnRequest.id },
								body: {
									status: status || undefined,
									adminNotes: adminNotes || undefined,
									refundAmount: refundAmount ? Number(refundAmount) : undefined,
								},
							})
						}
						className="rounded-md bg-foreground px-3 py-1.5 text-background text-sm hover:bg-foreground/90 disabled:opacity-50"
					>
						{updateMutation.isPending ? "Saving..." : "Save"}
					</button>
				</div>
			)}
		</div>
	);
}

// ── Main Component ─────────────────────────────────────────────────────────

export function OrderDetail(props: {
	orderId?: string;
	params?: Record<string, string>;
}) {
	const orderId = props.orderId ?? props.params?.id;
	const api = useOrderAdminApi();
	const [showFulfillDialog, setShowFulfillDialog] = useState(false);

	useEffect(() => {
		if (!showFulfillDialog) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") setShowFulfillDialog(false);
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [showFulfillDialog]);

	const {
		data: orderData,
		isLoading: orderLoading,
		refetch: refetchOrder,
	} = api.getOrder.useQuery(
		{ params: { id: orderId ?? "" } },
		{ enabled: !!orderId },
	) as {
		data: { order: OrderWithDetails } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const {
		data: fulfillmentData,
		isLoading: fulfillmentLoading,
		refetch: refetchFulfillments,
	} = api.listFulfillments.useQuery(
		{ params: { id: orderId ?? "" } },
		{ enabled: !!orderId },
	) as {
		data:
			| {
					fulfillments: FulfillmentWithItems[];
					fulfillmentStatus: OrderFulfillmentStatus;
			  }
			| undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const {
		data: returnData,
		isLoading: returnsLoading,
		refetch: refetchReturns,
	} = api.listOrderReturns.useQuery(
		{ params: { id: orderId ?? "" } },
		{ enabled: !!orderId },
	) as {
		data: { returns: ReturnRequestWithItems[] } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const handleFulfillmentChange = useCallback(() => {
		refetchFulfillments();
		refetchOrder();
	}, [refetchFulfillments, refetchOrder]);

	const handleReturnChange = useCallback(() => {
		refetchReturns();
		refetchOrder();
	}, [refetchReturns, refetchOrder]);

	const order = orderData?.order;
	const fulfillments = fulfillmentData?.fulfillments ?? [];
	const fulfillmentStatus = fulfillmentData?.fulfillmentStatus ?? "unfulfilled";
	const returns = returnData?.returns ?? [];

	if (!orderId) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
				<p className="font-medium">Order not found</p>
				<p className="mt-1 text-sm">No order ID was provided.</p>
				<a href="/admin/orders" className="mt-3 inline-block text-sm underline">
					Back to orders
				</a>
			</div>
		);
	}

	if (orderLoading) {
		return (
			<div className="space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted" />
				<div className="h-64 animate-pulse rounded-lg bg-muted" />
			</div>
		);
	}

	if (!order) {
		return (
			<div className="py-12 text-center">
				<p className="text-muted-foreground text-sm">Order not found.</p>
				<a
					href="/admin/orders"
					className="mt-2 inline-block text-primary text-sm hover:underline"
				>
					&larr; Back to orders
				</a>
			</div>
		);
	}

	const shipping = order.addresses.find((a) => a.type === "shipping");
	const billing = order.addresses.find((a) => a.type === "billing");

	const content = (
		<div>
			{/* Header */}
			<div className="mb-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 className="font-bold text-2xl text-foreground">
							{order.orderNumber}
						</h1>
						<p className="mt-0.5 text-muted-foreground text-sm">
							{formatDate(order.createdAt)}
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							<Badge value={order.status} colors={STATUS_COLORS} />
							<Badge
								value={order.paymentStatus}
								colors={PAYMENT_STATUS_COLORS}
							/>
							<Badge
								value={fulfillmentStatus}
								colors={FULFILLMENT_ORDER_COLORS}
							/>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<PrintOrderButton />
						{fulfillmentStatus !== "fulfilled" && (
							<button
								type="button"
								onClick={() => setShowFulfillDialog(true)}
								className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:bg-foreground/90"
							>
								Fulfill Order
							</button>
						)}
					</div>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Left column — items + fulfillments */}
				<div className="space-y-6 lg:col-span-2">
					{/* Items */}
					<div className="overflow-hidden rounded-lg border border-border">
						<div className="border-border border-b bg-muted/40 px-4 py-2.5">
							<h2 className="font-semibold text-foreground text-sm">
								Items ({order.items.length})
							</h2>
						</div>
						{order.items.map((item) => (
							<div
								key={item.id}
								className="flex items-center justify-between border-border border-b px-4 py-3 last:border-0"
							>
								<div className="min-w-0 flex-1">
									<p className="font-medium text-foreground text-sm">
										{item.name}
									</p>
									<p className="text-muted-foreground text-xs">
										Qty: {item.quantity}
										{item.sku ? ` · SKU: ${item.sku}` : ""} ·{" "}
										{formatPrice(item.price, order.currency)} each
									</p>
								</div>
								<span className="shrink-0 font-medium text-foreground text-sm tabular-nums">
									{formatPrice(item.subtotal, order.currency)}
								</span>
							</div>
						))}
					</div>

					{/* Fulfillments */}
					<div>
						<h2 className="mb-3 font-semibold text-foreground text-sm">
							Fulfillments ({fulfillments.length})
						</h2>
						{fulfillmentLoading ? (
							<div className="h-24 animate-pulse rounded-lg bg-muted" />
						) : fulfillments.length === 0 ? (
							<div className="rounded-lg border border-border border-dashed py-8 text-center">
								<p className="text-muted-foreground text-sm">
									No fulfillments yet
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Create a fulfillment to begin shipping this order.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{fulfillments.map((f) => (
									<FulfillmentCard
										key={f.id}
										fulfillment={f}
										orderItems={order.items}
										onUpdated={handleFulfillmentChange}
									/>
								))}
							</div>
						)}
					</div>

					{/* Returns */}
					<div>
						<h2 className="mb-3 font-semibold text-foreground text-sm">
							Returns ({returns.length})
						</h2>
						{returnsLoading ? (
							<div className="h-24 animate-pulse rounded-lg bg-muted" />
						) : returns.length === 0 ? (
							<div className="rounded-lg border border-border border-dashed py-8 text-center">
								<p className="text-muted-foreground text-sm">
									No return requests
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Customer return requests for this order will appear here.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{returns.map((r) => (
									<ReturnCard
										key={r.id}
										returnRequest={r}
										orderItems={order.items}
										onUpdated={handleReturnChange}
									/>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Right column — status, summary, customer, addresses, notes, timeline */}
				<div className="space-y-4">
					{/* Status management */}
					<StatusManager
						orderId={order.id}
						currentStatus={order.status}
						currentPaymentStatus={order.paymentStatus}
						onUpdated={refetchOrder}
					/>

					{/* Order summary */}
					<div className="rounded-lg border border-border p-4">
						<h3 className="mb-3 font-semibold text-foreground text-sm">
							Summary
						</h3>
						<div className="space-y-1.5 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Subtotal</span>
								<span className="text-foreground tabular-nums">
									{formatPrice(order.subtotal, order.currency)}
								</span>
							</div>
							{order.discountAmount > 0 && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Discount</span>
									<span className="text-emerald-600 tabular-nums dark:text-emerald-400">
										-{formatPrice(order.discountAmount, order.currency)}
									</span>
								</div>
							)}
							{order.giftCardAmount > 0 && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Gift Card</span>
									<span className="text-emerald-600 tabular-nums dark:text-emerald-400">
										-{formatPrice(order.giftCardAmount, order.currency)}
									</span>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-muted-foreground">Shipping</span>
								<span className="text-foreground tabular-nums">
									{order.shippingAmount === 0
										? "Free"
										: formatPrice(order.shippingAmount, order.currency)}
								</span>
							</div>
							{order.taxAmount > 0 && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Tax</span>
									<span className="text-foreground tabular-nums">
										{formatPrice(order.taxAmount, order.currency)}
									</span>
								</div>
							)}
							<div className="flex justify-between border-border border-t pt-1.5 font-semibold">
								<span>Total</span>
								<span className="tabular-nums">
									{formatPrice(order.total, order.currency)}
								</span>
							</div>
						</div>
					</div>

					{/* Customer */}
					<div className="rounded-lg border border-border p-4">
						<h3 className="mb-2 font-semibold text-foreground text-sm">
							Customer
						</h3>
						<p className="text-muted-foreground text-sm">
							{order.guestEmail ?? order.customerId ?? "Unknown"}
						</p>
						{order.customerId && (
							<a
								href={`/admin/customers?id=${order.customerId}`}
								className="mt-1 inline-block text-primary text-xs hover:underline"
							>
								View customer profile
							</a>
						)}
					</div>

					{/* Addresses */}
					{shipping && (
						<div className="rounded-lg border border-border p-4">
							<h3 className="mb-2 font-semibold text-foreground text-sm">
								Shipping Address
							</h3>
							<div className="space-y-0.5 text-muted-foreground text-sm">
								<p>
									{shipping.firstName} {shipping.lastName}
								</p>
								{shipping.company && <p>{shipping.company}</p>}
								<p>{shipping.line1}</p>
								{shipping.line2 && <p>{shipping.line2}</p>}
								<p>
									{shipping.city}, {shipping.state} {shipping.postalCode}
								</p>
								<p>{shipping.country}</p>
							</div>
						</div>
					)}
					{billing && (
						<div className="rounded-lg border border-border p-4">
							<h3 className="mb-2 font-semibold text-foreground text-sm">
								Billing Address
							</h3>
							<div className="space-y-0.5 text-muted-foreground text-sm">
								<p>
									{billing.firstName} {billing.lastName}
								</p>
								{billing.company && <p>{billing.company}</p>}
								<p>{billing.line1}</p>
								{billing.line2 && <p>{billing.line2}</p>}
								<p>
									{billing.city}, {billing.state} {billing.postalCode}
								</p>
								<p>{billing.country}</p>
							</div>
						</div>
					)}

					{/* Notes management */}
					<NotesManager
						orderId={order.id}
						currentNotes={order.notes ?? ""}
						onUpdated={refetchOrder}
					/>

					{/* Timeline */}
					<OrderTimeline
						order={order}
						fulfillments={fulfillments}
						returns={returns}
					/>
				</div>
			</div>

			{/* Fulfill dialog */}
			{showFulfillDialog && (
				<FulfillDialog
					order={order}
					onClose={() => setShowFulfillDialog(false)}
					onCreated={handleFulfillmentChange}
				/>
			)}
		</div>
	);

	return <OrderDetailTemplate content={content} />;
}
