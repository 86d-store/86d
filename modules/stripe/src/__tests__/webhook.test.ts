import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createPaymentController } from "../../../payments/src/service-impl";
import { createStripeWebhook } from "../store/endpoints/webhook";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function buildStripeSignature(
	secret: string,
	body: string,
	offsetSeconds = 0,
): Promise<string> {
	const ts = Math.floor(Date.now() / 1000) + offsetSeconds;
	const v1 = await hmacSha256Hex(secret, `${ts}.${body}`);
	return `t=${ts},v1=${v1}`;
}

function makeRequest(
	body: string,
	headers: Record<string, string> = {},
): Request {
	return new Request("https://example.com/api/stripe/webhook", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body,
	});
}

/** Invoke the webhook endpoint handler with a mock ctx. */
async function callWebhook(
	handler: ReturnType<typeof createStripeWebhook>,
	request: Request,
	context?: Record<string, unknown>,
	autoSign = true,
): Promise<Response> {
	let nextRequest = request;
	if (autoSign && !request.headers.has("stripe-signature")) {
		const body = await request.clone().text();
		const headers = new Headers(request.headers);
		headers.set("stripe-signature", await buildStripeSignature(SECRET, body));
		nextRequest = new Request(request, { headers });
	}
	const h = handler as unknown as Record<string, unknown>;
	const fn = typeof h.handler === "function" ? h.handler : h;
	return (fn as CallableFunction)({
		request: nextRequest,
		context,
	}) as Promise<Response>;
}

/** Create a mock module context with a real payments controller and spy events. */
function createTestContext() {
	const data = createMockDataService();
	const payments = createPaymentController(data);
	const events = { emit: vi.fn() };
	return { data, payments, context: { controllers: { payments }, events } };
}

/** Seed a payment intent with a specific providerIntentId. */
async function seedIntent(options: {
	data: ReturnType<typeof createMockDataService>;
	payments: ReturnType<typeof createPaymentController>;
	providerIntentId: string;
	amount?: number;
	status?: string;
}) {
	const {
		data,
		payments,
		providerIntentId,
		amount = 2000,
		status = "pending",
	} = options;
	const intent = await payments.createIntent({ amount });
	await data.upsert("paymentIntent", intent.id, {
		...intent,
		providerIntentId,
		status,
	});
	return intent;
}

const SECRET = "whsec_test_secret_key";

// ── Missing verification configuration ───────────────────────────────────────

describe("createStripeWebhook — no secret configured", () => {
	const handler = createStripeWebhook({});

	it("returns 503 when no webhookSecret is set", async () => {
		const body = JSON.stringify({ type: "payment_intent.succeeded" });
		const req = makeRequest(body);
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(503);
	});

	it("fails closed before checking event type", async () => {
		const body = JSON.stringify({ id: "evt_123" });
		const req = makeRequest(body);
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(503);
	});

	it("fails closed before parsing invalid JSON", async () => {
		const req = makeRequest("not-json");
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(503);
	});
});

// ── With secret ───────────────────────────────────────────────────────────────

describe("createStripeWebhook — with webhookSecret", () => {
	const handler = createStripeWebhook({ webhookSecret: SECRET });

	it("accepts a valid signature", async () => {
		const body = JSON.stringify({ type: "charge.succeeded" });
		const sig = await buildStripeSignature(SECRET, body);
		const req = makeRequest(body, { "stripe-signature": sig });
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { received: boolean; type: string };
		expect(json.received).toBe(true);
		expect(json.type).toBe("charge.succeeded");
	});

	it("rejects a missing Stripe-Signature header (returns 401)", async () => {
		const body = JSON.stringify({ type: "charge.succeeded" });
		const req = makeRequest(body); // no signature header
		const res = await callWebhook(handler, req, undefined, false);
		expect(res.status).toBe(401);
	});

	it("rejects a tampered body", async () => {
		const originalBody = JSON.stringify({ type: "payment_intent.succeeded" });
		const sig = await buildStripeSignature(SECRET, originalBody);
		const tamperedBody = JSON.stringify({ type: "charge.refunded" });
		const req = makeRequest(tamperedBody, { "stripe-signature": sig });
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(401);
	});

	it("rejects an incorrect secret", async () => {
		const body = JSON.stringify({ type: "payment_intent.succeeded" });
		const sig = await buildStripeSignature("wrong-secret", body);
		const req = makeRequest(body, { "stripe-signature": sig });
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(401);
	});

	it("rejects an expired timestamp (> 5 minutes old)", async () => {
		const body = JSON.stringify({ type: "payment_intent.succeeded" });
		const sig = await buildStripeSignature(SECRET, body, -400); // 400s ago
		const req = makeRequest(body, { "stripe-signature": sig });
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(401);
	});

	it("accepts a recent timestamp within tolerance (60s ago)", async () => {
		const body = JSON.stringify({ type: "payment_intent.succeeded" });
		const sig = await buildStripeSignature(SECRET, body, -60);
		const req = makeRequest(body, { "stripe-signature": sig });
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(200);
	});
});

