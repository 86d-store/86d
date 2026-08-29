import type { CapabilityInvoker } from "@86d-app/core/capabilities";
import {
	orderCreateCapability,
	paymentCheckoutCapability,
} from "@86d-app/core/commerce-capabilities";
import { inventoryCheckoutV2Capability } from "@86d-app/core/inventory-reservation-capability";
import type {
	ManagedPaymentClientPort,
	PaymentAggregatePort,
	PaymentAggregateReaderPort,
	PaymentConnectionPort,
} from "@86d-app/core/payment-checkout-ports";
import { getProcessEnv } from "env/process-env";
import type {
	CheckoutFinalization,
	CheckoutFinalizationStore,
} from "./finalization";
import {
	type CheckoutFinalizationStepHandler,
	type CheckoutFinalizationStepHandlers,
	type CheckoutFinalizationStepOutcome,
	type CheckoutFinalizer,
	createCheckoutFinalizer,
} from "./finalizer";
import type { CheckoutController, CheckoutSession } from "./service";
import { recalculateTax } from "./store/endpoints/recalculate-tax";

const MANAGED_PAYMENT_PROVIDER = "86d_payments";
const THIRD_PARTY_PAYMENT_PROVIDERS = new Set([
	"paypal",
	"stripe",
	"braintree",
	"square",
]);

const NEXT_STEP = {
	checkout_revision: "accepted_offer",
	accepted_offer: "shipping_and_tax",
	shipping_and_tax: "inventory",
	inventory: "payment_connection",
	payment_connection: "payment_outcome",
	payment_outcome: "order",
	order: "commerce_commit",
	commerce_commit: "payment_settlement",
	payment_settlement: "checkout_completion",
} as const;

function advance(
	step: keyof typeof NEXT_STEP,
): CheckoutFinalizationStepOutcome {
	return {
		outcome: { type: "advanced", nextStep: NEXT_STEP[step] },
	};
}

function needsAttention(
	code: string,
	detail?: string,
): CheckoutFinalizationStepOutcome {
	return {
		outcome: {
			type: "needs_attention",
			reason: detail ? { code, detail } : { code },
		},
	};
}

function retryable(
	code: string,
	detail?: string,
): CheckoutFinalizationStepOutcome {
	return {
		outcome: {
			type: "retryable_failure",
			reason: detail ? { code, detail } : { code },
		},
	};
}

function legacyGiftCardContainment(
	session: CheckoutSession,
): CheckoutFinalizationStepOutcome | undefined {
	if (session.giftCardCode === undefined && session.giftCardAmount === 0) {
		return undefined;
	}

	return needsAttention(
		"GIFT_CARD_WORKFLOW_REQUIRED",
		"A legacy gift-card application cannot be finalized without coordinated redemption evidence.",
	);
}

export function isManagedPaymentProvider(provider: string): boolean {
	return provider === MANAGED_PAYMENT_PROVIDER;
}

export function isThirdPartyPaymentProvider(provider: string): boolean {
	return THIRD_PARTY_PAYMENT_PROVIDERS.has(provider);
}

export function isPaymentLiveActivated(
	connection: PaymentConnectionPort,
): boolean {
	if (getProcessEnv("86D_PAYMENTS_LIVE_ACTIVATION") === "true") {
		return true;
	}
	return connection.lifecycle === "enabled" && connection.health === "healthy";
}

export type CheckoutFinalizationHandlerDependencies = Readonly<{
	capabilities: CapabilityInvoker;
	checkout: CheckoutController;
	/** Lease duration for inventory reservations created during finalization. */
	reservationLeaseSeconds?: number | undefined;
	paymentConnections?:
		| {
				getConnection(id: string): Promise<PaymentConnectionPort | null>;
		  }
		| undefined;
	paymentAggregates?: PaymentAggregateReaderPort | undefined;
	managedPaymentClient?: ManagedPaymentClientPort | undefined;
	resolvePaymentAggregate?: (
		checkoutId: string,
		connectionId: string,
	) => Promise<PaymentAggregatePort | null>;
}>;

/**
 * Real capability handlers for the Checkout Finalizer.
 *
 * Activation of shopper payment and label purchase remains contained elsewhere.
 * These handlers invoke Tax, Inventory, Payment, and Order capabilities and
 * complete the Checkout session only after an Order identity exists. Missing
 * or non-authoritative decisions fail closed with needs_attention /
 * retryable_failure — they never invent success.
 */
