import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ComparisonController } from "../../service";

export const listComparison = createStoreEndpoint(
	"/comparisons",
	{
		method: "GET",
		query: z.object({
			sessionId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.comparisons as ComparisonController;
		const customerId = ctx.context.session?.user.id;

		const items = await controller.getComparison({
			customerId,
			sessionId: !customerId ? ctx.query.sessionId : undefined,
		});

		return { items, total: items.length };
	},
);
