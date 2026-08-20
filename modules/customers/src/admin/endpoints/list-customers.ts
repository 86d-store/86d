import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerController } from "../../service";

export const adminListCustomers = createAdminEndpoint(
	"/admin/customers",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(100).optional().default(20),
			search: z.string().optional(),
			tag: z.string().optional(),
		}),
	},
	async (ctx) => {
		const { page, limit, search, tag } = ctx.query;
		const offset = (page - 1) * limit;

		const controller = ctx.context.controllers.customer as CustomerController;
		const { customers, total } = await controller.list({
			limit,
			offset,
			...(search !== undefined ? { search } : {}),
			...(tag !== undefined ? { tag } : {}),
		});

		return {
			customers,
			total,
			page,
			limit,
			pages: Math.ceil(total / limit),
		};
	},
);
