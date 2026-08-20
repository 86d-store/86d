import type { PaymentProviderOperationRequest } from "@86d-app/core/payment-connection-provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createStripePaymentConnectionProvider as createProvider,
	type StripePaymentConnectionProviderOptions,
} from "../connection-provider";

function createStripePaymentConnectionProvider(
	options: Omit<StripePaymentConnectionProviderOptions, "providerAccountId"> & {
		providerAccountId?: string;
	},
) {
	const { providerAccountId = "acct_primary", ...connectionOptions } = options;
	return createProvider({ ...connectionOptions, providerAccountId });
}

function response(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

const authorizationRequest = {
	operationId: "payop_authorize_1",
	connectionId: "connection_stripe_primary",
	idempotencyKey: "authorization:payop_authorize_1",
	requestDigest: "a".repeat(64),
	attempt: 1,
	createdAt: new Date("2026-08-13T00:00:00.000Z"),
	payload: {
		operation: "authorization",
		amount: 12_345,
		currency: "EUR",
		metadata: { paymentMethodId: "pm_card_visa" },
	},
} as const satisfies PaymentProviderOperationRequest;

describe("StripePaymentConnectionProvider", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("freezes the verified Stripe account identity at adapter binding", () => {
		const provider = createStripePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			providerAccountId: "acct_verified_primary",
			apiKey: "sk_test_secret",
			mode: "test",
		});

		expect(provider.providerAccountId).toBe("acct_verified_primary");
		expect(() =>
			createStripePaymentConnectionProvider({
				connectionId: authorizationRequest.connectionId,
				providerAccountId: " ",
				apiKey: "sk_test_secret",
				mode: "test",
			}),
		).toThrow("Stripe provider account ID is required");
	});

	it.each([
		{ apiKey: "sk_live_secret", mode: "test" as const },
		{ apiKey: "rk_test_secret", mode: "live" as const },
	])(
		"rejects a $apiKey connection configured for $mode mode before any provider call",
		({ apiKey, mode }) => {
			const fetchMock = vi.fn();
			globalThis.fetch = fetchMock;

			expect(() =>
				createStripePaymentConnectionProvider({
					connectionId: authorizationRequest.connectionId,
					apiKey,
					mode,
				}),
			).toThrow("Stripe API key mode does not match Payment Connection mode");
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);

	it("binds a durable authorization envelope to a manual-capture PaymentIntent", async () => {
		const fetchMock = vi.fn().mockImplementation(() =>
			Promise.resolve(
				response({
					id: "pi_authorized",
					object: "payment_intent",
					amount: 12_345,
					amount_capturable: 12_345,
					amount_received: 0,
					currency: "eur",
					status: "requires_capture",
					client_secret: "must_not_escape",
					metadata: {
						"86d_operation_id": authorizationRequest.operationId,
						"86d_request_digest": authorizationRequest.requestDigest,
					},
				}),
			),
		);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.execute(authorizationRequest);
		const retryOutcome = await provider.execute(authorizationRequest);

		expect(outcome).toEqual({
			state: "succeeded",
			providerReference: "pi_authorized",
			result: {
				kind: "payment_intent",
				providerStatus: "requires_capture",
				amount: 12_345,
				amountCapturable: 12_345,
				amountReceived: 0,
				currency: "EUR",
			},
		});
		expect(retryOutcome).toEqual(outcome);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.stripe.com/v1/payment_intents");
		expect(init.headers).toMatchObject({
			Authorization: "Bearer sk_test_secret",
			"Idempotency-Key": authorizationRequest.idempotencyKey,
			"Stripe-Version": "2026-02-25.clover",
		});
		expect(init.body).toBe(
			new URLSearchParams({
				amount: "12345",
				currency: "eur",
				capture_method: "manual",
				confirm: "true",
				payment_method: "pm_card_visa",
				"metadata[86d_operation_id]": authorizationRequest.operationId,
				"metadata[86d_request_digest]": authorizationRequest.requestDigest,
			}).toString(),
		);
		expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
		expect(JSON.stringify(outcome)).not.toContain("must_not_escape");
	});

	it("reports Stripe shopper authentication as requires_action, not ambiguity", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			response({
				id: "pi_requires_action",
				object: "payment_intent",
				amount: 12_345,
				amount_capturable: 0,
				amount_received: 0,
				currency: "eur",
				status: "requires_action",
				client_secret: "must_not_escape",
				metadata: {
					"86d_operation_id": authorizationRequest.operationId,
					"86d_request_digest": authorizationRequest.requestDigest,
				},
			}),
		);
		const provider = createStripePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		expect(await provider.execute(authorizationRequest)).toEqual({
			state: "requires_action",
			providerReference: "pi_requires_action",
			result: {
				kind: "payment_intent",
				providerStatus: "requires_action",
				amount: 12_345,
				amountCapturable: 0,
				amountReceived: 0,
				currency: "EUR",
			},
		});
	});

	it("creates an intent with manual capture without asserting shopper success", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_intent_1",
			idempotencyKey: "intent:payop_intent_1",
			payload: { operation: "intent", amount: 2_500, currency: "USD" },
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				id: "pi_requires_payment_method",
				object: "payment_intent",
				amount: 2_500,
				amount_capturable: 0,
				amount_received: 0,
				currency: "usd",
				status: "requires_payment_method",
				metadata: {},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.execute(request);

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "pi_requires_payment_method",
			result: {
				kind: "payment_intent",
				providerStatus: "requires_payment_method",
				currency: "USD",
			},
		});
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		expect(init.body).toContain("capture_method=manual");
		expect(init.body).not.toContain("confirm=true");
	});

	it("authorizes an existing intent without replacing its provider reference", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_authorize_existing",
			idempotencyKey: "authorization:payop_authorize_existing",
			payload: {
				...authorizationRequest.payload,
				providerPaymentReference: "pi_prepared_exact",
			},
			source: {
				operationId: "payop_intent_prepared_exact",
				operation: "intent",
				providerReference: "pi_prepared_exact",
				amount: 12_345,
				currency: "EUR",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				id: "pi_prepared_exact",
				object: "payment_intent",
				amount: 12_345,
				amount_capturable: 12_345,
				amount_received: 0,
				currency: "eur",
				status: "requires_capture",
				metadata: {},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.execute(request);

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "pi_prepared_exact",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.stripe.com/v1/payment_intents/pi_prepared_exact/confirm",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"Idempotency-Key": request.idempotencyKey,
				}),
			}),
		);
	});

	it("rejects an operation envelope bound to another connection", async () => {
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.execute({
			...authorizationRequest,
			connectionId: "connection_stripe_other",
		});

		expect(outcome).toEqual({
			state: "failed",
			result: { reason: "connection_mismatch" },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([
		{
			operation: "referenced authorization",
			payload: {
				operation: "authorization" as const,
				amount: 1_000,
				currency: "USD",
				providerPaymentReference: "pi_intent_source",
				metadata: { paymentMethodId: "pm_card_visa" },
			},
		},
		{
			operation: "capture",
			payload: {
				operation: "capture" as const,
				amount: 1_000,
				currency: "USD",
				providerPaymentReference: "pi_authorization_source",
			},
		},
		{
			operation: "refund",
			payload: {
				operation: "refund" as const,
				amount: 500,
				currency: "USD",
				providerPaymentReference: "pi_capture_source",
			},
		},
		{
			operation: "void",
			payload: {
				operation: "void" as const,
				providerPaymentReference: "pi_authorization_source",
			},
		},
	])(
		"requires durable source provenance for $operation",
		async ({ payload }) => {
			const fetchMock = vi.fn();
			globalThis.fetch = fetchMock;
			const provider = createStripePaymentConnectionProvider({
				connectionId: authorizationRequest.connectionId,
				apiKey: "sk_test_secret",
				mode: "test",
			});

			const outcome = await provider.execute({
				...authorizationRequest,
				operationId: `payop_missing_source_${payload.operation}`,
				idempotencyKey: `missing-source:${payload.operation}`,
				payload,
			});

			expect(outcome).toEqual({
				state: "failed",
				result: { reason: "source_provenance_required" },
			});
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);

	it("rejects partial final capture before calling Stripe", async () => {
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});
		const request = {
			...authorizationRequest,
			operationId: "payop_partial_final_capture_rejected",
			idempotencyKey: "capture:payop_partial_final_capture_rejected",
			payload: {
				operation: "capture",
				amount: 4_000,
				currency: "USD",
				providerPaymentReference: "pi_full_authorization",
			},
			source: {
				operationId: "payop_full_authorization",
				operation: "authorization",
				providerReference: "pi_full_authorization",
				amount: 5_000,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;

		const outcome = await provider.execute(request);

		expect(outcome).toEqual({
			state: "failed",
			result: { reason: "single_final_capture_required" },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects mismatched source provenance during reconciliation without a provider read", async () => {
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});
		const request = {
			...authorizationRequest,
			operationId: "payop_capture_bad_reconciliation_source",
			payload: {
				operation: "capture",
				amount: 5_000,
				currency: "USD",
				providerPaymentReference: "pi_expected_source",
			},
			source: {
				operationId: "payop_unrelated_authorization",
				operation: "authorization",
				providerReference: "pi_other_source",
				amount: 5_000,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;

		const outcome = await provider.reconcile({
			...request,
			operation: request.payload.operation,
		});

		expect(outcome).toEqual({
			state: "failed",
			result: { reason: "source_provenance_mismatch" },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("captures only the exact authorized PaymentIntent", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_capture_1",
			idempotencyKey: "capture:payop_capture_1",
			payload: {
				operation: "capture",
				amount: 5_000,
				currency: "USD",
				providerPaymentReference: "pi_exact_source",
			},
			source: {
				operationId: "payop_authorization_exact_source",
				operation: "authorization",
				providerReference: "pi_exact_source",
				amount: 5_000,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				id: "pi_exact_source",
				object: "payment_intent",
				amount: 5_000,
				amount_capturable: 0,
				amount_received: 5_000,
				currency: "usd",
				status: "succeeded",
				metadata: {},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.execute(request);

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "pi_exact_source",
			result: {
				kind: "payment_intent",
				providerStatus: "succeeded",
				requestedAmount: 5_000,
				currency: "USD",
			},
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.stripe.com/v1/payment_intents/pi_exact_source/capture",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"Idempotency-Key": request.idempotencyKey,
				}),
				body: new URLSearchParams({
					amount_to_capture: "5000",
					final_capture: "true",
					"metadata[86d_operation_id]": request.operationId,
					"metadata[86d_request_digest]": request.requestDigest,
				}).toString(),
			}),
		);
	});

	it("voids only the exact uncaptured PaymentIntent", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_void_1",
			idempotencyKey: "void:payop_void_1",
			payload: {
				operation: "void",
				providerPaymentReference: "pi_authorization_to_void",
			},
			source: {
				operationId: "payop_authorization_to_void",
				operation: "authorization",
				providerReference: "pi_authorization_to_void",
				amount: 5_000,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				id: "pi_authorization_to_void",
				object: "payment_intent",
				amount: 5_000,
				amount_capturable: 0,
				amount_received: 0,
				currency: "usd",
				status: "canceled",
				metadata: {},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.execute(request);

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "pi_authorization_to_void",
			result: { kind: "payment_intent", providerStatus: "canceled" },
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.stripe.com/v1/payment_intents/pi_authorization_to_void/cancel",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"Idempotency-Key": request.idempotencyKey,
				}),
			}),
		);
	});

	it("keeps equal partial refunds distinct by durable operation identity", async () => {
		const baseRefund = {
			...authorizationRequest,
			payload: {
				operation: "refund",
				amount: 1_250,
				currency: "EUR",
				providerPaymentReference: "pi_captured_source",
			},
			source: {
				operationId: "payop_capture_for_equal_refunds",
				operation: "capture",
				providerReference: "pi_captured_source",
				amount: 5_000,
				currency: "EUR",
			},
		} as const;
		const firstRequest = {
			...baseRefund,
			operationId: "payop_refund_equal_a",
			idempotencyKey: "refund:payop_refund_equal_a",
		} as const satisfies PaymentProviderOperationRequest;
		const secondRequest = {
			...baseRefund,
			operationId: "payop_refund_equal_b",
			idempotencyKey: "refund:payop_refund_equal_b",
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				response({
					id: "re_equal_a",
					object: "refund",
					amount: 1_250,
					currency: "eur",
					payment_intent: "pi_captured_source",
					status: "succeeded",
					metadata: { "86d_operation_id": firstRequest.operationId },
				}),
			)
			.mockResolvedValueOnce(
				response({
					id: "re_equal_b",
					object: "refund",
					amount: 1_250,
					currency: "eur",
					payment_intent: "pi_captured_source",
					status: "succeeded",
					metadata: { "86d_operation_id": secondRequest.operationId },
				}),
			);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: firstRequest.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const [first, second] = await Promise.all([
			provider.execute(firstRequest),
			provider.execute(secondRequest),
		]);

		expect(first).toMatchObject({
			state: "succeeded",
			providerReference: "re_equal_a",
			result: { kind: "refund", sourceProviderReference: "pi_captured_source" },
		});
		expect(second).toMatchObject({
			state: "succeeded",
			providerReference: "re_equal_b",
			result: { kind: "refund", sourceProviderReference: "pi_captured_source" },
		});
		const calls = fetchMock.mock.calls as [string, RequestInit][];
		expect(calls.map(([, init]) => init.headers)).toEqual([
			expect.objectContaining({
				"Idempotency-Key": firstRequest.idempotencyKey,
			}),
			expect.objectContaining({
				"Idempotency-Key": secondRequest.idempotencyKey,
			}),
		]);
		expect(calls[0]?.[1].body).toContain(
			`metadata%5B86d_operation_id%5D=${firstRequest.operationId}`,
		);
		expect(calls[1]?.[1].body).toContain(
			`metadata%5B86d_operation_id%5D=${secondRequest.operationId}`,
		);
	});

	it("never normalizes a dispute-shaped object as a refund", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_refund_not_dispute",
			idempotencyKey: "refund:payop_refund_not_dispute",
			payload: {
				operation: "refund",
				amount: 2_000,
				currency: "USD",
				providerPaymentReference: "pi_disputed_source",
			},
			source: {
				operationId: "payop_capture_disputed_source",
				operation: "capture",
				providerReference: "pi_disputed_source",
				amount: 2_000,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		globalThis.fetch = vi.fn().mockResolvedValue(
			response({
				id: "dp_not_a_refund",
				object: "dispute",
				amount: 2_000,
				currency: "usd",
				payment_intent: "pi_disputed_source",
				status: "succeeded",
				metadata: {},
			}),
		);
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.execute(request);

		expect(outcome).toEqual({
			state: "ambiguous",
			result: { reason: "provider_response_mismatch" },
		});
	});

	it("retains an exact refund reference when returned money conflicts", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_refund_conflicting_money",
			payload: {
				operation: "refund",
				amount: 1_000,
				currency: "USD",
				providerPaymentReference: "pi_refund_conflicting_money",
			},
			source: {
				operationId: "payop_capture_refund_conflicting_money",
				operation: "capture",
				providerReference: "pi_refund_conflicting_money",
				amount: 2_000,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		globalThis.fetch = vi.fn().mockResolvedValue(
			response({
				id: "re_conflicting_money",
				object: "refund",
				amount: 900,
				currency: "usd",
				payment_intent: "pi_refund_conflicting_money",
				status: "succeeded",
				metadata: {},
			}),
		);
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.execute(request);

		expect(outcome).toEqual({
			state: "ambiguous",
			providerReference: "re_conflicting_money",
			result: { reason: "provider_response_mismatch" },
		});
	});

	it("keeps a timeout ambiguous until an exact read-only reconciliation", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_timeout_intent",
			idempotencyKey: "intent:payop_timeout_intent",
			payload: { operation: "intent", amount: 8_800, currency: "CAD" },
		} as const satisfies PaymentProviderOperationRequest;
		const canonicalIntent = {
			id: "pi_created_before_timeout",
			object: "payment_intent",
			amount: 8_800,
			amount_capturable: 0,
			amount_received: 0,
			currency: "cad",
			status: "requires_payment_method",
			metadata: {
				"86d_operation_id": request.operationId,
				"86d_request_digest": request.requestDigest,
			},
		};
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("socket closed"))
			.mockResolvedValueOnce(
				response({
					object: "search_result",
					data: [canonicalIntent],
					has_more: false,
				}),
			);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const initial = await provider.execute(request);
		const reconciled = await provider.reconcile({
			...request,
			operation: request.payload.operation,
		});

		expect(initial).toEqual({
			state: "ambiguous",
			result: { reason: "provider_request_unknown" },
		});
		expect(reconciled).toMatchObject({
			state: "succeeded",
			providerReference: "pi_created_before_timeout",
		});
		const [reconcileUrl, reconcileInit] = fetchMock.mock.calls[1] as [
			string,
			RequestInit,
		];
		expect(reconcileUrl).toContain("/payment_intents/search?");
		expect(decodeURIComponent(reconcileUrl)).toContain(request.operationId);
		expect(reconcileInit.method).toBe("GET");
		expect(reconcileInit.headers).toMatchObject({
			"Stripe-Version": "2026-02-25.clover",
		});
		expect(reconcileInit.body).toBeUndefined();
	});

	it("treats timeout, conflict, and throttling HTTP responses as ambiguous", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response({ error: { code: "timeout" } }, 408))
			.mockResolvedValueOnce(
				response({ error: { code: "idempotency_key_in_use" } }, 409),
			)
			.mockResolvedValueOnce(response({ error: { code: "rate_limit" } }, 429));
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcomes = await Promise.all([
			provider.execute(authorizationRequest),
			provider.execute(authorizationRequest),
			provider.execute(authorizationRequest),
		]);

		expect(outcomes).toEqual([
			{ state: "ambiguous", result: { reason: "provider_request_unknown" } },
			{ state: "ambiguous", result: { reason: "provider_request_unknown" } },
			{ state: "ambiguous", result: { reason: "provider_request_unknown" } },
		]);
	});

	it("reconciles equal refunds by operation metadata instead of amount", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_refund_reconcile_exact",
			idempotencyKey: "refund:payop_refund_reconcile_exact",
			payload: {
				operation: "refund",
				amount: 900,
				currency: "USD",
				providerPaymentReference: "pi_refund_source",
			},
			source: {
				operationId: "payop_capture_refund_source",
				operation: "capture",
				providerReference: "pi_refund_source",
				amount: 6_000,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const otherEqualRefund = {
			id: "re_other_equal_amount",
			object: "refund",
			amount: 900,
			currency: "usd",
			payment_intent: "pi_refund_source",
			status: "succeeded",
			metadata: { "86d_operation_id": "payop_some_other_refund" },
		};
		const exactRefund = {
			...otherEqualRefund,
			id: "re_exact_operation",
			metadata: {
				"86d_operation_id": request.operationId,
				"86d_request_digest": request.requestDigest,
			},
		};
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				object: "list",
				data: [otherEqualRefund, exactRefund],
				has_more: false,
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.reconcile({
			...request,
			operation: request.payload.operation,
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "re_exact_operation",
		});
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(
			"https://api.stripe.com/v1/refunds?payment_intent=pi_refund_source&limit=100",
		);
		expect(init.method).toBe("GET");
	});

	it("reconciles capture from the exact source PaymentIntent", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_capture_reconcile",
			idempotencyKey: "capture:payop_capture_reconcile",
			payload: {
				operation: "capture",
				amount: 3_000,
				currency: "GBP",
				providerPaymentReference: "pi_capture_reconcile_source",
			},
			source: {
				operationId: "payop_authorization_capture_reconcile",
				operation: "authorization",
				providerReference: "pi_capture_reconcile_source",
				amount: 3_000,
				currency: "GBP",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				id: "pi_capture_reconcile_source",
				object: "payment_intent",
				amount: 3_000,
				amount_capturable: 0,
				amount_received: 3_000,
				currency: "gbp",
				status: "succeeded",
				metadata: {
					"86d_operation_id": request.operationId,
					"86d_request_digest": request.requestDigest,
				},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.reconcile({
			...request,
			operation: request.payload.operation,
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "pi_capture_reconcile_source",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.stripe.com/v1/payment_intents/pi_capture_reconcile_source",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("reconciles authorization only from its exact prepared intent", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_authorization_reconcile",
			idempotencyKey: "authorization:payop_authorization_reconcile",
			payload: {
				...authorizationRequest.payload,
				providerPaymentReference: "pi_prepared_for_reconcile",
			},
			source: {
				operationId: "payop_intent_prepared_for_reconcile",
				operation: "intent",
				providerReference: "pi_prepared_for_reconcile",
				amount: 12_345,
				currency: "EUR",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				id: "pi_prepared_for_reconcile",
				object: "payment_intent",
				amount: 12_345,
				amount_capturable: 12_345,
				amount_received: 0,
				currency: "eur",
				status: "requires_capture",
				metadata: {},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.reconcile({
			...request,
			operation: request.payload.operation,
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "pi_prepared_for_reconcile",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.stripe.com/v1/payment_intents/pi_prepared_for_reconcile",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("reconciles a void only from the exact source intent", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_void_reconcile",
			idempotencyKey: "void:payop_void_reconcile",
			payload: {
				operation: "void",
				providerPaymentReference: "pi_void_reconcile_source",
			},
			source: {
				operationId: "payop_authorization_void_reconcile",
				operation: "authorization",
				providerReference: "pi_void_reconcile_source",
				amount: 7_500,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				id: "pi_void_reconcile_source",
				object: "payment_intent",
				amount: 7_500,
				amount_capturable: 0,
				amount_received: 0,
				currency: "usd",
				status: "canceled",
				metadata: {},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createStripePaymentConnectionProvider({
			connectionId: request.connectionId,
			apiKey: "sk_test_secret",
			mode: "test",
		});

		const outcome = await provider.reconcile({
			...request,
			operation: request.payload.operation,
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "pi_void_reconcile_source",
			result: { providerStatus: "canceled" },
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.stripe.com/v1/payment_intents/pi_void_reconcile_source",
			expect.objectContaining({ method: "GET" }),
		);
	});
});