export function createCheckoutFinalizationHandlers(
	deps: CheckoutFinalizationHandlerDependencies,
): CheckoutFinalizationStepHandlers {
	const leaseSeconds = deps.reservationLeaseSeconds ?? 900;
	const containLegacyGiftCard = (
		handler: CheckoutFinalizationStepHandler,
	): CheckoutFinalizationStepHandler => {
		return async (context) => {
			const session = await deps.checkout.getById(
				context.finalization.checkoutId,
			);
			if (!session) {
				return needsAttention(
					"CHECKOUT_NOT_FOUND",
					"The Checkout session named by this Finalization is gone.",
				);
			}
			const containment = legacyGiftCardContainment(session);
			if (containment) return containment;
			return handler(context);
		};
	};

	return {
		checkout_revision: containLegacyGiftCard(async ({ finalization }) => {
			const session = await deps.checkout.getById(finalization.checkoutId);
			if (!session) {
				return needsAttention(
					"CHECKOUT_NOT_FOUND",
					"The Checkout session named by this Finalization is gone.",
				);
			}
			if (session.revision !== finalization.expectedRevision) {
				return needsAttention(
					"CHECKOUT_REVISION_CONFLICT",
					"The Checkout revision no longer matches the accepted Finalization.",
				);
			}
			return advance("checkout_revision");
		}),

		accepted_offer: containLegacyGiftCard(async ({ finalization }) => {
			if (!finalization.acceptedInput.acceptedOfferId) {
				return needsAttention("ACCEPTED_OFFER_REQUIRED");
			}
			return advance("accepted_offer");
		}),

		shipping_and_tax: containLegacyGiftCard(async ({ finalization }) => {
			return handleShippingAndTax(deps, finalization);
		}),

		inventory: containLegacyGiftCard(async ({ finalization }) => {
			return handleInventory(deps, finalization, leaseSeconds);
		}),

		payment_connection: containLegacyGiftCard(async ({ finalization }) => {
			return handlePaymentConnection(deps, finalization);
		}),

		payment_outcome: containLegacyGiftCard(async ({ finalization }) => {
			return handlePaymentOutcome(deps, finalization);
		}),

		order: containLegacyGiftCard(async ({ finalization }) => {
			return handleOrder(deps, finalization);
		}),

		commerce_commit: containLegacyGiftCard(async () => {
			return advance("commerce_commit");
		}),

		payment_settlement: containLegacyGiftCard(async ({ finalization }) => {
			return handlePaymentSettlement(deps, finalization);
		}),

		checkout_completion: containLegacyGiftCard(async ({ finalization }) => {
			return handleCheckoutCompletion(deps, finalization);
		}),
	};
}

/**
 * Transport entry: drive one Finalization with the real capability handlers.
 * Safe to schedule; does not expose a shopper HTTP activation path.
 */
export function createCheckoutFinalizationTransport(options: {
	store: CheckoutFinalizationStore;
	handlers: CheckoutFinalizationStepHandlers;
	maxAttemptsPerRun?: number | undefined;
}): CheckoutFinalizer {
	return createCheckoutFinalizer(options);
}

async function resolveConnection(
	deps: CheckoutFinalizationHandlerDependencies,
	connectionId: string,
): Promise<PaymentConnectionPort | null> {
	return deps.paymentConnections?.getConnection(connectionId) ?? null;
}

async function resolvePayment(
	deps: CheckoutFinalizationHandlerDependencies,
	finalization: CheckoutFinalization,
	connectionId: string,
): Promise<PaymentAggregatePort | null> {
	if (finalization.result.payment?.paymentId && deps.paymentAggregates) {
		return deps.paymentAggregates.get(finalization.result.payment.paymentId);
	}
	if (deps.resolvePaymentAggregate) {
		return deps.resolvePaymentAggregate(finalization.checkoutId, connectionId);
	}
	const session = await deps.checkout.getById(finalization.checkoutId);
	const paymentId =
		typeof session?.metadata?.paymentV2Id === "string"
			? session.metadata.paymentV2Id
			: undefined;
	if (paymentId && deps.paymentAggregates) {
		return deps.paymentAggregates.get(paymentId);
	}
	return null;
}

