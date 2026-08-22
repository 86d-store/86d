import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ShippingController } from "../../service";

const addressSchema = z.object({
	name: z.string().max(200).transform(sanitizeText).optional(),
	company: z.string().max(200).transform(sanitizeText).optional(),
	street1: z.string().min(1).max(500).transform(sanitizeText),
	street2: z.string().max(500).transform(sanitizeText).optional(),
	city: z.string().min(1).max(200).transform(sanitizeText),
	state: z.string().min(1).max(100).transform(sanitizeText),
	zip: z.string().min(1).max(20).transform(sanitizeText),
	country: z.string().min(2).max(2).transform(sanitizeText),
	phone: z.string().max(30).transform(sanitizeText).optional(),
});

const parcelSchema = z.object({
	length: z.number().positive(),
	width: z.number().positive(),
	height: z.number().positive(),
	weight: z.number().positive(),
});

export const liveRatesEndpoint = createStoreEndpoint(
	"/shipping/live-rates",
	{
		method: "POST",
		body: z.object({
			fromAddress: addressSchema,
			toAddress: addressSchema,
			parcel: parcelSchema,
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const rates = await controller.getLiveRates({
			fromAddress: ctx.body.fromAddress,
			toAddress: ctx.body.toAddress,
			parcel: ctx.body.parcel,
		});
		return { rates };
	},
);
