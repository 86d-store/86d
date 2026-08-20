import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SquarePaymentProvider } from "../provider";
import { createSquareWebhook } from "../store/endpoints/webhook";

/**
 * Security regression tests for the Square module.
 *
 * Square processes payments and receives webhook events carrying
 * financial data. These tests verify:
 * - Webhook signature verification (HMAC-SHA256)
 * - Event type filtering (only known types processed)
 * - Payment amount integrity through webhook payloads
 * - Idempotency key uniqueness on provider requests
 * - Provider API authorization header inclusion
 * - Invalid / malicious payload rejection
 * - Refund event extraction safety
 * - Location / notification URL scoping
 */

// ── Helpers ─────────────────────────────────────────────────────────

const enc = new TextEncoder();
const SIG_KEY = "sq-sec-test-key-1234";
const NOTIFICATION_URL = "https://store.example.com/api/square/webhook";

async function buildSignature(
	sigKey: string,
	notificationUrl: string,
	body: string,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(sigKey),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const payload = notificationUrl + body;
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function makeRequest(
	body: string,
	headers: Record<string, string> = {},
): Request {
	return new Request(NOTIFICATION_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body,
	});
}

async function callWebhook(
	handler: ReturnType<typeof createSquareWebhook>,
	request: Request,
	context?: Record<string, unknown>,
	autoSign = true,
): Promise<Response> {
	let nextRequest = request;
	if (autoSign && !request.headers.has("x-square-hmacsha256-signature")) {
		const body = await request.clone().text();
		const headers = new Headers(request.headers);
		headers.set(
			"x-square-hmacsha256-signature",
			await buildSignature(SIG_KEY, NOTIFICATION_URL, body),
		);
		nextRequest = new Request(request, { headers });
	}
	const h = handler as unknown as Record<string, unknown>;
	const fn = typeof h.handler === "function" ? h.handler : h;
	return (fn as CallableFunction)({
		request: nextRequest,
		context,
	}) as Promise<Response>;
}

function mockFetchResponse(data: unknown, ok = true, status = 200) {
	return vi.fn().mockResolvedValue({
		ok,
		status,
		json: () => Promise.resolve(data),
	});
}

// ── Webhook Signature Verification ──────────────────────────────────

