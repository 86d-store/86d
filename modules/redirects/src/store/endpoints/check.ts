import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { RedirectController } from "../../service";

export const checkRedirect = createStoreEndpoint(
	"/redirects/check",
	{
		method: "GET",
		query: z.object({
			path: z.string().min(1).max(2000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;

		const result = await controller.testPath(ctx.query.path);

		return {
			matched: result.matched,
			...(result.redirect && {
				statusCode: result.redirect.statusCode,
				targetPath: result.redirect.targetPath,
			}),
		};
	},
);
