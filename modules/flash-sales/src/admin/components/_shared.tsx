"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useFlashSalesApi() {
	const client = useModuleClient();
	return {
		list: client.module("flash-sales").admin["/admin/flash-sales"],
		stats: client.module("flash-sales").admin["/admin/flash-sales/stats"],
		create: client.module("flash-sales").admin["/admin/flash-sales/create"],
		get: client.module("flash-sales").admin["/admin/flash-sales/:id"],
		update: client.module("flash-sales").admin["/admin/flash-sales/:id/update"],
		remove: client.module("flash-sales").admin["/admin/flash-sales/:id/delete"],
		listProducts:
			client.module("flash-sales").admin["/admin/flash-sales/:id/products"],
		addProduct:
			client.module("flash-sales").admin["/admin/flash-sales/:id/products/add"],
		removeProduct:
			client.module("flash-sales").admin[
				"/admin/flash-sales/:id/products/:productId/remove"
			],
	};
}

export interface FlashSale {
	id: string;
	name: string;
	slug: string;
	description?: string;
	status: string;
	startsAt: string;
	endsAt: string;
	createdAt: string;
	updatedAt: string;
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

export const STATUS_COLORS: Record<string, string> = {
	draft: "bg-muted text-muted-foreground",
	scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	ended:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export const STATUS_LABELS: Record<string, string> = {
	draft: "Draft",
	scheduled: "Scheduled",
	active: "Active",
	ended: "Ended",
};