async function handlePaymentConnection(
	deps: CheckoutFinalizationHandlerDependencies,
	finalization: CheckoutFinalization,
): Promise<CheckoutFinalizationStepOutcome> {
	const connectionId = finalization.acceptedInput.paymentConnectionId;
	if (!connectionId) {
		return needsAttention(
			"PAYMENT_CONNECTION_REQUIRED",
			"Finalization cannot advance without a Payment Connection identity.",
		);
	}

	const connection = await resolveConnection(deps, connectionId);
	if (!connection) {
		return needsAttention(
			"PAYMENT_CONNECTION_NOT_FOUND",
			"The accepted Payment Connection does not exist.",
		);
	}

	if (
		!isManagedPaymentProvider(connection.provider) &&
		!isThirdPartyPaymentProvider(connection.provider)
	) {
		return needsAttention(
			"PAYMENT_CONNECTION_UNSUPPORTED",
			`Provider '${connection.provider}' is not routable for Checkout finalization.`,
		);
	}

	if (
		connection.lifecycle === "revoked" ||
		connection.lifecycle === "disabled"
	) {
		return needsAttention(
			"PAYMENT_CONNECTION_NOT_USABLE",
			"The accepted Payment Connection is not enabled.",
		);
	}

	return advance("payment_connection");
}

async function handleShippingAndTax(
	deps: CheckoutFinalizationHandlerDependencies,
	finalization: CheckoutFinalization,
): Promise<CheckoutFinalizationStepOutcome> {
	const session = await deps.checkout.getById(finalization.checkoutId);
	if (!session) {
		return needsAttention("CHECKOUT_NOT_FOUND");
	}
	if (!session.shippingAddress) {
		return needsAttention(
			"SHIPPING_ADDRESS_REQUIRED",
			"Tax cannot be decided without a shipping address.",
		);
	}

	const tax = await recalculateTax(session, deps.checkout, deps.capabilities);
	if (!tax.ok) {
		if (tax.code === "TAX_REVIEW_REQUIRED") {
			return needsAttention(
				"TAX_REVIEW_REQUIRED",
				tax.reason ?? "Tax requires merchant review before payment.",
			);
		}
		return retryable("CHECKOUT_TAX_UNAVAILABLE");
	}

	const quoteId = tax.session.metadata?.taxQuoteId;
	if (typeof quoteId !== "string" || quoteId.length === 0) {
		return needsAttention("TAX_QUOTE_REQUIRED");
	}

	const acceptedQuoteId = finalization.acceptedInput.taxQuoteId;
	if (acceptedQuoteId && acceptedQuoteId !== quoteId) {
		return needsAttention(
			"TAX_QUOTE_MISMATCH",
			"The live Tax quote no longer matches the accepted Finalization input.",
		);
	}

	return advance("shipping_and_tax");
}

async function handleInventory(
	deps: CheckoutFinalizationHandlerDependencies,
	finalization: CheckoutFinalization,
	leaseSeconds: number,
): Promise<CheckoutFinalizationStepOutcome> {
	const lineItems = await deps.checkout.getLineItems(finalization.checkoutId);
	if (lineItems.length === 0) {
		return needsAttention("CHECKOUT_LINES_REQUIRED");
	}

	const existing = finalization.acceptedInput.inventoryReservationIds;
	if (existing.length > 0 && existing.length === lineItems.length) {
		return advance("inventory");
	}

	for (const [index, item] of lineItems.entries()) {
		const lineId = `${item.productId}:${item.variantId ?? ""}:${index}`;
		const idempotencyKey = `finalize:${finalization.id}:inventory:${lineId}`;
		const result = await deps.capabilities.invoke(
			inventoryCheckoutV2Capability,
			{
				operation: "reserve",
				checkoutId: finalization.checkoutId,
				lineId,
				productId: item.productId,
				...(item.variantId ? { variantId: item.variantId } : {}),
				quantity: item.quantity,
				leaseDurationSeconds: leaseSeconds,
				idempotencyKey,
			},
		);
		if (!result.ok) {
			return retryable("INVENTORY_RESERVATION_FAILED", result.failure.code);
		}
		if (result.decision.operation !== "reserve") {
			return needsAttention("INVENTORY_DECISION_INVALID");
		}
		if (result.decision.reservation.status !== "reserved") {
			return needsAttention(
				"INVENTORY_NOT_RESERVED",
				result.decision.reservation.status,
			);
		}
	}

	return advance("inventory");
}

