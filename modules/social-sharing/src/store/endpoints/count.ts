import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SocialSharingController, TargetType } from "../../service";

export const countEndpoint = createStoreEndpoint(
	"/social-sharing/count",
	{
		method: "GET",
		query: z.object({
			targetType: z.enum([
				"product",
				"collection",
				"page",
				"blog-post",
				"custom",
			]),
			targetId: z.string().max(128),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"social-sharing"
		] as SocialSharingController;
		const count = await controller.getShareCount(
			ctx.query.targetType as TargetType,
			ctx.query.targetId,
		);
		return { count };
	},
);
