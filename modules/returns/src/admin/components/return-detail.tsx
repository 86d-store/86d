"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ReturnDetailTemplate from "./return-detail.mdx";

interface ReturnItemData {
	id: string;
	productName: string;
	sku?: string | null;
	quantity: number;
	unitPrice: number;
	reason: string;
	condition: string;
	notes?: string | null;
}

interface ReturnData {
	id: string;
	orderId: string;
	customerId: string;
	status: string;
	refundMethod: string;
	refundAmount: number;
	currency: string;
	reason: string;
	customerNotes?: string | null;
	adminNotes?: string | null;
	trackingNumber?: string | null;
	trackingCarrier?: string | null;
	requestedAt: string;
	resolvedAt?: string | null;
	items: ReturnItemData[];
}

interface DetailResult {
	return: ReturnData;
}

const STATUS_COLORS: Record<string, string> = {
	requested:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	received:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	cancelled: "bg-muted text-muted-foreground",
};

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useReturnsApi() {
	const client = useModuleClient();
	return {
		get: client.module("returns").admin["/admin/returns/:id"],
		approve: client.module("returns").admin["/admin/returns/:id/approve"],
		reject: client.module("returns").admin["/admin/returns/:id/reject"],
		received: client.module("returns").admin["/admin/returns/:id/received"],
		complete: client.module("returns").admin["/admin/returns/:id/complete"],
		cancel: client.module("returns").admin["/admin/returns/:id/cancel"],
	};
}

