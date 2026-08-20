"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useMembershipsApi() {
	const client = useModuleClient();
	return {
		listMemberships: client.module("memberships").admin["/admin/memberships"],
		getMembership: client.module("memberships").admin["/admin/memberships/:id"],
		cancelMembership:
			client.module("memberships").admin["/admin/memberships/:id/cancel"],
		pauseMembership:
			client.module("memberships").admin["/admin/memberships/:id/pause"],
		resumeMembership:
			client.module("memberships").admin["/admin/memberships/:id/resume"],
		stats: client.module("memberships").admin["/admin/memberships/stats"],
		listPlans: client.module("memberships").admin["/admin/memberships/plans"],
		createPlan:
			client.module("memberships").admin["/admin/memberships/plans/create"],
		updatePlan:
			client.module("memberships").admin["/admin/memberships/plans/:id/update"],
		deletePlan:
			client.module("memberships").admin["/admin/memberships/plans/:id/delete"],
	};
}
