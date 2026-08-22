import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { FavorController } from "../../service";

export const createDelivery = createStoreEndpoint(
	"/favor/deliveries",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().min(1).max(200),
			pickupAddress: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 20, {
					message: "Too many fields in address",
				}),
			dropoffAddress: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 20, {
					message: "Too many fields in address",
				}),
			fee: z.number().min(0).max(100000),
			tip: z.number().min(0).max(100000).optional(),
			specialInstructions: z
				.string()
				.max(500)
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

		const controller = ctx.context.controllers.favor as FavorController;
		const delivery = await controller.createDelivery({
			orderId: ctx.body.orderId,
			pickupAddress: ctx.body.pickupAddress,
			dropoffAddress: ctx.body.dropoffAddress,
			fee: ctx.body.fee,
			tip: ctx.body.tip,
			specialInstructions: ctx.body.specialInstructions,
		});
		return { delivery };
	},
);
