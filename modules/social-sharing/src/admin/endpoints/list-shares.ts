import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type {
	Network,
	SocialSharingController,
	TargetType,
} from "../../service";

export const listSharesEndpoint = createAdminEndpoint(
	"/admin/social-sharing",
	{
		method: "GET",
		query: z.object({
			targetType: z
				.enum(["product", "collection", "page", "blog-post", "custom"])
				.optional(),
			targetId: z.string().optional(),
			network: z
				.enum([
					"twitter",
					"facebook",
					"pinterest",
					"linkedin",
					"whatsapp",
					"email",
					"copy-link",
				])
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"social-sharing"
		] as SocialSharingController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		// Fetch all matching for accurate total count, then slice for page
		const all = await controller.listShares({
			targetType: ctx.query.targetType as TargetType | undefined,
			network: ctx.query.network as Network | undefined,
			targetId: ctx.query.targetId,
		});
		const total = all.length;
		const shares = all.slice(skip, skip + limit);
		return { shares, total };
	},
);
