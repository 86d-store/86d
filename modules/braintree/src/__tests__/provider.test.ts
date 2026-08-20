import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BraintreePaymentProvider } from "../provider";

function mockFetchResponse(data: unknown, ok = true, status = 200) {
	return vi.fn().mockResolvedValue({
		ok,
		status,
		json: () => Promise.resolve(data),
	});
}

describe("BraintreePaymentProvider", () => {
	let provider: BraintreePaymentProvider;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		provider = new BraintreePaymentProvider(
			"merchant_123",
			"public_key",
			"private_key",
			true,
		);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// ── constructor ──────────────────────────────────────────────────────

	describe("constructor", () => {
		it("uses sandbox URL when sandbox=true", async () => {
			const sandboxProvider = new BraintreePaymentProvider(
				"merchant_123",
				"public_key",
				"private_key",
				true,
			);
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_sandbox_url",
					status: "authorized",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			await sandboxProvider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: { paymentMethodNonce: "nonce" },
			});
			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.stringContaining("api.sandbox.braintreegateway.com"),
				expect.anything(),
			);
		});

		it("uses production URL when sandbox=false", async () => {
			const prodProvider = new BraintreePaymentProvider(
				"merchant_123",
				"public_key",
				"private_key",
				false,
			);
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_prod_url",
					status: "authorized",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			await prodProvider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: { paymentMethodNonce: "nonce" },
			});
			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.stringContaining("api.braintreegateway.com"),
				expect.anything(),
			);
			expect(globalThis.fetch).not.toHaveBeenCalledWith(
				expect.stringContaining("sandbox"),
				expect.anything(),
			);
		});

		it("defaults to production URL when sandbox is omitted", async () => {
			const defaultProvider = new BraintreePaymentProvider(
				"merchant_123",
				"public_key",
				"private_key",
			);
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_default_url",
					status: "authorized",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			await defaultProvider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: { paymentMethodNonce: "nonce" },
			});
			expect(globalThis.fetch).not.toHaveBeenCalledWith(
				expect.stringContaining("sandbox"),
				expect.anything(),
			);
		});
	});

	// ── generateClientToken ──────────────────────────────────────────────

	describe("generateClientToken", () => {
		it("returns a client token from the Braintree API", async () => {
			globalThis.fetch = mockFetchResponse({
				clientToken: { value: "bt_client_token_123" },
			});

			const token = await provider.generateClientToken();
			expect(token).toBe("bt_client_token_123");
			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.stringContaining("/client_token"),
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("throws on Braintree API error", async () => {
			globalThis.fetch = mockFetchResponse(
				{ apiErrorResponse: { message: "Unauthorized" } },
				false,
				401,
			);

			await expect(provider.generateClientToken()).rejects.toThrow(
				"Braintree error: Unauthorized",
			);
		});
	});

	// ── createIntent ─────────────────────────────────────────────────────

	describe("createIntent", () => {
		const validMeta = { paymentMethodNonce: "test-nonce" };

		it("creates a transaction via Braintree API", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_txn_123",
					status: "authorized",
					amount: "50.00",
					currencyIsoCode: "USD",
				},
			});

			const result = await provider.createIntent({
				amount: 5000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.providerIntentId).toBe("bt_txn_123");
			expect(result.status).toBe("pending"); // authorized → pending
			expect(result.providerMetadata?.braintreeStatus).toBe("authorized");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				"https://api.sandbox.braintreegateway.com/merchants/merchant_123/transactions",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Braintree-Version": "2019-01-01",
					}),
				}),
			);
		});

		it("returns client token when paymentMethodNonce is missing", async () => {
			globalThis.fetch = mockFetchResponse({
				clientToken: { value: "bt_client_token_abc" },
			});

			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
			});
			expect(result.status).toBe("pending");
			expect(result.providerMetadata?.paymentType).toBe("braintree");
			expect(result.providerMetadata?.braintreeClientToken).toBe(
				"bt_client_token_abc",
			);
			expect(result.providerIntentId).toMatch(/^braintree_pending_/);
		});

		it("returns client token when metadata is provided without nonce", async () => {
			globalThis.fetch = mockFetchResponse({
				clientToken: { value: "bt_client_token_def" },
			});

			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: { someOtherField: "value" },
			});
			expect(result.status).toBe("pending");
			expect(result.providerMetadata?.paymentType).toBe("braintree");
			expect(result.providerMetadata?.braintreeClientToken).toBe(
				"bt_client_token_def",
			);
		});

		it("maps settled status to succeeded", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_settled",
					status: "settled",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("succeeded");
		});

		it("maps voided status to cancelled", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_void",
					status: "voided",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("cancelled");
		});

		it("maps submitted_for_settlement to processing", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_sfs",
					status: "submitted_for_settlement",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("processing");
		});

		it("maps settling to processing", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_settling",
					status: "settling",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("processing");
		});

		it("maps failed to failed", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_fail",
					status: "failed",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("failed");
		});

		it("maps processor_declined to failed", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_declined",
					status: "processor_declined",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("failed");
		});

		it("maps gateway_rejected to failed", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_rejected",
					status: "gateway_rejected",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("failed");
		});

		it("formats amount correctly (cents to dollars)", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_fmt",
					status: "authorized",
					amount: "12.50",
					currencyIsoCode: "USD",
				},
			});
			await provider.createIntent({
				amount: 1250,
				currency: "USD",
				metadata: validMeta,
			});
			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.transaction.amount).toBe("12.50");
		});

		it("uses paymentMethodNonce from metadata", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_nonce",
					status: "authorized",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: { paymentMethodNonce: "real-nonce-123" },
			});
			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.transaction.payment_method_nonce).toBe("real-nonce-123");
		});

		it("uses sandbox URL", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_sandbox",
					status: "authorized",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.stringContaining("sandbox.braintreegateway.com"),
				expect.anything(),
			);
		});

		it("throws on Braintree API error", async () => {
			globalThis.fetch = mockFetchResponse(
				{
					apiErrorResponse: {
						message: "Transaction failed",
						errors: {},
					},
				},
				false,
				422,
			);

			await expect(
				provider.createIntent({
					amount: 1000,
					currency: "USD",
					metadata: validMeta,
				}),
			).rejects.toThrow("Braintree error: Transaction failed");
		});

		it("maps settlement_declined to failed", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_sd",
					status: "settlement_declined",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("failed");
		});

		it("maps settlement_confirmed to processing", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_sc",
					status: "settlement_confirmed",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("processing");
		});

		it("maps settlement_pending to processing", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_sp",
					status: "settlement_pending",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			expect(result.status).toBe("processing");
		});

		it("includes Basic auth header in request", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_auth",
					status: "authorized",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			await provider.createIntent({
				amount: 1000,
				currency: "USD",
				metadata: validMeta,
			});
			const expectedAuth = `Basic ${btoa("public_key:private_key")}`;
			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: expectedAuth,
					}),
				}),
			);
		});

		it("throws with HTTP status when no apiErrorResponse message", async () => {
			globalThis.fetch = mockFetchResponse({}, false, 500);
			await expect(
				provider.createIntent({
					amount: 1000,
					currency: "USD",
					metadata: validMeta,
				}),
			).rejects.toThrow("Braintree error: HTTP 500");
		});
	});

	// ── confirmIntent ────────────────────────────────────────────────────

	describe("confirmIntent", () => {
		it("submits a transaction for settlement", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_txn_confirm",
					status: "submitted_for_settlement",
					amount: "50.00",
					currencyIsoCode: "USD",
				},
			});

			const result = await provider.confirmIntent("bt_txn_confirm");
			expect(result.providerIntentId).toBe("bt_txn_confirm");
			expect(result.status).toBe("processing");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.stringContaining(
					"/transactions/bt_txn_confirm/submit_for_settlement",
				),
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("maps settling to processing", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_confirm_settling",
					status: "settling",
					amount: "25.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.confirmIntent("bt_confirm_settling");
			expect(result.status).toBe("processing");
		});

		it("maps settled to succeeded", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_confirm_settled",
					status: "settled",
					amount: "25.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.confirmIntent("bt_confirm_settled");
			expect(result.status).toBe("succeeded");
		});

		it("includes braintreeStatus in providerMetadata", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_confirm_meta",
					status: "submitted_for_settlement",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.confirmIntent("bt_confirm_meta");
			expect(result.providerMetadata?.braintreeStatus).toBe(
				"submitted_for_settlement",
			);
		});
	});

	// ── cancelIntent ─────────────────────────────────────────────────────

	describe("cancelIntent", () => {
		it("voids a transaction", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_txn_void",
					status: "voided",
					amount: "50.00",
					currencyIsoCode: "USD",
				},
			});

			const result = await provider.cancelIntent("bt_txn_void");
			expect(result.status).toBe("cancelled");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.stringContaining("/transactions/bt_txn_void/void"),
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("maps voided status to cancelled explicitly", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_cancel_voided",
					status: "voided",
					amount: "30.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.cancelIntent("bt_cancel_voided");
			expect(result.status).toBe("cancelled");
			expect(result.providerMetadata?.braintreeStatus).toBe("voided");
		});

		it("calls void endpoint with correct path", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_cancel_path",
					status: "voided",
					amount: "15.00",
					currencyIsoCode: "USD",
				},
			});
			await provider.cancelIntent("bt_cancel_path");
			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.stringContaining("/transactions/bt_cancel_path/void"),
				expect.anything(),
			);
		});
	});

	// ── createRefund ─────────────────────────────────────────────────────

	describe("createRefund", () => {
		it("creates a full refund", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_ref_123",
					status: "settled",
					amount: "50.00",
					currencyIsoCode: "USD",
				},
			});

			const result = await provider.createRefund({
				providerIntentId: "bt_txn_123",
			});
			expect(result.providerRefundId).toBe("bt_ref_123");
			expect(result.status).toBe("succeeded");

			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.stringContaining("/transactions/bt_txn_123/refunds"),
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("creates a partial refund with amount", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_ref_partial",
					status: "settling",
					amount: "20.00",
					currencyIsoCode: "USD",
				},
			});

			await provider.createRefund({
				providerIntentId: "bt_txn_123",
				amount: 2000,
			});

			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.refund.amount).toBe("20.00");
		});

		it("maps failed refund status", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_ref_fail",
					status: "failed",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createRefund({
				providerIntentId: "bt_txn_1",
			});
			expect(result.status).toBe("failed");
		});

		it("maps processor_declined refund to failed", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_ref_declined",
					status: "processor_declined",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createRefund({
				providerIntentId: "bt_txn_1",
			});
			expect(result.status).toBe("failed");
		});

		it("maps settlement_pending to pending", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_ref_pend",
					status: "settlement_pending",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createRefund({
				providerIntentId: "bt_txn_1",
			});
			expect(result.status).toBe("pending");
		});

		it("maps settling to succeeded for refund", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_ref_settling",
					status: "settling",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createRefund({
				providerIntentId: "bt_txn_settling",
			});
			expect(result.status).toBe("succeeded");
		});

		it("sends refund without amount when not provided (full refund)", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_ref_full",
					status: "settled",
					amount: "50.00",
					currencyIsoCode: "USD",
				},
			});
			await provider.createRefund({
				providerIntentId: "bt_txn_full",
			});
			const body = JSON.parse(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
			);
			expect(body.refund).toEqual({});
			expect(body.refund.amount).toBeUndefined();
		});

		it("includes braintreeStatus in refund providerMetadata", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_ref_meta",
					status: "settled",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createRefund({
				providerIntentId: "bt_txn_meta",
			});
			expect(result.providerMetadata?.braintreeStatus).toBe("settled");
		});

		it("maps authorized status to pending for refund", async () => {
			globalThis.fetch = mockFetchResponse({
				transaction: {
					id: "bt_ref_auth",
					status: "authorized",
					amount: "10.00",
					currencyIsoCode: "USD",
				},
			});
			const result = await provider.createRefund({
				providerIntentId: "bt_txn_auth",
			});
			expect(result.status).toBe("pending");
		});
	});
});