function paymentOutcomeSatisfied(
	payment: PaymentAggregatePort,
	policyId: string | undefined,
): boolean {
	if (policyId === "authorize-then-capture-v1") {
		return payment.authorizedAmount > 0 || payment.capturedAmount > 0;
	}
	return payment.capturedAmount >= payment.expectedAmount;
}

async function handlePaymentOutcome(
	deps: CheckoutFinalizationHandlerDependencies,
	finalization: CheckoutFinalization,
): Promise<CheckoutFinalizationStepOutcome> {
	const session = await deps.checkout.getById(finalization.checkoutId);
	if (!session) {
		return needsAttention("CHECKOUT_NOT_FOUND");
	}

	if (session.total <= 0) {
		return advance("payment_outcome");
	}

	const connectionId = finalization.acceptedInput.paymentConnectionId;
	if (!connectionId) {
		return needsAttention("PAYMENT_CONNECTION_REQUIRED");
	}

	const connection = await resolveConnection(deps, connectionId);
	if (!connection) {
		return needsAttention("PAYMENT_CONNECTION_NOT_FOUND");
	}

	if (!isPaymentLiveActivated(connection)) {
		return needsAttention(
			"PAYMENT_ACTIVATION_REQUIRED",
			"Live payment activation remains contained until production evidence exists.",
		);
	}

	if (isManagedPaymentProvider(connection.provider)) {
		const payment = await resolvePayment(deps, finalization, connectionId);
		if (!payment) {
			return needsAttention(
				"PAYMENT_NOT_FOUND",
				"No managed Payment aggregate exists for this Checkout.",
			);
		}
		if (
			!paymentOutcomeSatisfied(
				payment,
				finalization.acceptedInput.paymentPolicyId,
			)
		) {
			return needsAttention(
				"PAYMENT_NOT_COMPLETED",
				"The managed Payment outcome has not confirmed authorization.",
			);
		}
		return {
			outcome: { type: "advanced", nextStep: "order" },
			result: {
				payment: {
					connectionId,
					paymentId: payment.id,
					...(payment.providerReferences.find(
						(reference) => reference.operation === "authorization",
					)
						? {
								authorizationOperationId: payment.providerReferences.find(
									(reference) => reference.operation === "authorization",
								)?.operationId,
							}
						: {}),
				},
			},
		};
	}

	if (
		isThirdPartyPaymentProvider(connection.provider) &&
		deps.paymentAggregates
	) {
		const payment = await resolvePayment(deps, finalization, connectionId);
		if (payment) {
			if (
				!paymentOutcomeSatisfied(
					payment,
					finalization.acceptedInput.paymentPolicyId,
				)
			) {
				return needsAttention(
					"PAYMENT_NOT_COMPLETED",
					"The Payment aggregate has not reached an authoritative state.",
				);
			}
			return {
				outcome: { type: "advanced", nextStep: "order" },
				result: {
					payment: {
						connectionId,
						paymentId: payment.id,
					},
				},
			};
		}
	}

	if (
		!session.paymentIntentId ||
		session.paymentIntentId === "no_payment_required"
	) {
		return needsAttention(
			"PAYMENT_ACTIVATION_REQUIRED",
			"Live payment activation remains contained until production evidence exists.",
		);
	}

	const payment = await deps.capabilities.invoke(paymentCheckoutCapability, {
		operation: "get",
		intentId: session.paymentIntentId,
	});
	if (!payment.ok) {
		if (payment.failure.code === "PAYMENT_NOT_FOUND") {
			return needsAttention("PAYMENT_NOT_FOUND");
		}
		return retryable("PAYMENT_STATUS_UNAVAILABLE");
	}
	if (payment.decision.status !== "succeeded") {
		return needsAttention("PAYMENT_NOT_COMPLETED", payment.decision.status);
	}

	return advance("payment_outcome");
}

