import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";

/**
 * Guest order confirmation lookup.
 * Allows a guest to fetch their order by ID + email after checkout.
 * Returns the order only if the email matches the guestEmail on the order.
 * Authenticated users whose customerId matches the order also get access.
 */
export const confirmOrder = createStoreEndpoint(
	"/orders/confirm",
	{
		method: "POST",
		body: z.object({
			orderId: z.string().min(1, "Order ID is required").max(128),
			email: z
				.string()
				.email("Valid email is required")
				.max(320)
				.transform((v) => v.toLowerCase().trim()),
		}),
	},
	async () => {
		return {
			code: "ORDER_GUEST_PROOF_REQUIRED",
			error:
				"Guest confirmation is unavailable until it is authorized by the scoped Checkout-to-Order proof.",
			status: 503,
		};
	},
);
