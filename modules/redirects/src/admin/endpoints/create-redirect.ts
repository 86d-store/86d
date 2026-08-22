import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { RedirectController } from "../../service";

export const createRedirect = createAdminEndpoint(
	"/admin/redirects/create",
	{
		method: "POST",
		body: z.object({
			sourcePath: z.string().min(1).max(2000),
			targetPath: z.string().min(1).max(2000),
			statusCode: z
				.number()
				.int()
				.refine((v) => [301, 302, 307, 308].includes(v), {
					message: "Status code must be 301, 302, 307, or 308",
				})
				.optional(),
			isActive: z.boolean().optional(),
			isRegex: z.boolean().optional(),
			preserveQueryString: z.boolean().optional(),
			note: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;

		// Prevent duplicate source paths for non-regex redirects
		if (!ctx.body.isRegex) {
			const existing = await controller.listRedirects({});
			const duplicate = existing.find(
				(r) => !r.isRegex && r.sourcePath === ctx.body.sourcePath,
			);
			if (duplicate) {
				return {
					error: "A redirect with this source path already exists",
					status: 400,
				};
			}
		}

		// Prevent redirect loops
		if (ctx.body.sourcePath === ctx.body.targetPath) {
			return {
				error: "Source and target paths cannot be the same",
				status: 400,
			};
		}

		const params: Parameters<typeof controller.createRedirect>[0] = {
			sourcePath: ctx.body.sourcePath,
			targetPath: ctx.body.targetPath,
		};
		if (ctx.body.statusCode != null) params.statusCode = ctx.body.statusCode;
		if (ctx.body.isActive != null) params.isActive = ctx.body.isActive;
		if (ctx.body.isRegex != null) params.isRegex = ctx.body.isRegex;
		if (ctx.body.preserveQueryString != null)
			params.preserveQueryString = ctx.body.preserveQueryString;
		if (ctx.body.note != null) params.note = ctx.body.note;

		const redirect = await controller.createRedirect(params);

		return { redirect };
	},
);
