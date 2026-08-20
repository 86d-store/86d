import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SocialSharingController, TargetType } from "../../service";

export const topEndpoint = createAdminEndpoint(
	"/admin/social-sharing/top",
	{
		method: "GET",
		query: z.object({
			targetType: z
				.enum(["product", "collection", "page", "blog-post", "custom"])
				.optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"social-sharing"
		] as SocialSharingController;
		const top = await controller.getTopShared({
			targetType: ctx.query.targetType as TargetType | undefined,
			take: ctx.query.limit ?? 10,
		});
		return { top };
	},
);
