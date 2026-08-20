import type { PaymentProviderOperationRequest } from "@86d-app/core/payment-connection-provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type BraintreePaymentConnectionProviderOptions,
	createBraintreePaymentConnectionProvider as createProvider,
} from "../connection-provider";

function createBraintreePaymentConnectionProvider(
	options: Omit<
		BraintreePaymentConnectionProviderOptions,
		"providerAccountId"
	> & {
		providerAccountId?: string;
	},
) {
	const { providerAccountId = "merchant_primary", ...connectionOptions } =
		options;
	return createProvider({ ...connectionOptions, providerAccountId });
}

function response(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

const authorizationRequest = {
	operationId: "payop_braintree_authorize_1",
	connectionId: "connection_braintree_primary",
	idempotencyKey: "authorization:payop_braintree_authorize_1",
	requestDigest: "b".repeat(64),
	attempt: 1,
	createdAt: new Date("2026-08-13T00:00:00.000Z"),
	payload: {
		operation: "authorization",
		amount: 12_345,
		currency: "EUR",
		metadata: { paymentMethodId: "payment_method_single_use" },
	},
} as const satisfies PaymentProviderOperationRequest;

describe("BraintreePaymentConnectionProvider", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("freezes the verified Braintree merchant identity at adapter binding", () => {
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			providerAccountId: "merchant_verified_primary",
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { EUR: "merchant_account_eur" },
		});

		expect(provider.providerAccountId).toBe("merchant_verified_primary");
		expect(() =>
			createBraintreePaymentConnectionProvider({
				connectionId: authorizationRequest.connectionId,
				providerAccountId: " ",
				publicKey: "public_key",
				privateKey: "private_key",
				mode: "test",
				merchantAccountIds: { EUR: "merchant_account_eur" },
			}),
		).toThrow("Braintree provider account ID is required");
	});

	it("forwards the same durable authorization envelope to Braintree GraphQL", async () => {
		const fetchMock = vi.fn().mockImplementation(() =>
			Promise.resolve(
				response({
					data: {
						authorizePaymentMethod: {
							clientMutationId: authorizationRequest.operationId,
							transaction: {
								id: "bt_graphql_transaction_1",
								legacyId: "legacy_transaction_1",
								status: "AUTHORIZED",
								orderId: authorizationRequest.operationId,
								amount: { value: "123.45", currencyIsoCode: "EUR" },
							},
						},
					},
				}),
			),
		);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { EUR: "merchant_account_eur" },
		});

		const first = await provider.execute(authorizationRequest);
		const retry = await provider.execute(authorizationRequest);

		expect(first).toEqual({
			state: "succeeded",
			providerReference: "bt_graphql_transaction_1",
			result: {
				kind: "transaction",
				providerStatus: "AUTHORIZED",
				amount: 12_345,
				currency: "EUR",
				legacyProviderReference: "legacy_transaction_1",
			},
		});
		expect(retry).toEqual(first);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://payments.sandbox.braintree-api.com/graphql");
		expect(init.headers).toMatchObject({
			Authorization: `Basic ${btoa("public_key:private_key")}`,
			"Braintree-Version": "2019-01-01",
			"Content-Type": "application/json",
		});
		const body = JSON.parse(String(init.body)) as {
			query: string;
			variables: { input: Record<string, unknown> };
		};
		expect(body.query).toContain("authorizePaymentMethod");
		expect(body.variables.input).toEqual({
			apiRequestKey: authorizationRequest.idempotencyKey,
			clientMutationId: authorizationRequest.operationId,
			paymentMethodId: "payment_method_single_use",
			transaction: {
				amount: "123.45",
				merchantAccountId: "merchant_account_eur",
				orderId: authorizationRequest.operationId,
			},
		});
		expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
	});

	it("reports a known Braintree authorization in progress as pending", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			response({
				data: {
					authorizePaymentMethod: {
						clientMutationId: authorizationRequest.operationId,
						transaction: {
							id: "bt_authorizing",
							status: "AUTHORIZING",
							orderId: authorizationRequest.operationId,
							amount: { value: "123.45", currencyIsoCode: "EUR" },
						},
					},
				},
			}),
		);
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { EUR: "merchant_account_eur" },
		});

		expect(await provider.execute(authorizationRequest)).toMatchObject({
			state: "pending",
			providerReference: "bt_authorizing",
			result: { providerStatus: "AUTHORIZING" },
		});
	});

	it("retains an exact authorization reference when returned money conflicts", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			response({
				data: {
					authorizePaymentMethod: {
						clientMutationId: authorizationRequest.operationId,
						transaction: {
							id: "bt_authorization_conflicting_money",
							status: "AUTHORIZED",
							orderId: authorizationRequest.operationId,
							amount: { value: "120.00", currencyIsoCode: "EUR" },
						},
					},
				},
			}),
		);
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { EUR: "merchant_account_eur" },
		});

		const outcome = await provider.execute(authorizationRequest);

		expect(outcome).toEqual({
			state: "ambiguous",
			providerReference: "bt_authorization_conflicting_money",
			result: { reason: "provider_response_mismatch" },
		});
	});

	it("uses the configured merchant account and ISO exponent for a JPY authorization", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_authorization_jpy",
			idempotencyKey: "authorization:payop_braintree_authorization_jpy",
			payload: {
				operation: "authorization",
				amount: 1_200,
				currency: "JPY",
				metadata: { paymentMethodId: "payment_method_jpy" },
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				data: {
					authorizePaymentMethod: {
						clientMutationId: request.operationId,
						transaction: {
							id: "bt_jpy_transaction",
							status: "AUTHORIZED",
							orderId: request.operationId,
							amount: { value: "1200", currencyIsoCode: "JPY" },
						},
					},
				},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: request.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { JPY: "merchant_account_jpy" },
		});

		const outcome = await provider.execute(request);

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "bt_jpy_transaction",
			result: { amount: 1_200, currency: "JPY" },
		});
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const body = JSON.parse(String(init.body)) as {
			variables: { input: { transaction: Record<string, unknown> } };
		};
		expect(body.variables.input.transaction).toEqual({
			amount: "1200",
			merchantAccountId: "merchant_account_jpy",
			orderId: request.operationId,
		});
	});

	it.each(["ISK", "LAK"] as const)(
		"uses the zero-decimal exponent for a %s authorization",
		async (currency) => {
			const request = {
				...authorizationRequest,
				operationId: `payop_braintree_authorization_${currency.toLowerCase()}`,
				idempotencyKey: `authorization:payop_braintree_authorization_${currency.toLowerCase()}`,
				payload: {
					operation: "authorization",
					amount: 1_200,
					currency,
					metadata: {
						paymentMethodId: `payment_method_${currency.toLowerCase()}`,
					},
				},
			} as const satisfies PaymentProviderOperationRequest;
			const fetchMock = vi.fn().mockResolvedValue(
				response({
					data: {
						authorizePaymentMethod: {
							clientMutationId: request.operationId,
							transaction: {
								id: `bt_${currency.toLowerCase()}_transaction`,
								status: "AUTHORIZED",
								orderId: request.operationId,
								amount: { value: "1200", currencyIsoCode: currency },
							},
						},
					},
				}),
			);
			globalThis.fetch = fetchMock;
			const provider = createBraintreePaymentConnectionProvider({
				connectionId: request.connectionId,
				publicKey: "public_key",
				privateKey: "private_key",
				mode: "test",
				merchantAccountIds: {
					[currency]: `merchant_account_${currency.toLowerCase()}`,
				},
			});

			const outcome = await provider.execute(request);

			expect(outcome).toMatchObject({
				state: "succeeded",
				result: { amount: 1_200, currency },
			});
			const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
			const body = JSON.parse(String(init.body)) as {
				variables: { input: { transaction: Record<string, unknown> } };
			};
			expect(body.variables.input.transaction).toMatchObject({
				amount: "1200",
				merchantAccountId: `merchant_account_${currency.toLowerCase()}`,
			});
		},
	);

	it("keeps MGA at its supported two-decimal exponent", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_authorization_mga",
			idempotencyKey: "authorization:payop_braintree_authorization_mga",
			payload: {
				operation: "authorization",
				amount: 1_200,
				currency: "MGA",
				metadata: { paymentMethodId: "payment_method_mga" },
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				data: {
					authorizePaymentMethod: {
						clientMutationId: request.operationId,
						transaction: {
							id: "bt_mga_transaction",
							status: "AUTHORIZED",
							orderId: request.operationId,
							amount: { value: "12.00", currencyIsoCode: "MGA" },
						},
					},
				},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: request.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { MGA: "merchant_account_mga" },
		});

		const outcome = await provider.execute(request);

		expect(outcome).toMatchObject({ state: "succeeded" });
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const body = JSON.parse(String(init.body)) as {
			variables: { input: { transaction: Record<string, unknown> } };
		};
		expect(body.variables.input.transaction).toMatchObject({ amount: "12.00" });
	});

	it("does not turn an intent into an unrecorded financial authorization", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_unsupported_intent",
			idempotencyKey: "intent:payop_braintree_unsupported_intent",
			payload: {
				operation: "intent",
				amount: 5_000,
				currency: "USD",
				metadata: { paymentMethodId: "must_not_be_authorized" },
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: request.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { USD: "merchant_account_usd" },
		});

		const outcome = await provider.execute(request);

		expect(provider.capabilities).not.toContain("intent");
		expect(outcome).toEqual({
			state: "failed",
			result: { reason: "intent_not_supported" },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects an operation envelope bound to another connection", async () => {
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { EUR: "merchant_account_eur" },
		});

		const outcome = await provider.execute({
			...authorizationRequest,
			connectionId: "connection_braintree_other",
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
				providerPaymentReference: "bt_intent_source",
				metadata: { paymentMethodId: "payment_method_single_use" },
			},
		},
		{
			operation: "capture",
			payload: {
				operation: "capture" as const,
				amount: 1_000,
				currency: "USD",
				providerPaymentReference: "bt_authorization_source",
			},
		},
		{
			operation: "refund",
			payload: {
				operation: "refund" as const,
				amount: 500,
				currency: "USD",
				providerPaymentReference: "bt_capture_source",
			},
		},
		{
			operation: "void",
			payload: {
				operation: "void" as const,
				providerPaymentReference: "bt_authorization_source",
			},
		},
	])(
		"requires durable source provenance for $operation",
		async ({ payload }) => {
			const fetchMock = vi.fn();
			globalThis.fetch = fetchMock;
			const provider = createBraintreePaymentConnectionProvider({
				connectionId: authorizationRequest.connectionId,
				publicKey: "public_key",
				privateKey: "private_key",
				mode: "test",
				merchantAccountIds: { USD: "merchant_account_usd" },
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

	it("rejects partial final capture before calling Braintree", async () => {
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { USD: "merchant_account_usd" },
		});
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_partial_final_capture_rejected",
			idempotencyKey: "capture:payop_braintree_partial_final_capture_rejected",
			payload: {
				operation: "capture",
				amount: 4_000,
				currency: "USD",
				providerPaymentReference: "bt_full_authorization",
			},
			source: {
				operationId: "payop_braintree_full_authorization",
				operation: "authorization",
				providerReference: "bt_full_authorization",
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
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { USD: "merchant_account_usd" },
		});
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_capture_bad_reconciliation_source",
			payload: {
				operation: "capture",
				amount: 5_000,
				currency: "USD",
				providerPaymentReference: "bt_expected_source",
			},
			source: {
				operationId: "payop_braintree_unrelated_authorization",
				operation: "authorization",
				providerReference: "bt_other_source",
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

	it("captures only the exact authorized transaction", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_capture_1",
			idempotencyKey: "capture:payop_braintree_capture_1",
			payload: {
				operation: "capture",
				amount: 4_000,
				currency: "USD",
				providerPaymentReference: "bt_authorization_exact",
			},
			source: {
				operationId: "payop_braintree_authorization_exact",
				operation: "authorization",
				providerReference: "bt_authorization_exact",
				amount: 4_000,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				data: {
					captureTransaction: {
						clientMutationId: request.operationId,
						transaction: {
							id: "bt_authorization_exact",
							legacyId: "legacy_authorization_exact",
							status: "SUBMITTED_FOR_SETTLEMENT",
							orderId: request.operationId,
							amount: { value: "40.00", currencyIsoCode: "USD" },
						},
					},
				},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: request.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { EUR: "current_mapping_must_not_route_capture" },
		});

		const outcome = await provider.execute(request);

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "bt_authorization_exact",
			result: { providerStatus: "SUBMITTED_FOR_SETTLEMENT" },
		});
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const body = JSON.parse(String(init.body)) as {
			query: string;
			variables: { input: Record<string, unknown> };
		};
		expect(body.query).toContain("captureTransaction");
		expect(body.variables.input).toEqual({
			apiRequestKey: request.idempotencyKey,
			clientMutationId: request.operationId,
			transactionId: "bt_authorization_exact",
			transaction: { amount: "40.00", orderId: request.operationId },
		});
	});

	it("voids only the exact unsettled transaction", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_void_1",
			idempotencyKey: "void:payop_braintree_void_1",
			payload: {
				operation: "void",
				providerPaymentReference: "bt_transaction_to_void",
			},
			source: {
				operationId: "payop_braintree_authorization_to_void",
				operation: "authorization",
				providerReference: "bt_transaction_to_void",
				amount: 4_000,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				data: {
					voidTransaction: {
						clientMutationId: request.operationId,
						transaction: {
							id: "bt_transaction_to_void",
							status: "VOIDED",
							orderId: "original_order_identity",
							amount: { value: "40.00", currencyIsoCode: "USD" },
						},
					},
				},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: request.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { USD: "merchant_account_usd" },
		});

		const outcome = await provider.execute(request);

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "bt_transaction_to_void",
			result: { providerStatus: "VOIDED" },
		});
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const body = JSON.parse(String(init.body)) as {
			query: string;
			variables: { input: Record<string, unknown> };
		};
		expect(body.query).toContain("voidTransaction");
		expect(body.variables.input).toEqual({
			apiRequestKey: request.idempotencyKey,
			clientMutationId: request.operationId,
			transactionId: "bt_transaction_to_void",
		});
	});

	it("keeps equal refunds distinct by apiRequestKey and orderId", async () => {
		const baseRequest = {
			...authorizationRequest,
			payload: {
				operation: "refund",
				amount: 1_500,
				currency: "USD",
				providerPaymentReference: "bt_settled_source",
			},
			source: {
				operationId: "payop_braintree_capture_settled_source",
				operation: "capture",
				providerReference: "bt_settled_source",
				amount: 5_000,
				currency: "USD",
			},
		} as const;
		const firstRequest = {
			...baseRequest,
			operationId: "payop_braintree_refund_equal_a",
			idempotencyKey: "refund:payop_braintree_refund_equal_a",
		} as const satisfies PaymentProviderOperationRequest;
		const secondRequest = {
			...baseRequest,
			operationId: "payop_braintree_refund_equal_b",
			idempotencyKey: "refund:payop_braintree_refund_equal_b",
		} as const satisfies PaymentProviderOperationRequest;
		const refundResponse = (
			request: PaymentProviderOperationRequest,
			id: string,
		) =>
			response({
				data: {
					refundTransaction: {
						clientMutationId: request.operationId,
						refund: {
							__typename: "Refund",
							id,
							status: "SUBMITTED_FOR_SETTLEMENT",
							orderId: request.operationId,
							amount: { value: "15.00", currencyIsoCode: "USD" },
							refundedTransaction: { id: "bt_settled_source" },
						},
					},
				},
			});
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(refundResponse(firstRequest, "bt_refund_equal_a"))
			.mockResolvedValueOnce(
				refundResponse(secondRequest, "bt_refund_equal_b"),
			);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: firstRequest.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { EUR: "current_mapping_must_not_route_refund" },
		});

		const first = await provider.execute(firstRequest);
		const second = await provider.execute(secondRequest);

		expect(first).toMatchObject({
			state: "succeeded",
			providerReference: "bt_refund_equal_a",
			result: { sourceProviderReference: "bt_settled_source" },
		});
		expect(second).toMatchObject({
			state: "succeeded",
			providerReference: "bt_refund_equal_b",
			result: { sourceProviderReference: "bt_settled_source" },
		});
		const inputs = fetchMock.mock.calls.map((call) => {
			const init = call[1] as RequestInit;
			return (
				JSON.parse(String(init.body)) as {
					variables: { input: Record<string, unknown> };
				}
			).variables.input;
		});
		expect(inputs).toEqual([
			expect.objectContaining({
				apiRequestKey: firstRequest.idempotencyKey,
				clientMutationId: firstRequest.operationId,
				transactionId: "bt_settled_source",
				refund: expect.objectContaining({ orderId: firstRequest.operationId }),
			}),
			expect.objectContaining({
				apiRequestKey: secondRequest.idempotencyKey,
				clientMutationId: secondRequest.operationId,
				transactionId: "bt_settled_source",
				refund: expect.objectContaining({ orderId: secondRequest.operationId }),
			}),
		]);
		for (const input of inputs) {
			expect(input.refund).not.toHaveProperty("merchantAccountId");
		}
	});

	it("keeps a timeout ambiguous until exact order-id reconciliation", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_timeout_authorize",
			idempotencyKey: "authorization:payop_braintree_timeout_authorize",
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("connection reset"))
			.mockResolvedValueOnce(
				response({
					data: {
						transactions: {
							pageInfo: { hasNextPage: false },
							edges: [
								{
									node: {
										id: "bt_created_before_timeout",
										status: "AUTHORIZED",
										orderId: request.operationId,
										amount: {
											value: "123.45",
											currencyIsoCode: "EUR",
										},
									},
								},
							],
						},
					},
				}),
			);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: request.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { EUR: "merchant_account_eur" },
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
			providerReference: "bt_created_before_timeout",
		});
		const reconcileInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
		const body = JSON.parse(String(reconcileInit.body)) as {
			query: string;
			variables: Record<string, unknown>;
		};
		expect(body.query).toContain("transactions");
		expect(body.query).not.toContain("mutation");
		expect(body.variables).toEqual({
			input: { orderId: { is: request.operationId } },
		});
	});

	it("never converts a missing reconciliation result into success", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				data: {
					transactions: {
						pageInfo: { hasNextPage: false },
						edges: [],
					},
				},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: authorizationRequest.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { EUR: "merchant_account_eur" },
		});

		const outcome = await provider.reconcile({
			...authorizationRequest,
			operation: authorizationRequest.payload.operation,
		});

		expect(outcome).toEqual({
			state: "ambiguous",
			result: { reason: "provider_operation_not_uniquely_identified" },
		});
	});

	it("reconciles capture by querying only its exact source transaction", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_capture_reconcile",
			idempotencyKey: "capture:payop_braintree_capture_reconcile",
			payload: {
				operation: "capture",
				amount: 2_100,
				currency: "USD",
				providerPaymentReference: "bt_capture_reconcile_source",
			},
			source: {
				operationId: "payop_braintree_authorization_capture_reconcile",
				operation: "authorization",
				providerReference: "bt_capture_reconcile_source",
				amount: 2_100,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				data: {
					node: {
						__typename: "Transaction",
						id: "bt_capture_reconcile_source",
						status: "SETTLED",
						orderId: request.operationId,
						amount: { value: "21.00", currencyIsoCode: "USD" },
					},
				},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: request.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { USD: "merchant_account_usd" },
		});

		const outcome = await provider.reconcile({
			...request,
			operation: request.payload.operation,
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "bt_capture_reconcile_source",
		});
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const body = JSON.parse(String(init.body)) as {
			query: string;
			variables: Record<string, unknown>;
		};
		expect(body.query).toContain("node(id: $id)");
		expect(body.query).not.toContain("mutation");
		expect(body.variables).toEqual({ id: "bt_capture_reconcile_source" });
	});

	it("reconciles a void from the exact transaction and never another order", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_void_reconcile",
			idempotencyKey: "void:payop_braintree_void_reconcile",
			payload: {
				operation: "void",
				providerPaymentReference: "bt_void_reconcile_source",
			},
			source: {
				operationId: "payop_braintree_authorization_void_reconcile",
				operation: "authorization",
				providerReference: "bt_void_reconcile_source",
				amount: 2_500,
				currency: "CAD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				data: {
					node: {
						__typename: "Transaction",
						id: "bt_void_reconcile_source",
						status: "VOIDED",
						orderId: "unrelated_original_order_id",
						amount: { value: "10.00", currencyIsoCode: "USD" },
					},
				},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: request.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { USD: "merchant_account_usd" },
		});

		const outcome = await provider.reconcile({
			...request,
			operation: request.payload.operation,
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "bt_void_reconcile_source",
		});
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const body = JSON.parse(String(init.body)) as {
			query: string;
			variables: Record<string, unknown>;
		};
		expect(body.query).not.toContain("mutation");
		expect(body.variables).toEqual({ id: "bt_void_reconcile_source" });
	});

	it("reconciles a refund by its unique order ID rather than equal amount", async () => {
		const request = {
			...authorizationRequest,
			operationId: "payop_braintree_refund_reconcile",
			idempotencyKey: "refund:payop_braintree_refund_reconcile",
			payload: {
				operation: "refund",
				amount: 1_500,
				currency: "USD",
				providerPaymentReference: "bt_refund_reconcile_source",
			},
			source: {
				operationId: "payop_braintree_capture_refund_reconcile",
				operation: "capture",
				providerReference: "bt_refund_reconcile_source",
				amount: 7_500,
				currency: "USD",
			},
		} as const satisfies PaymentProviderOperationRequest;
		const fetchMock = vi.fn().mockResolvedValue(
			response({
				data: {
					refunds: {
						pageInfo: { hasNextPage: false },
						edges: [
							{
								node: {
									__typename: "Refund",
									id: "bt_refund_reconciled",
									status: "SETTLED",
									orderId: request.operationId,
									amount: { value: "15.00", currencyIsoCode: "USD" },
									refundedTransaction: {
										id: "bt_refund_reconcile_source",
									},
								},
							},
						],
					},
				},
			}),
		);
		globalThis.fetch = fetchMock;
		const provider = createBraintreePaymentConnectionProvider({
			connectionId: request.connectionId,
			publicKey: "public_key",
			privateKey: "private_key",
			mode: "test",
			merchantAccountIds: { USD: "merchant_account_usd" },
		});

		const outcome = await provider.reconcile({
			...request,
			operation: request.payload.operation,
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "bt_refund_reconciled",
		});
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const body = JSON.parse(String(init.body)) as {
			query: string;
			variables: Record<string, unknown>;
		};
		expect(body.query).toContain("refunds");
		expect(body.query).not.toContain("mutation");
		expect(body.variables).toEqual({
			input: { orderId: { is: request.operationId } },
		});
	});
});
