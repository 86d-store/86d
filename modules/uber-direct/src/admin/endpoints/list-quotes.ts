import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { UberDirectController } from "../../service";

export const listQuotes = createAdminEndpoint(
	"/admin/uber-direct/quotes",
	{
		method: "GET",
		query: z.object({
			status: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.uberDirect as UberDirectController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listQuotes({
			status: ctx.query.status,
		});
		const total = all.length;
		const quotes = all.slice(skip, skip + take);
		return { quotes, total };
	},
);
