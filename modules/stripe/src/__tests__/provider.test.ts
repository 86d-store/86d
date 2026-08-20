import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StripePaymentProvider } from "../provider";

function mockFetchResponse(data: unknown, ok = true, status = 200) {
	return vi.fn().mockResolvedValue({
		ok,
		status,
		json: () => Promise.resolve(data),
	});
}

describe("StripePaymentProvider", () => {
	let provider: StripePaymentProvider;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		provider = new StripePaymentProvider("sk_test_key");
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// ── createIntent ─────────────────────────────────────────────────────

	describe("createIntent", () => {
		it("creates a payment intent via Stripe API", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_123",
				object: "payment_intent",
				amount: 5000,
				currency: "usd",
				status: "requires_payment_method",
				client_secret: "pi_123_secret_abc",
				metadata: {},
			});

			const result = await provider.createIntent({
				amount: 5000,
				currency: "USD",
			});
			expect(result.providerIntentId).toBe("pi_123");
			expect(result.status).toBe("pending");
			expect(result.providerMetadata?.clientSecret).toBe("pi_123_secret_abc");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				"https://api.stripe.com/v1/payment_intents",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer sk_test_key",
					}),
				}),
			);
		});

		it("maps succeeded status correctly", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_456",
				object: "payment_intent",
				amount: 1000,
				currency: "usd",
				status: "succeeded",
				client_secret: "secret",
				metadata: {},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
			});
			expect(result.status).toBe("succeeded");
		});

		it("maps processing status correctly", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_789",
				object: "payment_intent",
				amount: 1000,
				currency: "usd",
				status: "processing",
				client_secret: "secret",
				metadata: {},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
			});
			expect(result.status).toBe("processing");
		});

		it("throws on Stripe API error", async () => {
			globalThis.fetch = mockFetchResponse(
				{ error: { message: "Invalid API key", type: "authentication_error" } },
				false,
				401,
			);

			await expect(
				provider.createIntent({ amount: 1000, currency: "USD" }),
			).rejects.toThrow("Stripe error: Invalid API key");
		});

		it("lowercases currency", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_lc",
				object: "payment_intent",
				amount: 500,
				currency: "eur",
				status: "requires_payment_method",
				client_secret: "secret",
				metadata: {},
			});
			await provider.createIntent({ amount: 500, currency: "EUR" });
			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0];
			expect(fetchCall[1].body).toContain("currency=eur");
		});

		it("maps requires_capture to processing", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_cap",
				object: "payment_intent",
				amount: 3000,
				currency: "usd",
				status: "requires_capture",
				client_secret: "secret_cap",
				metadata: {},
			});
			const result = await provider.createIntent({
				amount: 3000,
				currency: "USD",
			});
			expect(result.status).toBe("processing");
		});

		it("maps requires_confirmation to pending", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_conf",
				object: "payment_intent",
				amount: 1500,
				currency: "usd",
				status: "requires_confirmation",
				client_secret: "secret_conf",
				metadata: {},
			});
			const result = await provider.createIntent({
				amount: 1500,
				currency: "USD",
			});
			expect(result.status).toBe("pending");
		});

		it("passes metadata through in the request body", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_meta",
				object: "payment_intent",
				amount: 4000,
				currency: "usd",
				status: "requires_payment_method",
				client_secret: "secret_meta",
				metadata: {},
			});
			await provider.createIntent({
				amount: 4000,
				currency: "USD",
			});
			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0];
			const body = fetchCall[1].body as string;
			expect(body).toContain("amount=4000");
			expect(body).toContain("currency=usd");
			expect(body).toContain("automatic_payment_methods%5Benabled%5D=true");
		});
	});

	// ── confirmIntent ────────────────────────────────────────────────────

	describe("confirmIntent", () => {
		it("confirms a payment intent", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_123",
				object: "payment_intent",
				amount: 5000,
				currency: "usd",
				status: "succeeded",
				client_secret: "secret",
				metadata: {},
			});

			const result = await provider.confirmIntent("pi_123");
			expect(result.providerIntentId).toBe("pi_123");
			expect(result.status).toBe("succeeded");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				"https://api.stripe.com/v1/payment_intents/pi_123/confirm",
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("maps requires_action to pending", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_3ds",
				object: "payment_intent",
				amount: 2000,
				currency: "usd",
				status: "requires_action",
				client_secret: "secret",
				metadata: {},
			});
			const result = await provider.confirmIntent("pi_3ds");
			expect(result.status).toBe("pending");
		});

		it("handles error response without message field (falls back to HTTP status)", async () => {
			globalThis.fetch = mockFetchResponse(
				{ error: { type: "api_error" } },
				false,
				500,
			);
			await expect(provider.confirmIntent("pi_err")).rejects.toThrow(
				"Stripe error: HTTP 500",
			);
		});
	});

	// ── cancelIntent ─────────────────────────────────────────────────────

	describe("cancelIntent", () => {
		it("cancels a payment intent", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_cancel",
				object: "payment_intent",
				amount: 5000,
				currency: "usd",
				status: "canceled",
				client_secret: "secret",
				metadata: {},
			});

			const result = await provider.cancelIntent("pi_cancel");
			expect(result.status).toBe("cancelled");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				"https://api.stripe.com/v1/payment_intents/pi_cancel/cancel",
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("maps canceled status to cancelled explicitly", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "pi_cancel_explicit",
				object: "payment_intent",
				amount: 1200,
				currency: "usd",
				status: "canceled",
				client_secret: "secret_cancel",
				metadata: {},
			});

			const result = await provider.cancelIntent("pi_cancel_explicit");
			expect(result.providerIntentId).toBe("pi_cancel_explicit");
			expect(result.status).toBe("cancelled");
			expect(result.providerMetadata?.stripeStatus).toBe("canceled");
		});
	});

	// ── createRefund ─────────────────────────────────────────────────────

	describe("createRefund", () => {
		it("creates a refund", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "re_123",
				object: "refund",
				amount: 5000,
				charge: "ch_123",
				payment_intent: "pi_123",
				status: "succeeded",
				reason: null,
			});

			const result = await provider.createRefund({
				providerIntentId: "pi_123",
			});
			expect(result.providerRefundId).toBe("re_123");
			expect(result.status).toBe("succeeded");
		});

		it("sends amount when provided", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "re_partial",
				object: "refund",
				amount: 2000,
				charge: "ch_123",
				payment_intent: "pi_123",
				status: "succeeded",
				reason: null,
			});

			await provider.createRefund({
				providerIntentId: "pi_123",
				amount: 2000,
			});

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0];
			expect(fetchCall[1].body).toContain("amount=2000");
		});

		it("maps failed refund status", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "re_fail",
				object: "refund",
				amount: 1000,
				charge: "ch_1",
				payment_intent: "pi_1",
				status: "failed",
				reason: null,
			});
			const result = await provider.createRefund({
				providerIntentId: "pi_1",
			});
			expect(result.status).toBe("failed");
		});

		it("maps pending refund status", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "re_pend",
				object: "refund",
				amount: 1000,
				charge: "ch_1",
				payment_intent: "pi_1",
				status: "pending",
				reason: null,
			});
			const result = await provider.createRefund({
				providerIntentId: "pi_1",
			});
			expect(result.status).toBe("pending");
		});

		it("maps canceled refund to pending status", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "re_canceled",
				object: "refund",
				amount: 800,
				charge: "ch_cancel",
				payment_intent: "pi_cancel_refund",
				status: "canceled",
				reason: null,
			});
			const result = await provider.createRefund({
				providerIntentId: "pi_cancel_refund",
			});
			// "canceled" is not "succeeded" or "failed", so it falls to "pending"
			expect(result.status).toBe("pending");
			expect(result.providerMetadata?.stripeStatus).toBe("canceled");
		});

		it("sends reason when provided", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "re_reason",
				object: "refund",
				amount: 3000,
				charge: "ch_reason",
				payment_intent: "pi_reason",
				status: "succeeded",
				reason: "duplicate",
			});
			await provider.createRefund({
				providerIntentId: "pi_reason",
				reason: "duplicate",
			});
			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0];
			const body = fetchCall[1].body as string;
			expect(body).toContain("reason=duplicate");
		});

		it("does not send amount or reason when not provided", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "re_minimal",
				object: "refund",
				amount: 5000,
				charge: "ch_min",
				payment_intent: "pi_minimal",
				status: "succeeded",
				reason: null,
			});
			await provider.createRefund({
				providerIntentId: "pi_minimal",
			});
			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0];
			const body = fetchCall[1].body as string;
			expect(body).not.toContain("amount=");
			expect(body).not.toContain("reason=");
			expect(body).toContain("payment_intent=pi_minimal");
		});

		it("sends deterministic Idempotency-Key header for full refund", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "re_idem",
				object: "refund",
				amount: 5000,
				charge: "ch_1",
				payment_intent: "pi_idem",
				status: "succeeded",
				reason: null,
			});
			await provider.createRefund({ providerIntentId: "pi_idem" });
			const headers = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0][1].headers;
			expect(headers["Idempotency-Key"]).toBe("refund-pi_idem-full");
		});

		it("sends deterministic Idempotency-Key header for partial refund", async () => {
			globalThis.fetch = mockFetchResponse({
				id: "re_partial",
				object: "refund",
				amount: 1500,
				charge: "ch_1",
				payment_intent: "pi_partial",
				status: "succeeded",
				reason: null,
			});
			await provider.createRefund({
				providerIntentId: "pi_partial",
				amount: 1500,
			});
			const headers = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0][1].headers;
			expect(headers["Idempotency-Key"]).toBe("refund-pi_partial-1500");
		});
	});
});
