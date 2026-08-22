import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { RedirectController } from "../../service";

export const resolveRedirect = createStoreEndpoint(
	"/redirects/resolve",
	{
		method: "GET",
		query: z.object({
			path: z.string().min(1).max(2000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;

		const result = await controller.resolve(ctx.query.path);
		if (!result) {
			return { matched: false };
		}

		// Find the redirect to record the hit
		const test = await controller.testPath(ctx.query.path);
		if (test.redirect) {
			await controller.recordHit(test.redirect.id);
		}

		return {
			matched: true,
			targetPath: result.targetPath,
			statusCode: result.statusCode,
			preserveQueryString: result.preserveQueryString,
		};
	},
);
