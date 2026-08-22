import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ComparisonController } from "../../service";

export const frequentProducts = createAdminEndpoint(
	"/admin/comparisons/frequent",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.comparisons as ComparisonController;

		const products = await controller.getFrequentlyCompared({
			take: ctx.query.take ?? 10,
		});

		return { products };
	},
);
