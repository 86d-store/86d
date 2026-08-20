import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { Cart } from "../../service";

export const listCarts = createAdminEndpoint(
	"/admin/carts",
	{
		method: "GET",
		query: z
			.object({
				page: z.string().optional(),
				limit: z.string().optional(),
				customerId: z.string().optional(),
				status: z.enum(["active", "abandoned", "converted"]).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const { query = {} } = ctx;
		const context = ctx.context;

		const page = query.page ? Number.parseInt(query.page, 10) : 1;
		const limit = query.limit ? Number.parseInt(query.limit, 10) : 20;
		const skip = (page - 1) * limit;

		const where: Record<string, unknown> = {};
		if (query.customerId) where.customerId = query.customerId;
		if (query.status) where.status = query.status;

		const all = (await context.data.findMany("cart", {
			where,
		})) as Cart[];
		const total = all.length;
		const carts = all.slice(skip, skip + limit);

		return {
			carts,
			page,
			limit,
			total,
		};
	},
);
