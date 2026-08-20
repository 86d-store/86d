"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useAffiliatesApi() {
	const client = useModuleClient();
	return {
		listAffiliates: client.module("affiliates").admin["/admin/affiliates"],
		stats: client.module("affiliates").admin["/admin/affiliates/stats"],
		getAffiliate: client.module("affiliates").admin["/admin/affiliates/:id"],
		approveAffiliate:
			client.module("affiliates").admin["/admin/affiliates/:id/approve"],
		suspendAffiliate:
			client.module("affiliates").admin["/admin/affiliates/:id/suspend"],
		rejectAffiliate:
			client.module("affiliates").admin["/admin/affiliates/:id/reject"],
		listConversions:
			client.module("affiliates").admin["/admin/affiliates/conversions"],
		approveConversion:
			client.module("affiliates").admin[
				"/admin/affiliates/conversions/:id/approve"
			],
		rejectConversion:
			client.module("affiliates").admin[
				"/admin/affiliates/conversions/:id/reject"
			],
		listPayouts: client.module("affiliates").admin["/admin/affiliates/payouts"],
		createPayout:
			client.module("affiliates").admin["/admin/affiliates/payouts/create"],
		completePayout:
			client.module("affiliates").admin[
				"/admin/affiliates/payouts/:id/complete"
			],
		failPayout:
			client.module("affiliates").admin["/admin/affiliates/payouts/:id/fail"],
		listLinks: client.module("affiliates").admin["/admin/affiliates/links"],
	};
}

export interface Affiliate {
	id: string;
	name: string;
	email: string;
	website?: string;
	status: string;
	commissionRate: number;
	notes?: string;
	customerId?: string;
	createdAt: string;
	updatedAt: string;
}

export function formatCurrency(amount: number) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
	}).format(amount / 100);
}

export function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
