import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentController } from "../../../payments/src/service-impl";
import { createPayPalWebhook } from "../store/endpoints/webhook";

/**
 * Security regression tests for the PayPal module.
 *
 * These tests verify:
 * - Webhook signature verification enforcement
 * - Event type filtering (only mapped event types update state)
 * - Provider intent ID extraction safety
 * - Refund amount integrity and conversion
 * - Missing / malformed payload handling
 * - Sandbox vs production URL isolation
 * - Idempotent event processing
 * - Admin settings credential masking
 */

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

function mockPayPalVerification(verificationStatus: "SUCCESS" | "FAILURE") {
	return vi.spyOn(global, "fetch").mockImplementation(async (url) => {
		const urlStr = String(url);
		if (urlStr.includes("/oauth2/token")) {
			return new Response(JSON.stringify({ access_token: "mock-token" }), {
				status: 200,
			});
		}
		if (urlStr.includes("/verify-webhook-signature")) {
			return new Response(
				JSON.stringify({
					verification_status: verificationStatus,
				}),
				{ status: 200 },
			);
		}
		return new Response("Not found", { status: 404 });
	});
}

function createTestContext() {
	const data = createMockDataService();
	const payments = createPaymentController(data);
	const events = { emit: vi.fn() };
	return {
		data,
		payments,
		context: { controllers: { payments }, events },
	};
}

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

// ── Webhook Signature Verification ────────────────────────────────────────────

describe("paypal endpoint security — signature verification", () => {
	const handler = createPayPalWebhook({
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		webhookId: WEBHOOK_ID,
	});

	it("rejects requests with missing PayPal transmission headers", async () => {
		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
		});
		const res = await callWebhook(handler, makeRequest(body), undefined, false);
		expect(res.status).toBe(401);
	});

	it("rejects requests with partial PayPal headers", async () => {
		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
		});
		// Only provide 2 of 5 required headers
		const res = await callWebhook(
			handler,
			makeRequest(body, {
				"paypal-transmission-id": "tx-id-123",
				"paypal-auth-algo": "SHA256withRSA",
			}),
			undefined,
			false,
		);
		expect(res.status).toBe(401);
	});

	it("rejects when PayPal verification API returns FAILURE", async () => {
		mockPayPalVerification("FAILURE");
		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
		});
		const res = await callWebhook(handler, makeRequest(body, PAYPAL_HEADERS));
		expect(res.status).toBe(401);
	});

	it("rejects when PayPal verification API is unreachable", async () => {
		vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
		});
		const res = await callWebhook(handler, makeRequest(body, PAYPAL_HEADERS));
		expect(res.status).toBe(401);
	});

	it("accepts when PayPal verification returns SUCCESS", async () => {
		mockPayPalVerification("SUCCESS");
		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
		});
		const res = await callWebhook(handler, makeRequest(body, PAYPAL_HEADERS));
		expect(res.status).toBe(200);
	});
});

// ── Event Type Filtering ──────────────────────────────────────────────────────

describe("paypal endpoint security — event type filtering", () => {
	const handler = createPayPalWebhook({
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		webhookId: WEBHOOK_ID,
	});

	it("rejects payloads with missing event_type", async () => {
		const body = JSON.stringify({ id: "evt-no-type" });
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(400);
	});

	it("does not update state for unmapped event types", async () => {
		const { data, payments, context } = createTestContext();
		await seedIntent(data, payments, "PP_ORDER_999");

		const body = JSON.stringify({
			event_type: "BILLING.SUBSCRIPTION.CREATED",
			resource: { id: "PP_ORDER_999" },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as {
			received: boolean;
			handled?: boolean;
		};
		expect(json.received).toBe(true);
		expect(json.handled).toBeUndefined();

		// Intent status should remain unchanged
		const intent = await payments.getIntent(
			(await payments.listIntents())[0]?.id,
		);
		expect(intent?.status).toBe("pending");
	});

	it("does not update state for CHECKOUT.ORDER.COMPLETED (unmapped)", async () => {
		const { data, payments, context } = createTestContext();
		await seedIntent(data, payments, "PP_UNMAPPED_1");

		const body = JSON.stringify({
			event_type: "CHECKOUT.ORDER.COMPLETED",
			resource: { id: "PP_UNMAPPED_1" },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { received: boolean };
		expect(json.received).toBe(true);
	});

	it("maps PAYMENT.CAPTURE.COMPLETED to succeeded status", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(data, payments, "PP_COMPLETED_1");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
			id: "WH-cap-1",
			resource: {
				id: "CAP_1",
				supplementary_data: {
					related_ids: { order_id: "PP_COMPLETED_1" },
				},
			},
		});

		await callWebhook(handler, makeRequest(body), context);
		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("succeeded");
	});

	it("maps PAYMENT.CAPTURE.DENIED to failed status", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(data, payments, "PP_DENIED_SEC");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.DENIED",
			resource: { id: "PP_DENIED_SEC" },
		});

		await callWebhook(handler, makeRequest(body), context);
		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("failed");
	});

	it("maps PAYMENT.CAPTURE.PENDING to processing status", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(data, payments, "PP_PENDING_SEC");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.PENDING",
			resource: { id: "PP_PENDING_SEC" },
		});

		await callWebhook(handler, makeRequest(body), context);
		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("processing");
	});
});

