import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const trackOrder = createStoreEndpoint(
	"/orders/track",
	{
		method: "POST",
		body: z.object({
			orderNumber: z
				.string()
				.min(1, "Order number is required")
				.transform((v) => v.trim()),
			email: z
				.string()
				.email("Valid email is required")
				.transform((v) => v.toLowerCase().trim()),
		}),
	},
	async () => {
		return {
			code: "ORDER_GUEST_PROOF_REQUIRED",
			error:
				"Guest tracking is unavailable until it is authorized by the scoped Checkout-to-Order proof.",
			status: 503,
		};
	},
);
