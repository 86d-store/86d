import { createStoreEndpoint } from "@86d-app/core/api";

/**
 * eBay delivers marketplace events through Platform Notifications with a
 * signed payload. No verification material is configured for this Store, so the
 * ingress stays closed rather than creating Orders from an unauthenticated POST.
 * https://developer.ebay.com/api-docs/commerce/notification/overview.html
 */
export const webhookEndpoint = createStoreEndpoint(
	"/ebay/webhooks",
	{
		exposure: "provider_webhook",
		method: "POST",
		requireRequest: true,
	},
	async () =>
		Response.json(
			{
				error:
					"eBay webhook verification is not configured; provider ingress is disabled.",
			},
			{ status: 503 },
		),
);
