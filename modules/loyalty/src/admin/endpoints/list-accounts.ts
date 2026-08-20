import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { LoyaltyController } from "../../service";

export const listAccounts = createAdminEndpoint(
	"/admin/loyalty/accounts",
	{
		method: "GET",
		query: z.object({
			tier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
			status: z.enum(["active", "suspended", "closed"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listAccounts({
			tier: ctx.query.tier,
			status: ctx.query.status,
		});
		const total = all.length;
		const accounts = all.slice(skip, skip + take);
		return { accounts, total };
	},
);
