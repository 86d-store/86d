import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FlashSaleController } from "../../service";

export const listFlashSales = createAdminEndpoint(
	"/admin/flash-sales",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["draft", "scheduled", "active", "ended"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const [sales, total] = await Promise.all([
			controller.listFlashSales({
				...(ctx.query.status != null && { status: ctx.query.status }),
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countFlashSales({
				...(ctx.query.status != null && { status: ctx.query.status }),
			}),
		]);

		return { sales, total };
	},
);
