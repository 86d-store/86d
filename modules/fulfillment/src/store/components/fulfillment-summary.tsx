"use client";

import { observer } from "@86d-app/core/state";
import type { FulfillmentStatus } from "../../service";
import { useFulfillmentApi } from "./_hooks";
import { formatDate, getStatusColor, getStatusLabel } from "./_utils";
import FulfillmentSummaryTemplate from "./fulfillment-summary.mdx";

interface FulfillmentEntry {
	id: string;
	orderId: string;
	status: FulfillmentStatus;
	items: { lineItemId: string; quantity: number }[];
	carrier?: string | null;
	trackingNumber?: string | null;
	trackingUrl?: string | null;
	shippedAt?: string | null;
	deliveredAt?: string | null;
	createdAt: string;
}

interface FulfillmentsResponse {
	fulfillments: FulfillmentEntry[];
}

export interface FulfillmentSummaryProps {
	/** Order ID to look up fulfillments for. */
	orderId: string;
}

/** Displays all fulfillments for an order with status and item count. */
export const FulfillmentSummary = observer((props: FulfillmentSummaryProps) => {
	const api = useFulfillmentApi();

	const { data, isPending, isError } = api.listByOrder.useQuery({
		params: { orderId: props.orderId },
	}) as {
		data: FulfillmentsResponse | undefined;
		isPending: boolean;
		isError: boolean;
	};

	const fulfillments = (data?.fulfillments ?? []).map((f) => ({
		id: f.id,
		statusLabel: getStatusLabel(f.status),
		statusColor: getStatusColor(f.status),
		itemCount: Array.isArray(f.items) ? f.items.length : 0,
		carrier: f.carrier ?? null,
		trackingNumber: f.trackingNumber ?? null,
		trackingUrl: f.trackingUrl ?? null,
		createdAt: formatDate(f.createdAt),
	}));

	return (
		<FulfillmentSummaryTemplate
			fulfillments={fulfillments}
			loading={isPending}
			error={isError}
			empty={!isPending && !isError && fulfillments.length === 0}
		/>
	);
});
