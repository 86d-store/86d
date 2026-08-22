import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TaxController } from "../../service";

export const adminListRates = createAdminEndpoint(
	"/admin/tax/rates",
	{
		method: "GET",
		query: z.object({
			country: z.string().optional(),
			state: z.string().optional(),
			enabled: z
				.string()
				.transform((v) => v === "true")
				.optional(),
			take: z
				.string()
				.transform((v) => Number.parseInt(v, 10))
				.optional(),
			skip: z
				.string()
				.transform((v) => Number.parseInt(v, 10))
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const rates = await controller.listRates({
			country: ctx.query.country,
			state: ctx.query.state,
			enabled: ctx.query.enabled,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return { rates };
	},
);
