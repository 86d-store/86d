"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function usePreordersApi() {
	const client = useModuleClient();
	return {
		listCampaigns:
			client.module("preorders").admin["/admin/preorders/campaigns"],
		getCampaign:
			client.module("preorders").admin["/admin/preorders/campaigns/:id"],
		createCampaign:
			client.module("preorders").admin["/admin/preorders/campaigns/create"],
		activateCampaign:
			client.module("preorders").admin[
				"/admin/preorders/campaigns/:id/activate"
			],
		pauseCampaign:
			client.module("preorders").admin["/admin/preorders/campaigns/:id/pause"],
		completeCampaign:
			client.module("preorders").admin[
				"/admin/preorders/campaigns/:id/complete"
			],
		cancelCampaign:
			client.module("preorders").admin["/admin/preorders/campaigns/:id/cancel"],
		notifyCampaign:
			client.module("preorders").admin["/admin/preorders/campaigns/:id/notify"],
		listItems: client.module("preorders").admin["/admin/preorders/items"],
		fulfillItem:
			client.module("preorders").admin["/admin/preorders/items/:id/fulfill"],
		readyItem:
			client.module("preorders").admin["/admin/preorders/items/:id/ready"],
		cancelItem:
			client.module("preorders").admin["/admin/preorders/items/:id/cancel"],
		summary: client.module("preorders").admin["/admin/preorders/summary"],
	};
}

export interface Campaign {
	id: string;
	productId: string;
	productName: string;
	variantId?: string;
	variantLabel?: string;
	paymentType: string;
	depositAmount?: number;
	depositPercent?: number;
	price: number;
	maxQuantity?: number;
	status: string;
	startDate: string;
	endDate?: string;
	estimatedShipDate?: string;
	message?: string;
	totalOrdered: number;
	createdAt: string;
	updatedAt: string;
}

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
	draft: "bg-muted text-muted-foreground",
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	paused:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function formatCurrency(amount: number) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
	}).format(amount / 100);
}

export function formatDate(dateStr: string) {
	const date = new Date(dateStr);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
