import type { PaymentConnectionProvider } from "@86d-app/core/payment-connection-provider";
import type { Module, ModuleContext } from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import {
	createPaymentCheckoutProvider,
	createPaymentIntentProvider,
} from "./capabilities";
import {
	createPaymentConnectionController,
	PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS,
	PAYMENT_OPERATION_STALE_AFTER_MS,
	PAYMENT_PENDING_RECONCILIATION_BACKOFF_MS,
	PAYMENT_RECONCILIATION_BACKOFF_MS,
	PAYMENT_REQUIRES_ACTION_RECONCILIATION_BACKOFF_MS,
	PaymentConnectionError,
	paymentOperationReconciliationOptionsSchema,
} from "./connection-service";
import {
	applyPaymentDisputeInputSchema,
	confirmedPaymentOperationInputSchema,
	createPaymentAggregateInputSchema,
	createPaymentAggregateStore,
	PaymentAggregateError,
	paymentAggregateSchema,
	paymentDisputeProjectionSchema,
	paymentDisputeStateSchema,
	paymentOptionSchema,
	paymentProviderReferenceSchema,
	paymentStateSchema,
	paymentTerminalStateSchema,
	paymentTransitionConfirmedV1,
} from "./payment-service";
import { paymentsSchema, paymentsTables } from "./schema";
import type { PaymentProvider } from "./service";
import { createPaymentController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";
import {
	createPaymentWebhookReceiptStore,
	PaymentWebhookReceiptError,
	paymentWebhookNormalizedFactSchema,
	paymentWebhookReceiptSchema,
	recordVerifiedPaymentWebhookInputSchema,
} from "./webhook-receipt-service";

export type {
	PaymentConnectionCapability,
	PaymentConnectionMode,
	PaymentConnectionProvider,
	PaymentOperationPayload,
	PaymentProviderOperationOutcome,
	PaymentProviderOperationRequest,
	PaymentProviderOperationSource,
	PaymentProviderReconciliationRequest,
} from "@86d-app/core/payment-connection-provider";
export type {
	CreatePaymentConnectionInput,
	PaymentConnection,
	PaymentConnectionController,
	PaymentConnectionErrorCode,
	PaymentConnectionHealth,
	PaymentConnectionLifecycle,
	PaymentOperation,
	PaymentOperationAttempt,
	PaymentOperationExecutionInput,
	PaymentOperationReconciliationOptions,
} from "./connection-service";
export type {
	ApplyPaymentDisputeInput,
	ConfirmedPaymentOperationInput,
	CreatePaymentAggregateInput,
	PaymentAggregate,
	PaymentAggregateErrorCode,
	PaymentAggregateStore,
	PaymentOption,
} from "./payment-service";
export type {
	PaymentController,
	PaymentIntent,
	PaymentIntentStatus,
	PaymentMethod,
	PaymentProvider,
	ProviderIntentResult,
	ProviderRefundResult,
	Refund,
	RefundStatus,
} from "./service";
export type {
	PaymentWebhookReceipt,
	PaymentWebhookReceiptErrorCode,
	PaymentWebhookReceiptStore,
	RecordVerifiedPaymentWebhookInput,
} from "./webhook-receipt-service";
export {
	applyPaymentDisputeInputSchema,
	confirmedPaymentOperationInputSchema,
	createPaymentAggregateInputSchema,
	createPaymentAggregateStore,
	createPaymentWebhookReceiptStore,
	PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS,
	PAYMENT_OPERATION_STALE_AFTER_MS,
	PAYMENT_PENDING_RECONCILIATION_BACKOFF_MS,
	PAYMENT_RECONCILIATION_BACKOFF_MS,
	PAYMENT_REQUIRES_ACTION_RECONCILIATION_BACKOFF_MS,
	PaymentAggregateError,
	PaymentConnectionError,
	PaymentWebhookReceiptError,
	paymentAggregateSchema,
	paymentDisputeProjectionSchema,
	paymentDisputeStateSchema,
	paymentOperationReconciliationOptionsSchema,
	paymentOptionSchema,
	paymentProviderReferenceSchema,
	paymentStateSchema,
	paymentTerminalStateSchema,
	paymentTransitionConfirmedV1,
	paymentWebhookNormalizedFactSchema,
	paymentWebhookReceiptSchema,
	recordVerifiedPaymentWebhookInputSchema,
};

export interface PaymentsOptions {
	/** Default currency for payment intents */
	currency?: string;
	/** Payment provider implementation (e.g. StripePaymentProvider) */
	provider?: PaymentProvider;
	/**
	 * Explicit v2 adapters, each bound to one immutable Payment Connection ID.
	 * These are not used by the legacy Checkout capability or shopper routes.
	 */
	connectionProviders?: readonly PaymentConnectionProvider[];
}

export default function payments(options?: PaymentsOptions): Module {
	return {
		id: "payments",
		version: "0.0.1",
		schema: paymentsSchema,
		tables: paymentsTables,
		capabilities: {
			provides: [
				createPaymentCheckoutProvider(options?.provider),
				createPaymentIntentProvider(options?.provider),
			],
		},
		exports: {
			read: ["paymentStatus", "paymentAmount", "paymentMethod"],
		},
		events: {
			emits: ["payment.completed", "payment.failed", "payment.refunded"],
		},
		durableEvents: { emits: [paymentTransitionConfirmedV1] },
		init: async (ctx: ModuleContext) => {
			const controller = createPaymentController(ctx.data, options?.provider);
			const aggregates = createPaymentAggregateStore(
				ctx.data,
				ctx.transactions,
			);
			const connections = createPaymentConnectionController(
				ctx.data,
				ctx.transactions,
				options?.connectionProviders,
			);
			const webhookReceipts = createPaymentWebhookReceiptStore(
				ctx.data,
				ctx.transactions,
				aggregates,
			);
			return {
				controllers: {
					payments: controller,
					paymentAggregates: aggregates,
					paymentConnections: connections,
					paymentWebhookReceipts: webhookReceipts,
				},
			};
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		store: {
			pages: [
				{ path: "/account/payment-methods", component: "SavedPaymentMethods" },
			],
		},
		admin: {
			pages: [
				{
					path: "/admin/payments",
					component: "PaymentsAdmin",
					label: "Payments",
					icon: "CreditCard",
					group: "Sales",
				},
			],
		},
	};
}
