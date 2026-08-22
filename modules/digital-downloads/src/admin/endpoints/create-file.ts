import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { DigitalDownloadsController } from "../../service";

export const createFile = createAdminEndpoint(
	"/admin/downloads/files/create",
	{
		method: "POST",
		body: z.object({
			productId: z.string(),
			name: z.string().min(1).max(500).transform(sanitizeText),
			url: z.string().url(),
			fileSize: z.number().int().min(0).optional(),
			mimeType: z.string().max(200).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const file = await controller.createFile({
			productId: ctx.body.productId,
			name: ctx.body.name,
			url: ctx.body.url,
			fileSize: ctx.body.fileSize,
			mimeType: ctx.body.mimeType,
			isActive: ctx.body.isActive,
		});
		return { file };
	},
);
