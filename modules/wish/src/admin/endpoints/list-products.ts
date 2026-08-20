import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WishController, WishProductStatus } from "../../service";

export const listProductsEndpoint = createAdminEndpoint(
	"/admin/wish/products",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["active", "disabled", "pending-review", "rejected"])
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wish as WishController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listProducts({
			status: ctx.query.status as WishProductStatus | undefined,
		});
		const total = all.length;
		const products = all.slice(skip, skip + limit);
		return { products, total };
	},
);
