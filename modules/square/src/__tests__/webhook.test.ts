import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createPaymentController } from "../../../payments/src/service-impl";
import { createSquareWebhook } from "../store/endpoints/webhook";

// ── Helpers ───────────────────────────────────────────────────────────────────

const enc = new TextEncoder();
const SIG_KEY = "square-test-sig-key";
const NOTIFICATION_URL = "https://example.com/api/square/webhook";

async function buildSquareSignature(
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
			await buildSquareSignature(SIG_KEY, NOTIFICATION_URL, body),
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

// ── No signature configured ───────────────────────────────────────────────────

describe("createSquareWebhook — no signature configured", () => {
	const handler = createSquareWebhook({});

	it("fails closed without a signature key", async () => {
		const body = JSON.stringify({ type: "payment.created", data: {} });
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(503);
	});

	it("fails closed before checking event type", async () => {
		const res = await callWebhook(
			handler,
			makeRequest(JSON.stringify({ data: {} })),
		);
		expect(res.status).toBe(503);
	});

	it("fails closed before parsing invalid JSON", async () => {
		const res = await callWebhook(handler, makeRequest("bad-json"));
		expect(res.status).toBe(503);
	});
});

// ── Signature verification enabled ────────────────────────────────────────────

describe("createSquareWebhook — with signature verification", () => {
	const handler = createSquareWebhook({
		webhookSignatureKey: SIG_KEY,
		notificationUrl: NOTIFICATION_URL,
	});

	it("accepts a valid signature", async () => {
		const body = JSON.stringify({ type: "payment.created", data: {} });
		const sig = await buildSquareSignature(SIG_KEY, NOTIFICATION_URL, body);
		const req = makeRequest(body, { "x-square-hmacsha256-signature": sig });
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { received: boolean; type: string };
		expect(json.received).toBe(true);
		expect(json.type).toBe("payment.created");
	});

	it("rejects a missing signature header", async () => {
		const body = JSON.stringify({ type: "payment.created", data: {} });
		const req = makeRequest(body); // no signature header
		const res = await callWebhook(handler, req, undefined, false);
		expect(res.status).toBe(401);
	});

	it("rejects a tampered body", async () => {
		const originalBody = JSON.stringify({ type: "payment.created", data: {} });
		const sig = await buildSquareSignature(
			SIG_KEY,
			NOTIFICATION_URL,
			originalBody,
		);
		const tamperedBody = JSON.stringify({ type: "refund.created", data: {} });
		const req = makeRequest(tamperedBody, {
			"x-square-hmacsha256-signature": sig,
		});
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(401);
	});

	it("rejects an incorrect signature key", async () => {
		const body = JSON.stringify({ type: "payment.created", data: {} });
		const sig = await buildSquareSignature("wrong-key", NOTIFICATION_URL, body);
		const req = makeRequest(body, { "x-square-hmacsha256-signature": sig });
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(401);
	});

	it("rejects a signature built for a different notification URL", async () => {
		const body = JSON.stringify({ type: "payment.created", data: {} });
		const sig = await buildSquareSignature(
			SIG_KEY,
			"https://other.com/webhook",
			body,
		);
		const req = makeRequest(body, { "x-square-hmacsha256-signature": sig });
		const res = await callWebhook(handler, req);
		expect(res.status).toBe(401);
	});
});

// ── Event handling ────────────────────────────────────────────────────────────

describe("createSquareWebhook — event handling", () => {
	const handler = createSquareWebhook({
		webhookSignatureKey: SIG_KEY,
		notificationUrl: NOTIFICATION_URL,
	});

	it("handles payment.completed and emits payment.completed", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent({
			data: data,
			payments: payments,
			providerIntentId: "SQ_PAY_123",
		});

		const body = JSON.stringify({
			type: "payment.completed",
			event_id: "sq_evt_1",
			data: {
				object: {
					payment: { id: "SQ_PAY_123", amount_money: { amount: 2000 } },
				},
			},
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("succeeded");
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.completed",
			expect.objectContaining({ paymentIntentId: intent.id }),
		);
	});

	it("handles payment.failed and emits payment.failed", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent({
			data: data,
			payments: payments,
			providerIntentId: "SQ_FAIL_123",
		});

		const body = JSON.stringify({
			type: "payment.failed",
			data: { object: { payment: { id: "SQ_FAIL_123" } } },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("failed");
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.failed",
			expect.anything(),
		);
	});

	it("handles refund.completed and emits payment.refunded", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent({
			data: data,
			payments: payments,
			providerIntentId: "SQ_REFUND_PAY",
			amount: 4000,
			status: "succeeded",
		});

		const body = JSON.stringify({
			type: "refund.completed",
			data: {
				object: {
					refund: {
						id: "SQ_RF_456",
						payment_id: "SQ_REFUND_PAY",
						amount_money: { amount: 4000 },
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
				amount: 4000,
			}),
		);
	});

	it("returns unhandled for unknown Square event types", async () => {
		const { context } = createTestContext();

		const body = JSON.stringify({
			type: "catalog.version.updated",
			data: { object: {} },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { received: boolean; handled?: boolean };
		expect(json.received).toBe(true);
		expect(json.handled).toBeUndefined();
	});

	it("skips handling when no payments controller in context", async () => {
		const body = JSON.stringify({
			type: "payment.completed",
			data: { object: { payment: { id: "SQ_NO_CTX" } } },
		});

		const res = await callWebhook(handler, makeRequest(body));
		const json = (await res.json()) as { received: boolean; handled?: boolean };
		expect(json.received).toBe(true);
		expect(json.handled).toBeUndefined();
	});
});
