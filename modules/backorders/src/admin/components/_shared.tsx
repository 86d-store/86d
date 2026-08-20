"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useBackordersApi() {
	const client = useModuleClient();
	return {
		listBackorders: client.module("backorders").admin["/admin/backorders"],
		summary: client.module("backorders").admin["/admin/backorders/summary"],
		updateStatus:
			client.module("backorders").admin["/admin/backorders/:id/status"],
		cancelBackorder:
			client.module("backorders").admin["/admin/backorders/:id/cancel"],
		bulkStatus:
			client.module("backorders").admin["/admin/backorders/bulk-status"],
		allocate: client.module("backorders").admin["/admin/backorders/allocate"],
		listPolicies:
			client.module("backorders").admin["/admin/backorders/policies"],
		setPolicy: client.module("backorders").admin["/admin/backorders/policies"],
		deletePolicy:
			client.module("backorders").admin[
				"/admin/backorders/policies/:productId/delete"
			],
	};
}
