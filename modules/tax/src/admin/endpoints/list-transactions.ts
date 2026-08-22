import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TaxController } from "../../service";

export const adminListTransactions = createAdminEndpoint(
	"/admin/tax/transactions",
	{
		method: "GET",
		query: z.object({
			country: z.string().optional(),
			state: z.string().optional(),
			startDate: z
				.string()
				.transform((v) => new Date(v))
				.optional(),
			endDate: z
				.string()
				.transform((v) => new Date(v))
				.optional(),
			limit: z
				.string()
				.transform((v) => Number.parseInt(v, 10))
				.optional(),
			offset: z
				.string()
				.transform((v) => Number.parseInt(v, 10))
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const transactions = await controller.listTransactions({
			country: ctx.query.country,
			state: ctx.query.state,
			startDate: ctx.query.startDate,
			endDate: ctx.query.endDate,
			limit: ctx.query.limit,
			offset: ctx.query.offset,
		});
		return { transactions };
	},
);
