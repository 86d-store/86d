import { createStoreEndpoint } from "@86d-app/core/api";

/**
 * Resend webhook containment endpoint. It authenticates the exact raw request,
 * then asks the provider to retry until receipt persistence and delivery-status
 * projection can be performed durably.
 *
 * Resend uses Svix for webhook delivery. Each request carries three headers:
 *   svix-id        — unique message ID
 *   svix-timestamp — Unix seconds (must be within 5 minutes)
 *   svix-signature — space-separated list of "v1,<base64-hmac-sha256>" signatures
 *
 * The signed payload is: `${svixId}.${svixTimestamp}.${rawBody}`
 * The key is the raw bytes of the webhook signing secret.
 *
 * An unconfigured verifier fails closed.
 */

const FIVE_MINUTES_MS = 5 * 60 * 1000;

type VerifySvixSignatureOptions = {
	rawBody: string;
	svixId: string;
	svixTimestamp: string;
	svixSignature: string;
	secret: string;
};

async function verifySvixSignature(
	options: VerifySvixSignatureOptions,
): Promise<boolean> {
	const { rawBody, svixId, svixTimestamp, svixSignature, secret } = options;
	// Replay-attack guard: reject events older than 5 minutes
	const ts = Number(svixTimestamp) * 1000;
	if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > FIVE_MINUTES_MS) {
		return false;
	}

	const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sigBytes = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(toSign),
	);
	const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));

	// svix-signature may contain multiple signatures ("v1,<b64> v1,<b64>")
	const candidates = svixSignature.split(" ");
	for (const candidate of candidates) {
		const parts = candidate.split(",");
		if (parts.length === 2 && parts[0] === "v1" && parts[1] === expected) {
			return true;
		}
	}
	return false;
}

export function createResendWebhook(opts: {
	webhookSecret?: string | undefined;
}) {
	return createStoreEndpoint(
		"/notifications/webhook/resend",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const request = ctx.request;

			const webhookSecret = opts.webhookSecret?.trim();
			if (!webhookSecret) {
				return Response.json(
					{ error: "Resend webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const rawBody = await request.text();
			const svixId = request.headers.get("svix-id") ?? "";
			const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
			const svixSignature = request.headers.get("svix-signature") ?? "";
			if (!svixId || !svixTimestamp || !svixSignature) {
				return Response.json(
					{ error: "Missing Svix webhook headers." },
					{ status: 401 },
				);
			}

			const valid = await verifySvixSignature({
				rawBody,
				svixId,
				svixTimestamp,
				svixSignature,
				secret: webhookSecret,
			});
			if (!valid) {
				return Response.json(
					{ error: "Invalid or expired webhook signature." },
					{ status: 401 },
				);
			}

			return Response.json(
				{
					code: "NOTIFICATION_WEBHOOK_DURABILITY_REQUIRED",
					error:
						"Resend webhook processing requires a durable provider receipt.",
				},
				{ status: 503, headers: { "Retry-After": "60" } },
			);
		},
	);
}
