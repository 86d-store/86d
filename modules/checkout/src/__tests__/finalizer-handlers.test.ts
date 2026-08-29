import type { CapabilityInvoker } from "@86d-app/core/capabilities";
import {
	orderCreateCapability,
	paymentCheckoutCapability,
	taxQuoteV2Capability,
} from "@86d-app/core/commerce-capabilities";
import { inventoryCheckoutV2Capability } from "@86d-app/core/inventory-reservation-capability";
import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { getProcessEnv, setProcessEnv } from "env/process-env";
import { describe, expect, it, vi } from "vitest";
import { createCheckoutFinalizationStore } from "../finalization";
import {
	createCheckoutFinalizationHandlers,
	createCheckoutFinalizationTransport,
	isPaymentLiveActivated,
} from "../finalizer-handlers";
import type { CheckoutSession } from "../service";
import { createCheckoutController } from "../service-impl";
import { createTransactionTestStore } from "./transaction-test-utils";

const address = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "1 Main St",
	city: "Austin",
	state: "TX",
	postalCode: "78701",
	country: "US",
};

const legacyGiftCardCases: ReadonlyArray<{
	label: string;
	fields: Partial<Pick<CheckoutSession, "giftCardAmount" | "giftCardCode">>;
}> = [
	{ label: "stored code", fields: { giftCardCode: "GIFT-LEGACY" } },
	{ label: "stored amount", fields: { giftCardAmount: 1_000 } },
];

const resumableExecutableSteps = [
	"checkout_revision",
	"accepted_offer",
	"shipping_and_tax",
	"inventory",
	"payment_connection",
	"payment_outcome",
	"order",
	"commerce_commit",
	"payment_settlement",
	"checkout_completion",
] as const;

function paypalConnection(
	overrides: Partial<{
		id: string;
		health: "unknown" | "healthy" | "degraded" | "unhealthy";
		lifecycle: "draft" | "enabled" | "disabled" | "revoked";
	}> = {},
) {
	return {
		id: overrides.id ?? "payment-connection-1",
		providerAccountId: "PAYPAL-1",
		name: "PayPal",
		normalizedName: "paypal",
		provider: "paypal",
		mode: "test" as const,
		capabilities: ["authorization", "capture"] as (
			| "authorization"
			| "capture"
		)[],
		health: overrides.health ?? "unknown",
		lifecycle: overrides.lifecycle ?? "draft",
		secretReference: "secret/paypal",
		createdAt: new Date("2026-08-13T00:00:00.000Z"),
		updatedAt: new Date("2026-08-13T00:00:00.000Z"),
	};
}

function paymentConnectionsMock(
	connection: ReturnType<typeof paypalConnection> | null = paypalConnection(),
) {
	return {
		async getConnection(id: string) {
			return connection && connection.id === id ? connection : null;
		},
	};
}

function admission(overrides?: {
	taxQuoteId?: string;
	inventoryReservationIds?: string[];
	paymentConnectionId?: string;
}) {
	return {
		operationKey: "finalize-operation-handlers-1",
		checkoutId: "checkout-1",
		expectedRevision: 1,
		acceptedInput: {
			acceptedOfferId: "offer-1",
			acceptanceId: "acceptance-1",
			catalogRevisionId: "catalog-revision-1",
			pricingDecisionId: "pricing-decision-1",
			discountDecisionIds: [],
			inventoryReservationIds: overrides?.inventoryReservationIds ?? [
				"reservation-1",
			],
			shippingQuoteId: "shipping-quote-1",
			shippingOptionId: "shipping-option-1",
			taxQuoteId: overrides?.taxQuoteId ?? "quote-1",
			paymentConnectionId:
				overrides?.paymentConnectionId ?? "payment-connection-1",
			paymentPolicyId: "authorize-then-capture-v1",
		},
	};
}

