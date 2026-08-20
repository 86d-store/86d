import { createStoreEndpoint } from "@86d-app/core/api";

/**
 * Walmart Marketplace delivers events with a signed payload. No verification
 * material is configured for this Store, so the ingress stays closed rather than
 * creating Orders from an unauthenticated POST.
 * https://developer.walmart.com/doc/us/mp/us-mp-notifications/
 */
export const webhookEndpoint = createStoreEndpoint(
	"/walmart/webhooks",
	{
		exposure: "provider_webhook",
		method: "POST",
		requireRequest: true,
	},
	async () =>
		Response.json(
			{
				error:
					"Walmart webhook verification is not configured; provider ingress is disabled.",
			},
			{ status: 503 },
		),
);
