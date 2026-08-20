import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ComparisonController } from "../../service";

export const clearComparison = createStoreEndpoint(
	"/comparisons/clear",
	{
		method: "POST",
		body: z.object({
			sessionId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.comparisons as ComparisonController;
		const customerId = ctx.context.session?.user.id;

		const cleared = await controller.clearComparison({
			customerId,
			sessionId: !customerId ? ctx.body.sessionId : undefined,
		});

		return { cleared };
	},
);
