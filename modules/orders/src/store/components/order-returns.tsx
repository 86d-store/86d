"use client";

import { useState } from "react";
import { useOrdersApi } from "./_hooks";
import type { OrderItem, ReturnRequestWithItems } from "./_types";
import { formatDate, formatPrice, RETURN_STATUS_STYLES } from "./_utils";
import OrderReturnsTemplate from "./order-returns.mdx";
import { ReturnRequestForm } from "./return-request-form";
import { StatusBadge } from "./status-badge";

function ReturnCard({ r }: { r: ReturnRequestWithItems }) {
	return (
		<div className="rounded-xl border border-border p-4">
			<div className="flex items-center gap-2">
				<StatusBadge value={r.status} styles={RETURN_STATUS_STYLES} />
				<span className="text-muted-foreground text-sm capitalize">
					{r.type.replace(/_/g, " ")}
				</span>
			</div>
			<p className="mt-1.5 text-foreground text-sm capitalize">
				{r.reason.replace(/_/g, " ")}
			</p>
			{r.customerNotes && (
				<p className="mt-1 text-muted-foreground text-sm">{r.customerNotes}</p>
			)}
			{r.adminNotes && (
				<div className="mt-2 rounded-lg bg-muted/40 p-2">
					<p className="text-muted-foreground text-xs">Store response</p>
					<p className="text-foreground text-sm">{r.adminNotes}</p>
				</div>
			)}
			{r.refundAmount != null && (
				<p className="mt-1.5 font-medium text-emerald-600 text-sm dark:text-emerald-400">
					Refund: {formatPrice(r.refundAmount)}
				</p>
			)}
			{r.trackingNumber && (
				<p className="mt-1 font-mono text-muted-foreground text-xs">
					{r.carrier && `${r.carrier}: `}
					{r.trackingNumber}
				</p>
			)}
			<p className="mt-2 text-muted-foreground text-xs">
				Requested {formatDate(r.createdAt)}
			</p>
		</div>
	);
}

export function OrderReturns({
	orderId,
	items,
	orderStatus,
}: {
	orderId: string;
	items: OrderItem[];
	orderStatus: string;
}) {
	const api = useOrdersApi();
	const [showForm, setShowForm] = useState(false);

	const { data: returnData, refetch } = api.getMyReturns.useQuery({
		params: { id: orderId },
	}) as {
		data: { returns: ReturnRequestWithItems[] } | undefined;
		refetch: () => void;
	};

	const returns = returnData?.returns ?? [];
	const canReturn = ["completed", "processing"].includes(orderStatus);

	const formContent = showForm ? (
		<div className="mb-6 rounded-xl border border-border bg-muted/20 p-4">
			<ReturnRequestForm
				orderId={orderId}
				items={items}
				onSuccess={() => {
					setShowForm(false);
					refetch();
				}}
				onCancel={() => setShowForm(false)}
			/>
		</div>
	) : null;

	const returnsListContent =
		returns.length === 0 && !showForm ? null : (
			<div className="space-y-3">
				{returns.map((r) => (
					<ReturnCard key={r.id} r={r} />
				))}
			</div>
		);

	return (
		<OrderReturnsTemplate
			canReturn={canReturn}
			showForm={showForm}
			onShowForm={() => setShowForm(true)}
			formContent={formContent}
			hasReturns={returns.length > 0}
			returnsListContent={returnsListContent}
		/>
	);
}
