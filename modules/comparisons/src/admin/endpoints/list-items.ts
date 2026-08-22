import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ComparisonController } from "../../service";

export const listAllItems = createAdminEndpoint(
	"/admin/comparisons",
	{
		method: "GET",
		query: z.object({
			customerId: z.string().optional(),
			productId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(200).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.comparisons as ComparisonController;

		const [items, total] = await Promise.all([
			controller.listAll({
				customerId: ctx.query.customerId,
				productId: ctx.query.productId,
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countItems({
				customerId: ctx.query.customerId,
				productId: ctx.query.productId,
			}),
		]);

		return { items, total };
	},
);
