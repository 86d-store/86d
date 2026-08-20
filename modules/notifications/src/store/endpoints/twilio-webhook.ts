import { createStoreEndpoint } from "@86d-app/core/api";

/**
 * Twilio callback containment endpoint. It authenticates the exact form body,
 * then asks the provider to retry until receipt persistence and delivery-status
 * projection can be performed durably.
 *
 * Twilio POSTs URL-encoded form data with:
 *   MessageSid    — the message SID (matches smsDelivery.messageId stored at send time)
 *   MessageStatus — "queued" | "sending" | "sent" | "delivered" | "undelivered" | "failed"
 *   SmsStatus     — same as MessageStatus (older field, kept for compatibility)
 *   AccountSid, From, To, Body, NumSegments
 *
 * Signature verification uses HMAC-SHA1 over: callbackUrl + sorted(formParams).
 * The key is the Twilio Auth Token. The result is base64-encoded and compared
 * with the X-Twilio-Signature header.
 *
 * An unconfigured verifier fails closed.
 */

async function computeTwilioSignature(
	authToken: string,
	url: string,
	params: Record<string, string>,
): Promise<string> {
	// Twilio signature: HMAC-SHA1(authToken, url + sorted params (key+value pairs concatenated))
	const sortedKeys = Object.keys(params).sort();
	const paramString = sortedKeys.map((k) => `${k}${params[k]}`).join("");
	const toSign = url + paramString;

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(authToken),
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const sigBytes = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(toSign),
	);
	return btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
}

export function createTwilioWebhook(opts: {
	authToken?: string | undefined;
	webhookUrl?: string | undefined;
}) {
	return createStoreEndpoint(
		"/notifications/webhook/twilio",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const request = ctx.request;
			const rawBody = await request.text();

			// Parse URL-encoded form body
			const params: Record<string, string> = {};
			for (const [k, v] of new URLSearchParams(rawBody)) {
				params[k] = v;
			}

			const authToken = opts.authToken?.trim();
			const webhookUrl = opts.webhookUrl?.trim();
			if (!authToken || !webhookUrl) {
				return Response.json(
					{ error: "Twilio webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const twilioSignature = request.headers.get("x-twilio-signature") ?? "";
			if (!twilioSignature) {
				return Response.json(
					{ error: "Missing X-Twilio-Signature header." },
					{ status: 401 },
				);
			}

			const expected = await computeTwilioSignature(
				authToken,
				webhookUrl,
				params,
			);
			if (twilioSignature !== expected) {
				return Response.json(
					{ error: "Invalid webhook signature." },
					{ status: 401 },
				);
			}

			return Response.json(
				{
					code: "NOTIFICATION_WEBHOOK_DURABILITY_REQUIRED",
					error:
						"Twilio webhook processing requires a durable provider receipt.",
				},
				{ status: 503, headers: { "Retry-After": "60" } },
			);
		},
	);
}
