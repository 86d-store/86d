import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { UberEatsController } from "../../service";

export const receiveOrderEndpoint = createStoreEndpoint(
	"/uber-eats/orders",
	{
		method: "POST",
		body: z.object({
			externalOrderId: z.string().max(200),
			items: z
				.array(
					z
						.record(z.string().max(100), z.unknown())
						.refine(
							(r) => Object.keys(r).length <= 50,
							"Too many keys in item record",
						),
				)
				.max(100),
			subtotal: z.number().min(0),
			deliveryFee: z.number().min(0),
			tax: z.number().min(0),
			total: z.number().min(0),
			customerName: z.string().max(200).transform(sanitizeText).optional(),
			customerPhone: z.string().max(50).transform(sanitizeText).optional(),
			specialInstructions: z
				.string()
				.max(1000)
				.transform(sanitizeText)
				.optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		const role = ctx.context.session?.user?.role;
		if (!userId || role !== "admin") {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers[
			"uber-eats"
		] as UberEatsController;
		const order = await controller.receiveOrder({
			externalOrderId: ctx.body.externalOrderId,
			items: ctx.body.items,
			subtotal: ctx.body.subtotal,
			deliveryFee: ctx.body.deliveryFee,
			tax: ctx.body.tax,
			total: ctx.body.total,
			customerName: ctx.body.customerName,
			customerPhone: ctx.body.customerPhone,
			specialInstructions: ctx.body.specialInstructions,
		});
		return { order };
	},
);
