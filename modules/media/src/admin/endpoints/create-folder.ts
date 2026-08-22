import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { MediaController } from "../../service";

export const createFolderEndpoint = createAdminEndpoint(
	"/admin/media/folders/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			parentId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const folder = await controller.createFolder({
			name: ctx.body.name,
			parentId: ctx.body.parentId,
		});
		return { folder };
	},
);