function taxDecision(
	status: "CALCULATED" | "REVIEW_REQUIRED",
	request: {
		currency: string;
		lineItems: Array<{
			lineId: string;
			productId: string;
			taxCategoryId: string;
			quantity: number;
			unitAmount: number;
			discountAmount?: number;
			variantId?: string;
		}>;
		shippingAmount?: number;
	},
) {
	const subtotal = request.lineItems.reduce(
		(sum, line) => sum + line.unitAmount * line.quantity,
		0,
	);
	const discount = request.lineItems.reduce(
		(sum, line) => sum + (line.discountAmount ?? 0),
		0,
	);
	const shipping = request.shippingAmount ?? 0;
	const tax =
		status === "REVIEW_REQUIRED"
			? null
			: Math.round((subtotal - discount) * 0.0825);
	return {
		quoteId: status === "REVIEW_REQUIRED" ? "quote-review" : "quote-1",
		jurisdictionDecision:
			status === "REVIEW_REQUIRED"
				? ("BLOCKED" as const)
				: ("COLLECT" as const),
		status,
		reason:
			status === "REVIEW_REQUIRED"
				? ("RATE_NOT_CONFIGURED" as const)
				: ("TAX_CALCULATED" as const),
		policyVersion: status === "REVIEW_REQUIRED" ? "unconfigured" : "policy-v1",
		sourceVersion: status === "REVIEW_REQUIRED" ? "unconfigured" : "rates-v1",
		issuedAt: "2026-08-14T00:00:00.000Z",
		expiresAt: "2026-08-14T00:10:00.000Z",
		currency: request.currency,
		totals: {
			subtotal,
			discount,
			shipping,
			taxable: subtotal - discount,
			lineTax: tax,
			shippingTax: status === "REVIEW_REQUIRED" ? null : 0,
			tax,
			grandTotal: tax === null ? null : subtotal - discount + shipping + tax,
		},
		lineAllocations: request.lineItems.map((line) => {
			const grossAmount = line.unitAmount * line.quantity;
			const discountAmount = line.discountAmount ?? 0;
			return {
				lineId: line.lineId,
				productId: line.productId,
				...(line.variantId ? { variantId: line.variantId } : {}),
				taxCategoryId: line.taxCategoryId,
				quantity: line.quantity,
				grossAmount,
				discountAmount,
				taxableAmount: grossAmount - discountAmount,
				taxAmount:
					tax === null
						? null
						: Math.round((grossAmount - discountAmount) * 0.0825),
			};
		}),
	};
}

function taxOnlyInvoker(
	status: "CALCULATED" | "REVIEW_REQUIRED",
): CapabilityInvoker {
	return {
		async invoke(definition, request) {
			if (definition === taxQuoteV2Capability) {
				return {
					ok: true as const,
					decision: taxDecision(
						status,
						request as Parameters<typeof taxDecision>[1],
					),
				};
			}
			return {
				ok: false as const,
				failure: {
					code: "CAPABILITY_UNAVAILABLE" as const,
					capability: definition.name,
					version: definition.version,
				},
			};
		},
	} as CapabilityInvoker;
}

