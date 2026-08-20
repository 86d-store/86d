import { createAdminEndpoint } from "@86d-app/core/api";
import type { SocialSharingController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/social-sharing/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"social-sharing"
		] as SocialSharingController;
		const all = await controller.listShares();
		const byNetwork: Record<string, number> = {};
		for (const share of all) {
			byNetwork[share.network] = (byNetwork[share.network] ?? 0) + 1;
		}
		return { stats: byNetwork, total: all.length };
	},
);
