import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BadgePosition, SocialProofController } from "../../service";

export const adminListBadges = createAdminEndpoint(
	"/admin/social-proof/badges",
	{
		method: "GET",
		query: z.object({
			position: z
				.enum(["header", "footer", "product", "checkout", "cart"])
				.optional(),
			isActive: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			take: z.coerce.number().int().min(1).max(200).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.socialProof as SocialProofController;

		const [badges, total] = await Promise.all([
			controller.listBadges({
				position: ctx.query.position as BadgePosition | undefined,
				isActive: ctx.query.isActive,
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countBadges({
				position: ctx.query.position as BadgePosition | undefined,
				isActive: ctx.query.isActive,
			}),
		]);

		return { badges, total };
	},
);
