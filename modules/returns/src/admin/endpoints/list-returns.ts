import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReturnController } from "../../service";

export const listReturns = createAdminEndpoint(
	"/admin/returns",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum([
					"requested",
					"approved",
					"rejected",
					"received",
					"completed",
					"cancelled",
				])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.returns as ReturnController;
		const returns = await controller.list({
			status: ctx.query.status,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return { returns };
	},
);
