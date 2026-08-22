import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WarrantyController } from "../../service";

export const listClaims = createStoreEndpoint(
	"/warranties/claims",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum([
					"submitted",
					"under_review",
					"approved",
					"denied",
					"in_repair",
					"resolved",
					"closed",
				])
				.optional(),
			take: z.coerce.number().int().min(1).max(50).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.warranties as WarrantyController;
		const claims = await controller.getClaimsByCustomer(userId, {
			status: ctx.query.status,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});

		return { claims };
	},
);
