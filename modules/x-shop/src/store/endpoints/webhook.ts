import { createStoreEndpoint } from "@86d-app/core/api";

/**
 * X delivers events with a signed payload. No verification material is
 * configured for this Store, so the ingress stays closed rather than accepting
 * an unsigned provider event.
 */
export const webhookEndpoint = createStoreEndpoint(
	"/x-shop/webhooks",
	{
		exposure: "provider_webhook",
		method: "POST",
		requireRequest: true,
	},
	async () =>
		Response.json(
			{
				error:
					"X Shop webhook verification is not configured; provider ingress is disabled.",
			},
			{ status: 503 },
		),
);
