import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RedirectController } from "../../service";

export const getRedirect = createAdminEndpoint(
	"/admin/redirects/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;
		const redirect = await controller.getRedirect(ctx.params.id);

		if (!redirect) {
			return { error: "Redirect not found", status: 404 };
		}

		return { redirect };
	},
);
