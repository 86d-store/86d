import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TaxController } from "../../service";

export const adminGetReport = createAdminEndpoint(
	"/admin/tax/report",
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
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const report = await controller.getReport({
			country: ctx.query.country,
			state: ctx.query.state,
			startDate: ctx.query.startDate,
			endDate: ctx.query.endDate,
		});
		return { report };
	},
);
