import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TaxController } from "../../service";

export const adminListNexus = createAdminEndpoint(
	"/admin/tax/nexus",
	{
		method: "GET",
		query: z.object({
			country: z.string().optional(),
			enabled: z
				.string()
				.transform((v) => v === "true")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const nexus = await controller.listNexus({
			country: ctx.query.country,
			enabled: ctx.query.enabled,
		});
		return { nexus };
	},
);
