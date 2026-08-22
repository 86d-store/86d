import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AffiliateController } from "../../service";

export const suspendAffiliateEndpoint = createAdminEndpoint(
	"/admin/affiliates/:id/suspend",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.affiliates as AffiliateController;
		const affiliate = await controller.suspendAffiliate(ctx.params.id);
		if (!affiliate) return { error: "Unable to suspend affiliate" };
		void ctx.context.events?.emit("affiliates.suspended", {
			affiliateId: affiliate.id,
			email: affiliate.email,
			name: affiliate.name,
			customerId: affiliate.customerId,
		});
		return { affiliate };
	},
);
