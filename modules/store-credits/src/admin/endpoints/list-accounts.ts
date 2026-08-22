import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StoreCreditController } from "../../service";

export const listAccounts = createAdminEndpoint(
	"/admin/store-credits/accounts",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["active", "frozen", "closed"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"store-credits"
		] as StoreCreditController;
		const accounts = await controller.listAccounts({
			status: ctx.query.status,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return { accounts };
	},
);
