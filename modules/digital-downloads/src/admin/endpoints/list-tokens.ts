import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DigitalDownloadsController } from "../../service";

export const listTokens = createAdminEndpoint(
	"/admin/downloads/tokens",
	{
		method: "GET",
		query: z.object({
			fileId: z.string().optional(),
			orderId: z.string().optional(),
			email: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listTokens({
			fileId: ctx.query.fileId,
			orderId: ctx.query.orderId,
			email: ctx.query.email,
		});
		const total = all.length;
		const tokens = all.slice(skip, skip + take);
		return { tokens, total };
	},
);
