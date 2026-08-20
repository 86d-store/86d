import { createAdminEndpoint } from "@86d-app/core/api";
import type { MembershipController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/memberships/stats",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const stats = await controller.getStats();

		return { stats };
	},
);
