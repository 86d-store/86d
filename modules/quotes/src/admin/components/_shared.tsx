"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useQuotesApi() {
	const client = useModuleClient();
	return {
		list: client.module("quotes").admin["/admin/quotes"],
		create: client.module("quotes").admin["/admin/quotes/create"],
		detail: client.module("quotes").admin["/admin/quotes/:id"],
		deleteQuote: client.module("quotes").admin["/admin/quotes/:id/delete"],
		approve: client.module("quotes").admin["/admin/quotes/:id/approve"],
		reject: client.module("quotes").admin["/admin/quotes/:id/reject"],
		convert: client.module("quotes").admin["/admin/quotes/:id/convert"],
		expire: client.module("quotes").admin["/admin/quotes/:id/expire"],
		addComment: client.module("quotes").admin["/admin/quotes/:id/comments/add"],
		addItem: client.module("quotes").admin["/admin/quotes/:id/items"],
		updateItem:
			client.module("quotes").admin["/admin/quotes/:id/items/:itemId"],
		removeItem:
			client.module("quotes").admin["/admin/quotes/:id/items/:itemId/remove"],
	};
}

export interface Quote {
	id: string;
	quoteNumber?: string;
	customerId?: string;
	customerEmail: string;
	customerName?: string;
	companyName?: string;
	status: string;
	notes?: string;
	adminNotes?: string;
	subtotal?: number;
	discount?: number;
	total: number;
	currency: string;
	itemCount?: number;
	expiresAt?: string;
	convertedOrderId?: string;
	createdAt: string;
	updatedAt?: string;
}

export function formatCurrency(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

export const STATUS_COLORS: Record<string, string> = {
	draft: "bg-muted text-muted-foreground",
	submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	under_review:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	countered:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	accepted:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	expired:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	converted:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
	sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

export const labelCls = "mb-1 block font-medium text-foreground text-sm";

export const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
