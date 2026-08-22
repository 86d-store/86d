import { createStoreEndpoint } from "@86d-app/core/api";
import { readManagedWorkloadConfig } from "@86d-app/sdk/workload-token-client";
import { getProcessEnv } from "env/process-env";
import { z } from "zod";
import { createManagedPaymentClient } from "../../managed-payment-client";

const prepareInputSchema = z
	.object({
		bindingId: z.string().trim().min(1).max(255),
		merchantPaymentAccountId: z.string().trim().min(1).max(255),
		mode: z.enum(["sandbox", "live"]).default("sandbox"),
		option: z.enum(["card", "apple_pay", "google_pay"]).default("card"),
	})
	.strict();

export function createPrepareManagedPaymentEndpoint(options?: {
	liveActivation?: boolean | undefined;
}) {
	return createStoreEndpoint(
		"/payments/managed/prepare",
		{
			method: "POST",
			body: prepareInputSchema,
		},
		async ({ body }) => {
			const liveActivation =
				options?.liveActivation ??
				getProcessEnv("86D_PAYMENTS_LIVE_ACTIVATION") === "true";
			if (!liveActivation) {
				return Response.json(
					{
						code: "PAYMENT_ACTIVATION_REQUIRED",
						error:
							"Managed Payment tokenization remains contained until production evidence exists.",
					},
					{ status: 503 },
				);
			}

			const client = createManagedPaymentClient({
				config: readManagedWorkloadConfig(),
			});
			if (!client.configured) {
				return Response.json(
					{
						code: "MANAGED_PAYMENT_UNAVAILABLE",
						error: "Managed workload identity is not configured.",
					},
					{ status: 503 },
				);
			}

			try {
				const prepared = await client.preparePaymentOption(body);
				return Response.json({
					providerReference: prepared.providerReference,
					option: prepared.option,
					safeConfiguration: prepared.safeConfiguration,
				});
			} catch {
				return Response.json(
					{
						code: "MANAGED_PAYMENT_UNAVAILABLE",
						error: "Managed Payment preparation is temporarily unavailable.",
					},
					{ status: 503 },
				);
			}
		},
	);
}
