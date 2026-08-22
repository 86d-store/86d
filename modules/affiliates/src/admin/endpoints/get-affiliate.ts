import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AffiliateController } from "../../service";

export const getAffiliateEndpoint = createAdminEndpoint(
	"/admin/affiliates/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.affiliates as AffiliateController;
		const affiliate = await controller.getAffiliate(ctx.params.id);
		if (!affiliate) return { error: "Affiliate not found" };

		const balance = await controller.getAffiliateBalance(affiliate.id);
		const links = await controller.listLinks({
			affiliateId: affiliate.id,
		});
		const conversions = await controller.listConversions({
			affiliateId: affiliate.id,
			take: 20,
		});
		const payouts = await controller.listPayouts({
			affiliateId: affiliate.id,
			take: 20,
		});

		return { affiliate, balance, links, conversions, payouts };
	},
);
