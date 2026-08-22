import { createStoreEndpoint } from "@86d-app/core/api";
import { getProcessEnv } from "env/process-env";

/** Minimal typed shape of a PayPal webhook event resource. */
interface PayPalResource {
	id?: string;
	supplementary_data?: {
		related_ids?: { order_id?: string };
	};
	amount?: { value?: string };
}

interface PayPalWebhookOptions {
	clientId: string;
	clientSecret: string;
	/** PayPal webhook ID (from dashboard). Required for webhook readiness. */
	webhookId?: string | undefined;
	/** Use sandbox environment. Pass "true" to enable. */
	sandbox?: string | undefined;
	/** Immutable Payment Connection bound to this webhook ingress. */
	connectionId?: string | undefined;
	/** Store identity for durable webhook receipts. */
	storeId?: string | undefined;
	/** Opaque verification key locator persisted with each receipt. */
	verificationKeyReference?: string | undefined;
}

// ── PayPal signature verification ─────────────────────────────────────────────
// PayPal uses asymmetric RSA signatures that require calling their verification
// API. We POST the event headers + body to PayPal, and they confirm authenticity.
// https://developer.paypal.com/api/rest/webhooks/rest/

async function getAccessToken(
	clientId: string,
	clientSecret: string,
	baseUrl: string,
): Promise<string | null> {
	const credentials = btoa(`${clientId}:${clientSecret}`);
	const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${credentials}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	});
	if (!res.ok) return null;
	const data = (await res.json()) as { access_token: string };
	return data.access_token;
}

async function verifyPayPalSignature(options: {
	rawBody: string;
	requestHeaders: { get(name: string): string | null };
	webhookId: string;
	clientId: string;
	clientSecret: string;
	baseUrl: string;
}): Promise<boolean> {
	const {
		rawBody,
		requestHeaders,
		webhookId,
		clientId,
		clientSecret,
		baseUrl,
	} = options;
	const authAlgo = requestHeaders.get("paypal-auth-algo");
	const certUrl = requestHeaders.get("paypal-cert-url");
	const transmissionId = requestHeaders.get("paypal-transmission-id");
	const transmissionSig = requestHeaders.get("paypal-transmission-sig");
	const transmissionTime = requestHeaders.get("paypal-transmission-time");

	if (
		!authAlgo ||
		!certUrl ||
		!transmissionId ||
		!transmissionSig ||
		!transmissionTime
	) {
		return false;
	}

	try {
		JSON.parse(rawBody);
	} catch {
		return false;
	}

	try {
		const token = await getAccessToken(clientId, clientSecret, baseUrl);
		if (!token) return false;
		const res = await fetch(
			`${baseUrl}/v1/notifications/verify-webhook-signature`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: `{"auth_algo":${JSON.stringify(authAlgo)},"cert_url":${JSON.stringify(certUrl)},"transmission_id":${JSON.stringify(transmissionId)},"transmission_sig":${JSON.stringify(transmissionSig)},"transmission_time":${JSON.stringify(transmissionTime)},"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${rawBody}}`,
			},
		);
		if (!res.ok) return false;
		const data = (await res.json()) as { verification_status: string };
		return data.verification_status === "SUCCESS";
	} catch {
		return false;
	}
}

const enc = new TextEncoder();
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

// ── PayPal event → payment status mapping ────────────────────────────────────

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

const PAYPAL_EVENT_MAP: Record<string, EventMapping> = {
	"PAYMENT.CAPTURE.COMPLETED": {
		status: "succeeded",
		domainEvent: "payment.completed",
	},
	"PAYMENT.CAPTURE.DENIED": {
		status: "failed",
		domainEvent: "payment.failed",
	},
	"PAYMENT.CAPTURE.PENDING": {
		status: "processing",
		domainEvent: "",
	},
	"CHECKOUT.ORDER.APPROVED": {
		status: "processing",
		domainEvent: "",
	},
};

