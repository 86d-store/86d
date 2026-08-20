import { createStoreEndpoint } from "@86d-app/core/api";

/** Minimal typed shape of a Square webhook event data. */
interface SquareEventData {
	object?: {
		payment?: { id?: string };
		refund?: {
			id?: string;
			payment_id?: string;
			amount_money?: { amount?: number };
		};
	};
}

interface SquareWebhookOptions {
	/** Square webhook signature key. The `x-square-hmacsha256-signature`
	 *  header is verified against the raw body + notification URL. */
	webhookSignatureKey?: string | undefined;
	/** The full URL that Square sends webhooks to (e.g. https://your-store.com/api/square/webhook).
	 *  Required for signature verification. */
	notificationUrl?: string | undefined;
}

// ── Square signature verification ─────────────────────────────────────────────
// Square signs webhooks with HMAC-SHA256 over (notificationUrl + rawBody).
// The signature is Base64-encoded in the `x-square-hmacsha256-signature` header.
// https://developer.squareup.com/docs/webhooks/step3validate

const enc = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

async function verifySquareSignature(
	rawBody: string,
	signatureHeader: string,
	signatureKey: string,
	notificationUrl: string,
): Promise<boolean> {
	if (!signatureHeader) return false;
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(signatureKey),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const payload = notificationUrl + rawBody;
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
	const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
	return timingSafeEqual(signatureHeader, expected);
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

// ── Square event → payment status mapping ────────────────────────────────────

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

const SQUARE_EVENT_MAP: Record<string, EventMapping> = {
	"payment.completed": {
		status: "succeeded",
		domainEvent: "payment.completed",
	},
	"payment.failed": {
		status: "failed",
		domainEvent: "payment.failed",
	},
	"payment.canceled": {
		status: "cancelled",
		domainEvent: "",
	},
};

const SQUARE_REFUND_EVENTS = new Set(["refund.completed", "refund.updated"]);

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

/** Extract the provider intent ID from a Square webhook event. */
function extractProviderIntentId(
	event: Record<string, unknown>,
): string | undefined {
	const data = event.data as SquareEventData | undefined;
	const obj = data?.object;
	if (!obj) return undefined;

	// Payment events: data.object.payment.id
	if (typeof obj.payment?.id === "string") return obj.payment.id;

	// Refund events: data.object.refund.payment_id
	if (typeof obj.refund?.payment_id === "string") return obj.refund.payment_id;

	return undefined;
}

/** Extract refund details from a Square refund event. */
function extractRefundDetails(event: Record<string, unknown>):
	| {
			providerRefundId: string;
			amount: number;
	  }
	| undefined {
	const data = event.data as SquareEventData | undefined;
	const refund = data?.object?.refund;
	if (!refund || typeof refund.id !== "string") return undefined;
	const amount = refund.amount_money?.amount;
	if (!Number.isSafeInteger(amount) || (amount ?? 0) <= 0) return undefined;

	return {
		providerRefundId: refund.id,
		amount: amount as number,
	};
}

// ── Endpoint factory ──────────────────────────────────────────────────────────

/**
 * Create the Square webhook endpoint.
 * The signature key and exact notification URL are mandatory. The endpoint is
 * unavailable until both values are configured.
 */
export function createSquareWebhook(opts: SquareWebhookOptions) {
	const withReceipt = createReceiptGuard();

	return createStoreEndpoint(
		"/square/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const webhookSignatureKey = opts.webhookSignatureKey?.trim();
			const notificationUrl = opts.notificationUrl?.trim();
			if (!webhookSignatureKey || !notificationUrl) {
				return Response.json(
					{ error: "Square webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const request = ctx.request;
			const rawBody = await request.text();

			const sigHeader =
				request.headers.get("x-square-hmacsha256-signature") ?? "";
			const valid = await verifySquareSignature(
				rawBody,
				sigHeader,
				webhookSignatureKey,
				notificationUrl,
			);
			if (!valid) {
				return Response.json(
					{ error: "Invalid webhook signature." },
					{ status: 401 },
				);
			}
			let event: Record<string, unknown>;
			try {
				event = JSON.parse(rawBody) as Record<string, unknown>;
			} catch {
				return Response.json({ error: "Invalid JSON body." }, { status: 400 });
			}

			const eventType = event.type as string | undefined;
			if (!eventType) {
				return Response.json({ error: "Missing event type." }, { status: 400 });
			}
			const eventId =
				typeof event.event_id === "string" ? event.event_id : undefined;
			const receiptKey = eventId || (await sha256Hex(rawBody));

			return withReceipt(
				receiptKey,
				{ received: true, type: eventType },
				async () => {
					// ── Process payment events ──────────────────────────────────────
					const providerIntentId = extractProviderIntentId(event);
					const payments = ctx.context?.controllers?.payments;
					const events = ctx.context?.events;

					if (providerIntentId && payments) {
						if (SQUARE_REFUND_EVENTS.has(eventType)) {
							const refundDetails = extractRefundDetails(event);
							if (!refundDetails) {
								return Response.json(
									{ error: "Missing stable Square refund ID." },
									{ status: 400 },
								);
							}
							const result = (await payments.handleWebhookRefund({
								providerIntentId,
								providerRefundId: refundDetails.providerRefundId,
								amount: refundDetails.amount,
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
								type: eventType,
								handled: true,
							});
						}

						const mapping = SQUARE_EVENT_MAP[eventType];
						if (mapping) {
							const updated = (await payments.handleWebhookEvent({
								providerIntentId,
								status: mapping.status,
								providerMetadata: {
									squareEventId: event.event_id,
									squareEventType: eventType,
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
								type: eventType,
								handled: true,
							});
						}
					}

					return Response.json({ received: true, type: eventType });
				},
			);
		},
	);
}

/**
 * Registered containment endpoint. A valid signature proves provenance only;
 * Square outcomes remain retryable until Payments owns a durable receipt.
 */
export function createContainedSquareWebhook(opts: SquareWebhookOptions) {
	return createStoreEndpoint(
		"/square/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const webhookSignatureKey = opts.webhookSignatureKey?.trim();
			const notificationUrl = opts.notificationUrl?.trim();
			if (!webhookSignatureKey || !notificationUrl) {
				return Response.json(
					{ error: "Square webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const rawBody = await ctx.request.text();
			const signature =
				ctx.request.headers.get("x-square-hmacsha256-signature") ?? "";
			const valid = await verifySquareSignature(
				rawBody,
				signature,
				webhookSignatureKey,
				notificationUrl,
			);
			if (!valid) {
				return Response.json(
					{ error: "Invalid webhook signature." },
					{ status: 401 },
				);
			}

			return Response.json(
				{
					code: "PAYMENT_WEBHOOK_DURABILITY_REQUIRED",
					error:
						"Square webhook processing requires a durable provider receipt.",
				},
				{ status: 503, headers: { "Retry-After": "60" } },
			);
		},
	);
}
