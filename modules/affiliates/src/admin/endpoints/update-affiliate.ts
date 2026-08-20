import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { AffiliateController } from "../../service";

export const updateAffiliateEndpoint = createAdminEndpoint(
	"/admin/affiliates/:id/update",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			email: z.string().email().max(320).optional(),
			website: z.string().url().max(500).optional(),
			commissionRate: z.number().min(0).max(100).optional(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.affiliates as AffiliateController;
		const affiliate = await controller.updateAffiliate(ctx.params.id, {
			name: ctx.body.name,
			email: ctx.body.email,
			website: ctx.body.website,
			commissionRate: ctx.body.commissionRate,
			notes: ctx.body.notes,
		});
		if (!affiliate) return { error: "Affiliate not found" };
		return { affiliate };
	},
);
