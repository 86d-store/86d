import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { RedirectController } from "../../service";

export const updateRedirect = createAdminEndpoint(
	"/admin/redirects/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			sourcePath: z.string().min(1).max(2000).optional(),
			targetPath: z.string().min(1).max(2000).optional(),
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
			note: z.string().max(1000).transform(sanitizeText).nullable().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;

		// Get existing to check for loop
		const existing = await controller.getRedirect(ctx.params.id);
		if (!existing) {
			return { error: "Redirect not found", status: 404 };
		}

		const newSource = ctx.body.sourcePath ?? existing.sourcePath;
		const newTarget = ctx.body.targetPath ?? existing.targetPath;
		if (newSource === newTarget) {
			return {
				error: "Source and target paths cannot be the same",
				status: 400,
			};
		}

		// Check for duplicate source paths
		if (ctx.body.sourcePath && ctx.body.sourcePath !== existing.sourcePath) {
			const isRegex = ctx.body.isRegex ?? existing.isRegex;
			if (!isRegex) {
				const all = await controller.listRedirects({});
				const duplicate = all.find(
					(r) =>
						r.id !== ctx.params.id &&
						!r.isRegex &&
						r.sourcePath === ctx.body.sourcePath,
				);
				if (duplicate) {
					return {
						error: "A redirect with this source path already exists",
						status: 400,
					};
				}
			}
		}

		const updateParams: Parameters<typeof controller.updateRedirect>[1] = {};
		if (ctx.body.sourcePath != null)
			updateParams.sourcePath = ctx.body.sourcePath;
		if (ctx.body.targetPath != null)
			updateParams.targetPath = ctx.body.targetPath;
		if (ctx.body.statusCode != null)
			updateParams.statusCode = ctx.body.statusCode;
		if (ctx.body.isActive != null) updateParams.isActive = ctx.body.isActive;
		if (ctx.body.isRegex != null) updateParams.isRegex = ctx.body.isRegex;
		if (ctx.body.preserveQueryString != null)
			updateParams.preserveQueryString = ctx.body.preserveQueryString;
		// note can be explicitly null (to clear) or a string value
		if (ctx.body.note !== undefined) updateParams.note = ctx.body.note;

		const redirect = await controller.updateRedirect(
			ctx.params.id,
			updateParams,
		);

		if (!redirect) {
			return { error: "Redirect not found", status: 404 };
		}

		return { redirect };
	},
);