describe("Checkout finalization handlers", () => {
	it("keeps payment step helpers private behind the contained handler factory", async () => {
		const finalizerHandlersModule = await import("../finalizer-handlers");
		expect(finalizerHandlersModule).not.toHaveProperty(
			"handlePaymentConnection",
		);
		expect(finalizerHandlersModule).not.toHaveProperty("handlePaymentOutcome");
		expect(finalizerHandlersModule).not.toHaveProperty(
			"handlePaymentSettlement",
		);
	});

	it.each(legacyGiftCardCases)(
		"contains a legacy gift-card $label before capabilities or completion",
		async ({ fields }) => {
			const storage = createTransactionTestStore();
			const checkout = createCheckoutController(storage.data);
			await checkout.create({
				id: "checkout-1",
				subtotal: 1_000,
				total: 0,
				discountAmount: 1_000,
				lineItems: [
					{ productId: "p1", name: "Widget", price: 1_000, quantity: 1 },
				],
				shippingAddress: address,
			});
			const stored = await storage.data.get("checkoutSession", "checkout-1");
			if (!stored) throw new Error("Expected the Checkout fixture to exist");
			await storage.data.upsert("checkoutSession", "checkout-1", {
				...stored,
				...fields,
			});

			const capabilities: CapabilityInvoker = {
				async invoke() {
					throw new Error("Legacy gift-card containment must run first");
				},
			};
			const store = createCheckoutFinalizationStore(storage.transactions);
			const admitted = await store.admit(admission());
			const handlers = createCheckoutFinalizationHandlers({
				checkout,
				capabilities,
			});

			const run = await createCheckoutFinalizationTransport({
				store,
				handlers,
			}).run({ finalizationId: admitted.finalization.id });

			expect(run.finalization).toMatchObject({
				state: "needs_attention",
				currentStep: "checkout_revision",
				needsAttention: { code: "GIFT_CARD_WORKFLOW_REQUIRED" },
				result: {},
			});
			const unchanged = await checkout.getById("checkout-1");
			expect(unchanged?.status).toBe("pending");
			expect(unchanged?.orderId).toBeUndefined();
		},
	);

	it.each(
		legacyGiftCardCases.flatMap(({ label, fields }) =>
			resumableExecutableSteps.map((step) => ({ label, fields, step })),
		),
	)(
		"contains a legacy gift-card $label when resuming at $step",
		async ({ fields, step }) => {
			const storage = createTransactionTestStore();
			const checkout = createCheckoutController(storage.data);
			await checkout.create({
				id: "checkout-1",
				subtotal: 1_000,
				total: 0,
				discountAmount: 1_000,
				lineItems: [
					{ productId: "p1", name: "Widget", price: 1_000, quantity: 1 },
				],
				shippingAddress: address,
			});
			const stored = await storage.data.get("checkoutSession", "checkout-1");
			if (!stored) throw new Error("Expected the Checkout fixture to exist");
			await storage.data.upsert("checkoutSession", "checkout-1", {
				...stored,
				...fields,
			});

			const store = createCheckoutFinalizationStore(storage.transactions);
			const admitted = await store.admit(admission());
			let seededFinalization = admitted.finalization;
			const resumeIndex = resumableExecutableSteps.indexOf(step);
			for (let index = 0; index < resumeIndex; index += 1) {
				const currentStep = resumableExecutableSteps[index];
				const nextStep = resumableExecutableSteps[index + 1];
				if (!currentStep || !nextStep) {
					throw new Error("Expected a valid Finalization checkpoint pair");
				}
				const recorded = await store.recordAttempt({
					finalizationId: seededFinalization.id,
					attemptKey: `resume-seed:${currentStep}:${seededFinalization.attemptCount}`,
					expectedAttemptCount: seededFinalization.attemptCount,
					expectedState:
						seededFinalization.state === "pending" ? "pending" : "running",
					expectedStep: currentStep,
					outcome: { type: "advanced", nextStep },
					...(currentStep === "order"
						? { result: { orderId: "order-resume-seed" } }
						: {}),
				});
				seededFinalization = recorded.finalization;
			}
			expect(seededFinalization.currentStep).toBe(step);

			const invoke = vi.fn(async () => {
				throw new Error(
					"A contained Finalization must not invoke a capability",
				);
			});
			const getConnection = vi.fn(async () => {
				throw new Error("A contained Finalization must not read a Connection");
			});
			const getPayment = vi.fn(async () => {
				throw new Error("A contained Finalization must not read a Payment");
			});
			const submitOperation = vi.fn(async () => {
				throw new Error("A contained Finalization must not submit a Payment");
			});
			const resolvePaymentAggregate = vi.fn(async () => {
				throw new Error("A contained Finalization must not resolve a Payment");
			});
			const getLineItems = vi.spyOn(checkout, "getLineItems");
			const update = vi.spyOn(checkout, "update");
			const complete = vi.spyOn(checkout, "complete");
			const handlers = createCheckoutFinalizationHandlers({
				checkout,
				capabilities: { invoke } as unknown as CapabilityInvoker,
				paymentConnections: { getConnection },
				paymentAggregates: { get: getPayment },
				managedPaymentClient: { configured: true, submitOperation },
				resolvePaymentAggregate,
			});

			const run = await createCheckoutFinalizationTransport({
				store,
				handlers,
			}).run({ finalizationId: admitted.finalization.id });

			expect(run.attemptsRecorded).toBe(1);
			expect(run.finalization).toMatchObject({
				state: "needs_attention",
				currentStep: step,
				needsAttention: { code: "GIFT_CARD_WORKFLOW_REQUIRED" },
			});
			expect(invoke).not.toHaveBeenCalled();
			expect(getConnection).not.toHaveBeenCalled();
			expect(getPayment).not.toHaveBeenCalled();
			expect(submitOperation).not.toHaveBeenCalled();
			expect(resolvePaymentAggregate).not.toHaveBeenCalled();
			expect(getLineItems).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
			expect(complete).not.toHaveBeenCalled();
		},
	);

	it("stops at shipping_and_tax with TAX_REVIEW_REQUIRED and never invents zero tax", async () => {
		const storage = createTransactionTestStore();
		const checkout = createCheckoutController(storage.data);
		await checkout.create({
			id: "checkout-1",
			subtotal: 1000,
			total: 1000,
			lineItems: [
				{ productId: "p1", name: "Widget", price: 1000, quantity: 1 },
			],
			shippingAddress: address,
			taxAmount: 40,
		});

		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		const handlers = createCheckoutFinalizationHandlers({
			checkout,
			capabilities: taxOnlyInvoker("REVIEW_REQUIRED"),
		});

		const run = await createCheckoutFinalizationTransport({
			store,
			handlers,
		}).run({ finalizationId: admitted.finalization.id });

		expect(run.finalization).toMatchObject({
			state: "needs_attention",
			currentStep: "shipping_and_tax",
			needsAttention: { code: "TAX_REVIEW_REQUIRED" },
		});
		const unchanged = await checkout.getById("checkout-1");
		expect(unchanged?.taxAmount).toBe(40);
		expect(unchanged?.status).toBe("pending");
	});

	it("revalidates CALCULATED tax, then fails closed on contained payment activation", async () => {
		const storage = createTransactionTestStore();
		const checkout = createCheckoutController(storage.data);
		await checkout.create({
			id: "checkout-1",
			subtotal: 1000,
			total: 1083,
			taxAmount: 0,
			lineItems: [
				{ productId: "p1", name: "Widget", price: 1000, quantity: 1 },
			],
			shippingAddress: address,
		});

		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		const handlers = createCheckoutFinalizationHandlers({
			checkout,
			capabilities: taxOnlyInvoker("CALCULATED"),
			paymentConnections: paymentConnectionsMock(
				paypalConnection({ lifecycle: "draft", health: "unknown" }),
			),
		});

		const run = await createCheckoutFinalizationTransport({
			store,
			handlers,
		}).run({ finalizationId: admitted.finalization.id });

		expect(run.finalization).toMatchObject({
			state: "needs_attention",
			currentStep: "payment_outcome",
			needsAttention: { code: "PAYMENT_ACTIVATION_REQUIRED" },
		});
		const taxed = await checkout.getById("checkout-1");
		expect(taxed?.taxAmount).toBe(83);
		expect(taxed?.metadata).toMatchObject({
			taxQuoteId: "quote-1",
			taxQuoteStatus: "CALCULATED",
		});
	});

	it("completes the Checkout session once payment and Order succeed", async () => {
		const storage = createTransactionTestStore();
		const checkout = createCheckoutController(storage.data);
		await checkout.create({
			id: "checkout-1",
			subtotal: 1000,
			total: 0,
			taxAmount: 0,
			discountAmount: 1000,
			lineItems: [
				{ productId: "p1", name: "Widget", price: 1000, quantity: 1 },
			],
			shippingAddress: address,
		});

		const capabilities = {
			async invoke(
				definition: { name: string; version: string },
				request: unknown,
			) {
				if (definition === taxQuoteV2Capability) {
					return {
						ok: true as const,
						decision: taxDecision(
							"CALCULATED",
							request as Parameters<typeof taxDecision>[1],
						),
					};
				}
				if (definition === inventoryCheckoutV2Capability) {
					return {
						ok: true as const,
						decision: {
							operation: "reserve" as const,
							reservation: {
								id: "reservation-live-1",
								checkoutId: "checkout-1",
								lineId: "p1::0",
								productId: "p1",
								quantity: 1,
								leaseExpiresAt: "2026-08-14T00:15:00.000Z",
								status: "reserved" as const,
							},
						},
					};
				}
				if (definition === orderCreateCapability) {
					return {
						ok: true as const,
						decision: {
							orderId: "order:fin-1",
							orderNumber: "1001",
						},
					};
				}
				if (definition === paymentCheckoutCapability) {
					return {
						ok: false as const,
						failure: {
							code: "PAYMENT_NOT_FOUND" as const,
							message: "unused",
						},
					};
				}
				return {
					ok: false as const,
					failure: {
						code: "CAPABILITY_UNAVAILABLE" as const,
						capability: definition.name,
						version: definition.version,
					},
				};
			},
		} as CapabilityInvoker;

		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(
			admission({ inventoryReservationIds: ["reservation-1"] }),
		);

		const handlers = createCheckoutFinalizationHandlers({
			checkout,
			capabilities,
			paymentConnections: paymentConnectionsMock(
				paypalConnection({ lifecycle: "enabled", health: "healthy" }),
			),
		});
		const run = await createCheckoutFinalizationTransport({
			store,
			handlers,
		}).run({ finalizationId: admitted.finalization.id });

		expect(run.finalization.state).toBe("completed");
		expect(run.finalization.result.orderId).toBeTruthy();
		const completed = await checkout.getById("checkout-1");
		expect(completed?.status).toBe("completed");
		expect(completed?.orderId).toBe(run.finalization.result.orderId);
	});

	it("rejects unknown payment connections at payment_connection", async () => {
		const storage = createTransactionTestStore();
		const checkout = createCheckoutController(storage.data);
		await checkout.create({
			id: "checkout-1",
			subtotal: 1000,
			total: 1083,
			taxAmount: 83,
			lineItems: [
				{ productId: "p1", name: "Widget", price: 1000, quantity: 1 },
			],
			shippingAddress: address,
		});
		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		const finalization = admitted.finalization;

		const handler = createCheckoutFinalizationHandlers({
			checkout,
			capabilities: taxOnlyInvoker("CALCULATED"),
			paymentConnections: {
				async getConnection() {
					return null;
				},
			},
		}).payment_connection;
		if (!handler) throw new Error("Expected a payment_connection handler");
		const outcome = await handler({
			finalization,
			step: "payment_connection",
		});

		expect(outcome.outcome).toMatchObject({
			type: "needs_attention",
			reason: { code: "PAYMENT_CONNECTION_NOT_FOUND" },
		});
	});

	it("advances managed payment outcome when the v2 aggregate is authorized", async () => {
		const storage = createTransactionTestStore();
		const checkout = createCheckoutController(storage.data);
		await checkout.create({
			id: "checkout-1",
			subtotal: 1000,
			total: 1083,
			taxAmount: 83,
			lineItems: [
				{ productId: "p1", name: "Widget", price: 1000, quantity: 1 },
			],
			shippingAddress: address,
			metadata: { paymentV2Id: "payment-1" },
		});

		const paymentStorage = createMockTransactionRunner({ storeId: "store-1" });
		await paymentStorage.data.upsert(
			"paymentConnection",
			"payment-connection-1",
			{
				id: "payment-connection-1",
				providerAccountId: "MERCHANT-1",
				name: "86d Payments",
				normalizedName: "86d payments",
				provider: "86d_payments",
				mode: "test",
				capabilities: ["authorization", "capture", "void"],
				health: "healthy",
				lifecycle: "enabled",
				secretReference: "secret/managed-1",
				enabledAt: new Date("2026-08-13T00:00:00.000Z"),
				createdAt: new Date("2026-08-13T00:00:00.000Z"),
				updatedAt: new Date("2026-08-13T00:00:00.000Z"),
			},
		);
		// A fake satisfying PaymentAggregateReaderPort. Building a real aggregate
		// here would make payments a build dependency of checkout, which is the
		// undeclared edge the Module isolation guard rejects.
		const paymentAggregates = {
			async get(paymentId: string) {
				if (paymentId !== "payment-1") return null;
				return {
					id: "payment-1",
					paymentOption: "card",
					currency: "USD",
					expectedAmount: 1_083,
					authorizedAmount: 1_083,
					capturedAmount: 0,
					providerReferences: [
						{
							operationId: "authorization-1",
							operation: "authorization",
							providerReference: "provider-auth-1",
							amount: 1_083,
							currency: "USD",
						},
					],
				};
			},
		};

		const store = createCheckoutFinalizationStore(storage.transactions);
		const admitted = await store.admit(admission());
		const handlers = createCheckoutFinalizationHandlers({
			checkout,
			capabilities: taxOnlyInvoker("CALCULATED"),
			paymentConnections: {
				async getConnection(id) {
					return paymentStorage.data.get("paymentConnection", id) as never;
				},
			},
			paymentAggregates,
		});

		const previousActivation = getProcessEnv("86D_PAYMENTS_LIVE_ACTIVATION");
		setProcessEnv("86D_PAYMENTS_LIVE_ACTIVATION", "true");
		try {
			const run = await createCheckoutFinalizationTransport({
				store,
				handlers,
			}).run({ finalizationId: admitted.finalization.id });
			expect(run.finalization.currentStep).not.toBe("payment_outcome");
			expect(run.finalization.needsAttention?.code).not.toBe(
				"PAYMENT_ACTIVATION_REQUIRED",
			);
		} finally {
			if (previousActivation === undefined) {
				setProcessEnv("86D_PAYMENTS_LIVE_ACTIVATION", undefined);
			} else {
				setProcessEnv("86D_PAYMENTS_LIVE_ACTIVATION", previousActivation);
			}
		}
	});

	it("treats enabled healthy connections as live activated", () => {
		expect(
			isPaymentLiveActivated({
				id: "connection-1",
				providerAccountId: "acct-1",
				provider: "paypal",
				mode: "test",
				health: "healthy",
				lifecycle: "enabled",
			}),
		).toBe(true);
	});
});
