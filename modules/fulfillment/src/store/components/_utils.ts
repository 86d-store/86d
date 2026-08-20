import type { FulfillmentStatus } from "../../service";

export function formatDate(iso: string | Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

export function formatDateTime(iso: string | Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

const statusLabels: Record<FulfillmentStatus, string> = {
	pending: "Pending",
	processing: "Processing",
	shipped: "Shipped",
	delivered: "Delivered",
	cancelled: "Cancelled",
};

export function getStatusLabel(status: FulfillmentStatus): string {
	return statusLabels[status] ?? status;
}

const statusColors: Record<FulfillmentStatus, string> = {
	pending: "text-yellow-600 dark:text-yellow-400",
	processing: "text-blue-600 dark:text-blue-400",
	shipped: "text-indigo-600 dark:text-indigo-400",
	delivered: "text-green-600 dark:text-green-400",
	cancelled: "text-red-600 dark:text-red-400",
};

export function getStatusColor(status: FulfillmentStatus): string {
	return statusColors[status] ?? "text-muted-foreground";
}

/** The four ordered steps in the fulfillment lifecycle. */
export const fulfillmentSteps: FulfillmentStatus[] = [
	"pending",
	"processing",
	"shipped",
	"delivered",
];

export function getStepIndex(status: FulfillmentStatus): number {
	const idx = fulfillmentSteps.indexOf(status);
	return idx === -1 ? -1 : idx;
}
