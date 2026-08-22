import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ComparisonController } from "../../service";

export const customerItems = createAdminEndpoint(
	"/admin/comparisons/customer/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
		query: z.object({
			take: z.coerce.number().int().min(1).max(200).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.comparisons as ComparisonController;

		const [items, total] = await Promise.all([
			controller.listAll({
				customerId: ctx.params.id,
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countItems({
				customerId: ctx.params.id,
			}),
		]);

		return { items, total };
	},
);
