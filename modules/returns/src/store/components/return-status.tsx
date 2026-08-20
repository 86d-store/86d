"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import ReturnStatusTemplate from "./return-status.mdx";

interface ReturnItemData {
	id: string;
	productName: string;
	quantity: number;
	unitPrice: number;
	reason: string;
}

interface ReturnData {
	id: string;
	status: string;
	refundMethod: string;
	refundAmount: number;
	currency: string;
	reason: string;
	trackingNumber?: string | null;
	trackingCarrier?: string | null;
	requestedAt: string;
	resolvedAt?: string | null;
	items: ReturnItemData[];
}

interface StatusResult {
	return: ReturnData;
}

const STATUS_LABELS: Record<string, string> = {
	requested: "Under Review",
	approved: "Approved - Ship Items Back",
	received: "Items Received",
	completed: "Refund Processed",
	rejected: "Request Denied",
	cancelled: "Cancelled",
};

function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

export function ReturnStatus({ id }: { id: string }) {
	const client = useModuleClient();
	const api = client.module("returns").store["/returns/:id"];

	const { data, isLoading: loading } = api.useQuery({ id }) as {
		data: StatusResult | undefined;
		isLoading: boolean;
	};

	const ret = data?.return;

	if (loading) {
		const content = (
			<div className="space-y-3 py-4">
				<div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
				<div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
				<div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
				<div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
			</div>
		);
		return <ReturnStatusTemplate content={content} />;
	}

	if (!ret) {
		const content = (
			<div className="py-8 text-center text-muted-foreground text-sm">
				Return request not found.
			</div>
		);
		return <ReturnStatusTemplate content={content} />;
	}

	const content = (
		<div>
			<h2 className="mb-2 font-semibold text-foreground text-lg">
				Return Status
			</h2>
			<p className="mb-4 font-medium text-foreground text-sm">
				{STATUS_LABELS[ret.status] ?? ret.status}
			</p>

			<div className="mb-4 space-y-2">
				{ret.items.map((item) => (
					<div
						key={item.id}
						className="flex items-center justify-between rounded-md border border-border p-2"
					>
						<span className="text-foreground text-sm">{item.productName}</span>
						<span className="text-muted-foreground text-sm">
							x{item.quantity} &middot;{" "}
							{formatPrice(item.unitPrice * item.quantity, ret.currency)}
						</span>
					</div>
				))}
			</div>

			<dl className="space-y-1 text-sm">
				<div className="flex justify-between">
					<dt className="text-muted-foreground">Refund Amount</dt>
					<dd className="font-medium text-foreground">
						{formatPrice(ret.refundAmount, ret.currency)}
					</dd>
				</div>
				<div className="flex justify-between">
					<dt className="text-muted-foreground">Refund Method</dt>
					<dd className="text-foreground">
						{ret.refundMethod.replace(/_/g, " ")}
					</dd>
				</div>
				{ret.trackingNumber && (
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Tracking</dt>
						<dd className="font-mono text-foreground text-xs">
							{ret.trackingNumber}
						</dd>
					</div>
				)}
			</dl>
		</div>
	);

	return <ReturnStatusTemplate content={content} />;
}
