import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AffiliateController } from "../../service";

export const createLinkEndpoint = createStoreEndpoint(
	"/affiliates/links/create",
	{
		method: "POST",
		body: z.object({
			targetUrl: z.string().url().max(2000),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.affiliates as AffiliateController;

		const affiliates = await controller.listAffiliates();
		const affiliate = affiliates.find((a) => a.customerId === customerId);
		if (!affiliate) return { error: "Not an affiliate", status: 404 };
		if (affiliate.status !== "approved")
			return { error: "Your affiliate account is not active", status: 403 };

		const link = await controller.createLink({
			affiliateId: affiliate.id,
			targetUrl: ctx.body.targetUrl,
		});
		if (!link) return { error: "Unable to create link", status: 500 };
		return { link };
	},
);
