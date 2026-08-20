import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RedirectController } from "../../service";

export const deleteRedirect = createAdminEndpoint(
	"/admin/redirects/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;
		const deleted = await controller.deleteRedirect(ctx.params.id);

		if (!deleted) {
			return { error: "Redirect not found", status: 404 };
		}

		return { success: true };
	},
);
