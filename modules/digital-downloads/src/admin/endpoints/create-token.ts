import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DigitalDownloadsController } from "../../service";

export const createToken = createAdminEndpoint(
	"/admin/downloads/tokens/create",
	{
		method: "POST",
		body: z.object({
			fileId: z.string(),
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
		const token = await controller.createToken({
			fileId: ctx.body.fileId,
			email: ctx.body.email,
			orderId: ctx.body.orderId,
			maxDownloads: ctx.body.maxDownloads,
			expiresAt: ctx.body.expiresAt,
		});
		return { token };
	},
);
