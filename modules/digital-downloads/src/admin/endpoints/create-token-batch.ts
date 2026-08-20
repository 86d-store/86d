import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DigitalDownloadsController } from "../../service";

export const createTokenBatch = createAdminEndpoint(
	"/admin/downloads/tokens/batch",
	{
		method: "POST",
		body: z.object({
			fileIds: z.array(z.string()).min(1).max(50),
			email: z.string().email(),
			orderId: z.string().optional(),
			maxDownloads: z.number().int().min(1).optional(),
			expiresAt: z
				.string()
				.datetime()
				.optional()
				.transform((v) => (v ? new Date(v) : undefined)),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const tokens = await controller.createTokenBatch({
			fileIds: ctx.body.fileIds,
			email: ctx.body.email,
			orderId: ctx.body.orderId,
			maxDownloads: ctx.body.maxDownloads,
			expiresAt: ctx.body.expiresAt,
		});
		return { tokens };
	},
);