async function handlePaymentSettlement(
	deps: CheckoutFinalizationHandlerDependencies,
	finalization: CheckoutFinalization,
): Promise<CheckoutFinalizationStepOutcome> {
	const session = await deps.checkout.getById(finalization.checkoutId);
	if (!session || session.total <= 0) {
		return advance("payment_settlement");
	}

	const connectionId = finalization.acceptedInput.paymentConnectionId;
	if (!connectionId) {
		return advance("payment_settlement");
	}

	const connection = await resolveConnection(deps, connectionId);
	if (!connection) {
		return needsAttention("PAYMENT_CONNECTION_NOT_FOUND");
	}

	if (
		finalization.acceptedInput.paymentPolicyId !== "authorize-then-capture-v1"
	) {
		return advance("payment_settlement");
	}

	const payment = await resolvePayment(deps, finalization, connectionId);
	if (!payment) {
		return needsAttention(
			"PAYMENT_NOT_FOUND",
			"Settlement requires the Payment aggregate from prior checkpoints.",
		);
	}

	if (payment.capturedAmount >= payment.expectedAmount) {
		return advance("payment_settlement");
	}

	if (isManagedPaymentProvider(connection.provider)) {
		if (!deps.managedPaymentClient?.configured) {
			return retryable(
				"MANAGED_PAYMENT_UNAVAILABLE",
				"Managed Payment capture requires Control Plane workload identity.",
			);
		}
		const authorization = payment.providerReferences.find(
			(reference) => reference.operation === "authorization",
		);
		if (!authorization) {
			return needsAttention(
				"PAYMENT_AUTHORIZATION_REQUIRED",
				"Capture requires a confirmed authorization operation.",
			);
		}
		try {
			await deps.managedPaymentClient.submitOperation({
				idempotencyKey: `finalize:${finalization.id}:capture`,
				provider: connection.provider,
				mode: connection.mode === "test" ? "sandbox" : "live",
				kind: "capture",
				businessId: "managed-business",
				merchantPaymentAccountId: connection.providerAccountId,
				bindingId: "managed-binding",
				connectionId,
				paymentId: payment.id,
				checkoutId: finalization.checkoutId,
				option:
					payment.paymentOption === "card" ||
					payment.paymentOption === "apple_pay" ||
					payment.paymentOption === "google_pay"
						? payment.paymentOption
						: "card",
				amountMinorUnits: payment.expectedAmount - payment.capturedAmount,
				currency: payment.currency,
				sourceOperationId: authorization.operationId,
			});
		} catch {
			return retryable("PAYMENT_CAPTURE_UNAVAILABLE");
		}
		return advance("payment_settlement");
	}

	return advance("payment_settlement");
}

