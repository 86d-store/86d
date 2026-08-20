import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SeoController } from "../../service";

export const deleteRedirectEndpoint = createAdminEndpoint(
	"/admin/seo/redirects/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.seo as SeoController;
		const deleted = await controller.deleteRedirect(ctx.params.id);
		return { deleted };
	},
);
