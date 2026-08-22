import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { LoyaltyController } from "../../service";

export const adjustPoints = createAdminEndpoint(
	"/admin/loyalty/accounts/:customerId/adjust",
	{
		method: "POST",
		params: z.object({
			customerId: z.string(),
		}),
		body: z.object({
			points: z.number().int(),
			description: z.string().max(1000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const transaction = await controller.adjustPoints({
			customerId: ctx.params.customerId,
			points: ctx.body.points,
			description: ctx.body.description,
		});
		const account = await controller.getAccount(ctx.params.customerId);
		if (ctx.body.points > 0) {
			void ctx.context.events?.emit("loyalty.pointsEarned", {
				customerId: ctx.params.customerId,
				points: ctx.body.points,
				balance: account?.balance ?? 0,
				description: ctx.body.description,
			});
		}
		return { transaction, account };
	},
);
