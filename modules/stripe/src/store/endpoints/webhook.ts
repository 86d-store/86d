import { createStoreEndpoint } from "@86d-app/core/api";

/** Minimal typed shape of a Stripe webhook event. */
interface StripeEventData {
	object?: {
		id?: string;
		payment_intent?: string;
		amount_refunded?: number;
		refunds?: { data?: Array<{ id?: string; amount?: number }> };
	};
}

interface StripeWebhookOptions {
	/** Stripe webhook signing secret (whsec_...). Required for webhook readiness. */
	webhookSecret?: string | undefined;
}

// ── Stripe signature verification ─────────────────────────────────────────────
// Inline implementation using Web Crypto API (no external dependencies).
// The same algorithm is available in packages/utils/src/crypto.ts for non-module use.

const enc = new TextEncoder();

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function sha256Hex(data: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", enc.encode(data));
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

/** Default tolerance: 5 minutes */
const TOLERANCE_MS = 300_000;

async function verifyStripeSignature(
	rawBody: string,
	signatureHeader: string,
	secret: string,
): Promise<boolean> {
	let timestamp: string | undefined;
	const signatures: string[] = [];
	for (const item of signatureHeader.split(",")) {
		const separator = item.indexOf("=");
		if (separator < 1) continue;
		const key = item.slice(0, separator).trim();
		const value = item.slice(separator + 1).trim();
		if (key === "t" && !timestamp) timestamp = value;
		if (key === "v1" && value) signatures.push(value);
	}
	if (!timestamp || signatures.length === 0) return false;

	const timestampMs = Number(timestamp) * 1000;
	if (
		!Number.isFinite(timestampMs) ||
		Math.abs(Date.now() - timestampMs) > TOLERANCE_MS
	) {
		return false;
	}

	const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
	return signatures.some((signature) => timingSafeEqual(signature, expected));
}

const MAX_WEBHOOK_RECEIPTS = 10_000;

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

// ── Stripe event → payment status mapping ────────────────────────────────────

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

const STRIPE_EVENT_MAP: Record<string, EventMapping> = {
	"payment_intent.succeeded": {
		status: "succeeded",
		domainEvent: "payment.completed",
	},
	"payment_intent.payment_failed": {
		status: "failed",
		domainEvent: "payment.failed",
	},
	"payment_intent.canceled": {
		status: "cancelled",
		domainEvent: "",
	},
	"charge.succeeded": {
		status: "succeeded",
		domainEvent: "payment.completed",
	},
	"charge.failed": {
		status: "failed",
		domainEvent: "payment.failed",
	},
};

const STRIPE_REFUND_EVENTS = new Set(["charge.refunded"]);

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

/** Extract the Stripe payment intent ID from the event data object. */
function extractProviderIntentId(
	event: Record<string, unknown>,
): string | undefined {
	const data = event.data as StripeEventData | undefined;
	const obj = data?.object;
	if (!obj) return undefined;

	// For payment_intent events, the object IS the payment intent
	if (typeof obj.id === "string" && obj.id.startsWith("pi_")) return obj.id;

	// For charge events, the payment_intent field references the PI
	if (typeof obj.payment_intent === "string") return obj.payment_intent;

	return undefined;
}

/** Extract refund details from a charge.refunded event. */
function extractRefundDetails(event: Record<string, unknown>):
	| {
			providerRefundId: string;
			amount: number;
	  }
	| undefined {
	const data = event.data as StripeEventData | undefined;
	const obj = data?.object;
	if (!obj?.refunds?.data) return undefined;

	const latestRefund = obj.refunds.data[0];
	if (!latestRefund || typeof latestRefund.id !== "string") return undefined;
	const amount = latestRefund.amount;
	if (!Number.isSafeInteger(amount) || (amount ?? 0) <= 0) return undefined;

	return {
		providerRefundId: latestRefund.id,
		amount: amount as number,
	};
}

// ── Endpoint factory ──────────────────────────────────────────────────────────

/**
 * Create the Stripe webhook endpoint.
 * A signing secret is mandatory. The endpoint is unavailable until configured.
 */
export function createStripeWebhook(opts: StripeWebhookOptions) {
	const withReceipt = createReceiptGuard();

	return createStoreEndpoint(
		"/stripe/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const webhookSecret = opts.webhookSecret?.trim();
			if (!webhookSecret) {
				return Response.json(
					{ error: "Stripe webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const request = ctx.request;

			// Read raw body before any JSON.parse to preserve bytes for HMAC
			const rawBody = await request.text();

			const sigHeader = request.headers.get("stripe-signature") ?? "";
			const valid = await verifyStripeSignature(
				rawBody,
				sigHeader,
				webhookSecret,
			);
			if (!valid) {
				return Response.json(
					{ error: "Invalid or expired webhook signature." },
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
			const eventId = typeof event.id === "string" ? event.id : undefined;
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
						if (STRIPE_REFUND_EVENTS.has(eventType)) {
							const refundDetails = extractRefundDetails(event);
							if (!refundDetails) {
								return Response.json(
									{ error: "Missing stable Stripe refund ID." },
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

						const mapping = STRIPE_EVENT_MAP[eventType];
						if (mapping) {
							const updated = (await payments.handleWebhookEvent({
								providerIntentId,
								status: mapping.status,
								providerMetadata: {
									stripeEventId: event.id,
									stripeEventType: eventType,
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
 * Registered containment endpoint. Verification remains strict, but a signed
 * event is deliberately not acknowledged until Payments can persist a receipt
 * and apply the provider outcome through its durable owner workflow.
 */
export function createContainedStripeWebhook(opts: StripeWebhookOptions) {
	return createStoreEndpoint(
		"/stripe/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const webhookSecret = opts.webhookSecret?.trim();
			if (!webhookSecret) {
				return Response.json(
					{ error: "Stripe webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const rawBody = await ctx.request.text();
			const signature = ctx.request.headers.get("stripe-signature") ?? "";
			if (!(await verifyStripeSignature(rawBody, signature, webhookSecret))) {
				return Response.json(
					{ error: "Invalid or expired webhook signature." },
					{ status: 401 },
				);
			}

			return Response.json(
				{
					code: "PAYMENT_WEBHOOK_DURABILITY_REQUIRED",
					error:
						"Stripe webhook processing requires a durable provider receipt.",
				},
				{ status: 503, headers: { "Retry-After": "60" } },
			);
		},
	);
}
