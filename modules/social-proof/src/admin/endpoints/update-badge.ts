import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { BadgePosition, SocialProofController } from "../../service";

export const updateBadge = createAdminEndpoint(
	"/admin/social-proof/badges/:id/update",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			description: z
				.string()
				.max(500)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			icon: z.string().min(1).max(200).optional(),
			url: z.string().max(2000).nullable().optional(),
			position: z
				.enum(["header", "footer", "product", "checkout", "cart"])
				.optional(),
			priority: z.number().int().min(0).max(1000).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const badge = await controller.updateBadge(ctx.params.id, {
			name: ctx.body.name,
			description: ctx.body.description,
			icon: ctx.body.icon,
			url: ctx.body.url,
			position: ctx.body.position as BadgePosition | undefined,
			priority: ctx.body.priority,
			isActive: ctx.body.isActive,
		});

		if (!badge) {
			return { error: "Badge not found", status: 404 };
		}

		return { badge };
	},
);