async function handleOrder(
	deps: CheckoutFinalizationHandlerDependencies,
	finalization: CheckoutFinalization,
): Promise<CheckoutFinalizationStepOutcome> {
	const session = await deps.checkout.getById(finalization.checkoutId);
	if (!session) {
		return needsAttention("CHECKOUT_NOT_FOUND");
	}
	const giftCardContainment = legacyGiftCardContainment(session);
	if (giftCardContainment) return giftCardContainment;
	if (finalization.result.orderId) {
		return advance("order");
	}
	const lineItems = await deps.checkout.getLineItems(finalization.checkoutId);
	if (lineItems.length === 0) {
		return needsAttention("CHECKOUT_LINES_REQUIRED");
	}

	const orderId = `order:${finalization.id}`;
	const created = await deps.capabilities.invoke(orderCreateCapability, {
		id: orderId,
		...(session.customerId ? { customerId: session.customerId } : {}),
		...(session.guestEmail ? { guestEmail: session.guestEmail } : {}),
		currency: session.currency,
		paymentStatus: session.total > 0 ? "paid" : "unpaid",
		subtotal: session.subtotal,
		taxAmount: session.taxAmount,
		shippingAmount: session.shippingAmount,
		discountAmount: session.discountAmount,
		giftCardAmount: session.giftCardAmount,
		storeCreditAmount: session.storeCreditAmount,
		total: session.total,
		items: lineItems.map((item) => ({
			productId: item.productId,
			...(item.variantId ? { variantId: item.variantId } : {}),
			name: item.name,
			...(item.sku ? { sku: item.sku } : {}),
			price: item.price,
			quantity: item.quantity,
		})),
		...(session.billingAddress
			? {
					billingAddress: {
						firstName: session.billingAddress.firstName,
						lastName: session.billingAddress.lastName,
						line1: session.billingAddress.line1,
						...(session.billingAddress.line2
							? { line2: session.billingAddress.line2 }
							: {}),
						city: session.billingAddress.city,
						state: session.billingAddress.state,
						postalCode: session.billingAddress.postalCode,
						country: session.billingAddress.country,
						...(session.billingAddress.phone
							? { phone: session.billingAddress.phone }
							: {}),
					},
				}
			: {}),
		...(session.shippingAddress
			? {
					shippingAddress: {
						firstName: session.shippingAddress.firstName,
						lastName: session.shippingAddress.lastName,
						line1: session.shippingAddress.line1,
						...(session.shippingAddress.line2
							? { line2: session.shippingAddress.line2 }
							: {}),
						city: session.shippingAddress.city,
						state: session.shippingAddress.state,
						postalCode: session.shippingAddress.postalCode,
						country: session.shippingAddress.country,
						...(session.shippingAddress.phone
							? { phone: session.shippingAddress.phone }
							: {}),
					},
				}
			: {}),
		checkoutId: finalization.checkoutId,
		acceptedOfferId: finalization.acceptedInput.acceptedOfferId,
		catalogRevision: finalization.acceptedInput.catalogRevisionId,
		priceSourceVersion: finalization.acceptedInput.pricingDecisionId,
		...(typeof session.metadata?.guestProofDigest === "string"
			? {
					metadata: {
						guestProofDigest: session.metadata.guestProofDigest,
					},
				}
			: {}),
		...(finalization.acceptedInput.taxQuoteId
			? { taxQuoteId: finalization.acceptedInput.taxQuoteId }
			: typeof session.metadata?.taxQuoteId === "string"
				? { taxQuoteId: session.metadata.taxQuoteId }
				: {}),
		...(finalization.acceptedInput.shippingQuoteId
			? { shippingQuoteId: finalization.acceptedInput.shippingQuoteId }
			: {}),
		...(finalization.acceptedInput.shippingOptionId
			? { shippingOptionId: finalization.acceptedInput.shippingOptionId }
			: {}),
		...(finalization.acceptedInput.inventoryReservationIds.length > 0
			? {
					inventoryReservationIds:
						finalization.acceptedInput.inventoryReservationIds,
				}
			: {}),
		...(finalization.acceptedInput.paymentConnectionId
			? {
					paymentConnectionId: finalization.acceptedInput.paymentConnectionId,
				}
			: {}),
		...(finalization.result.payment?.authorizationOperationId
			? {
					paymentOperationId:
						finalization.result.payment.authorizationOperationId,
				}
			: session.paymentIntentId &&
					session.paymentIntentId !== "no_payment_required"
				? { paymentOperationId: session.paymentIntentId }
				: {}),
	});

	if (!created.ok) {
		return retryable("ORDER_CREATE_FAILED", created.failure.code);
	}

	return {
		outcome: { type: "advanced", nextStep: "commerce_commit" },
		result: { orderId: created.decision.orderId },
	};
}

async function handleCheckoutCompletion(
	deps: CheckoutFinalizationHandlerDependencies,
	finalization: CheckoutFinalization,
): Promise<CheckoutFinalizationStepOutcome> {
	const session = await deps.checkout.getById(finalization.checkoutId);
	if (!session) {
		return needsAttention("CHECKOUT_NOT_FOUND");
	}
	const giftCardContainment = legacyGiftCardContainment(session);
	if (giftCardContainment) return giftCardContainment;

	const orderId = finalization.result.orderId;
	if (!orderId) {
		return needsAttention(
			"ORDER_REQUIRED",
			"Checkout completion requires the Order identity from prior checkpoints.",
		);
	}

	if (session.status === "completed" && session.orderId === orderId) {
		return {
			outcome: { type: "completed" },
			result: { orderId },
		};
	}

	const completed = await deps.checkout.complete(
		finalization.checkoutId,
		orderId,
	);
	if (!completed) {
		return needsAttention(
			"CHECKOUT_COMPLETION_FAILED",
			"The Checkout session could not transition to completed.",
		);
	}

	return {
		outcome: { type: "completed" },
		result: { orderId },
	};
}
