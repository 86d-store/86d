import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SquarePaymentProvider } from "../provider";

function mockFetchResponse(data: unknown, ok = true, status = 200) {
	return vi.fn().mockResolvedValue({
		ok,
		status,
		json: () => Promise.resolve(data),
	});
}

describe("SquarePaymentProvider", () => {
	let provider: SquarePaymentProvider;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		provider = new SquarePaymentProvider("sq_test_token");
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// ── createIntent ─────────────────────────────────────────────────────

	describe("createIntent", () => {
		const validMeta = { paymentMethodNonce: "cnon:card-nonce-ok" };

		it("returns square payment type when no nonce provided", async () => {
			const result = await provider.createIntent({
				amount: 5000,
				currency: "USD",
			});
			expect(result.status).toBe("pending");
			expect(result.providerMetadata?.paymentType).toBe("square");
			expect(result.providerIntentId).toMatch(/^square_pending_/);
		});

		it("returns square payment type when metadata has no nonce", async () => {
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: { someOther: "value" },
			});
			expect(result.status).toBe("pending");
			expect(result.providerMetadata?.paymentType).toBe("square");
		});

		it("does not call Square API when no nonce provided", async () => {
			globalThis.fetch = vi.fn();
			await provider.createIntent({ amount: 1000, currency: "USD" });
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});

		it("creates a payment via Square API with nonce", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_123",
					status: "APPROVED",
					amount_money: { amount: 5000, currency: "USD" },
				},
			});

			const result = await provider.createIntent({
				amount: 5000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.providerIntentId).toBe("sq_pay_123");
			expect(result.status).toBe("pending"); // APPROVED → pending
			expect(result.providerMetadata?.squareStatus).toBe("APPROVED");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				"https://connect.squareup.com/v2/payments",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer sq_test_token",
					}),
				}),
			);
		});

		it("maps COMPLETED status to succeeded", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_comp",
					status: "COMPLETED",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("succeeded");
		});

		it("maps CANCELED status to cancelled", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_cancel",
					status: "CANCELED",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("cancelled");
		});

		it("maps FAILED status to failed", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_fail",
					status: "FAILED",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("failed");
		});

		it("uppercases currency", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_lc",
					status: "PENDING",
					amount_money: { amount: 500, currency: "EUR" },
				},
			});
			await provider.createIntent({
				amount: 500,
				currency: "eur",
				metadata: validMeta,
			});
			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.amount_money.currency).toBe("EUR");
		});

		it("maps PENDING status to pending", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_pend",
					status: "PENDING",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("pending");
		});

		it("derives idempotency_key from source nonce for retry safety", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_idem",
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
			expect(body.idempotency_key).toBe("create-cnon:card-nonce-ok");
		});

		it("sets autocomplete to false", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_auto",
					status: "APPROVED",
					amount_money: { amount: 3000, currency: "USD" },
				},
			});
			await provider.createIntent({
				amount: 3000,
				currency: "USD",
				metadata: validMeta,
			});
			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.autocomplete).toBe(false);
		});

		it("uses nonce as source_id", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_src",
					status: "APPROVED",
					amount_money: { amount: 1500, currency: "USD" },
				},
			});
			await provider.createIntent({
				amount: 1500,
				currency: "USD",
				metadata: { paymentMethodNonce: "cnon:my-card-nonce" },
			});
			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.source_id).toBe("cnon:my-card-nonce");
		});

		it("includes Square-Version header", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_ver",
					status: "APPROVED",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});
			await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0][1];
			expect(callArgs.headers["Square-Version"]).toBe("2024-01-18");
		});

		it("throws on Square API error", async () => {
			globalThis.fetch = mockFetchResponse(
				{
					errors: [
						{
							detail: "Not found",
							category: "API_ERROR",
							code: "NOT_FOUND",
						},
					],
				},
				false,
				404,
			);

			await expect(
				provider.createIntent({
					amount: 1000,
					currency: "USD",
					metadata: validMeta,
				}),
			).rejects.toThrow("Square error: Not found");
		});
	});

	// ── confirmIntent ────────────────────────────────────────────────────

	describe("confirmIntent", () => {
		it("completes a payment", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_123",
					status: "COMPLETED",
					amount_money: { amount: 5000, currency: "USD" },
				},
			});

			const result = await provider.confirmIntent("sq_pay_123");
			expect(result.providerIntentId).toBe("sq_pay_123");
			expect(result.status).toBe("succeeded");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				"https://connect.squareup.com/v2/payments/sq_pay_123/complete",
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("calls correct URL with /complete suffix", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_xyz",
					status: "COMPLETED",
					amount_money: { amount: 7000, currency: "USD" },
				},
			});

			await provider.confirmIntent("sq_pay_xyz");
			const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0][0];
			expect(url).toBe(
				"https://connect.squareup.com/v2/payments/sq_pay_xyz/complete",
			);
		});
	});

	// ── cancelIntent ─────────────────────────────────────────────────────

	describe("cancelIntent", () => {
		it("cancels a payment", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_cancel",
					status: "CANCELED",
					amount_money: { amount: 3000, currency: "USD" },
				},
			});

			const result = await provider.cancelIntent("sq_pay_cancel");
			expect(result.status).toBe("cancelled");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				"https://connect.squareup.com/v2/payments/sq_pay_cancel/cancel",
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("calls correct URL with /cancel suffix", async () => {
			globalThis.fetch = mockFetchResponse({
				payment: {
					id: "sq_pay_abc",
					status: "CANCELED",
					amount_money: { amount: 4000, currency: "USD" },
				},
			});

			await provider.cancelIntent("sq_pay_abc");
			const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0][0];
			expect(url).toBe(
				"https://connect.squareup.com/v2/payments/sq_pay_abc/cancel",
			);
		});
	});

	// ── createRefund ─────────────────────────────────────────────────────

	describe("createRefund", () => {
		it("creates a refund", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_123",
					status: "COMPLETED",
					amount_money: { amount: 5000, currency: "USD" },
				},
			});

			const result = await provider.createRefund({
				providerIntentId: "sq_pay_123",
			});
			expect(result.providerRefundId).toBe("sq_ref_123");
			expect(result.status).toBe("succeeded");
		});

		it("sends amount when provided", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_partial",
					status: "PENDING",
					amount_money: { amount: 2000, currency: "USD" },
				},
			});

			await provider.createRefund({
				providerIntentId: "sq_pay_123",
				amount: 2000,
			});

			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.amount_money.amount).toBe(2000);
		});

		it("sends currency from params in refund amount_money", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_gbp",
					status: "PENDING",
					amount_money: { amount: 1500, currency: "GBP" },
				},
			});

			await provider.createRefund({
				providerIntentId: "sq_pay_gbp",
				amount: 1500,
				currency: "GBP",
			});

			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.amount_money.currency).toBe("GBP");
			expect(body.amount_money.amount).toBe(1500);
		});

		it("maps REJECTED status to failed", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_rej",
					status: "REJECTED",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});
			const result = await provider.createRefund({
				providerIntentId: "sq_pay_1",
			});
			expect(result.status).toBe("failed");
		});

		it("maps FAILED status to failed", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_fail",
					status: "FAILED",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});
			const result = await provider.createRefund({
				providerIntentId: "sq_pay_1",
			});
			expect(result.status).toBe("failed");
		});

		it("maps PENDING status to pending", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_pend",
					status: "PENDING",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});
			const result = await provider.createRefund({
				providerIntentId: "sq_pay_1",
			});
			expect(result.status).toBe("pending");
		});

		it("sends reason when provided", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_reason",
					status: "COMPLETED",
					amount_money: { amount: 1000, currency: "USD" },
				},
			});

			await provider.createRefund({
				providerIntentId: "sq_pay_1",
				reason: "Customer request",
			});

			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.reason).toBe("Customer request");
		});

		it("derives deterministic idempotency_key for full refund", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_idem",
					status: "COMPLETED",
					amount_money: { amount: 500, currency: "USD" },
				},
			});

			await provider.createRefund({ providerIntentId: "sq_pay_1" });

			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.idempotency_key).toBe("refund-sq_pay_1-full");
		});

		it("derives deterministic idempotency_key for partial refund", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_partial",
					status: "COMPLETED",
					amount_money: { amount: 300, currency: "USD" },
				},
			});

			await provider.createRefund({
				providerIntentId: "sq_pay_2",
				amount: 300,
				currency: "usd",
			});

			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.idempotency_key).toBe("refund-sq_pay_2-300-USD");
		});

		it("does not send amount_money when no amount specified", async () => {
			globalThis.fetch = mockFetchResponse({
				refund: {
					id: "sq_ref_noamt",
					status: "COMPLETED",
					amount_money: { amount: 5000, currency: "USD" },
				},
			});

			await provider.createRefund({ providerIntentId: "sq_pay_1" });

			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.amount_money).toBeUndefined();
			expect(body.payment_id).toBe("sq_pay_1");
		});
	});
});