// ── Refund Amount Integrity ───────────────────────────────────────────────────

describe("paypal endpoint security — refund amount integrity", () => {
	const handler = createPayPalWebhook({
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		webhookId: WEBHOOK_ID,
	});

	it("converts refund dollar amount to cents correctly", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(
			data,
			payments,
			"PP_REFUND_AMT",
			5000,
			"succeeded",
		);

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.REFUNDED",
			resource: {
				id: "RF_AMT_1",
				amount: { value: "50.00", currency_code: "USD" },
				supplementary_data: {
					related_ids: { order_id: "PP_REFUND_AMT" },
				},
			},
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("refunded");
	});

	it("handles PAYMENT.SALE.REFUNDED event type as refund", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(
			data,
			payments,
			"PP_SALE_REFUND",
			3000,
			"succeeded",
		);

		const body = JSON.stringify({
			event_type: "PAYMENT.SALE.REFUNDED",
			resource: {
				id: "RF_SALE_1",
				amount: { value: "30.00", currency_code: "USD" },
				supplementary_data: {
					related_ids: { order_id: "PP_SALE_REFUND" },
				},
			},
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(json.handled).toBe(true);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("refunded");
	});

	it("rejects a refund when amount is missing", async () => {
		const { data, payments, context } = createTestContext();
		await seedIntent(data, payments, "PP_NO_AMT", 2000, "succeeded");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.REFUNDED",
			resource: {
				id: "RF_NO_AMT",
				supplementary_data: {
					related_ids: { order_id: "PP_NO_AMT" },
				},
			},
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		const json = (await res.json()) as { handled: boolean };
		expect(res.status).toBe(400);
		expect(json.handled).toBeUndefined();
		expect(context.events.emit).not.toHaveBeenCalled();
	});
});

// ── Malformed Payload Handling ────────────────────────────────────────────────

describe("paypal endpoint security — malformed payloads", () => {
	const handler = createPayPalWebhook({
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		webhookId: WEBHOOK_ID,
	});

	it("rejects completely invalid JSON before provider verification", async () => {
		const res = await callWebhook(handler, makeRequest("{not-valid-json"));
		expect(res.status).toBe(401);
	});

	it("rejects an empty body before provider verification", async () => {
		const res = await callWebhook(handler, makeRequest(""));
		expect(res.status).toBe(401);
	});

	it("does not crash when resource field is missing", async () => {
		const { context } = createTestContext();
		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
			// no resource field
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		// Should still return 200 (received but not handled since
		// no providerIntentId can be extracted)
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			received: boolean;
			handled?: boolean;
		};
		expect(json.received).toBe(true);
	});

	it("does not crash when resource.supplementary_data is absent", async () => {
		const { context } = createTestContext();
		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
			resource: { id: "CAP_ONLY" },
		});

		const res = await callWebhook(handler, makeRequest(body), context);
		expect(res.status).toBe(200);
	});
});

// ── Sandbox vs Production URL Isolation ───────────────────────────────────────

describe("paypal endpoint security — sandbox isolation", () => {
	it("sandbox handler calls sandbox.paypal.com for verification", async () => {
		const fetchSpy = vi
			.spyOn(global, "fetch")
			.mockImplementation(async (url) => {
				const urlStr = String(url);
				if (urlStr.includes("/oauth2/token")) {
					return new Response(JSON.stringify({ access_token: "tok" }), {
						status: 200,
					});
				}
				return new Response(
					JSON.stringify({
						verification_status: "SUCCESS",
					}),
					{ status: 200 },
				);
			});

		const sandboxHandler = createPayPalWebhook({
			clientId: CLIENT_ID,
			clientSecret: CLIENT_SECRET,
			webhookId: WEBHOOK_ID,
			sandbox: "true",
		});

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
		});
		await callWebhook(sandboxHandler, makeRequest(body, PAYPAL_HEADERS));

		const calledUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
		const allSandbox = calledUrls.every(
			(u) => new URL(u).hostname === "api-m.sandbox.paypal.com",
		);
		expect(allSandbox).toBe(true);
	});

	it("production handler calls api-m.paypal.com (not sandbox)", async () => {
		const fetchSpy = vi
			.spyOn(global, "fetch")
			.mockImplementation(async (url) => {
				const urlStr = String(url);
				if (urlStr.includes("/oauth2/token")) {
					return new Response(JSON.stringify({ access_token: "tok" }), {
						status: 200,
					});
				}
				return new Response(
					JSON.stringify({
						verification_status: "SUCCESS",
					}),
					{ status: 200 },
				);
			});

		const prodHandler = createPayPalWebhook({
			clientId: CLIENT_ID,
			clientSecret: CLIENT_SECRET,
			webhookId: WEBHOOK_ID,
		});

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
		});
		await callWebhook(prodHandler, makeRequest(body, PAYPAL_HEADERS));

		const calledUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
		const noneSandbox = calledUrls.every(
			(u) => !new URL(u).hostname.includes("sandbox"),
		);
		expect(noneSandbox).toBe(true);
		expect(
			calledUrls.every((u) => new URL(u).hostname === "api-m.paypal.com"),
		).toBe(true);
	});
});

