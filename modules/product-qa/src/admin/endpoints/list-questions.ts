import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductQaController } from "../../service";

export const listQuestions = createAdminEndpoint(
	"/admin/product-qa/questions",
	{
		method: "GET",
		query: z.object({
			productId: z.string().optional(),
			status: z.enum(["pending", "published", "rejected"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const questions = await controller.listQuestions({
			productId: ctx.query.productId,
			status: ctx.query.status,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return { questions };
	},
);
