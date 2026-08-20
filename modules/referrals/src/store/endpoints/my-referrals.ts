import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReferralController } from "../../service";

export const myReferralsEndpoint = createStoreEndpoint(
	"/referrals/my-referrals",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(50).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers.referrals as ReferralController;
		const limit = ctx.query.limit ?? 20;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		const referrals = await controller.listReferrals({
			referrerCustomerId: customerId,
			take: limit,
			skip,
		});
		return { referrals, total: referrals.length };
	},
);
