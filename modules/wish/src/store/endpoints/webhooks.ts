import { createStoreEndpoint } from "@86d-app/core/api";

/**
 * Wish delivers marketplace events with a signed payload. No verification
 * material is configured for this Store, so the ingress stays closed rather than
 * creating Orders from an unauthenticated POST.
 */
export const webhookEndpoint = createStoreEndpoint(
	"/wish/webhooks",
	{
		exposure: "provider_webhook",
		method: "POST",
		requireRequest: true,
	},
	async () =>
		Response.json(
			{
				error:
					"Wish webhook verification is not configured; provider ingress is disabled.",
			},
			{ status: 503 },
		),
);
