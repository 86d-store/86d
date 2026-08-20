import type { ModuleController } from "@86d-app/core/types/module";

export type {
	PaymentProvider,
	ProviderIntentResult,
	ProviderRefundResult,
} from "@86d-app/core/payment-provider";

export type PaymentIntentStatus =
	| "pending"
	| "processing"
	| "succeeded"
	| "failed"
	| "cancelled"
	| "refunded";

export type RefundStatus = "pending" | "succeeded" | "failed";

export type PaymentIntent = {
	id: string;
	providerIntentId?: string | undefined;
	customerId?: string | undefined;
	email?: string | undefined;
	amount: number;
	currency: string;
	status: PaymentIntentStatus;
	paymentMethodId?: string | undefined;
	orderId?: string | undefined;
	checkoutSessionId?: string | undefined;
	metadata: Record<string, unknown>;
	providerMetadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type PaymentMethod = {
	id: string;
	customerId: string;
	providerMethodId: string;
	type: string;
	last4?: string | undefined;
	brand?: string | undefined;
	expiryMonth?: number | undefined;
	expiryYear?: number | undefined;
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type Refund = {
	id: string;
	paymentIntentId: string;
	providerRefundId: string;
	amount: number;
	reason?: string | undefined;
	status: RefundStatus;
	createdAt: Date;
	updatedAt: Date;
};

// ── Controller interface ──────────────────────────────────────────────────────

export type PaymentController = ModuleController & {
	// ── Intents ───────────────────────────────────────────────────────────
	createIntent(params: {
		amount: number;
		currency?: string | undefined;
		customerId?: string | undefined;
		email?: string | undefined;
		orderId?: string | undefined;
		checkoutSessionId?: string | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<PaymentIntent>;

	getIntent(id: string): Promise<PaymentIntent | null>;

	confirmIntent(id: string): Promise<PaymentIntent | null>;

	cancelIntent(id: string): Promise<PaymentIntent | null>;

	listIntents(params?: {
		customerId?: string | undefined;
		status?: PaymentIntentStatus | undefined;
		orderId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<PaymentIntent[]>;

	// ── Payment methods ───────────────────────────────────────────────────
	savePaymentMethod(params: {
		customerId: string;
		providerMethodId: string;
		type?: string | undefined;
		last4?: string | undefined;
		brand?: string | undefined;
		expiryMonth?: number | undefined;
		expiryYear?: number | undefined;
		isDefault?: boolean | undefined;
	}): Promise<PaymentMethod>;

	getPaymentMethod(id: string): Promise<PaymentMethod | null>;

	listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;

	deletePaymentMethod(id: string): Promise<boolean>;

	// ── Refunds ───────────────────────────────────────────────────────────
	createRefund(params: {
		intentId: string;
		amount?: number | undefined;
		reason?: string | undefined;
	}): Promise<Refund>;

	getRefund(id: string): Promise<Refund | null>;

	listRefunds(intentId: string): Promise<Refund[]>;

	// ── Webhook handling ──────────────────────────────────────────────────
	/** Look up a payment intent by its provider-assigned ID and update its status. */
	handleWebhookEvent(params: {
		providerIntentId: string;
		status: PaymentIntentStatus;
		providerMetadata?: Record<string, unknown> | undefined;
	}): Promise<PaymentIntent | null>;

	/** Look up a payment intent by its provider-assigned ID and record a refund. */
	handleWebhookRefund(params: {
		providerIntentId: string;
		providerRefundId: string;
		amount?: number | undefined;
		reason?: string | undefined;
	}): Promise<{ intent: PaymentIntent; refund: Refund } | null>;
};
