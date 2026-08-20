import { createAdminEndpoint } from "@86d-app/core/api";
import { isSafeUrl, sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { NavigationController } from "../../service";

export const updateItemEndpoint = createAdminEndpoint(
	"/admin/navigation/items/:id/update",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			label: z.string().min(1).max(200).transform(sanitizeText).optional(),
			parentId: z.string().optional(),
			type: z
				.enum(["link", "category", "collection", "page", "product"])
				.optional(),
			url: z.string().max(2000).refine(isSafeUrl, "Invalid URL").optional(),
			resourceId: z.string().optional(),
			openInNewTab: z.boolean().optional(),
			cssClass: z.string().max(200).transform(sanitizeText).optional(),
			position: z.number().int().min(0).optional(),
			isVisible: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.navigation as NavigationController;
		const item = await controller.updateItem(ctx.params.id, {
			label: ctx.body.label,
			parentId: ctx.body.parentId,
			type: ctx.body.type,
			url: ctx.body.url,
			resourceId: ctx.body.resourceId,
			openInNewTab: ctx.body.openInNewTab,
			cssClass: ctx.body.cssClass,
			position: ctx.body.position,
			isVisible: ctx.body.isVisible,
		});
		return { item };
	},
);
