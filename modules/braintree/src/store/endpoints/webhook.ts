import { createStoreEndpoint } from "@86d-app/core/api";

interface BraintreeWebhookOptions {
	/** Braintree public key — used to match the prefix in bt_signature. */
	publicKey: string;
	/** Braintree private key — used by the SDK-compatible digest derivation. */
	privateKey: string;
}

// ── Braintree signature verification ──────────────────────────────────────────
// Braintree sends webhooks as application/x-www-form-urlencoded with two fields:
//   bt_signature: one or more "<publicKey>|<signature>" pairs joined by `&`
//   bt_payload:   base64-encoded XML notification
// https://developer.paypal.com/braintree/docs/guides/webhooks/parse

const enc = new TextEncoder();

async function hmacSha1Hex(
	keyBytes: BufferSource,
	data: string,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

async function verifyBraintreeSignature(
	btSignature: string,
	btPayload: string,
	publicKey: string,
	privateKey: string,
): Promise<boolean> {
	if (!/^[A-Za-z0-9+/=\n]+$/.test(btPayload)) return false;

	const signatures = btSignature
		.split("&")
		.map((pair) => {
			const pipeIndex = pair.indexOf("|");
			if (pipeIndex < 1) return undefined;
			return {
				publicKey: pair.slice(0, pipeIndex),
				signature: pair.slice(pipeIndex + 1),
			};
		})
		.filter(
			(pair): pair is { publicKey: string; signature: string } =>
				pair !== undefined &&
				pair.signature.length > 0 &&
				timingSafeEqual(pair.publicKey, publicKey),
		);
	if (signatures.length === 0) return false;

	// Braintree's Node SDK first hashes the private key, then uses the binary
	// SHA-1 digest as the HMAC-SHA1 key. It accepts payloads signed with or
	// without the trailing newline used by some gateway versions.
	const derivedKey = await crypto.subtle.digest(
		"SHA-1",
		enc.encode(privateKey),
	);
	const expected = await hmacSha1Hex(derivedKey, btPayload);
	const expectedWithNewline = await hmacSha1Hex(derivedKey, `${btPayload}\n`);
	return signatures.some(
		({ signature }) =>
			timingSafeEqual(signature, expected) ||
			timingSafeEqual(signature, expectedWithNewline),
	);
}

const MAX_WEBHOOK_RECEIPTS = 10_000;

async function sha256Hex(data: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", enc.encode(data));
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function createReceiptGuard() {
	const receipts = new Map<string, "processing" | "processed">();
	return async function withReceipt(
		key: string,
		duplicateBody: Record<string, unknown>,
		work: () => Promise<Response>,
	): Promise<Response> {
		const state = receipts.get(key);
		if (state === "processed") {
			return Response.json({ ...duplicateBody, duplicate: true });
		}
		if (state === "processing") {
			return Response.json(
				{ error: "Webhook event is already being processed." },
				{ status: 409 },
			);
		}
		receipts.set(key, "processing");
		try {
			const response = await work();
			if (response.ok) {
				receipts.set(key, "processed");
				if (receipts.size > MAX_WEBHOOK_RECEIPTS) {
					const oldest = receipts.keys().next().value;
					if (oldest) receipts.delete(oldest);
				}
			} else {
				receipts.delete(key);
			}
			return response;
		} catch (error) {
			receipts.delete(key);
			throw error;
		}
	};
}

/** Extract the `kind` field from the base64-encoded XML payload. */
function extractKind(btPayload: string): string | undefined {
	try {
		const xml = atob(btPayload);
		const match = xml.match(/<kind>([^<]+)<\/kind>/);
		return match?.[1];
	} catch {
		return undefined;
	}
}

/** Extract a transaction ID from the base64-encoded XML payload. */
function extractTransactionId(btPayload: string): string | undefined {
	try {
		const xml = atob(btPayload);
		const match = xml.match(/<id>([^<]+)<\/id>/);
		return match?.[1];
	} catch {
		return undefined;
	}
}

/** Extract the amount from the base64-encoded XML payload. */
function extractAmount(btPayload: string): number | undefined {
	try {
		const xml = atob(btPayload);
		const match = xml.match(/<amount>([^<]+)<\/amount>/);
		if (!match?.[1]) return undefined;
		return Math.round(Number(match[1]) * 100);
	} catch {
		return undefined;
	}
}

// ── Braintree event kind → payment status mapping ────────────────────────────

type PaymentIntentStatus =
	| "pending"
	| "processing"
	| "succeeded"
	| "failed"
	| "cancelled"
	| "refunded";

interface EventMapping {
	status: PaymentIntentStatus;
	domainEvent: string;
}

const BRAINTREE_EVENT_MAP: Record<string, EventMapping> = {
	transaction_settled: {
		status: "succeeded",
		domainEvent: "payment.completed",
	},
	transaction_disbursed: {
		status: "succeeded",
		domainEvent: "payment.completed",
	},
	transaction_settlement_declined: {
		status: "failed",
		domainEvent: "payment.failed",
	},
};

/** Check if the kind represents a refund by inspecting XML for refund markers. */
function isRefundNotification(kind: string, btPayload: string): boolean {
	if (kind !== "transaction_settled") return false;
	try {
		const xml = atob(btPayload);
		return (
			xml.includes("<type>credit</type>") ||
			xml.includes("<refunded-transaction-id>")
		);
	} catch {
		return false;
	}
}

interface WebhookEventResult {
	id: string;
	amount: number;
	currency: string;
	orderId?: string;
}

interface WebhookRefundResult {
	intent: { id: string };
	refund: { id: string; amount: number };
}

// ── Endpoint factory ──────────────────────────────────────────────────────────

/**
 * Create the Braintree webhook endpoint with HMAC-SHA1 signature verification.
 * Braintree always sends `bt_signature` and `bt_payload` — verification is
 * always enforced (no dev-mode passthrough since credentials are required).
 */
export function createBraintreeWebhook(opts: BraintreeWebhookOptions) {
	const withReceipt = createReceiptGuard();

	return createStoreEndpoint(
		"/braintree/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const publicKey = opts.publicKey.trim();
			const privateKey = opts.privateKey.trim();
			if (!publicKey || !privateKey) {
				return Response.json(
					{ error: "Braintree webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const request = ctx.request;
			const rawBody = await request.text();

			// Braintree sends application/x-www-form-urlencoded
			const params = new URLSearchParams(rawBody);
			const btSignature = params.get("bt_signature");
			const btPayload = params.get("bt_payload");

			if (!btSignature || !btPayload) {
				return Response.json(
					{ error: "Missing bt_signature or bt_payload." },
					{ status: 400 },
				);
			}

			const valid = await verifyBraintreeSignature(
				btSignature,
				btPayload,
				publicKey,
				privateKey,
			);
			if (!valid) {
				return Response.json(
					{ error: "Invalid webhook signature." },
					{ status: 401 },
				);
			}
			const kind = extractKind(btPayload);
			if (!kind) {
				return Response.json(
					{ error: "Missing or unparseable event kind." },
					{ status: 400 },
				);
			}
			const receiptKey = await sha256Hex(btPayload);

			return withReceipt(receiptKey, { received: true, kind }, async () => {
				// ── Process payment events ──────────────────────────────────────
				const transactionId = extractTransactionId(btPayload);
				const paymentsCtrl = ctx.context?.controllers?.payments;
				const events = ctx.context?.events;

				if (transactionId && paymentsCtrl) {
					// Check if this is a refund notification
					if (isRefundNotification(kind, btPayload)) {
						const amount = extractAmount(btPayload);
						if (!Number.isSafeInteger(amount) || (amount ?? 0) <= 0) {
							return Response.json(
								{ error: "Missing or invalid Braintree refund amount." },
								{ status: 400 },
							);
						}
						const result = (await paymentsCtrl.handleWebhookRefund({
							providerIntentId: transactionId,
							providerRefundId: `bt_re_${transactionId}`,
							amount: amount as number,
						})) as WebhookRefundResult | null;
						if (result && events) {
							await events.emit("payment.refunded", {
								paymentIntentId: result.intent.id,
								refundId: result.refund.id,
								amount: result.refund.amount,
							});
						}
						return Response.json({
							received: true,
							kind,
							handled: true,
						});
					}

					const mapping = BRAINTREE_EVENT_MAP[kind];
					if (mapping) {
						const updated = (await paymentsCtrl.handleWebhookEvent({
							providerIntentId: transactionId,
							status: mapping.status,
							providerMetadata: {
								braintreeKind: kind,
							},
						})) as WebhookEventResult | null;
						if (updated && mapping.domainEvent && events) {
							await events.emit(mapping.domainEvent, {
								paymentIntentId: updated.id,
								amount: updated.amount,
								currency: updated.currency,
								orderId: updated.orderId,
							});
						}
						return Response.json({
							received: true,
							kind,
							handled: true,
						});
					}
				}

				return Response.json({ received: true, kind });
			});
		},
	);
}

/**
 * Registered containment endpoint. It authenticates Braintree's form payload
 * but does not apply a provider outcome without durable receipt persistence.
 */
export function createContainedBraintreeWebhook(opts: BraintreeWebhookOptions) {
	return createStoreEndpoint(
		"/braintree/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const publicKey = opts.publicKey.trim();
			const privateKey = opts.privateKey.trim();
			if (!publicKey || !privateKey) {
				return Response.json(
					{ error: "Braintree webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const params = new URLSearchParams(await ctx.request.text());
			const signature = params.get("bt_signature");
			const payload = params.get("bt_payload");
			if (
				!signature ||
				!payload ||
				!(await verifyBraintreeSignature(
					signature,
					payload,
					publicKey,
					privateKey,
				))
			) {
				return Response.json(
					{ error: "Invalid or missing webhook signature." },
					{ status: 401 },
				);
			}

			return Response.json(
				{
					code: "PAYMENT_WEBHOOK_DURABILITY_REQUIRED",
					error:
						"Braintree webhook processing requires a durable provider receipt.",
				},
				{ status: 503, headers: { "Retry-After": "60" } },
			);
		},
	);
}
