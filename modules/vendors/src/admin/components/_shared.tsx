"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useVendorsApi() {
	const client = useModuleClient();
	return {
		listVendors: client.module("vendors").admin["/admin/vendors"],
		stats: client.module("vendors").admin["/admin/vendors/stats"],
		createVendor: client.module("vendors").admin["/admin/vendors/create"],
		updateVendor: client.module("vendors").admin["/admin/vendors/:id/update"],
		updateStatus: client.module("vendors").admin["/admin/vendors/:id/status"],
		deleteVendor: client.module("vendors").admin["/admin/vendors/:id/delete"],
		vendorPayouts:
			client.module("vendors").admin["/admin/vendors/:vendorId/payouts"],
		createPayout:
			client.module("vendors").admin["/admin/vendors/:vendorId/payouts/create"],
		updatePayoutStatus:
			client.module("vendors").admin["/admin/vendors/payouts/:id/status"],
		payoutStats: client.module("vendors").admin["/admin/vendors/payouts/stats"],
	};
}

export interface Vendor {
	id: string;
	name: string;
	slug: string;
	email: string;
	phone?: string;
	description?: string;
	logo?: string;
	banner?: string;
	website?: string;
	commissionRate: number;
	status: string;
	createdAt: string;
	updatedAt: string;
}

export function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

export const labelCls = "mb-1 block font-medium text-foreground text-sm";

export const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
