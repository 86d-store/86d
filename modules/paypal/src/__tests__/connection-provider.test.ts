import type {
	PaymentOperationPayload,
	PaymentProviderOperationRequest,
} from "@86d-app/core/payment-connection-provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PayPalPaymentConnectionProvider } from "../connection-provider";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function installPayPalFetch(
	handler: (url: string, init: RequestInit | undefined) => Promise<Response>,
) {
	const fetchMock = vi.fn(
		async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/v1/oauth2/token")) {
				return jsonResponse({
					access_token: "access-token",
					expires_in: 3_600,
				});
			}
			return handler(url, init);
		},
	);
	globalThis.fetch = fetchMock;
	return fetchMock;
}

function provider() {
	return new PayPalPaymentConnectionProvider({
		connectionId: "paypal-connection-1",
		providerAccountId: "PAYPAL-MERCHANT-1",
		clientId: "client-id",
		clientSecret: "client-secret",
		mode: "test",
		returnUrl: "https://store.example/paypal/return",
		cancelUrl: "https://store.example/paypal/cancel",
	});
}

function request(
	payload: PaymentOperationPayload,
	idempotencyKey = `paypal-${payload.operation}-operation-1`,
): PaymentProviderOperationRequest {
	const providerPaymentReference =
		"providerPaymentReference" in payload
			? payload.providerPaymentReference
			: undefined;
	const source =
		providerPaymentReference === undefined
			? undefined
			: {
					operationId: `source-${payload.operation}-1`,
					operation:
						payload.operation === "authorization"
							? ("intent" as const)
							: payload.operation === "refund"
								? ("capture" as const)
								: ("authorization" as const),
					providerReference: providerPaymentReference,
					amount: "amount" in payload ? payload.amount : 1,
					currency: "currency" in payload ? payload.currency : "USD",
				};
	return {
		operationId: `operation-${payload.operation}-1`,
		connectionId: "paypal-connection-1",
		idempotencyKey,
		requestDigest: "a".repeat(64),
		attempt: 1,
		createdAt: new Date("2026-08-13T00:00:00.000Z"),
		payload,
		...(source ? { source } : {}),
	};
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("PayPal Payment Connection provider", () => {
	it("freezes the verified PayPal merchant identity at adapter binding", () => {
		expect(provider().providerAccountId).toBe("PAYPAL-MERCHANT-1");
		expect(
			() =>
				new PayPalPaymentConnectionProvider({
					connectionId: "paypal-connection-1",
					providerAccountId: " ",
					clientId: "client-id",
					clientSecret: "client-secret",
					mode: "test",
					returnUrl: "https://store.example/paypal/return",
					cancelUrl: "https://store.example/paypal/cancel",
				}),
		).toThrow();
	});
	it("creates an AUTHORIZE order with server money and the stable operation key", async () => {
		const fetchMock = installPayPalFetch(async (url) => {
			expect(url).toContain("api-m.sandbox.paypal.com/v2/checkout/orders");
			return jsonResponse({
				id: "ORDER-1",
				status: "CREATED",
				purchase_units: [{ amount: { currency_code: "EUR", value: "12.05" } }],
				links: [
					{
						href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1",
						rel: "approve",
						method: "GET",
					},
				],
			});
		});
		const outcome = await provider().execute(
			request(
				{ operation: "intent", amount: 1_205, currency: "EUR" },
				"create-order-stable-key",
			),
		);

		expect(outcome).toMatchObject({
			state: "requires_action",
			providerReference: "ORDER-1",
			result: { resource: "order", paypalStatus: "CREATED" },
		});
		const call = fetchMock.mock.calls.find(([url]) =>
			String(url).includes("/v2/checkout/orders"),
		);
		const init = call?.[1] as RequestInit;
		expect(init.headers).toMatchObject({
			"PayPal-Request-Id": "create-order-stable-key",
			Prefer: "return=representation",
		});
		expect(JSON.parse(String(init.body))).toMatchObject({
			intent: "AUTHORIZE",
			payment_source: {
				paypal: {
					experience_context: {
						return_url: "https://store.example/paypal/return",
						cancel_url: "https://store.example/paypal/cancel",
						user_action: "PAY_NOW",
					},
				},
			},
			purchase_units: [{ amount: { currency_code: "EUR", value: "12.05" } }],
		});
	});

	it("accepts PayPal's current payer-action handoff link", async () => {
		installPayPalFetch(async () =>
			jsonResponse({
				id: "ORDER-PAYER-ACTION",
				status: "PAYER_ACTION_REQUIRED",
				purchase_units: [{ amount: { currency_code: "USD", value: "1.00" } }],
				links: [
					{
						href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PAYER-ACTION",
						rel: "payer-action",
						method: "GET",
					},
				],
			}),
		);

		expect(
			await provider().execute(
				request({ operation: "intent", amount: 100, currency: "USD" }),
			),
		).toMatchObject({
			state: "requires_action",
			result: {
				approvalUrl:
					"https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PAYER-ACTION",
			},
		});
	});

	it("rejects untrusted callback URLs at construction", () => {
		expect(
			() =>
				new PayPalPaymentConnectionProvider({
					connectionId: "paypal-untrusted",
					providerAccountId: "PAYPAL-MERCHANT-1",
					clientId: "client-id",
					clientSecret: "client-secret",
					mode: "test",
					returnUrl: "http://store.example/paypal/return",
					cancelUrl: "https://store.example/paypal/cancel",
				}),
		).toThrow("trusted HTTPS");
	});

	it("rejects an overlong PayPal request ID before provider I/O", async () => {
		const fetchMock = installPayPalFetch(async () => {
			throw new Error("must not be called");
		});
		const outcome = await provider().execute(
			request(
				{ operation: "intent", amount: 100, currency: "USD" },
				"x".repeat(109),
			),
		);

		expect(outcome).toEqual({
			state: "failed",
			result: { reason: "idempotency_key_invalid" },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("uses PayPal zero-digit currency exponents", async () => {
		const fetchMock = installPayPalFetch(async () =>
			jsonResponse({
				id: "ORDER-JPY",
				status: "CREATED",
				purchase_units: [{ amount: { currency_code: "JPY", value: "1205" } }],
			}),
		);

		const outcome = await provider().execute(
			request({ operation: "intent", amount: 1_205, currency: "JPY" }),
		);

		expect(outcome).toMatchObject({
			state: "pending",
			providerReference: "ORDER-JPY",
		});
		const call = fetchMock.mock.calls.find(([url]) =>
			String(url).includes("/v2/checkout/orders"),
		);
		expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
			purchase_units: [{ amount: { currency_code: "JPY", value: "1205" } }],
		});
	});

	it("rejects an unsupported currency before provider I/O", async () => {
		const fetchMock = installPayPalFetch(async () => {
			throw new Error("must not be called");
		});

		await expect(
			provider().execute(
				request({ operation: "intent", amount: 100, currency: "AED" }),
			),
		).rejects.toThrow("does not support");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("authorizes the exact approved order and retains the authorization reference", async () => {
		const fetchMock = installPayPalFetch(async (url) => {
			expect(url).toContain("/v2/checkout/orders/ORDER-2/authorize");
			return jsonResponse({
				id: "ORDER-2",
				status: "COMPLETED",
				purchase_units: [
					{
						payments: {
							authorizations: [
								{
									id: "AUTH-2",
									status: "CREATED",
									amount: { currency_code: "USD", value: "20.00" },
								},
							],
						},
					},
				],
			});
		});
		const outcome = await provider().execute(
			request(
				{
					operation: "authorization",
					amount: 2_000,
					currency: "USD",
					providerPaymentReference: "ORDER-2",
				},
				"authorize-stable-key",
			),
		);

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "AUTH-2",
		});
		const call = fetchMock.mock.calls.find(([url]) =>
			String(url).includes("/authorize"),
		);
		expect(call?.[1]?.headers).toMatchObject({
			"PayPal-Request-Id": "authorize-stable-key",
			Prefer: "return=representation",
		});
	});

	it("reports a known pending PayPal authorization without calling it ambiguous", async () => {
		installPayPalFetch(async () =>
			jsonResponse({
				id: "ORDER-PENDING",
				status: "COMPLETED",
				purchase_units: [
					{
						payments: {
							authorizations: [
								{
									id: "AUTH-PENDING",
									status: "PENDING",
									amount: { currency_code: "USD", value: "20.00" },
								},
							],
						},
					},
				],
			}),
		);

		expect(
			await provider().execute(
				request({
					operation: "authorization",
					amount: 2_000,
					currency: "USD",
					providerPaymentReference: "ORDER-PENDING",
				}),
			),
		).toMatchObject({
			state: "pending",
			providerReference: "AUTH-PENDING",
			result: { paypalStatus: "PENDING" },
		});
	});

	it("captures only the cited authorization with an operation-specific key", async () => {
		const fetchMock = installPayPalFetch(async (url) => {
			expect(url).toContain("/v2/payments/authorizations/AUTH-3/capture");
			return jsonResponse({
				id: "CAPTURE-3",
				status: "COMPLETED",
				amount: { currency_code: "USD", value: "7.50" },
			});
		});
		const outcome = await provider().execute(
			request(
				{
					operation: "capture",
					amount: 750,
					currency: "USD",
					providerPaymentReference: "AUTH-3",
				},
				"capture-stable-key",
			),
		);

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "CAPTURE-3",
		});
		const call = fetchMock.mock.calls.find(([url]) =>
			String(url).includes("/capture"),
		);
		expect(call?.[1]?.headers).toMatchObject({
			"PayPal-Request-Id": "capture-stable-key",
			Prefer: "return=representation",
		});
		expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
			amount: { currency_code: "USD", value: "7.50" },
			final_capture: false,
		});
	});

	it("performs a real void and waits for canonical confirmation", async () => {
		let voidSubmitted = false;
		const fetchMock = installPayPalFetch(async (url, init) => {
			if (url.endsWith("/AUTH-4/void")) {
				voidSubmitted = true;
				expect(init?.headers).toMatchObject({
					"PayPal-Request-Id": "void-stable-key",
				});
				return new Response(null, { status: 204 });
			}
			expect(url).toContain("/v2/payments/authorizations/AUTH-4");
			return jsonResponse({
				id: "AUTH-4",
				status: "VOIDED",
				void_state: "SUCCEEDED",
				amount: { currency_code: "USD", value: "9.00" },
			});
		});
		const outcome = await provider().execute(
			request(
				{ operation: "void", providerPaymentReference: "AUTH-4" },
				"void-stable-key",
			),
		);

		expect(voidSubmitted).toBe(true);
		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "AUTH-4",
			result: { voidState: "SUCCEEDED" },
		});
		expect(
			fetchMock.mock.calls.filter(([url]) => String(url).includes("AUTH-4")),
		).toHaveLength(2);
	});

	it("supports equal partial refunds when caller operation keys differ", async () => {
		const requestIds: string[] = [];
		let refund = 0;
		installPayPalFetch(async (url, init) => {
			expect(url).toContain("/v2/payments/captures/CAPTURE-5/refund");
			const headers = init?.headers as Record<string, string> | undefined;
			requestIds.push(headers?.["PayPal-Request-Id"] ?? "");
			refund += 1;
			return jsonResponse({
				id: `REFUND-${refund}`,
				status: "COMPLETED",
				amount: { currency_code: "USD", value: "2.50" },
			});
		});
		const adapter = provider();
		const payload = {
			operation: "refund" as const,
			amount: 250,
			currency: "USD",
			providerPaymentReference: "CAPTURE-5",
		};
		const first = await adapter.execute(request(payload, "refund-key-one"));
		const second = await adapter.execute(request(payload, "refund-key-two"));

		expect(first.providerReference).toBe("REFUND-1");
		expect(second.providerReference).toBe("REFUND-2");
		expect(requestIds).toEqual(["refund-key-one", "refund-key-two"]);
	});

	it("does not blindly repeat an unknown create during later reconciliation", async () => {
		const fetchMock = installPayPalFetch(async () => {
			throw new Error("must not be called");
		});
		const outcome = await provider().reconcile({
			operationId: "operation-intent-6",
			connectionId: "paypal-connection-1",
			operation: "intent",
			idempotencyKey: "create-order-reconcile-key",
			requestDigest: "b".repeat(64),
			attempt: 2,
			createdAt: new Date("2020-01-01T00:00:00.000Z"),
			payload: { operation: "intent", amount: 1_100, currency: "USD" },
		});

		expect(outcome).toEqual({
			state: "ambiguous",
			result: {
				reason: "provider_reference_required_for_reconciliation",
			},
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("repeats an unknown create only inside the documented request-ID window", async () => {
		const fetchMock = installPayPalFetch(async () =>
			jsonResponse({
				id: "ORDER-WINDOW",
				status: "APPROVED",
				purchase_units: [{ amount: { currency_code: "USD", value: "11.00" } }],
			}),
		);
		const outcome = await provider().reconcile({
			operationId: "operation-intent-window",
			connectionId: "paypal-connection-1",
			operation: "intent",
			idempotencyKey: "create-order-window-key",
			requestDigest: "e".repeat(64),
			attempt: 2,
			createdAt: new Date(),
			payload: { operation: "intent", amount: 1_100, currency: "USD" },
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "ORDER-WINDOW",
		});
		const call = fetchMock.mock.calls.find(([url]) =>
			String(url).includes("/v2/checkout/orders"),
		);
		expect(call?.[1]?.headers).toMatchObject({
			"PayPal-Request-Id": "create-order-window-key",
		});
	});

	it("replays an unclear capture with the exact durable request inside the recovery bound", async () => {
		const fetchMock = installPayPalFetch(async (url) => {
			expect(url).toContain("/v2/payments/authorizations/AUTH-REPLAY/capture");
			return jsonResponse({
				id: "CAPTURE-REPLAY",
				status: "COMPLETED",
				amount: { currency_code: "USD", value: "7.50" },
			});
		});
		const payload = {
			operation: "capture" as const,
			amount: 750,
			currency: "USD",
			providerPaymentReference: "AUTH-REPLAY",
		};
		const durable = request(payload, "capture-replay-stable-key");

		const outcome = await provider().reconcile({
			...durable,
			operation: "capture",
			attempt: 2,
			createdAt: new Date(Date.now() - 60_000),
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "CAPTURE-REPLAY",
		});
		const call = fetchMock.mock.calls.find(([url]) =>
			String(url).includes("/capture"),
		);
		expect(call?.[1]?.headers).toMatchObject({
			"PayPal-Request-Id": "capture-replay-stable-key",
		});
		expect(JSON.parse(String(call?.[1]?.body))).toEqual({
			amount: { currency_code: "USD", value: "7.50" },
			final_capture: false,
		});
	});

	it("replays an unclear refund with the exact durable request inside 44 days", async () => {
		const fetchMock = installPayPalFetch(async (url) => {
			expect(url).toContain("/v2/payments/captures/CAPTURE-REPLAY/refund");
			return jsonResponse({
				id: "REFUND-REPLAY",
				status: "COMPLETED",
				amount: { currency_code: "USD", value: "2.50" },
			});
		});
		const payload = {
			operation: "refund" as const,
			amount: 250,
			currency: "USD",
			providerPaymentReference: "CAPTURE-REPLAY",
			reason: "Duplicate item",
		};
		const durable = request(payload, "refund-replay-stable-key");

		const outcome = await provider().reconcile({
			...durable,
			operation: "refund",
			attempt: 2,
			createdAt: new Date(Date.now() - 43 * 24 * 60 * 60 * 1_000),
		});

		expect(outcome).toMatchObject({
			state: "succeeded",
			providerReference: "REFUND-REPLAY",
		});
		const call = fetchMock.mock.calls.find(([url]) =>
			String(url).includes("/refund"),
		);
		expect(call?.[1]?.headers).toMatchObject({
			"PayPal-Request-Id": "refund-replay-stable-key",
		});
		expect(JSON.parse(String(call?.[1]?.body))).toEqual({
			amount: { currency_code: "USD", value: "2.50" },
			note_to_payer: "Duplicate item",
		});
	});

	it.each([
		{
			operation: "capture" as const,
			createdAt: new Date(Date.now() - 6 * 60 * 1_000),
			payload: {
				operation: "capture" as const,
				amount: 750,
				currency: "USD",
				providerPaymentReference: "AUTH-EXPIRED",
			},
		},
		{
			operation: "refund" as const,
			createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1_000),
			payload: {
				operation: "refund" as const,
				amount: 250,
				currency: "USD",
				providerPaymentReference: "CAPTURE-EXPIRED",
			},
		},
	])(
		"keeps an unclear $operation ambiguous after its replay bound",
		async ({ operation, createdAt, payload }) => {
			const fetchMock = installPayPalFetch(async () => {
				throw new Error("must not be called");
			});
			const durable = request(payload, `${operation}-expired-stable-key`);

			const outcome = await provider().reconcile({
				...durable,
				operation,
				attempt: 2,
				createdAt,
			});

			expect(outcome).toEqual({
				state: "ambiguous",
				result: { reason: "provider_reference_required_for_reconciliation" },
			});
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);

	it("reconciles a known refund using canonical GET without another refund", async () => {
		const fetchMock = installPayPalFetch(async (url, init) => {
			expect(init?.method).toBe("GET");
			expect(url).toContain("/v2/payments/refunds/REFUND-7");
			return jsonResponse({
				id: "REFUND-7",
				status: "COMPLETED",
				amount: { currency_code: "USD", value: "4.00" },
			});
		});
		const payload = {
			operation: "refund" as const,
			amount: 400,
			currency: "USD",
			providerPaymentReference: "CAPTURE-7",
		};
		const outcome = await provider().reconcile({
			operationId: "operation-refund-7",
			connectionId: "paypal-connection-1",
			operation: "refund",
			idempotencyKey: "refund-reconcile-key",
			requestDigest: "c".repeat(64),
			attempt: 2,
			createdAt: new Date("2026-08-13T00:00:00.000Z"),
			providerReference: "REFUND-7",
			payload,
			source: request(payload).source,
		});

		expect(outcome.state).toBe("succeeded");
		expect(
			fetchMock.mock.calls.filter(([url]) => String(url).includes("/refund")),
		).toHaveLength(1);
	});

	it("rejects conflicting money returned by canonical reconciliation", async () => {
		installPayPalFetch(async () =>
			jsonResponse({
				id: "REFUND-CONFLICT",
				status: "COMPLETED",
				amount: { currency_code: "EUR", value: "4.00" },
			}),
		);

		const payload = {
			operation: "refund" as const,
			amount: 400,
			currency: "USD",
			providerPaymentReference: "CAPTURE-CONFLICT",
		};
		await expect(
			provider().reconcile({
				operationId: "operation-refund-conflict",
				connectionId: "paypal-connection-1",
				operation: "refund",
				idempotencyKey: "refund-reconcile-conflict-key",
				requestDigest: "d".repeat(64),
				attempt: 2,
				createdAt: new Date("2026-08-13T00:00:00.000Z"),
				providerReference: "REFUND-CONFLICT",
				payload,
				source: request(payload).source,
			}),
		).rejects.toThrow("money facts that conflict");
	});

	it("returns a normalized definite provider rejection", async () => {
		installPayPalFetch(async () =>
			jsonResponse(
				{
					name: "UNPROCESSABLE_ENTITY",
					message: "Request rejected",
					details: [{ issue: "CURRENCY_NOT_SUPPORTED" }],
				},
				422,
			),
		);
		const outcome = await provider().execute(
			request({ operation: "intent", amount: 100, currency: "USD" }),
		);

		expect(outcome).toEqual({
			state: "failed",
			result: {
				reason: "provider_rejected",
				providerCode: "CURRENCY_NOT_SUPPORTED",
			},
		});
	});

	it("leaves network timeouts unknown for durable reconciliation", async () => {
		installPayPalFetch(async () => {
			throw new Error("network timeout");
		});
		await expect(
			provider().execute(
				request({ operation: "intent", amount: 100, currency: "USD" }),
			),
		).rejects.toThrow("network timeout");
	});

	it("rejects conflicting provider money instead of confirming it", async () => {
		installPayPalFetch(async () =>
			jsonResponse({
				id: "ORDER-9",
				status: "CREATED",
				purchase_units: [{ amount: { currency_code: "USD", value: "99.99" } }],
			}),
		);
		const outcome = await provider().execute(
			request({ operation: "intent", amount: 100, currency: "USD" }),
		);
		expect(outcome).toEqual({
			state: "ambiguous",
			providerReference: "ORDER-9",
			result: {
				reason: "provider_response_money_mismatch",
				resource: "order",
			},
		});
	});

	it("rejects missing continuation provenance before provider I/O", async () => {
		const fetchMock = installPayPalFetch(async () => {
			throw new Error("must not be called");
		});
		const capture = request({
			operation: "capture",
			amount: 100,
			currency: "USD",
			providerPaymentReference: "AUTH-NO-SOURCE",
		});
		const outcome = await provider().execute({ ...capture, source: undefined });

		expect(outcome).toEqual({
			state: "failed",
			result: { reason: "source_provenance_invalid" },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects cross-Connection invocation without provider I/O", async () => {
		const fetchMock = installPayPalFetch(async () => {
			throw new Error("must not be called");
		});
		const outcome = await provider().execute({
			...request({ operation: "intent", amount: 100, currency: "USD" }),
			connectionId: "another-connection",
		});

		expect(outcome).toEqual({
			state: "failed",
			result: { reason: "connection_mismatch" },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
