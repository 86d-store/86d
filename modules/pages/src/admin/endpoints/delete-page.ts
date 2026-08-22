import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PagesController } from "../../service";

export const deletePageEndpoint = createAdminEndpoint(
	"/admin/pages/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.pages as PagesController;
		const deleted = await controller.deletePage(ctx.params.id);
		return { deleted };
	},
);
