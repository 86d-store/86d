import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const calculateRatesUnavailable = createStoreEndpoint(
	"/shipping/calculate",
	{
		method: "POST",
		body: z.object({
			country: z.string().length(2),
			orderAmount: z.number().int().min(0),
			weight: z.number().min(0).optional(),
		}),
	},
	async () => ({
		code: "SHIPPING_QUOTE_V2_REQUIRED",
		error:
			"Shipping quotes require server-owned origin and packing plus a revision-bound local option.",
		status: 503,
	}),
);

export const trackShipmentUnavailable = createStoreEndpoint(
	"/shipping/track/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async () => ({
		code: "SHIPPING_CUSTOMER_CONTINUITY_REQUIRED",
		error:
			"Tracking requires a fulfillment-linked record and verified Store Customer or scoped guest proof.",
		status: 503,
	}),
);
