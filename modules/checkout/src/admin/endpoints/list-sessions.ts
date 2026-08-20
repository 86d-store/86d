import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CheckoutController, CheckoutStatus } from "../../service";

export const adminListSessions = createAdminEndpoint(
	"/admin/checkout/sessions",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(100).optional().default(20),
			status: z
				.enum(["pending", "processing", "completed", "expired", "abandoned"])
				.optional(),
			search: z.string().optional(),
		}),
	},
	async (ctx) => {
		const { page, limit, status, search } = ctx.query;
		const offset = (page - 1) * limit;

		const controller = ctx.context.controllers.checkout as CheckoutController;
		const { sessions, total } = await controller.listSessions({
			status: status as CheckoutStatus | undefined,
			search,
			take: limit,
			skip: offset,
		});

		return {
			sessions,
			total,
			page,
			limit,
			pages: Math.ceil(total / limit),
		};
	},
);
