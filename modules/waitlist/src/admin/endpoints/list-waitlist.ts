import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WaitlistController } from "../../service";

export const listWaitlist = createAdminEndpoint(
	"/admin/waitlist",
	{
		method: "GET",
		query: z.object({
			productId: z.string().optional(),
			email: z.string().optional(),
			status: z
				.enum(["waiting", "notified", "purchased", "cancelled"])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.waitlist as WaitlistController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;

		// Fetch all matching for accurate total count, then slice for page
		const all = await controller.listAll({
			productId: ctx.query.productId,
			email: ctx.query.email,
			status: ctx.query.status,
		});
		const total = all.length;
		const entries = all.slice(skip, skip + take);
		return { entries, total };
	},
);
