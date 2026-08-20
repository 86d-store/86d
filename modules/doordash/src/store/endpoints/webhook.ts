import { createStoreEndpoint } from "@86d-app/core/api";

/**
 * DoorDash Drive does not document the former x-doordash-signature body-HMAC
 * scheme. Keep direct imports fail-closed while the route is unregistered.
 * https://developer.doordash.com/en-US/docs/drive/how_to/webhooks/
 */
export function createDoordashWebhook(_signingSecret?: string | undefined) {
	return createStoreEndpoint(
		"/doordash/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async () =>
			Response.json(
				{
					error:
						"DoorDash webhook ingress is disabled until documented webhook authentication is configured.",
				},
				{ status: 503 },
			),
	);
}