const PAYPAL_REFUND_EVENTS = new Set([
	"PAYMENT.CAPTURE.REFUNDED",
	"PAYMENT.SALE.REFUNDED",
]);

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

/** Extract the provider intent ID from a PayPal webhook event. */
function extractProviderIntentId(
	event: Record<string, unknown>,
): string | undefined {
	const resource = event.resource as PayPalResource | undefined;
	if (!resource) return undefined;

	// PAYMENT.CAPTURE events: resource.id is the capture ID, supplementary_data has the order/intent
	if (typeof resource.supplementary_data?.related_ids?.order_id === "string") {
		return resource.supplementary_data.related_ids.order_id;
	}

	// Direct resource ID (order or capture)
	if (typeof resource.id === "string") return resource.id;

	return undefined;
}

/** Extract refund details from a refund event. */
function extractRefundDetails(event: Record<string, unknown>):
	| {
			providerRefundId: string;
			amount: number;
	  }
	| undefined {
	const resource = event.resource as PayPalResource | undefined;
	if (!resource || typeof resource.id !== "string") return undefined;
	if (typeof resource.amount?.value !== "string") return undefined;
	const amount = Math.round(Number(resource.amount.value) * 100);
	if (!Number.isSafeInteger(amount) || amount <= 0) return undefined;

	return {
		providerRefundId: resource.id,
		amount,
	};
}

function extractPaymentId(event: Record<string, unknown>): string | undefined {
	const resource = event.resource as { custom_id?: string } | undefined;
	if (
		typeof resource?.custom_id === "string" &&
		resource.custom_id.length > 0
	) {
		return resource.custom_id;
	}
	return undefined;
}

function extractCaptureAmount(
	event: Record<string, unknown>,
): { amount: number; currency: string } | undefined {
	const resource = event.resource as PayPalResource | undefined;
	if (typeof resource?.amount?.value !== "string") return undefined;
	const amount = Math.round(Number(resource.amount.value) * 100);
	const currency = (resource.amount as { currency_code?: string })
		.currency_code;
	if (
		!Number.isSafeInteger(amount) ||
		amount <= 0 ||
		typeof currency !== "string"
	) {
		return undefined;
	}
	return { amount, currency };
}

// ── Endpoint factory ──────────────────────────────────────────────────────────

/**
 * Durable PayPal webhook endpoint using Payment v2 webhook receipts.
 */
