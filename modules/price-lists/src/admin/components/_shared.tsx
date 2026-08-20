"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function usePriceListsApi() {
	const client = useModuleClient();
	return {
		list: client.module("price-lists").admin["/admin/price-lists"],
		stats: client.module("price-lists").admin["/admin/price-lists/stats"],
		create: client.module("price-lists").admin["/admin/price-lists/create"],
		detail: client.module("price-lists").admin["/admin/price-lists/:id"],
		update: client.module("price-lists").admin["/admin/price-lists/:id/update"],
		deletePl:
			client.module("price-lists").admin["/admin/price-lists/:id/delete"],
		entries:
			client.module("price-lists").admin["/admin/price-lists/:id/entries"],
		setEntry:
			client.module("price-lists").admin["/admin/price-lists/:id/entries/set"],
		removeEntry:
			client.module("price-lists").admin[
				"/admin/price-lists/:id/entries/:productId/remove"
			],
		bulkSet:
			client.module("price-lists").admin["/admin/price-lists/:id/entries/bulk"],
	};
}

export interface PriceList {
	id: string;
	name: string;
	slug: string;
	description?: string;
	currency?: string;
	priority: number;
	status: string;
	startsAt?: string;
	endsAt?: string;
	customerGroupId?: string;
	createdAt: string;
	updatedAt: string;
}

export const STATUS_COLORS: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	inactive: "bg-muted text-muted-foreground",
	scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export function formatDate(dateStr: string | undefined) {
	if (!dateStr) return "—";
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}
