import type {
	PaymentProvider,
	ProviderIntentResult,
	ProviderRefundResult,
} from "@86d-app/core/payment-provider";

// Stripe's PaymentIntent status values
type StripeIntentStatus =
	| "requires_payment_method"
	| "requires_confirmation"
	| "requires_action"
	| "processing"
	| "requires_capture"
	| "canceled"
	| "succeeded";

interface StripePaymentIntent {
	id: string;
	object: "payment_intent";
	amount: number;
	currency: string;
	status: StripeIntentStatus;
	client_secret: string;
	metadata: Record<string, string>;
}

interface StripeRefund {
	id: string;
	object: "refund";
	amount: number;
	charge: string;
	payment_intent: string;
	status: "pending" | "succeeded" | "failed" | "canceled";
	reason: string | null;
}

interface StripeError {
	error: {
		message: string;
		type: string;
		code?: string;
	};
}

export class StripePaymentProvider implements PaymentProvider {
	private readonly apiKey: string;
	private readonly baseUrl = "https://api.stripe.com/v1";

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	private encodeBody(
		params: Record<string, string | number | undefined>,
	): string {
		return Object.entries(params)
			.filter(([, v]) => v !== undefined)
			.map(
				([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
			)
			.join("&");
	}

	private async request<T>(
		method: "GET" | "POST",
		path: string,
		body?: Record<string, string | number | undefined>,
		extraHeaders?: Record<string, string>,
	): Promise<T> {
		const encodedBody =
			body && method === "POST" ? this.encodeBody(body) : undefined;
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/x-www-form-urlencoded",
				...extraHeaders,
			},
			...(encodedBody !== undefined ? { body: encodedBody } : {}),
		});
		const json = (await res.json()) as T | StripeError;
		if (!res.ok) {
			const err = json as StripeError;
			throw new Error(
				`Stripe error: ${err.error?.message ?? `HTTP ${res.status}`}`,
			);
		}
		return json as T;
	}

	private mapIntentStatus(
		status: StripeIntentStatus,
	): ProviderIntentResult["status"] {
		switch (status) {
			case "succeeded":
				return "succeeded";
			case "canceled":
				return "cancelled";
			case "processing":
			case "requires_capture":
				return "processing";
			case "requires_payment_method":
			case "requires_confirmation":
			case "requires_action":
				return "pending";
			default:
				return "pending";
		}
	}

	async createIntent(params: {
		amount: number;
		currency: string;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<ProviderIntentResult> {
		const body: Record<string, string | number | undefined> = {
			amount: params.amount,
			currency: params.currency.toLowerCase(),
			"automatic_payment_methods[enabled]": "true",
		};
		const intent = await this.request<StripePaymentIntent>(
			"POST",
			"/payment_intents",
			body,
		);
		return {
			providerIntentId: intent.id,
			status: this.mapIntentStatus(intent.status),
			providerMetadata: {
				clientSecret: intent.client_secret,
				stripeStatus: intent.status,
			},
		};
	}

	async confirmIntent(providerIntentId: string): Promise<ProviderIntentResult> {
		const intent = await this.request<StripePaymentIntent>(
			"POST",
			`/payment_intents/${providerIntentId}/confirm`,
		);
		return {
			providerIntentId: intent.id,
			status: this.mapIntentStatus(intent.status),
			providerMetadata: { stripeStatus: intent.status },
		};
	}

	async cancelIntent(providerIntentId: string): Promise<ProviderIntentResult> {
		const intent = await this.request<StripePaymentIntent>(
			"POST",
			`/payment_intents/${providerIntentId}/cancel`,
		);
		return {
			providerIntentId: intent.id,
			status: this.mapIntentStatus(intent.status),
			providerMetadata: { stripeStatus: intent.status },
		};
	}

	async verifyConnection(): Promise<
		{ ok: true; accountName: string } | { ok: false; error: string }
	> {
		try {
			const account = await this.request<{
				id: string;
				business_profile?: { name?: string | null };
			}>("GET", "/account");
			return {
				ok: true,
				accountName: account.business_profile?.name ?? account.id,
			};
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}

	async createRefund(params: {
		providerIntentId: string;
		amount?: number | undefined;
		currency?: string | undefined;
		reason?: string | undefined;
	}): Promise<ProviderRefundResult> {
		const body: Record<string, string | number | undefined> = {
			payment_intent: params.providerIntentId,
		};
		if (params.amount !== undefined) body.amount = params.amount;
		if (params.reason) body.reason = params.reason;
		const idempotencyKey =
			params.amount !== undefined
				? `refund-${params.providerIntentId}-${params.amount}`
				: `refund-${params.providerIntentId}-full`;
		const refund = await this.request<StripeRefund>("POST", "/refunds", body, {
			"Idempotency-Key": idempotencyKey,
		});
		return {
			providerRefundId: refund.id,
			status:
				refund.status === "succeeded"
					? "succeeded"
					: refund.status === "failed"
						? "failed"
						: "pending",
			providerMetadata: { stripeStatus: refund.status },
		};
	}
}