// ── Event handling ────────────────────────────────────────────────────────────

describe("createStripeWebhook — event handling", () => {
	const handler = createStripeWebhook({ webhookSecret: SECRET });

	it("handles payment_intent.succeeded and emits payment.completed", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent({
			data: data,
			payments: payments,
			providerIntentId: "pi_stripe_abc",
		});

		const body = JSON.stringify({
			type: "payment_intent.succeeded",
			id: "evt_test",
			data: { object: { id: "pi_stripe_abc", amount: 2000 } },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("succeeded");
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.completed",
			expect.objectContaining({ paymentIntentId: intent.id }),
		);
	});

	it("handles payment_intent.payment_failed and emits payment.failed", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent({
			data: data,
			payments: payments,
			providerIntentId: "pi_fail_test",
		});

		const body = JSON.stringify({
			type: "payment_intent.payment_failed",
			id: "evt_fail",
			data: { object: { id: "pi_fail_test" } },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("failed");
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.failed",
			expect.objectContaining({ paymentIntentId: intent.id }),
		);
	});

	it("handles charge.refunded and emits payment.refunded", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent({
			data: data,
			payments: payments,
			providerIntentId: "pi_refund_test",
			amount: 3000,
			status: "succeeded",
		});

		const body = JSON.stringify({
			type: "charge.refunded",
			data: {
				object: {
					payment_intent: "pi_refund_test",
					amount_refunded: 3000,
					refunds: {
						data: [{ id: "re_stripe_456", amount: 3000 }],
					},
				},
			},
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("refunded");
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.refunded",
			expect.objectContaining({
				paymentIntentId: intent.id,
				amount: 3000,
			}),
		);
	});

	it("handles payment_intent.canceled without emitting a domain event", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent({
			data: data,
			payments: payments,
			providerIntentId: "pi_cancel_test",
		});

		const body = JSON.stringify({
			type: "payment_intent.canceled",
			data: { object: { id: "pi_cancel_test" } },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("cancelled");
		expect(context.events.emit).not.toHaveBeenCalled();
	});

	it("returns unhandled for unknown Stripe event types", async () => {
		const { context } = createTestContext();

		const body = JSON.stringify({
			type: "customer.created",
			data: { object: { id: "cus_123" } },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { received: boolean; handled?: boolean };
		expect(json.received).toBe(true);
		expect(json.handled).toBeUndefined();
	});

	it("skips handling when no payments controller in context", async () => {
		const body = JSON.stringify({
			type: "payment_intent.succeeded",
			data: { object: { id: "pi_no_ctx" } },
		});

		const res = await callWebhook(handler, makeRequest(body));
		const json = (await res.json()) as { received: boolean; handled?: boolean };
		expect(json.received).toBe(true);
		expect(json.handled).toBeUndefined();
	});

	it("handles charge.succeeded via charge event mapping", async () => {
		const { data, payments, context } = createTestContext();
		await seedIntent({
			data: data,
			payments: payments,
			providerIntentId: "pi_charge_succ",
		});

		const body = JSON.stringify({
			type: "charge.succeeded",
			data: { object: { payment_intent: "pi_charge_succ" } },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.completed",
			expect.anything(),
		);
	});
});