export function createDurablePayPalWebhook(opts: PayPalWebhookOptions) {
	const baseUrl =
		opts.sandbox === "true"
			? "https://api-m.sandbox.paypal.com"
			: "https://api-m.paypal.com";
	const withReceipt = createReceiptGuard();

	return createStoreEndpoint(
		"/paypal/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const clientId = opts.clientId.trim();
			const clientSecret = opts.clientSecret.trim();
			const webhookId = opts.webhookId?.trim();
			const connectionId = opts.connectionId?.trim();
			const storeId =
				opts.storeId?.trim() ?? getProcessEnv("86D_STORE_ID")?.trim();
			if (!clientId || !clientSecret || !webhookId) {
				return Response.json(
					{ error: "PayPal webhook verification is not configured." },
					{ status: 503 },
				);
			}
			if (!connectionId || !storeId) {
				return Response.json(
					{
						code: "PAYMENT_WEBHOOK_DURABILITY_REQUIRED",
						error:
							"PayPal webhook processing requires a durable Connection binding.",
					},
					{ status: 503, headers: { "Retry-After": "60" } },
				);
			}

			const rawBody = await ctx.request.text();
			const valid = await verifyPayPalSignature({
				rawBody,
				requestHeaders: ctx.request.headers,
				webhookId,
				clientId,
				clientSecret,
				baseUrl,
			});
			if (!valid) {
				return Response.json(
					{ error: "Invalid or unverifiable webhook signature." },
					{ status: 401 },
				);
			}

			let event: Record<string, unknown>;
			try {
				event = JSON.parse(rawBody) as Record<string, unknown>;
			} catch {
				return Response.json({ error: "Invalid JSON body." }, { status: 400 });
			}

			const eventType = event.event_type as string | undefined;
			if (!eventType) {
				return Response.json({ error: "Missing event type." }, { status: 400 });
			}
			const providerEventId =
				typeof event.id === "string" ? event.id : await sha256Hex(rawBody);
			const receiptKey = providerEventId;

			return withReceipt(
				receiptKey,
				{ received: true, type: eventType },
				async () => {
					const webhookReceipts = ctx.context?.controllers
						?.paymentWebhookReceipts as
						| {
								recordVerified(
									input: unknown,
								): Promise<{ receipt: { id: string } }>;
								process(id: string): Promise<{ acknowledge: boolean }>;
						  }
						| undefined;
					if (!webhookReceipts) {
						return Response.json(
							{
								code: "PAYMENT_WEBHOOK_DURABILITY_REQUIRED",
								error:
									"PayPal webhook processing requires a durable provider receipt.",
							},
							{ status: 503, headers: { "Retry-After": "60" } },
						);
					}

					const paymentId = extractPaymentId(event);
					const providerReference = extractProviderIntentId(event);
					const payloadDigest = await sha256Hex(rawBody);
					const verificationKeyReference =
						opts.verificationKeyReference?.trim() ??
						`secret/paypal/${webhookId}`;

					if (
						PAYPAL_REFUND_EVENTS.has(eventType) &&
						paymentId &&
						providerReference
					) {
						const refundDetails = extractRefundDetails(event);
						if (!refundDetails) {
							return Response.json(
								{ error: "Missing stable PayPal refund ID." },
								{ status: 400 },
							);
						}
						const recorded = await webhookReceipts.recordVerified({
							storeId,
							connectionId,
							provider: "paypal",
							providerEventId,
							providerEventType: eventType,
							payloadDigest,
							verificationKeyReference,
							fact: {
								kind: "confirmed_operation",
								paymentId,
								operationId: `paypal-refund:${providerEventId}`,
								operation: "refund",
								sourceOperationId: providerReference,
								amount: refundDetails.amount,
								currency: "USD",
								requestDigest: payloadDigest,
								providerReference: refundDetails.providerRefundId,
								occurredAt: new Date(),
							},
						});
						await webhookReceipts.process(recorded.receipt.id);
						return Response.json({
							received: true,
							type: eventType,
							handled: true,
						});
					}

					if (
						eventType === "PAYMENT.CAPTURE.COMPLETED" &&
						paymentId &&
						providerReference
					) {
						const capture = extractCaptureAmount(event);
						if (!capture) {
							return Response.json(
								{ error: "Missing stable PayPal capture amount." },
								{ status: 400 },
							);
						}
						const recorded = await webhookReceipts.recordVerified({
							storeId,
							connectionId,
							provider: "paypal",
							providerEventId,
							providerEventType: eventType,
							payloadDigest,
							verificationKeyReference,
							fact: {
								kind: "confirmed_operation",
								paymentId,
								operationId: `paypal-capture:${providerEventId}`,
								operation: "capture",
								sourceOperationId: providerReference,
								amount: capture.amount,
								currency: capture.currency,
								requestDigest: payloadDigest,
								providerReference,
								occurredAt: new Date(),
							},
						});
						await webhookReceipts.process(recorded.receipt.id);
						return Response.json({
							received: true,
							type: eventType,
							handled: true,
						});
					}

					if (
						eventType === "CHECKOUT.ORDER.APPROVED" &&
						paymentId &&
						providerReference
					) {
						const recorded = await webhookReceipts.recordVerified({
							storeId,
							connectionId,
							provider: "paypal",
							providerEventId,
							providerEventType: eventType,
							payloadDigest,
							verificationKeyReference,
							fact: {
								kind: "confirmed_operation",
								paymentId,
								operationId: `paypal-authorization:${providerEventId}`,
								operation: "authorization",
								amount: 1,
								currency: "USD",
								requestDigest: payloadDigest,
								providerReference,
								occurredAt: new Date(),
							},
						});
						await webhookReceipts.process(recorded.receipt.id);
						return Response.json({
							received: true,
							type: eventType,
							handled: true,
						});
					}

					return Response.json({ received: true, type: eventType });
				},
			);
		},
	);
}

