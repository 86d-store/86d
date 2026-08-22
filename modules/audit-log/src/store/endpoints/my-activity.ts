import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AuditLogController } from "../../service";

export const myActivity = createStoreEndpoint(
	"/audit-log/my-activity",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers[
			"audit-log"
		] as AuditLogController;

		const take = ctx.query.take ?? 25;
		const skip = ctx.query.skip ?? 0;

		const entries = await controller.listForActor(userId, { take, skip });

		return { entries, total: entries.length };
	},
);
