import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { MediaController } from "../../service";

export const renameFolderEndpoint = createAdminEndpoint(
	"/admin/media/folders/:id",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const folder = await controller.renameFolder(ctx.params.id, ctx.body.name);
		return { folder };
	},
);