/**
 * Create the PayPal webhook endpoint.
 * The PayPal credentials and webhook ID are mandatory. The endpoint is
 * unavailable until all verification configuration is present.
 */
export function createPayPalWebhook(opts: PayPalWebhookOptions) {
	const baseUrl =
		opts.sandbox === "true"
			? "https://api-m.sandbox.paypal.com"
			: "https://api-m.paypal.com";
	const withReceipt = createReceiptGuard();

	return createStoreEndpoint(
		"/paypal/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			if (
				!opts.clientId.trim() ||
				!opts.clientSecret.trim() ||
				!opts.webhookId?.trim()
			) {
				return Response.json(
					{ error: "PayPal webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const request = ctx.request;
			const rawBody = await request.text();

			const valid = await verifyPayPalSignature({
				rawBody,
				requestHeaders: request.headers,
				webhookId: opts.webhookId,
				clientId: opts.clientId,
				clientSecret: opts.clientSecret,
				baseUrl,
			});
			if (!valid) {
				return Response.json(
					{ error: "Invalid or unverifiable webhook signature." },
					{ status: 401 },
				);
			}
			let event: Record<string, unknown>;
			try {
				event = JSON.parse(rawBody) as Record<string, unknown>;
			} catch {
				return Response.json({ error: "Invalid JSON body." }, { status: 400 });
			}

			const eventType = event.event_type as string | undefined;
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
						if (PAYPAL_REFUND_EVENTS.has(eventType)) {
							const refundDetails = extractRefundDetails(event);
							if (!refundDetails) {
								return Response.json(
									{ error: "Missing stable PayPal refund ID." },
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

						const mapping = PAYPAL_EVENT_MAP[eventType];
						if (mapping) {
							const updated = (await payments.handleWebhookEvent({
								providerIntentId,
								status: mapping.status,
								providerMetadata: {
									paypalEventId: event.id,
									paypalEventType: eventType,
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
 * Registered containment endpoint. PayPal still verifies every callback, but
 * verified events remain retryable until a durable Payments receipt exists.
 */
export function createContainedPayPalWebhook(opts: PayPalWebhookOptions) {
	const baseUrl =
		opts.sandbox === "true"
			? "https://api-m.sandbox.paypal.com"
			: "https://api-m.paypal.com";

	return createStoreEndpoint(
		"/paypal/webhook",
		{
			exposure: "provider_webhook",
			method: "POST",
			requireRequest: true,
		},
		async (ctx) => {
			const clientId = opts.clientId.trim();
			const clientSecret = opts.clientSecret.trim();
			const webhookId = opts.webhookId?.trim();
			if (!clientId || !clientSecret || !webhookId) {
				return Response.json(
					{ error: "PayPal webhook verification is not configured." },
					{ status: 503 },
				);
			}

			const rawBody = await ctx.request.text();
			const valid = await verifyPayPalSignature({
				rawBody,
				requestHeaders: ctx.request.headers,
				webhookId,
				clientId,
				clientSecret,
				baseUrl,
			});
			if (!valid) {
				return Response.json(
					{ error: "Invalid or unverifiable webhook signature." },
					{ status: 401 },
				);
			}

			return Response.json(
				{
					code: "PAYMENT_WEBHOOK_DURABILITY_REQUIRED",
					error:
						"PayPal webhook processing requires a durable provider receipt.",
				},
				{ status: 503, headers: { "Retry-After": "60" } },
			);
		},
	);
}
