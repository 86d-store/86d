/** Result returned by a payment provider after creating or mutating an intent. */
export type ProviderIntentResult = {
	providerIntentId: string;
	status: "pending" | "processing" | "succeeded" | "failed" | "cancelled";
	providerMetadata?: Record<string, unknown> | undefined;
};

/** Result returned by a payment provider after creating a refund. */
export type ProviderRefundResult = {
	providerRefundId: string;
	status: "pending" | "succeeded" | "failed";
	providerMetadata?: Record<string, unknown> | undefined;
};

/**
 * Store-runtime contract implemented by payment processor adapters.
 *
 * The protocol lives in core so adapters do not depend on the payments Module.
 */
export type PaymentProvider = {
	createIntent(params: {
		amount: number;
		currency: string;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<ProviderIntentResult>;

	confirmIntent(providerIntentId: string): Promise<ProviderIntentResult>;

	cancelIntent(providerIntentId: string): Promise<ProviderIntentResult>;

	createRefund(params: {
		providerIntentId: string;
		amount?: number | undefined;
		currency?: string | undefined;
		reason?: string | undefined;
	}): Promise<ProviderRefundResult>;
};
