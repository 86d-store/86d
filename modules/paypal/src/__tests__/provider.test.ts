import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PayPalPaymentProvider } from "../provider";

/** Tracks call count and returns different responses for auth vs API calls. */
function createMockFetch(
	apiResponse: Record<string, unknown>,
	apiOk = true,
	apiStatus = 200,
) {
	let _callIndex = 0;
	return vi.fn().mockImplementation((url: string) => {
		_callIndex++;
		// First call is always the OAuth token request
		if (typeof url === "string" && url.includes("/oauth2/token")) {
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						access_token: "test_access_token",
						expires_in: 3600,
					}),
			});
		}
		// Subsequent calls are API requests
		return Promise.resolve({
			ok: apiOk,
			status: apiStatus,
			json: () => Promise.resolve(apiResponse),
		});
	});
}

describe("PayPalPaymentProvider", () => {
	let provider: PayPalPaymentProvider;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		provider = new PayPalPaymentProvider("client_id", "client_secret", true);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// ── createIntent ─────────────────────────────────────────────────────

	describe("createIntent", () => {
		it("creates an order via PayPal API with paypalOrderId and paymentType", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_123",
				status: "CREATED",
				links: [
					{
						href: "https://api.sandbox.paypal.com/v2/checkout/orders/pp_order_123",
						rel: "self",
						method: "GET",
					},
					{
						href: "https://www.sandbox.paypal.com/checkoutnow?token=pp_order_123",
						rel: "approve",
						method: "GET",
					},
				],
			});

			const result = await provider.createIntent({
				amount: 5000,
				currency: "USD",
			});
			expect(result.providerIntentId).toBe("pp_order_123");
			expect(result.status).toBe("pending");
			expect(result.providerMetadata?.paypalStatus).toBe("CREATED");
			expect(result.providerMetadata?.paypalOrderId).toBe("pp_order_123");
			expect(result.providerMetadata?.paymentType).toBe("paypal");
			expect(result.providerMetadata?.approvalUrl).toBe(
				"https://www.sandbox.paypal.com/checkoutnow?token=pp_order_123",
			);
		});

		it("omits approvalUrl when no approve link is present", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_no_link",
				status: "CREATED",
				links: [
					{
						href: "https://api.sandbox.paypal.com/v2/checkout/orders/pp_order_no_link",
						rel: "self",
						method: "GET",
					},
				],
			});

			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
			});
			expect(result.providerMetadata?.paypalOrderId).toBe("pp_order_no_link");
			expect(result.providerMetadata?.paymentType).toBe("paypal");
			expect(result.providerMetadata?.approvalUrl).toBeUndefined();
		});

		it("maps COMPLETED status to succeeded", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_comp",
				status: "COMPLETED",
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
			});
			expect(result.status).toBe("succeeded");
		});

		it("maps APPROVED status to processing", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_app",
				status: "APPROVED",
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
			});
			expect(result.status).toBe("processing");
		});

		it("maps VOIDED status to cancelled", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_void",
				status: "VOIDED",
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
			});
			expect(result.status).toBe("cancelled");
		});

		it("maps SAVED status to pending", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_saved",
				status: "SAVED",
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
			});
			expect(result.status).toBe("pending");
		});

		it("maps PAYER_ACTION_REQUIRED to pending", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_par",
				status: "PAYER_ACTION_REQUIRED",
			});
			const result = await provider.createIntent({
				amount: 1000,
				currency: "USD",
			});
			expect(result.status).toBe("pending");
		});

		it("uses sandbox URL when sandbox=true", async () => {
			const sandboxProvider = new PayPalPaymentProvider(
				"client_id",
				"client_secret",
				true,
			);
			globalThis.fetch = createMockFetch({
				id: "pp_sandbox",
				status: "CREATED",
			});
			await sandboxProvider.createIntent({ amount: 1000, currency: "USD" });
			const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0]?.[0] as string;
			expect(calledUrl).toContain("sandbox.paypal.com");
		});

		it("uses production URL when sandbox=false", async () => {
			const prodProvider = new PayPalPaymentProvider(
				"client_id",
				"client_secret",
				false,
			);
			globalThis.fetch = createMockFetch({
				id: "pp_prod",
				status: "CREATED",
			});
			await prodProvider.createIntent({ amount: 1000, currency: "USD" });
			const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
				.calls[0]?.[0] as string;
			expect(calledUrl).toContain("https://api-m.paypal.com");
			expect(calledUrl).not.toContain("sandbox");
		});

		it("formats amount correctly (cents to dollars)", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_fmt",
				status: "CREATED",
			});
			await provider.createIntent({ amount: 1250, currency: "USD" });
			const apiCall = (
				globalThis.fetch as ReturnType<typeof vi.fn>
			).mock.calls.find(
				(c: string[]) =>
					typeof c[0] === "string" && c[0].includes("/checkout/orders"),
			);
			expect(apiCall).toBeDefined();
			const body = JSON.parse(apiCall?.[1].body);
			expect(body.purchase_units[0].amount.value).toBe("12.50");
		});

		it("sends CAPTURE intent (not AUTHORIZE)", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_intent",
				status: "CREATED",
			});
			await provider.createIntent({ amount: 1000, currency: "USD" });
			const apiCall = (
				globalThis.fetch as ReturnType<typeof vi.fn>
			).mock.calls.find(
				(c: string[]) =>
					typeof c[0] === "string" && c[0].includes("/checkout/orders"),
			);
			expect(apiCall).toBeDefined();
			const body = JSON.parse(apiCall?.[1].body);
			expect(body.intent).toBe("CAPTURE");
		});

		it("uppercases currency", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_cur",
				status: "CREATED",
			});
			await provider.createIntent({ amount: 500, currency: "eur" });
			const apiCall = (
				globalThis.fetch as ReturnType<typeof vi.fn>
			).mock.calls.find(
				(c: string[]) =>
					typeof c[0] === "string" && c[0].includes("/checkout/orders"),
			);
			expect(apiCall).toBeDefined();
			const body = JSON.parse(apiCall?.[1].body);
			expect(body.purchase_units[0].amount.currency_code).toBe("EUR");
		});

		it("throws on PayPal API error", async () => {
			globalThis.fetch = createMockFetch(
				{ name: "INVALID_REQUEST", message: "Invalid request" },
				false,
				400,
			);

			await expect(
				provider.createIntent({ amount: 1000, currency: "USD" }),
			).rejects.toThrow("PayPal error: Invalid request");
		});
	});

	// ── confirmIntent ────────────────────────────────────────────────────

	describe("confirmIntent", () => {
		it("captures an order", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_123",
				status: "COMPLETED",
			});

			const result = await provider.confirmIntent("pp_order_123");
			expect(result.providerIntentId).toBe("pp_order_123");
			expect(result.status).toBe("succeeded");
		});
	});

	// ── cancelIntent ─────────────────────────────────────────────────────

	describe("cancelIntent", () => {
		it("returns cancelled for a pending order", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_cancel",
				status: "CREATED",
			});

			const result = await provider.cancelIntent("pp_order_cancel");
			expect(result.status).toBe("cancelled");
		});

		it("returns succeeded for COMPLETED order", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_done",
				status: "COMPLETED",
			});
			const result = await provider.cancelIntent("pp_order_done");
			expect(result.status).toBe("succeeded");
		});

		it("returns cancelled for VOIDED order", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_voided",
				status: "VOIDED",
			});
			const result = await provider.cancelIntent("pp_order_voided");
			expect(result.status).toBe("cancelled");
		});

		it("returns cancelled for APPROVED order (not yet captured)", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_approved",
				status: "APPROVED",
			});
			const result = await provider.cancelIntent("pp_order_approved");
			expect(result.status).toBe("cancelled");
		});

		it("sets providerMetadata paypalStatus to VOIDED", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_meta",
				status: "CREATED",
			});
			const result = await provider.cancelIntent("pp_order_meta");
			expect(result.providerMetadata?.paypalStatus).toBe("VOIDED");
		});
	});

	// ── createRefund ─────────────────────────────────────────────────────

	describe("createRefund", () => {
		it("creates a refund against a capture", async () => {
			let callNum = 0;
			globalThis.fetch = vi.fn().mockImplementation((url: string) => {
				callNum++;
				if (url.includes("/oauth2/token")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								access_token: "test_token",
								expires_in: 3600,
							}),
					});
				}
				// GET order to find capture ID
				if (url.includes("/checkout/orders/") && callNum <= 3) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								id: "pp_order_ref",
								status: "COMPLETED",
								purchase_units: [
									{
										payments: {
											captures: [
												{
													id: "cap_123",
													status: "COMPLETED",
												},
											],
										},
									},
								],
							}),
					});
				}
				// POST refund
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () =>
						Promise.resolve({
							id: "ref_pp_123",
							status: "COMPLETED",
						}),
				});
			});

			const result = await provider.createRefund({
				providerIntentId: "pp_order_ref",
			});
			expect(result.providerRefundId).toBe("ref_pp_123");
			expect(result.status).toBe("succeeded");
		});

		it("throws when no capture found", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_order_nocap",
				status: "CREATED",
				purchase_units: [{ payments: {} }],
			});

			await expect(
				provider.createRefund({
					providerIntentId: "pp_order_nocap",
				}),
			).rejects.toThrow("No capture found");
		});

		it("maps FAILED refund status", async () => {
			let _callNum = 0;
			globalThis.fetch = vi.fn().mockImplementation((url: string) => {
				_callNum++;
				if (url.includes("/oauth2/token")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								access_token: "tok",
								expires_in: 3600,
							}),
					});
				}
				if (url.includes("/checkout/orders/")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								id: "ord",
								status: "COMPLETED",
								purchase_units: [
									{
										payments: {
											captures: [
												{
													id: "cap_1",
													status: "COMPLETED",
												},
											],
										},
									},
								],
							}),
					});
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ id: "ref_fail", status: "FAILED" }),
				});
			});

			const result = await provider.createRefund({
				providerIntentId: "pp_order_1",
			});
			expect(result.status).toBe("failed");
		});

		it("sends reason as note_to_payer in refund body", async () => {
			let capturedRefundBody: string | undefined;
			globalThis.fetch = vi
				.fn()
				.mockImplementation((url: string, init?: RequestInit) => {
					if (url.includes("/oauth2/token")) {
						return Promise.resolve({
							ok: true,
							status: 200,
							json: () =>
								Promise.resolve({
									access_token: "tok",
									expires_in: 3600,
								}),
						});
					}
					if (url.includes("/checkout/orders/")) {
						return Promise.resolve({
							ok: true,
							status: 200,
							json: () =>
								Promise.resolve({
									id: "ord",
									status: "COMPLETED",
									purchase_units: [
										{
											payments: {
												captures: [{ id: "cap_reason", status: "COMPLETED" }],
											},
										},
									],
								}),
						});
					}
					// Capture the refund request body
					capturedRefundBody = init?.body as string;
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({ id: "ref_reason", status: "COMPLETED" }),
					});
				});

			await provider.createRefund({
				providerIntentId: "pp_order_reason",
				reason: "Customer request",
			});

			expect(capturedRefundBody).toBeDefined();
			const parsed = JSON.parse(capturedRefundBody as string);
			expect(parsed.note_to_payer).toBe("Customer request");
		});

		it("sends currency from params in refund amount", async () => {
			let capturedRefundBody: string | undefined;
			globalThis.fetch = vi
				.fn()
				.mockImplementation((url: string, init?: RequestInit) => {
					if (url.includes("/oauth2/token")) {
						return Promise.resolve({
							ok: true,
							status: 200,
							json: () =>
								Promise.resolve({
									access_token: "tok",
									expires_in: 3600,
								}),
						});
					}
					if (url.includes("/checkout/orders/")) {
						return Promise.resolve({
							ok: true,
							status: 200,
							json: () =>
								Promise.resolve({
									id: "ord",
									status: "COMPLETED",
									purchase_units: [
										{
											payments: {
												captures: [{ id: "cap_eur", status: "COMPLETED" }],
											},
										},
									],
								}),
						});
					}
					capturedRefundBody = init?.body as string;
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () => Promise.resolve({ id: "ref_eur", status: "COMPLETED" }),
					});
				});

			await provider.createRefund({
				providerIntentId: "pp_order_eur",
				amount: 2500,
				currency: "EUR",
			});

			expect(capturedRefundBody).toBeDefined();
			const parsed = JSON.parse(capturedRefundBody as string);
			expect(parsed.amount.currency_code).toBe("EUR");
			expect(parsed.amount.value).toBe("25.00");
		});

		it("maps PENDING refund status to pending", async () => {
			globalThis.fetch = vi.fn().mockImplementation((url: string) => {
				if (url.includes("/oauth2/token")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								access_token: "tok",
								expires_in: 3600,
							}),
					});
				}
				if (url.includes("/checkout/orders/")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								id: "ord",
								status: "COMPLETED",
								purchase_units: [
									{
										payments: {
											captures: [{ id: "cap_pend", status: "COMPLETED" }],
										},
									},
								],
							}),
					});
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ id: "ref_pend", status: "PENDING" }),
				});
			});

			const result = await provider.createRefund({
				providerIntentId: "pp_order_pend",
			});
			expect(result.status).toBe("pending");
			expect(result.providerMetadata?.paypalStatus).toBe("PENDING");
		});

		it("maps CANCELLED refund status to pending", async () => {
			globalThis.fetch = vi.fn().mockImplementation((url: string) => {
				if (url.includes("/oauth2/token")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								access_token: "tok",
								expires_in: 3600,
							}),
					});
				}
				if (url.includes("/checkout/orders/")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								id: "ord",
								status: "COMPLETED",
								purchase_units: [
									{
										payments: {
											captures: [{ id: "cap_canc", status: "COMPLETED" }],
										},
									},
								],
							}),
					});
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ id: "ref_canc", status: "CANCELLED" }),
				});
			});

			const result = await provider.createRefund({
				providerIntentId: "pp_order_canc",
			});
			expect(result.status).toBe("pending");
			expect(result.providerMetadata?.paypalStatus).toBe("CANCELLED");
		});

		it("sends deterministic PayPal-Request-Id header for full refund", async () => {
			globalThis.fetch = vi.fn().mockImplementation((url: string) => {
				if (url.includes("/oauth2/token")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								access_token: "test_token",
								expires_in: 3600,
							}),
					});
				}
				if (url.includes("/checkout/orders/")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								id: "pp_order_idem",
								status: "COMPLETED",
								purchase_units: [
									{
										payments: {
											captures: [{ id: "cap_idem_1", status: "COMPLETED" }],
										},
									},
								],
							}),
					});
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ id: "ref_idem", status: "COMPLETED" }),
				});
			});
			await provider.createRefund({ providerIntentId: "pp_order_idem" });
			const refundCall = (
				globalThis.fetch as ReturnType<typeof vi.fn>
			).mock.calls.find(
				(c: string[]) => typeof c[0] === "string" && c[0].includes("/refund"),
			);
			expect(refundCall).toBeDefined();
			const headers = refundCall?.[1]?.headers as Record<string, string>;
			expect(headers["PayPal-Request-Id"]).toBe("refund-cap_idem_1-full");
		});

		it("sends deterministic PayPal-Request-Id header for partial refund", async () => {
			globalThis.fetch = vi.fn().mockImplementation((url: string) => {
				if (url.includes("/oauth2/token")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								access_token: "test_token",
								expires_in: 3600,
							}),
					});
				}
				if (url.includes("/checkout/orders/")) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								id: "pp_order_part",
								status: "COMPLETED",
								purchase_units: [
									{
										payments: {
											captures: [{ id: "cap_part_1", status: "COMPLETED" }],
										},
									},
								],
							}),
					});
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ id: "ref_part", status: "COMPLETED" }),
				});
			});
			await provider.createRefund({
				providerIntentId: "pp_order_part",
				amount: 1500,
				currency: "eur",
			});
			const refundCall = (
				globalThis.fetch as ReturnType<typeof vi.fn>
			).mock.calls.find(
				(c: string[]) => typeof c[0] === "string" && c[0].includes("/refund"),
			);
			expect(refundCall).toBeDefined();
			const headers = refundCall?.[1]?.headers as Record<string, string>;
			expect(headers["PayPal-Request-Id"]).toBe("refund-cap_part_1-1500-EUR");
		});
	});

	// ── auth token caching ───────────────────────────────────────────────

	describe("auth token caching", () => {
		it("reuses cached access token", async () => {
			globalThis.fetch = createMockFetch({
				id: "pp_cache_1",
				status: "CREATED",
			});
			await provider.createIntent({ amount: 1000, currency: "USD" });
			await provider.createIntent({ amount: 2000, currency: "USD" });

			// Auth token should be called only once (cached for second call)
			const tokenCalls = (
				globalThis.fetch as ReturnType<typeof vi.fn>
			).mock.calls.filter(
				(c: string[]) =>
					typeof c[0] === "string" && c[0].includes("/oauth2/token"),
			);
			expect(tokenCalls).toHaveLength(1);
		});

		it("throws on auth failure", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: () => Promise.resolve({ name: "ERROR", message: "Bad creds" }),
			});

			await expect(
				provider.createIntent({ amount: 100, currency: "USD" }),
			).rejects.toThrow("PayPal auth error: Bad creds");
		});
	});
});
