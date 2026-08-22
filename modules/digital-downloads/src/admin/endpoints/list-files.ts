import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DigitalDownloadsController } from "../../service";

export const listFiles = createAdminEndpoint(
	"/admin/downloads/files",
	{
		method: "GET",
		query: z.object({
			productId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const files = await controller.listFiles({
			productId: ctx.query.productId,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		return { files };
	},
);
