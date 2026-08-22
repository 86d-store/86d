import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DoordashController } from "../../service";

export const createDeliveryAdminEndpoint = createAdminEndpoint(
	"/admin/doordash/deliveries/create",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().min(1).max(200),
			pickupAddress: z.record(z.string().max(100), z.unknown()),
			dropoffAddress: z.record(z.string().max(100), z.unknown()),
			fee: z.number().min(0),
			tip: z.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.doordash as DoordashController;
		const delivery = await controller.createDelivery({
			orderId: ctx.body.orderId,
			pickupAddress: ctx.body.pickupAddress,
			dropoffAddress: ctx.body.dropoffAddress,
			fee: ctx.body.fee,
			tip: ctx.body.tip,
		});
		return { delivery };
	},
);
