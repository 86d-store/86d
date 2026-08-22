import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { DigitalDownloadsController } from "../../service";

export const updateFile = createAdminEndpoint(
	"/admin/downloads/files/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(500).transform(sanitizeText).optional(),
			url: z.string().url().optional(),
			fileSize: z.number().int().min(0).optional(),
			mimeType: z.string().max(200).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const file = await controller.updateFile(ctx.params.id, {
			name: ctx.body.name,
			url: ctx.body.url,
			fileSize: ctx.body.fileSize,
			mimeType: ctx.body.mimeType,
			isActive: ctx.body.isActive,
		});
		if (!file) return { error: "File not found", status: 404 };
		return { file };
	},
);
