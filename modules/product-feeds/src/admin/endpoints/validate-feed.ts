import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductFeedsController } from "../../service";

export const validateFeed = createAdminEndpoint(
	"/admin/product-feeds/:id/validate",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;
		const issues = await controller.validateFeed(ctx.params.id);
		return {
			valid: issues.filter((i) => i.severity === "error").length === 0,
			issues,
		};
	},
);
