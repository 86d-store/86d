import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";

const prepareInputSchema = z
	.object({
		bindingId: z.string().trim().min(1).max(255),
		merchantPaymentAccountId: z.string().trim().min(1).max(255),
		mode: z.enum(["sandbox", "live"]).default("sandbox"),
		option: z.enum(["card", "apple_pay", "google_pay"]).default("card"),
	})
	.strict();

/**
 * Contained managed Payment prepare endpoint. Tokenization config is served by
 * the managed-payments module once live activation evidence exists.
 */
export const prepareManagedPaymentUnavailable = createStoreEndpoint(
	"/payments/managed/prepare",
	{
		method: "POST",
		body: prepareInputSchema,
	},
	async () =>
		Response.json(
			{
				code: "PAYMENT_ACTIVATION_REQUIRED",
				error:
					"Managed Payment tokenization remains contained until production evidence exists.",
			},
			{ status: 503 },
		),
);
