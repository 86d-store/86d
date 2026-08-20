import { createStoreEndpoint } from "@86d-app/core/api";

/**
 * SP-API notifications are delivered through SQS or EventBridge, not this
 * historical custom-HMAC HTTP shape. Keep direct imports fail-closed while a
 * provider-native consumer is deferred.
 * https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide
 */
export function createAmazonWebhook(_webhookSecret?: string | undefined) {
	return createStoreEndpoint(
		"/amazon/webhooks",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async () =>
			Response.json(
				{
					error:
						"Amazon SP-API HTTP notification ingress is disabled; use a provider-native SQS or EventBridge consumer.",
				},
				{ status: 503 },
			),
	);
}
