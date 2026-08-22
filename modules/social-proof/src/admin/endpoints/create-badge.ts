import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { BadgePosition, SocialProofController } from "../../service";

export const createBadge = createAdminEndpoint(
	"/admin/social-proof/badges/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().max(500).transform(sanitizeText).optional(),
			icon: z.string().min(1).max(200),
			url: z.string().max(2000).optional(),
			position: z.enum(["header", "footer", "product", "checkout", "cart"]),
			priority: z.number().int().min(0).max(1000).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const badge = await controller.createBadge({
			name: ctx.body.name,
			description: ctx.body.description,
			icon: ctx.body.icon,
			url: ctx.body.url,
			position: ctx.body.position as BadgePosition,
			priority: ctx.body.priority,
			isActive: ctx.body.isActive,
		});

		return { badge };
	},
);
