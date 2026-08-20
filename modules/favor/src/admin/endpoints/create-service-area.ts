import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { FavorController } from "../../service";

export const createServiceArea = createAdminEndpoint(
	"/admin/favor/service-areas/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			zipCodes: z.array(z.string().min(1).max(20)).min(1).max(500),
			minOrderAmount: z.number().min(0).max(100000).optional(),
			deliveryFee: z.number().min(0).max(100000),
			estimatedMinutes: z.number().int().min(1).max(600),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.favor as FavorController;
		const area = await controller.createServiceArea({
			name: ctx.body.name,
			zipCodes: ctx.body.zipCodes,
			minOrderAmount: ctx.body.minOrderAmount,
			deliveryFee: ctx.body.deliveryFee,
			estimatedMinutes: ctx.body.estimatedMinutes,
		});
		return { area };
	},
);
