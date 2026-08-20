import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentController } from "../../../payments/src/service-impl";
import { createPayPalWebhook } from "../store/endpoints/webhook";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";
const WEBHOOK_ID = "WH-test-webhook-id";

const PAYPAL_HEADERS = {
	"paypal-auth-algo": "SHA256withRSA",
	"paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/CERT",
	"paypal-transmission-id": "tx-id-123",
	"paypal-transmission-sig": "base64sig==",
	"paypal-transmission-time": "2024-01-01T00:00:00Z",
};

function makeRequest(
	body: string,
	headers: Record<string, string> = {},
): Request {
	return new Request("https://example.com/api/paypal/webhook", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body,
	});
}

async function callWebhook(
	handler: ReturnType<typeof createPayPalWebhook>,
	request: Request,
	context?: Record<string, unknown>,
	autoVerify = true,
): Promise<Response> {
	let nextRequest = request;
	if (autoVerify) {
		if (!request.headers.has("paypal-auth-algo")) {
			const headers = new Headers(request.headers);
			for (const [name, value] of Object.entries(PAYPAL_HEADERS)) {
				headers.set(name, value);
			}
			nextRequest = new Request(request, { headers });
		}
		if (!vi.isMockFunction(globalThis.fetch)) {
			mockPayPalVerification("SUCCESS");
		}
	}
	const h = handler as unknown as Record<string, unknown>;
	const fn = typeof h.handler === "function" ? h.handler : h;
	return (fn as CallableFunction)({
		request: nextRequest,
		context,
	}) as Promise<Response>;
}

/** Mock fetch to return an OAuth token response and then a verification response. */
function mockPayPalVerification(verificationStatus: "SUCCESS" | "FAILURE") {
	return vi.spyOn(global, "fetch").mockImplementation(async (url) => {
		const urlStr = String(url);
		if (urlStr.includes("/oauth2/token")) {
			return new Response(
				JSON.stringify({ access_token: "mock-access-token" }),
				{ status: 200 },
			);
		}
		if (urlStr.includes("/verify-webhook-signature")) {
			return new Response(
				JSON.stringify({ verification_status: verificationStatus }),
				{ status: 200 },
			);
		}
		return new Response("Not found", { status: 404 });
	});
}

/** Create a mock module context with a real payments controller and spy events. */
function createTestContext() {
	const data = createMockDataService();
	const payments = createPaymentController(data);
	const events = { emit: vi.fn() };
	return { data, payments, context: { controllers: { payments }, events } };
}

/** Seed a payment intent with a specific providerIntentId. */
async function seedIntent(
	data: ReturnType<typeof createMockDataService>,
	payments: ReturnType<typeof createPaymentController>,
	providerIntentId: string,
	amount = 2000,
	status = "pending",
) {
	const intent = await payments.createIntent({ amount });
	await data.upsert("paymentIntent", intent.id, {
		...intent,
		providerIntentId,
		status,
	});
	return intent;
}

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Missing verification configuration ───────────────────────────────────────

describe("createPayPalWebhook — no webhookId configured", () => {
	const handler = createPayPalWebhook({
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
	});

	it("fails closed when no webhookId is set", async () => {
		const body = JSON.stringify({ event_type: "PAYMENT.CAPTURE.COMPLETED" });
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(503);
	});

	it("fails closed before checking event_type", async () => {
		const body = JSON.stringify({ id: "evt-123" });
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(503);
	});

	it("fails closed before parsing invalid JSON", async () => {
		const res = await callWebhook(handler, makeRequest("not-json"));
		expect(res.status).toBe(503);
	});
});

// ── With webhookId (verification enabled) ────────────────────────────────────

