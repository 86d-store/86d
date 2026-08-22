import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ToastController } from "../../service";

export const createMenuMappingEndpoint = createAdminEndpoint(
	"/admin/toast/menu-mappings/create",
	{
		method: "POST",
		body: z.object({
			localProductId: z.string().min(1).max(200).transform(sanitizeText),
			externalMenuItemId: z.string().min(1).max(200).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.toast as ToastController;
		const mapping = await controller.createMenuMapping({
			localProductId: ctx.body.localProductId,
			externalMenuItemId: ctx.body.externalMenuItemId,
		});
		return { mapping };
	},
);
