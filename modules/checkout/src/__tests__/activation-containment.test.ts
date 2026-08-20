import { createMockSession } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { CheckoutSession } from "../service";
import {
	capturePaymentUnavailable,
	completeSessionUnavailable,
	confirmSessionUnavailable,
	createPaymentUnavailable,
	getPaymentUnavailable,
} from "../store/endpoints/activation-unavailable";
import { createSession } from "../store/endpoints/create-session";
import { getShippingRates } from "../store/endpoints/get-shipping-rates";
import { createGuestProofMetadata } from "../store/endpoints/guest-proof";
import { updateSession } from "../store/endpoints/update-session";

const shippingAddress = {
	firstName: "Ada",
	lastName: "Lovelace",
	line1: "123 Main St",
	city: "Austin",
	state: "TX",
	postalCode: "78701",
	country: "US",
};

function checkoutSession(
	overrides: Partial<CheckoutSession> = {},
): CheckoutSession {
	const now = new Date("2026-08-13T12:00:00.000Z");
	return {
		id: "session-1",
		revision: 1,
		cartId: "cart-1",
		status: "pending",
		subtotal: 2_500,
		taxAmount: 0,
		shippingAmount: 0,
		discountAmount: 0,
		giftCardAmount: 0,
		storeCreditAmount: 0,
		total: 2_500,
		currency: "USD",
		expiresAt: new Date("2026-08-13T12:30:00.000Z"),
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function capabilityInvoker(options?: {
	cartFailure?: string;
	productFailure?: string;
	variantId?: string;
	taxStatus?: "CALCULATED" | "REVIEW_REQUIRED" | "UNAVAILABLE";
	storeCustomerId?: string;
}) {
	return {
		invoke: vi.fn(
			async (
				definition: { name: string; version?: string },
				request?: { identity?: { subject?: string } },
			) => {
				if (definition.name === "cart.snapshot") {
					if (options?.cartFailure) {
						return {
							ok: false,
							failure: { code: options.cartFailure },
						};
					}
					return {
						ok: true,
						decision: {
							cartId: "cart-1",
							revision: "2026-08-13T12:00:00.000Z",
							items: [
								{
									productId: "product-1",
									...(options?.variantId
										? { variantId: options.variantId }
										: {}),
									quantity: 2,
								},
							],
						},
					};
				}
				if (definition.name === "catalog.product.resolve") {
					if (options?.productFailure) {
						return {
							ok: false,
							failure: { code: options.productFailure },
						};
					}
					return {
						ok: true,
						decision: {
							product: {
								id: "product-1",
								name: "Authoritative Product",
								slug: "authoritative-product",
								status: "active",
								price: 1_250,
								sku: "REAL-SKU",
								images: [],
							},
						},
					};
				}
				if (definition.name === "tax.quote") {
					if (options?.taxStatus === "UNAVAILABLE") {
						return {
							ok: false,
							failure: {
								code: "CAPABILITY_UNAVAILABLE",
								capability: "tax.quote",
								version: "2.0.0",
							},
						};
					}
					const review = options?.taxStatus === "REVIEW_REQUIRED";
					return {
						ok: true,
						decision: {
							quoteId: "quote-1",
							jurisdictionDecision: review ? "BLOCKED" : "COLLECT",
							status: review ? "REVIEW_REQUIRED" : "CALCULATED",
							reason: review ? "RATE_NOT_CONFIGURED" : "TAX_CALCULATED",
							policyVersion: "policy-v1",
							sourceVersion: "rates-v1",
							issuedAt: "2026-08-14T00:00:00.000Z",
							expiresAt: "2026-08-14T00:10:00.000Z",
							currency: "USD",
							totals: {
								subtotal: 2_500,
								discount: 0,
								shipping: 0,
								taxable: 2_500,
								lineTax: review ? null : 206,
								shippingTax: review ? null : 0,
								tax: review ? null : 206,
								grandTotal: review ? null : 2_706,
							},
							lineAllocations: [
								{
									lineId: "product-1::0",
									productId: "product-1",
									taxCategoryId: "general",
									quantity: 2,
									grossAmount: 2_500,
									discountAmount: 0,
									taxableAmount: 2_500,
									taxAmount: review ? null : 206,
								},
							],
						},
					};
				}
				if (definition.name === "customers.identity.resolve") {
					return {
						ok: true,
						decision: {
							customerId:
								options?.storeCustomerId ??
								request?.identity?.subject ??
								"store-customer-1",
							bindingId: "binding-1",
							verifiedEmail: "ada@example.com",
							createdCustomer: false,
							createdBinding: false,
							boundAt: "2026-08-14T12:00:00.000Z",
						},
					};
				}
				return {
					ok: false,
					failure: {
						code: "CAPABILITY_UNAVAILABLE",
						capability: definition.name,
						version: "1.0.0",
					},
				};
			},
		),
	};
}

function guestCreateInput(
	create: ReturnType<typeof vi.fn>,
	capabilities = capabilityInvoker(),
) {
	return {
		body: { cartId: "cart-1" },
		headers: new Headers({ cookie: "cart_guest_id=guest-1" }),
		context: {
			controllers: { checkout: { create } },
			capabilities,
			session: null,
		},
	};
}

describe("checkout activation containment", () => {
	it("fails before persistence when an authoritative Cart snapshot is unavailable", async () => {
		const create = vi.fn();
		const result = await createSession(
			guestCreateInput(
				create,
				capabilityInvoker({ cartFailure: "CAPABILITY_UNAVAILABLE" }),
			),
		);

		expect(result).toMatchObject({
			code: "CHECKOUT_CART_UNAVAILABLE",
			status: 503,
		});
		expect(create).not.toHaveBeenCalled();
	});

	it("fails before persistence when authoritative product data is unavailable", async () => {
		const create = vi.fn();
		const result = await createSession(
			guestCreateInput(
				create,
				capabilityInvoker({ productFailure: "CAPABILITY_UNAVAILABLE" }),
			),
		);

		expect(result).toMatchObject({
			code: "CHECKOUT_PRICING_UNAVAILABLE",
			status: 503,
		});
		expect(create).not.toHaveBeenCalled();
	});

	it("derives product identity, quantity, and price from authoritative Store decisions", async () => {
		const create = vi.fn().mockResolvedValue(checkoutSession());
		const result = await createSession(guestCreateInput(create));

		expect(result).toHaveProperty("session");
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				cartId: "cart-1",
				subtotal: 2_500,
				total: 2_500,
				lineItems: [
					expect.objectContaining({
						productId: "product-1",
						name: "Authoritative Product",
						price: 1_250,
						quantity: 2,
						sku: "REAL-SKU",
					}),
				],
			}),
		);
	});

	it("fails before persistence when authoritative product pricing is invalid", async () => {
		const create = vi.fn();
		const result = await createSession(
			guestCreateInput(
				create,
				capabilityInvoker({ productFailure: "invalid_price" }),
			),
		);

		expect(result).toMatchObject({
			code: "CHECKOUT_PRICING_UNAVAILABLE",
			status: 503,
		});
		expect(create).not.toHaveBeenCalled();
	});

	it("rejects a Cart variant that Products cannot bind to its product", async () => {
		const create = vi.fn();
		const result = await createSession(
			guestCreateInput(
				create,
				capabilityInvoker({
					variantId: "variant-1",
					productFailure: "variant_mismatch",
				}),
			),
		);

		expect(result).toMatchObject({ status: 400 });
		expect(create).not.toHaveBeenCalled();
	});

	it("binds a shipping address through tax.quote v2 instead of inferring zero", async () => {
		const created = checkoutSession({ shippingAddress });
		const create = vi.fn().mockResolvedValue(created);
		const update = vi.fn().mockResolvedValue({
			...created,
			taxAmount: 206,
			total: 2_706,
			metadata: { taxQuoteId: "quote-1", taxQuoteStatus: "CALCULATED" },
		});
		const getLineItems = vi.fn().mockResolvedValue([
			{
				productId: "product-1",
				name: "Authoritative Product",
				price: 1_250,
				quantity: 2,
			},
		]);
		const capabilities = capabilityInvoker({ taxStatus: "CALCULATED" });
		const result = await createSession({
			body: { cartId: "cart-1", shippingAddress },
			headers: new Headers({ cookie: "cart_guest_id=guest-1" }),
			context: {
				controllers: { checkout: { create, update, getLineItems } },
				capabilities,
				session: null,
			},
		});

		expect(result).toMatchObject({
			session: expect.objectContaining({
				taxAmount: 206,
				metadata: expect.objectContaining({ taxQuoteStatus: "CALCULATED" }),
			}),
		});
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({ shippingAddress }),
		);
		expect(capabilities.invoke).toHaveBeenCalledWith(
			expect.objectContaining({ name: "tax.quote", version: "2.0.0" }),
			expect.objectContaining({
				address: expect.objectContaining({ country: "US", state: "TX" }),
			}),
		);
	});

	it("fails closed on REVIEW_REQUIRED without returning a sellable inferred zero", async () => {
		const created = checkoutSession({ shippingAddress, taxAmount: 0 });
		const create = vi.fn().mockResolvedValue(created);
		const update = vi.fn();
		const getLineItems = vi.fn().mockResolvedValue([
			{
				productId: "product-1",
				name: "Authoritative Product",
				price: 1_250,
				quantity: 2,
			},
		]);
		const result = await createSession({
			body: { cartId: "cart-1", shippingAddress },
			headers: new Headers({ cookie: "cart_guest_id=guest-1" }),
			context: {
				controllers: { checkout: { create, update, getLineItems } },
				capabilities: capabilityInvoker({ taxStatus: "REVIEW_REQUIRED" }),
				session: null,
			},
		});

		expect(result).toMatchObject({
			code: "TAX_REVIEW_REQUIRED",
			status: 422,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it("persists the Store Customer ID instead of the authentication subject", async () => {
		const create = vi
			.fn()
			.mockResolvedValue(checkoutSession({ customerId: "store-customer-1" }));
		const result = await createSession({
			body: { cartId: "cart-1" },
			context: {
				controllers: { checkout: { create } },
				capabilities: capabilityInvoker({
					storeCustomerId: "store-customer-1",
				}),
				session: createMockSession({ userId: "auth-subject-1" }),
			},
		});

		expect(result).toHaveProperty("session");
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "store-customer-1" }),
		);
		expect(create).not.toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "auth-subject-1" }),
		);
	});

	it("rejects a caller-supplied shipping amount before reading or mutating a session", async () => {
		const getById = vi.fn();
		const update = vi.fn();
		const result = await updateSession({
			params: { id: "session-1" },
			body: { expectedRevision: 1, shippingAmount: 1 },
			context: { controllers: { checkout: { getById, update } } },
		});

		expect(result).toMatchObject({
			code: "CHECKOUT_CALLER_TOTALS_REJECTED",
			status: 422,
		});
		expect(getById).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it("recalculates tax.quote v2 when an authorized address update is persisted", async () => {
		const existing = checkoutSession({ customerId: "customer-1" });
		const updated = checkoutSession({
			customerId: "customer-1",
			shippingAddress,
			revision: 2,
		});
		const getById = vi.fn().mockResolvedValue(existing);
		const update = vi
			.fn()
			.mockResolvedValueOnce(updated)
			.mockResolvedValueOnce({
				...updated,
				taxAmount: 206,
				total: 2_706,
				metadata: { taxQuoteId: "quote-1", taxQuoteStatus: "CALCULATED" },
			});
		const getLineItems = vi.fn().mockResolvedValue([
			{
				productId: "product-1",
				name: "Authoritative Product",
				price: 1_250,
				quantity: 2,
			},
		]);
		const result = await updateSession({
			params: { id: "session-1" },
			body: { expectedRevision: 1, shippingAddress },
			context: {
				controllers: { checkout: { getById, update, getLineItems } },
				capabilities: capabilityInvoker({ taxStatus: "CALCULATED" }),
				session: createMockSession({ userId: "customer-1" }),
			},
		});

		expect(result).toMatchObject({
			session: expect.objectContaining({ taxAmount: 206 }),
		});
		expect(update).toHaveBeenCalledWith(
			"session-1",
			expect.objectContaining({ shippingAddress }),
			1,
		);
	});

	it("contains an authorized guest shipping quote until Shipping v2 is bound", async () => {
		const proof = await createGuestProofMetadata();
		const getLineItems = vi.fn();
		const capabilities = capabilityInvoker();
		const result = await getShippingRates({
			params: { id: "session-1" },
			headers: new Headers({
				cookie: `checkout_guest_session-1=${proof.proof}`,
			}),
			context: {
				controllers: {
					checkout: {
						getById: vi.fn().mockResolvedValue(
							checkoutSession({
								shippingAddress,
								metadata: proof.metadata,
							}),
						),
						getLineItems,
					},
				},
				capabilities,
				session: null,
			},
		});

		expect(result).toMatchObject({
			code: "CHECKOUT_SHIPPING_QUOTE_V2_REQUIRED",
			status: 503,
		});
		expect(getLineItems).not.toHaveBeenCalled();
		expect(capabilities.invoke).not.toHaveBeenCalled();
	});

	it("does not disclose a shipping containment state to an unauthorized guest", async () => {
		const proof = await createGuestProofMetadata();
		const result = await getShippingRates({
			params: { id: "session-1" },
			headers: new Headers({
				cookie: "checkout_guest_session-1=wrong-proof",
			}),
			context: {
				controllers: {
					checkout: {
						getById: vi
							.fn()
							.mockResolvedValue(checkoutSession({ metadata: proof.metadata })),
					},
				},
				session: null,
			},
		});

		expect(result).toEqual({
			error: "Checkout session not found",
			status: 404,
		});
	});

	it("returns a CALCULATED USPS Priority Mail option from Shipping v2", async () => {
		const proof = await createGuestProofMetadata();
		const session = checkoutSession({
			shippingAddress,
			metadata: proof.metadata,
		});
		const bound = {
			...session,
			shippingAmount: 1101,
			shippingMethodName: "USPS Priority Mail",
			taxAmount: 206,
			total: 3_807,
			metadata: {
				...proof.metadata,
				shippingQuoteId: "shipquote_1",
				shippingOptionId: "shipoption_1",
				shippingQuoteStatus: "CALCULATED",
			},
		};
		const createQuote = vi.fn().mockResolvedValue({
			quote: {
				id: "shipquote_1",
				expiresAt: new Date("2026-08-14T12:15:00.000Z"),
			},
			options: [
				{
					id: "shipoption_1",
					carrier: "USPS",
					service: "usps.priority_mail",
					amountMinor: 1101,
					currency: "USD",
					deliveryDays: 2,
				},
			],
		});
		const update = vi.fn().mockResolvedValue(bound);
		const getLineItems = vi.fn().mockResolvedValue([
			{
				productId: "product-1",
				name: "Authoritative Product",
				price: 1_250,
				quantity: 2,
			},
		]);
		const first = await getShippingRates({
			params: { id: "session-1" },
			headers: new Headers({
				cookie: `checkout_guest_session-1=${proof.proof}`,
			}),
			context: {
				controllers: {
					checkout: {
						getById: vi.fn().mockResolvedValue(session),
						update,
						getLineItems,
					},
					shippingV2: {
						listConnections: vi.fn().mockResolvedValue([
							{
								id: "shipping_easypost_default",
								lifecycle: "enabled",
								health: "healthy",
								capabilities: ["quote"],
							},
						]),
						createQuote,
					},
				},
				capabilities: capabilityInvoker({ taxStatus: "CALCULATED" }),
				session: null,
			},
		});
		const replay = await getShippingRates({
			params: { id: "session-1" },
			headers: new Headers({
				cookie: `checkout_guest_session-1=${proof.proof}`,
			}),
			context: {
				controllers: {
					checkout: {
						getById: vi.fn().mockResolvedValue(session),
						update,
						getLineItems,
					},
					shippingV2: {
						listConnections: vi.fn().mockResolvedValue([
							{
								id: "shipping_easypost_default",
								lifecycle: "enabled",
								health: "healthy",
								capabilities: ["quote"],
							},
						]),
						createQuote,
					},
				},
				capabilities: capabilityInvoker({ taxStatus: "CALCULATED" }),
				session: null,
			},
		});

		expect(first).toMatchObject({
			rates: [
				expect.objectContaining({
					id: "shipoption_1",
					name: "USPS Priority Mail",
					price: 1101,
					service: "usps.priority_mail",
					quoteId: "shipquote_1",
				}),
			],
		});
		expect(replay).toMatchObject({
			rates: [expect.objectContaining({ id: "shipoption_1", price: 1101 })],
		});
		expect(createQuote).toHaveBeenCalledTimes(2);
		expect(createQuote).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				checkoutId: "session-1",
				checkoutRevision: 1,
				idempotencyKey: "checkout-quote:session-1:1",
				parcelPlan: [
					expect.objectContaining({
						parcelReference: "checkout-default-parcel",
					}),
				],
			}),
		);
		expect(createQuote.mock.calls[1]?.[0]).toEqual(
			createQuote.mock.calls[0]?.[0],
		);
	});

	it("fails closed when Shipping v2 returns no USPS Priority Mail option", async () => {
		const proof = await createGuestProofMetadata();
		const createQuote = vi.fn().mockRejectedValue(new Error("no rate"));
		const update = vi.fn();
		const result = await getShippingRates({
			params: { id: "session-1" },
			headers: new Headers({
				cookie: `checkout_guest_session-1=${proof.proof}`,
			}),
			context: {
				controllers: {
					checkout: {
						getById: vi.fn().mockResolvedValue(
							checkoutSession({
								shippingAddress,
								metadata: proof.metadata,
							}),
						),
						update,
					},
					shippingV2: {
						listConnections: vi.fn().mockResolvedValue([
							{
								id: "shipping_easypost_default",
								lifecycle: "enabled",
								health: "healthy",
								capabilities: ["quote"],
							},
						]),
						createQuote,
					},
				},
				capabilities: capabilityInvoker(),
				session: null,
			},
		});

		expect(result).toMatchObject({
			code: "CHECKOUT_SHIPPING_QUOTE_UNAVAILABLE",
			status: 503,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it("returns explicit activation unavailability without downstream effects", async () => {
		const getById = vi.fn();
		const mutate = vi.fn();
		const input = {
			params: { id: "session-1" },
			context: {
				controllers: {
					checkout: { getById, update: mutate },
					inventory: { reserve: mutate, decrement: mutate },
					orders: { create: mutate },
					payments: { confirmIntent: mutate, captureIntent: mutate },
					shipping: { purchaseLabel: mutate },
				},
			},
		};

		const results = await Promise.all([
			confirmSessionUnavailable(input),
			createPaymentUnavailable(input),
			capturePaymentUnavailable(input),
			getPaymentUnavailable(input),
			completeSessionUnavailable(input),
		]);

		for (const result of results) {
			expect(result).toMatchObject({
				code: "CHECKOUT_ACTIVATION_UNAVAILABLE",
				status: 503,
			});
		}
		expect(getById).not.toHaveBeenCalled();
		expect(mutate).not.toHaveBeenCalled();
	});

	it("does not repeat downstream effects when completion is retried", async () => {
		const downstream = vi.fn();
		const input = {
			params: { id: "session-1" },
			context: {
				controllers: {
					checkout: { getById: downstream, complete: downstream },
					inventory: { decrement: downstream },
					orders: { create: downstream },
					payments: { captureIntent: downstream },
					shipping: { purchaseLabel: downstream },
				},
			},
		};

		const first = await completeSessionUnavailable(input);
		const retry = await completeSessionUnavailable(input);

		expect(first).toMatchObject({
			code: "CHECKOUT_ACTIVATION_UNAVAILABLE",
			status: 503,
		});
		expect(retry).toMatchObject({
			code: "CHECKOUT_ACTIVATION_UNAVAILABLE",
			status: 503,
		});
		expect(downstream).not.toHaveBeenCalled();
	});
});