describe("square endpoint security", () => {
	describe("webhook signature verification", () => {
		const handler = createSquareWebhook({
			webhookSignatureKey: SIG_KEY,
			notificationUrl: NOTIFICATION_URL,
		});

		it("rejects request with empty signature header", async () => {
			const body = JSON.stringify({
				type: "payment.completed",
				data: {},
			});
			const req = makeRequest(body, {
				"x-square-hmacsha256-signature": "",
			});
			const res = await callWebhook(handler, req);
			expect(res.status).toBe(401);
		});

		it("rejects request with completely invalid base64 signature", async () => {
			const body = JSON.stringify({
				type: "payment.completed",
				data: {},
			});
			const req = makeRequest(body, {
				"x-square-hmacsha256-signature": "not-valid-base64!!!",
			});
			const res = await callWebhook(handler, req);
			expect(res.status).toBe(401);
		});

		it("rejects signature computed with different key", async () => {
			const body = JSON.stringify({
				type: "payment.completed",
				data: {},
			});
			const wrongSig = await buildSignature(
				"attacker-key",
				NOTIFICATION_URL,
				body,
			);
			const req = makeRequest(body, {
				"x-square-hmacsha256-signature": wrongSig,
			});
			const res = await callWebhook(handler, req);
			expect(res.status).toBe(401);
		});

		it("rejects signature computed for different notification URL", async () => {
			const body = JSON.stringify({
				type: "payment.completed",
				data: {},
			});
			const sig = await buildSignature(
				SIG_KEY,
				"https://evil.com/api/square/webhook",
				body,
			);
			const req = makeRequest(body, {
				"x-square-hmacsha256-signature": sig,
			});
			const res = await callWebhook(handler, req);
			expect(res.status).toBe(401);
		});

		it("rejects tampered body even with valid original signature", async () => {
			const originalBody = JSON.stringify({
				type: "payment.completed",
				data: {
					object: {
						payment: {
							id: "SQ_PAY_1",
							amount_money: { amount: 100 },
						},
					},
				},
			});
			const sig = await buildSignature(SIG_KEY, NOTIFICATION_URL, originalBody);
			// Attacker modifies the amount
			const tamperedBody = JSON.stringify({
				type: "payment.completed",
				data: {
					object: {
						payment: {
							id: "SQ_PAY_1",
							amount_money: { amount: 999999 },
						},
					},
				},
			});
			const req = makeRequest(tamperedBody, {
				"x-square-hmacsha256-signature": sig,
			});
			const res = await callWebhook(handler, req);
			expect(res.status).toBe(401);
		});

		it("accepts valid signature computed with correct key and URL", async () => {
			const body = JSON.stringify({
				type: "payment.completed",
				data: {},
			});
			const sig = await buildSignature(SIG_KEY, NOTIFICATION_URL, body);
			const req = makeRequest(body, {
				"x-square-hmacsha256-signature": sig,
			});
			const res = await callWebhook(handler, req);
			expect(res.status).toBe(200);
		});
	});

	// ── Webhook Event Type Filtering ────────────────────────────────

	describe("webhook event type filtering", () => {
		const handler = createSquareWebhook({
			webhookSignatureKey: SIG_KEY,
			notificationUrl: NOTIFICATION_URL,
		});

		it("rejects payload with missing event type", async () => {
			const body = JSON.stringify({ data: { object: {} } });
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(400);
			const json = (await res.json()) as { error: string };
			expect(json.error).toContain("Missing event type");
		});

		it("rejects malformed JSON body", async () => {
			const res = await callWebhook(handler, makeRequest("{not: json!!!"));
			expect(res.status).toBe(400);
		});

		it("returns received:true for unrecognized event types without handling", async () => {
			const body = JSON.stringify({
				type: "catalog.version.updated",
				data: { object: {} },
			});
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(200);
			const json = (await res.json()) as {
				received: boolean;
				handled?: boolean;
			};
			expect(json.received).toBe(true);
			expect(json.handled).toBeUndefined();
		});

		it("does not process inventory.count.updated as a payment event", async () => {
			const body = JSON.stringify({
				type: "inventory.count.updated",
				data: { object: {} },
			});
			const res = await callWebhook(handler, makeRequest(body));
			const json = (await res.json()) as {
				received: boolean;
				handled?: boolean;
			};
			expect(json.received).toBe(true);
			expect(json.handled).toBeUndefined();
		});

		it("does not process order.created as a payment event", async () => {
			const body = JSON.stringify({
				type: "order.created",
				data: { object: {} },
			});
			const res = await callWebhook(handler, makeRequest(body));
			const json = (await res.json()) as {
				received: boolean;
				handled?: boolean;
			};
			expect(json.received).toBe(true);
			expect(json.handled).toBeUndefined();
		});
	});

	// ── Webhook Payload Extraction Safety ───────────────────────────

	describe("webhook payload extraction safety", () => {
		const handler = createSquareWebhook({
			webhookSignatureKey: SIG_KEY,
			notificationUrl: NOTIFICATION_URL,
		});

		it("handles missing data.object gracefully without crashing", async () => {
			const body = JSON.stringify({
				type: "payment.completed",
				data: {},
			});
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(200);
			const json = (await res.json()) as {
				received: boolean;
				handled?: boolean;
			};
			// No providerIntentId extracted, so not handled
			expect(json.received).toBe(true);
		});

		it("handles null data field without crashing", async () => {
			const body = JSON.stringify({
				type: "payment.completed",
				data: null,
			});
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(200);
		});

		it("handles missing payment.id in payment event gracefully", async () => {
			const body = JSON.stringify({
				type: "payment.completed",
				data: { object: { payment: {} } },
			});
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(200);
			const json = (await res.json()) as {
				received: boolean;
				handled?: boolean;
			};
			// No string id -> no providerIntentId extracted
			expect(json.received).toBe(true);
		});

		it("handles non-string payment.id without processing", async () => {
			const body = JSON.stringify({
				type: "payment.completed",
				data: {
					object: { payment: { id: 12345 } },
				},
			});
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(200);
			const json = (await res.json()) as {
				received: boolean;
				handled?: boolean;
			};
			expect(json.received).toBe(true);
			expect(json.handled).toBeUndefined();
		});

		it("refund event without refund.payment_id does not extract providerIntentId", async () => {
			const body = JSON.stringify({
				type: "refund.completed",
				data: {
					object: { refund: { id: "RF_1" } },
				},
			});
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(200);
			const json = (await res.json()) as {
				received: boolean;
				handled?: boolean;
			};
			// payment_id missing -> providerIntentId undefined
			expect(json.received).toBe(true);
		});
	});

	// ── Missing verification configuration ─────────────────────────

	describe("webhook without signature key configured", () => {
		const handler = createSquareWebhook({});

		it("fails closed without any signature configuration", async () => {
			const body = JSON.stringify({
				type: "payment.created",
				data: {},
			});
			const res = await callWebhook(handler, makeRequest(body));
			expect(res.status).toBe(503);
		});

		it("requires both the key and notification URL", async () => {
			const handler2 = createSquareWebhook({
				notificationUrl: "",
			});
			const body = JSON.stringify({
				type: "payment.created",
				data: {},
			});
			const res = await callWebhook(handler2, makeRequest(body));
			expect(res.status).toBe(503);
		});
	});

	// ── Provider Authorization & Idempotency ────────────────────────

	describe("provider authorization and idempotency", () => {
		const originalFetch = globalThis.fetch;
		let provider: SquarePaymentProvider;

		beforeEach(() => {
			provider = new SquarePaymentProvider("sq_secret_token");
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		const validMeta = { paymentMethodNonce: "cnon:card-nonce-ok" };

		it("includes Bearer token in every outbound request", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "p1",
					status: "APPROVED",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});
			await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const headers = call?.[1]?.headers as Record<string, string>;
			expect(headers?.Authorization).toBe("Bearer sq_secret_token");
		});

		it("derives deterministic idempotency_key from nonce for retry safety", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "p1",
					status: "APPROVED",
					amount_money: { amount: 500, currency: "USD" },
				},
			});

			await provider.createIntent({
				amount: 500,
				currency: "USD",
				metadata: validMeta,
			});
			const body1 = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);

			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "p2",
					status: "APPROVED",
					amount_money: { amount: 500, currency: "USD" },
				},
			});
			await provider.createIntent({
				amount: 500,
				currency: "USD",
				metadata: validMeta,
			});
			const body2 = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);

			// Same nonce → same key (retry-safe idempotency)
			expect(body1.idempotency_key).toBe(body2.idempotency_key);
			expect(body1.idempotency_key).toBe("create-cnon:card-nonce-ok");
		});

		it("produces different idempotency_key for different refund operations", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "r1",
					status: "PENDING",
					amount_money: { amount: 500, currency: "USD" },
				},
			});

			await provider.createRefund({
				providerIntentId: "p1",
			});
			const body1 = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);

			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "r2",
					status: "PENDING",
					amount_money: { amount: 500, currency: "USD" },
				},
			});
			await provider.createRefund({
				providerIntentId: "p2",
			});
			const body2 = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);

			// Different payment IDs → different keys
			expect(body1.idempotency_key).not.toBe(body2.idempotency_key);
			expect(body1.idempotency_key).toBe("refund-p1-full");
			expect(body2.idempotency_key).toBe("refund-p2-full");
		});

		it("sets autocomplete to false on createIntent to prevent auto-capture", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "p_ac",
					status: "APPROVED",
					amount_money: { amount: 2000, currency: "USD" },
				},
			});

			await provider.createIntent({
				amount: 2000,
				currency: "USD",
				metadata: validMeta,
			});
			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.autocomplete).toBe(false);
		});

		it("preserves exact amount in createIntent body without rounding", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "p_amt",
					status: "APPROVED",
					amount_money: { amount: 1234, currency: "USD" },
				},
			});

			await provider.createIntent({
				amount: 1234,
				currency: "USD",
				metadata: validMeta,
			});
			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.amount_money.amount).toBe(1234);
		});

		it("throws descriptive error on Square API failure", async () => {
			globalThis.fetch = mockFetchResponse(
				{
					errors: [
						{
							detail: "Insufficient funds",
							category: "PAYMENT_METHOD_ERROR",
							code: "INSUFFICIENT_FUNDS",
						},
					],
				},
				false,
				402,
			);

			await expect(
				provider.createIntent({
					amount: 99999,
					currency: "USD",
					metadata: validMeta,
				}),
			).rejects.toThrow("Square error: Insufficient funds");
		});

		it("falls back to HTTP status when error detail is missing", async () => {
			globalThis.fetch = mockFetchResponse({ errors: [] }, false, 500);

			await expect(
				provider.createIntent({
					amount: 1000,
					currency: "USD",
					metadata: validMeta,
				}),
			).rejects.toThrow("Square error: HTTP 500");
		});
	});
});
