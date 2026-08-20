import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { AnalyticsController } from "../../service";

export const trackEventEndpoint = createStoreEndpoint(
	"/analytics/events",
	{
		method: "POST",
		body: z.object({
			type: z.string().min(1).max(100).transform(sanitizeText),
			sessionId: z.string().max(200).optional(),
			productId: z.string().max(200).optional(),
			orderId: z.string().max(200).optional(),
			value: z.number().optional(),
			data: z
				.record(z.string().max(100), z.unknown())
				.refine((obj) => Object.keys(obj).length <= 50, {
					message: "Data object must have at most 50 keys",
				})
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.analytics as AnalyticsController;
		const customerId = ctx.context.session?.user.id;
		const event = await controller.track({
			type: ctx.body.type,
			sessionId: !customerId ? ctx.body.sessionId : undefined,
			customerId,
			productId: ctx.body.productId,
			orderId: ctx.body.orderId,
			value: ctx.body.value,
			data: ctx.body.data,
		});
		return { event };
	},
);
