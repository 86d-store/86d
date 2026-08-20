import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RedirectController } from "../../service";

export const testRedirect = createAdminEndpoint(
	"/admin/redirects/test",
	{
		method: "POST",
		body: z.object({
			path: z.string().min(1).max(2000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;
		const result = await controller.testPath(ctx.body.path);

		return {
			matched: result.matched,
			...(result.redirect && {
				redirect: {
					id: result.redirect.id,
					sourcePath: result.redirect.sourcePath,
					targetPath: result.redirect.targetPath,
					statusCode: result.redirect.statusCode,
					isRegex: result.redirect.isRegex,
				},
			}),
		};
	},
);
