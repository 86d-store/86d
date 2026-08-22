import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AffiliateController } from "../../service";

export const myDashboardEndpoint = createStoreEndpoint(
	"/affiliates/dashboard",
	{
		method: "GET",
		query: z.object({}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.affiliates as AffiliateController;

		// Find affiliate by looking up all and filtering by customerId
		const affiliates = await controller.listAffiliates();
		const affiliate = affiliates.find((a) => a.customerId === customerId);
		if (!affiliate) return { error: "Not an affiliate", status: 404 };

		const balance = await controller.getAffiliateBalance(affiliate.id);
		const links = await controller.listLinks({
			affiliateId: affiliate.id,
		});
		const conversions = await controller.listConversions({
			affiliateId: affiliate.id,
			take: 10,
		});
		const payouts = await controller.listPayouts({
			affiliateId: affiliate.id,
			take: 10,
		});

		return { affiliate, balance, links, conversions, payouts };
	},
);