export function ReturnDetail({ id }: { id: string }) {
	const api = useReturnsApi();
	const [adminNotes, setAdminNotes] = useState("");
	const [refundAmount, setRefundAmount] = useState("");
	const [actionLoading, setActionLoading] = useState(false);

	const { data, isLoading: loading } = api.get.useQuery({ id }) as {
		data: DetailResult | undefined;
		isLoading: boolean;
	};

	const ret = data?.return;

	const handleAction = async (
		action: "approve" | "reject" | "received" | "complete" | "cancel",
	) => {
		setActionLoading(true);
		try {
			switch (action) {
				case "approve":
					await api.approve.fetch({
						id,
						adminNotes: adminNotes || undefined,
					});
					break;
				case "reject":
					await api.reject.fetch({
						id,
						adminNotes: adminNotes || undefined,
					});
					break;
				case "received":
					await api.received.fetch({ id });
					break;
				case "complete":
					await api.complete.fetch({
						id,
						refundAmount: Number(refundAmount) || 0,
					});
					break;
				case "cancel":
					await api.cancel.fetch({ id });
					break;
			}
			window.location.reload();
		} finally {
			setActionLoading(false);
		}
	};

	if (loading || !ret) {
		const content = (
			<div className="space-y-4 p-1">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-32 w-full rounded-lg" />
				<Skeleton className="h-48 w-full rounded-lg" />
				<Skeleton className="h-24 w-full rounded-lg" />
			</div>
		);
		return <ReturnDetailTemplate content={content} />;
	}

	const isOpen = !["completed", "rejected", "cancelled"].includes(ret.status);

	const content = (
		<div>
			<div className="mb-6 flex items-start justify-between">
				<div>
					<button
						type="button"
						onClick={() => {
							window.location.href = "/admin/returns";
						}}
						className="mb-2 text-muted-foreground text-sm hover:text-foreground"
					>
						&larr; Back to Returns
					</button>
					<h1 className="font-bold text-2xl text-foreground">
						Return {ret.id.slice(0, 8)}
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Order {ret.orderId.slice(0, 8)} &middot; Requested{" "}
						{new Date(ret.requestedAt).toLocaleDateString()}
					</p>
				</div>
				<span
					className={`inline-flex items-center rounded-full px-3 py-1 font-medium text-sm ${STATUS_COLORS[ret.status] ?? "bg-muted text-muted-foreground"}`}
				>
					{ret.status.replace(/_/g, " ")}
				</span>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					{/* Items */}
					<div className="rounded-lg border border-border bg-card p-4">
						<h2 className="mb-3 font-semibold text-foreground text-sm">
							Return Items
						</h2>
						<div className="divide-y divide-border">
							{ret.items.map((item) => (
								<div
									key={item.id}
									className="flex items-start justify-between py-3"
								>
									<div>
										<p className="font-medium text-foreground text-sm">
											{item.productName}
										</p>
										{item.sku && (
											<p className="font-mono text-muted-foreground text-xs">
												SKU: {item.sku}
											</p>
										)}
										<p className="mt-1 text-muted-foreground text-xs">
											Qty: {item.quantity} &middot;{" "}
											{item.reason.replace(/_/g, " ")} &middot; {item.condition}
										</p>
										{item.notes && (
											<p className="mt-1 text-muted-foreground text-xs italic">
												{item.notes}
											</p>
										)}
									</div>
									<span className="font-medium text-foreground text-sm">
										{formatPrice(item.unitPrice * item.quantity, ret.currency)}
									</span>
								</div>
							))}
						</div>
						<div className="mt-3 flex justify-between border-border border-t pt-3">
							<span className="font-semibold text-foreground text-sm">
								Total Refund
							</span>
							<span className="font-semibold text-foreground text-sm">
								{formatPrice(ret.refundAmount, ret.currency)}
							</span>
						</div>
					</div>

					{/* Notes */}
					{(ret.customerNotes || ret.adminNotes) && (
						<div className="rounded-lg border border-border bg-card p-4">
							<h2 className="mb-3 font-semibold text-foreground text-sm">
								Notes
							</h2>
							{ret.customerNotes && (
								<div className="mb-2">
									<p className="font-medium text-muted-foreground text-xs">
										Customer
									</p>
									<p className="text-foreground text-sm">{ret.customerNotes}</p>
								</div>
							)}
							{ret.adminNotes && (
								<div>
									<p className="font-medium text-muted-foreground text-xs">
										Admin
									</p>
									<p className="text-foreground text-sm">{ret.adminNotes}</p>
								</div>
							)}
						</div>
					)}

					{/* Tracking */}
					{ret.trackingNumber && (
						<div className="rounded-lg border border-border bg-card p-4">
							<h2 className="mb-2 font-semibold text-foreground text-sm">
								Return Shipping
							</h2>
							<p className="font-mono text-foreground text-sm">
								{ret.trackingNumber}
							</p>
							{ret.trackingCarrier && (
								<p className="text-muted-foreground text-xs">
									via {ret.trackingCarrier}
								</p>
							)}
						</div>
					)}
				</div>

				{/* Actions sidebar */}
				<div className="space-y-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<h2 className="mb-3 font-semibold text-foreground text-sm">
							Details
						</h2>
						<dl className="space-y-2 text-sm">
							<div className="flex justify-between">
								<dt className="text-muted-foreground">Refund Method</dt>
								<dd className="font-medium text-foreground">
									{ret.refundMethod.replace(/_/g, " ")}
								</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-muted-foreground">Reason</dt>
								<dd className="font-medium text-foreground">{ret.reason}</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-muted-foreground">Customer</dt>
								<dd className="font-medium font-mono text-foreground text-xs">
									{ret.customerId.slice(0, 8)}
								</dd>
							</div>
							{ret.resolvedAt && (
								<div className="flex justify-between">
									<dt className="text-muted-foreground">Resolved</dt>
									<dd className="font-medium text-foreground">
										{new Date(ret.resolvedAt).toLocaleDateString()}
									</dd>
								</div>
							)}
						</dl>
					</div>

					{isOpen && (
						<div className="rounded-lg border border-border bg-card p-4">
							<h2 className="mb-3 font-semibold text-foreground text-sm">
								Actions
							</h2>

							{ret.status === "requested" && (
								<>
									<textarea
										placeholder="Admin notes (optional)"
										value={adminNotes}
										onChange={(e) => setAdminNotes(e.target.value)}
										rows={3}
										className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									/>
									<div className="flex gap-2">
										<button
											type="button"
											disabled={actionLoading}
											onClick={() => void handleAction("approve")}
											className="flex-1 rounded-md bg-blue-600 px-3 py-2 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
										>
											Approve
										</button>
										<button
											type="button"
											disabled={actionLoading}
											onClick={() => void handleAction("reject")}
											className="flex-1 rounded-md bg-destructive px-3 py-2 font-medium text-destructive-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
										>
											Reject
										</button>
									</div>
								</>
							)}

							{ret.status === "approved" && (
								<div className="space-y-2">
									<button
										type="button"
										disabled={actionLoading}
										onClick={() => void handleAction("received")}
										className="w-full rounded-md bg-indigo-600 px-3 py-2 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
									>
										Mark Received
									</button>
									<div className="flex gap-2">
										<input
											type="number"
											placeholder="Refund amount (cents)"
											value={refundAmount}
											onChange={(e) => setRefundAmount(e.target.value)}
											className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										<button
											type="button"
											disabled={actionLoading || !refundAmount}
											onClick={() => void handleAction("complete")}
											className="rounded-md bg-green-600 px-3 py-2 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
										>
											Complete
										</button>
									</div>
								</div>
							)}

							{ret.status === "received" && (
								<div className="flex gap-2">
									<input
										type="number"
										placeholder="Refund amount (cents)"
										value={refundAmount}
										onChange={(e) => setRefundAmount(e.target.value)}
										className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
									<button
										type="button"
										disabled={actionLoading || !refundAmount}
										onClick={() => void handleAction("complete")}
										className="rounded-md bg-green-600 px-3 py-2 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
									>
										Complete
									</button>
								</div>
							)}

							{!["completed", "rejected", "cancelled"].includes(ret.status) && (
								<button
									type="button"
									disabled={actionLoading}
									onClick={() => void handleAction("cancel")}
									className="mt-2 w-full rounded-md border border-border px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
								>
									Cancel Return
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);

	return <ReturnDetailTemplate content={content} />;
}
