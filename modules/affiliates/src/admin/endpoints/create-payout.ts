import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { AffiliateController, PayoutMethod } from "../../service";

export const createPayoutEndpoint = createAdminEndpoint(
	"/admin/affiliates/payouts/create",
	{
		method: "POST",
		body: z.object({
			affiliateId: z.string(),
			amount: z.number().positive(),
			method: z.enum(["bank_transfer", "paypal", "store_credit", "check"]),
			reference: z.string().max(200).transform(sanitizeText).optional(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.affiliates as AffiliateController;
		const payout = await controller.createPayout({
			affiliateId: ctx.body.affiliateId,
			amount: ctx.body.amount,
			method: ctx.body.method as PayoutMethod,
			reference: ctx.body.reference,
			notes: ctx.body.notes,
		});
		if (!payout) return { error: "Unable to create payout" };
		return { payout };
	},
);
