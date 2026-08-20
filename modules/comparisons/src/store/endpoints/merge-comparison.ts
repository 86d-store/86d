import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ComparisonController } from "../../service";

export const mergeComparison = createStoreEndpoint(
	"/comparisons/merge",
	{
		method: "POST",
		body: z.object({
			sessionId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.comparisons as ComparisonController;
		const customerId = ctx.context.session?.user.id;

		if (!customerId) {
			return { error: "Authentication required", status: 401 };
		}

		const maxProducts = Number(
			(ctx.context.options as Record<string, unknown>)?.maxProducts,
		);

		const merged = await controller.mergeComparison({
			sessionId: ctx.body.sessionId,
			customerId,
			maxProducts: Number.isFinite(maxProducts) ? maxProducts : undefined,
		});

		return { merged };
	},
);