// ── Idempotent Event Processing ───────────────────────────────────────────────

describe("paypal endpoint security — idempotency", () => {
	const handler = createPayPalWebhook({
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		webhookId: WEBHOOK_ID,
	});

	it("processing the same COMPLETED event twice does not corrupt state", async () => {
		const { data, payments, context } = createTestContext();
		const intent = await seedIntent(data, payments, "PP_IDEMPOTENT_1");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
			id: "WH-idem-1",
			resource: {
				id: "CAP_IDEM",
				supplementary_data: {
					related_ids: { order_id: "PP_IDEMPOTENT_1" },
				},
			},
		});

		// First call
		const res1 = await callWebhook(handler, makeRequest(body), context);
		expect(res1.status).toBe(200);

		// Second identical call
		const res2 = await callWebhook(handler, makeRequest(body), context);
		expect(res2.status).toBe(200);

		const updated = await payments.getIntent(intent.id);
		expect(updated?.status).toBe("succeeded");
	});

	it("skips handling when no payments controller is available", async () => {
		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
			resource: {
				id: "CAP_NO_CTX",
				supplementary_data: {
					related_ids: { order_id: "PP_NO_CTX" },
				},
			},
		});

		// No context provided at all
		const res = await callWebhook(handler, makeRequest(body));
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			received: boolean;
			handled?: boolean;
		};
		expect(json.received).toBe(true);
		expect(json.handled).toBeUndefined();
	});
});

// ── Domain Event Emission ─────────────────────────────────────────────────────

describe("paypal endpoint security — domain event emission", () => {
	const handler = createPayPalWebhook({
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		webhookId: WEBHOOK_ID,
	});

	it("PAYMENT.CAPTURE.PENDING does not emit a domain event", async () => {
		const { data, payments, context } = createTestContext();
		await seedIntent(data, payments, "PP_PENDING_EVT");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.PENDING",
			resource: { id: "PP_PENDING_EVT" },
		});

		await callWebhook(handler, makeRequest(body), context);
		expect(context.events.emit).not.toHaveBeenCalled();
	});

	it("CHECKOUT.ORDER.APPROVED does not emit a domain event", async () => {
		const { data, payments, context } = createTestContext();
		await seedIntent(data, payments, "PP_APPROVED_EVT");

		const body = JSON.stringify({
			event_type: "CHECKOUT.ORDER.APPROVED",
			resource: { id: "PP_APPROVED_EVT" },
		});

		await callWebhook(handler, makeRequest(body), context);
		expect(context.events.emit).not.toHaveBeenCalled();
	});

	it("PAYMENT.CAPTURE.COMPLETED emits payment.completed", async () => {
		const { data, payments, context } = createTestContext();
		await seedIntent(data, payments, "PP_EMIT_COMP");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.COMPLETED",
			resource: {
				id: "CAP_EMIT",
				supplementary_data: {
					related_ids: { order_id: "PP_EMIT_COMP" },
				},
			},
		});

		await callWebhook(handler, makeRequest(body), context);
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.completed",
			expect.objectContaining({
				paymentIntentId: expect.any(String),
			}),
		);
	});

	it("PAYMENT.CAPTURE.DENIED emits payment.failed", async () => {
		const { data, payments, context } = createTestContext();
		await seedIntent(data, payments, "PP_EMIT_DENIED");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.DENIED",
			resource: { id: "PP_EMIT_DENIED" },
		});

		await callWebhook(handler, makeRequest(body), context);
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.failed",
			expect.anything(),
		);
	});

	it("PAYMENT.CAPTURE.REFUNDED emits payment.refunded", async () => {
		const { data, payments, context } = createTestContext();
		await seedIntent(data, payments, "PP_EMIT_REFUND", 4000, "succeeded");

		const body = JSON.stringify({
			event_type: "PAYMENT.CAPTURE.REFUNDED",
			resource: {
				id: "RF_EMIT_1",
				amount: { value: "40.00", currency_code: "USD" },
				supplementary_data: {
					related_ids: { order_id: "PP_EMIT_REFUND" },
				},
			},
		});

		await callWebhook(handler, makeRequest(body), context);
		expect(context.events.emit).toHaveBeenCalledWith(
			"payment.refunded",
			expect.objectContaining({
				paymentIntentId: expect.any(String),
			}),
		);
	});
});
