import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { NavigationController } from "../../service";

export const updateMenuEndpoint = createAdminEndpoint(
	"/admin/navigation/menus/:id/update",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().max(200).transform(sanitizeText).optional(),
			location: z
				.enum(["header", "footer", "sidebar", "mobile", "custom"])
				.optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.navigation as NavigationController;
		const menu = await controller.updateMenu(ctx.params.id, {
			name: ctx.body.name,
			slug: ctx.body.slug,
			location: ctx.body.location,
			isActive: ctx.body.isActive,
		});
		return { menu };
	},
);
