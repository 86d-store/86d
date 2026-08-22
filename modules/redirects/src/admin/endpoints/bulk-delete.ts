import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { RedirectController } from "../../service";

export const bulkDeleteRedirects = createAdminEndpoint(
	"/admin/redirects/bulk-delete",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string().min(1)).min(1).max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;
		const deleted = await controller.bulkDelete(ctx.body.ids);

		return { deleted };
	},
);
