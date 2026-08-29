import { acceptCapability } from "@86d-app/core/capabilities";
import {
	cartSnapshotCapability,
	customerIdentityResolveCapability,
	discountCodeCapability,
	inventoryCheckoutCapability,
	orderCreateCapability,
	paymentCheckoutCapability,
	priceListResolveCapability,
	productPriceConversionCapability,
	productResolveCapability,
	shippingQuoteCapability,
	storeCreditCheckoutCapability,
	taxQuoteCapability,
	taxQuoteV2Capability,
} from "@86d-app/core/commerce-capabilities";
import { inventoryCheckoutV2Capability } from "@86d-app/core/inventory-reservation-capability";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { checkoutFinalizationLifecycleV1 } from "./finalization";
import { checkoutStorage } from "./schema";
import { createCheckoutController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	CheckoutRequest,
	CheckoutRequestCreateInput,
	CheckoutRequestCreateResult,
	CheckoutRequestInvitationState,
	CheckoutRequestReadResult,
	CheckoutRequestStore,
} from "./checkout-request";
export type {
	AdmitCheckoutFinalizationInput,
	CheckoutFinalization,
	CheckoutFinalizationAttempt,
	CheckoutFinalizationCompensation,
	CheckoutFinalizationErrorCode,
	CheckoutFinalizationSnapshot,
	CheckoutFinalizationStore,
	RecordCheckoutFinalizationAttemptInput,
	RecordCheckoutFinalizationCompensationInput,
} from "./finalization";
export type {
	CheckoutFinalizationStepContext,
	CheckoutFinalizationStepHandler,
	CheckoutFinalizationStepHandlers,
	CheckoutFinalizationStepOutcome,
	CheckoutFinalizer,
	CheckoutFinalizerRunSummary,
} from "./finalizer";
export type { CheckoutFinalizationHandlerDependencies } from "./finalizer-handlers";
export type {
	CheckoutAddress,
	CheckoutController,
	CheckoutLineItem,
	CheckoutSession,
	CheckoutStatus,
	DiscountController,
	InventoryCheckController,
	PaymentProcessController,
	ShippingRateController,
} from "./service";

export interface CheckoutOptions extends ModuleConfig {
	/**
	 * Session TTL in milliseconds
	 * @default 1800000 (30 minutes)
	 */
	sessionTtl?: number;
	/**
	 * Default currency code
	 * @default "USD"
	 */
	currency?: string;
}

/**
 * Checkout module factory.
 * Orchestrates the checkout flow: session creation → address collection →
 * discount application → inventory reservation → order completion.
 *
 * Accepts required Product resolution and Order creation capabilities, plus
 * explicit optional capabilities for Inventory, Tax, Shipping, Discounts,
 * Store Credits, Payments, Price Lists, and Multi-currency. Gift-card
 * application remains withdrawn until its complete Workflow exists.
 * Providers remain authoritative and receive only their owner-scoped context.
 */
export default function checkout(options?: CheckoutOptions): Module {
	return {
		id: "checkout",
		version: "0.0.1",
		storage: checkoutStorage,
		capabilities: {
			accepts: [
				acceptCapability(cartSnapshotCapability),
				acceptCapability(productResolveCapability),
				acceptCapability(orderCreateCapability),
				acceptCapability(inventoryCheckoutCapability, {
					operations: ["check", "release"],
					optional: true,
				}),
				// The v2 reservation ledger carries checkout and line identity, a
				// lease, and an operation key, so a Finalization step can reserve and
				// commit stock idempotently. The v1 admission above stays until the
				// live path stops using it.
				acceptCapability(inventoryCheckoutV2Capability, { optional: true }),
				acceptCapability(taxQuoteCapability, { optional: true }),
				// v2 answers with an explicit collect, no-nexus, marketplace, or
				// blocked decision instead of an amount, so a missing policy fails the
				// Checkout rather than silently becoming zero tax.
				acceptCapability(taxQuoteV2Capability, { optional: true }),
				acceptCapability(shippingQuoteCapability, { optional: true }),
				acceptCapability(discountCodeCapability, {
					operations: ["validate"],
					optional: true,
				}),
				acceptCapability(storeCreditCheckoutCapability, {
					operations: ["balance"],
					optional: true,
				}),
				acceptCapability(paymentCheckoutCapability, {
					operations: ["cancel"],
					optional: true,
				}),
				acceptCapability(priceListResolveCapability, { optional: true }),
				acceptCapability(productPriceConversionCapability, { optional: true }),
				acceptCapability(customerIdentityResolveCapability, { optional: true }),
			],
		},
		exports: {
			read: ["checkoutStatus", "checkoutTotal", "checkoutLineItems"],
		},
		events: {
			emits: ["checkout.completed", "checkout.abandoned"],
		},
		durableEvents: { emits: [checkoutFinalizationLifecycleV1] },
		requires: {
			discounts: {
				read: ["discountValidation", "discountAmount"],
				optional: true,
			},
			inventory: {
				read: ["stockQuantity", "stockAvailability"],
				optional: true,
			},
			payments: {
				read: ["paymentStatus", "paymentAmount"],
				optional: true,
			},
			shipping: {
				read: ["shippingRates", "shippingZones", "shippingMethods"],
				optional: true,
			},
		},

		init: async (ctx: ModuleContext) => {
			const controller = createCheckoutController(ctx.data, ctx.transactions);
			return {
				controllers: { checkout: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/checkout",
					component: "CheckoutList",
					label: "Checkout",
					icon: "CreditCard",
					group: "Sales",
				},
				{ path: "/admin/checkout/:id", component: "CheckoutDetail" },
			],
		},

		store: {
			pages: [
				{
					path: "/checkout",
					component: "CheckoutForm",
				},
				{
					path: "/checkout/confirmation",
					component: "OrderConfirmation",
				},
			],
		},

		options,
	};
}