describe("createPayPalWebhook — with webhookId", () => {
	const handler = createPayPalWebhook({
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		webhookId: WEBHOOK_ID,
	});

	it("accepts a request when PayPal API returns SUCCESS", async () => {
		mockPayPalVerification("SUCCESS");
		const body = JSON.stringify({ event_type: "PAYMENT.CAPTURE.COMPLETED" });
		const res = await callWebhook(handler, makeRequest(body, PAYPAL_HEADERS));
		expect(res.status).toBe(200);
		const json = (await res.json()) as { received: boolean; type: string };
		expect(json.received).toBe(true);
		expect(json.type).toBe("PAYMENT.CAPTURE.COMPLETED");
	});

	it("rejects a request when PayPal API returns FAILURE", async () => {
		mockPayPalVerification("FAILURE");
		const body = JSON.stringify({ event_type: "PAYMENT.CAPTURE.COMPLETED" });
		const res = await callWebhook(handler, makeRequest(body, PAYPAL_HEADERS));
		expect(res.status).toBe(401);
	});

	it("rejects when PayPal transmission headers are missing", async () => {
		const body = JSON.stringify({ event_type: "PAYMENT.CAPTURE.COMPLETED" });
		// No PayPal headers — missing all 5 required headers
		const res = await callWebhook(handler, makeRequest(body), undefined, false);
		expect(res.status).toBe(401);
	});

	it("rejects when only some PayPal headers are present", async () => {
		const body = JSON.stringify({ event_type: "PAYMENT.CAPTURE.COMPLETED" });
		const res = await callWebhook(
			handler,
			makeRequest(body, {
				"paypal-transmission-id": "tx-id-123",
				// Missing the other 4 headers
			}),
			undefined,
			false,
		);
		expect(res.status).toBe(401);
	});

	it("rejects when PayPal API call fails", async () => {
		vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
		const body = JSON.stringify({ event_type: "PAYMENT.CAPTURE.COMPLETED" });
		const res = await callWebhook(handler, makeRequest(body, PAYPAL_HEADERS));
		expect(res.status).toBe(401);
	});

	it("returns 400 for missing event_type even after successful verification", async () => {
		mockPayPalVerification("SUCCESS");
		const body = JSON.stringify({ id: "evt-123" });
		const res = await callWebhook(handler, makeRequest(body, PAYPAL_HEADERS));
		expect(res.status).toBe(400);
	});

	it("uses sandbox URL when sandbox option is set", async () => {
		const fetchSpy = vi
			.spyOn(global, "fetch")
			.mockImplementation(async (url) => {
				const urlStr = String(url);
				expect(urlStr).toContain("sandbox.paypal.com");
				if (urlStr.includes("/oauth2/token")) {
					return new Response(JSON.stringify({ access_token: "mock-token" }), {
						status: 200,
					});
				}
				return new Response(
					JSON.stringify({ verification_status: "SUCCESS" }),
					{ status: 200 },
				);
			});

		const sandboxHandler = createPayPalWebhook({
			clientId: CLIENT_ID,
			clientSecret: CLIENT_SECRET,
			webhookId: WEBHOOK_ID,
			sandbox: "true",
		});

		const body = JSON.stringify({ event_type: "PAYMENT.CAPTURE.COMPLETED" });
		await callWebhook(sandboxHandler, makeRequest(body, PAYPAL_HEADERS));
		expect(fetchSpy).toHaveBeenCalled();
	});
});

// ── Event handling ────────────────────────────────────────────────────────────

describe("createPayPalWebhook — event handling", () => {
	const handler = createPayPalWebhook({
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		webhookId: WEBHOOK_ID,
	});

	it("handles PAYMENT.CAPTURE.COMPLETED and emits payment.completed", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(data, payments, "PP_ORDER_123");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
			id: "WH-evt-1",
			resource: {
				id: "CAP_456",
				supplementary_data: {
					related_ids: { order_id: "PP_ORDER_123" },
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

	it("handles PAYMENT.CAPTURE.DENIED and emits payment.failed", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(data, payments, "PP_DENIED_123");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.DENIED",
			resource: { id: "PP_DENIED_123" },
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

	it("handles PAYMENT.CAPTURE.REFUNDED and emits payment.refunded", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(
			data,
			payments,
			"PP_REFUND_ORDER",
			5000,
			"succeeded",
		);

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.REFUNDED",
			resource: {
				id: "RF_789",
				amount: { value: "50.00", currency_code: "USD" },
				supplementary_data: {
					related_ids: { order_id: "PP_REFUND_ORDER" },
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
			expect.objectContaining({ paymentIntentId: intent.id }),
		);
	});

	it("returns unhandled for unknown PayPal event types", async () => {
		const { context } = createTestContext();

		const body = JSON.stringify({
			event_type: "BILLING.SUBSCRIPTION.CREATED",
			resource: { id: "SUB_123" },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { received: boolean; handled?: boolean };
		expect(json.received).toBe(true);
		expect(json.handled).toBeUndefined();
	});

	it("skips handling when no payments controller in context", async () => {
		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
			resource: { id: "PP_NO_CTX" },
		});

		const res = await callWebhook(handler, makeRequest(body));
		const json = (await res.json()) as { received: boolean; handled?: boolean };
		expect(json.received).toBe(true);
		expect(json.handled).toBeUndefined();
	});
});
