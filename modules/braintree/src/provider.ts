import type {
	PaymentProvider,
	ProviderIntentResult,
	ProviderRefundResult,
} from "@86d-app/core/payment-provider";

// Braintree transaction status values
type BraintreeTransactionStatus =
	| "authorized"
	| "submitted_for_settlement"
	| "settling"
	| "settlement_pending"
	| "settlement_confirmed"
	| "settled"
	| "voided"
	| "failed"
	| "processor_declined"
	| "gateway_rejected"
	| "settlement_declined";

interface BraintreeTransaction {
	id: string;
	status: BraintreeTransactionStatus;
	amount: string;
	currencyIsoCode: string;
}

interface BraintreeApiError {
	apiErrorResponse?: {
		message: string;
		errors?: unknown;
	};
}

export class BraintreePaymentProvider implements PaymentProvider {
	private readonly merchantId: string;
	private readonly publicKey: string;
	private readonly privateKey: string;
	private readonly baseUrl: string;

	constructor(
		merchantId: string,
		publicKey: string,
		privateKey: string,
		sandbox = false,
	) {
		this.merchantId = merchantId;
		this.publicKey = publicKey;
		this.privateKey = privateKey;
		this.baseUrl = sandbox
			? "https://api.sandbox.braintreegateway.com"
			: "https://api.braintreegateway.com";
	}

	private get authHeader(): string {
		return `Basic ${btoa(`${this.publicKey}:${this.privateKey}`)}`;
	}

	async verifyConnection(): Promise<
		{ ok: true } | { ok: false; error: string }
	> {
		try {
			await this.request<{ clientToken: { value: string } }>(
				"POST",
				"/client_token",
				{ client_token: { version: 2 } },
			);
			return { ok: true };
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}

	private formatAmount(amountInCents: number): string {
		return (amountInCents / 100).toFixed(2);
	}

	private async request<T>(
		method: "POST" | "GET",
		path: string,
		body?: unknown,
	): Promise<T> {
		const jsonBody = body !== undefined ? JSON.stringify(body) : undefined;
		const res = await fetch(
			`${this.baseUrl}/merchants/${this.merchantId}${path}`,
			{
				method,
				headers: {
					Authorization: this.authHeader,
					"Braintree-Version": "2019-01-01",
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				...(jsonBody !== undefined ? { body: jsonBody } : {}),
			},
		);
		const json = (await res.json()) as T | BraintreeApiError;
		if (!res.ok) {
			const err = json as BraintreeApiError;
			throw new Error(
				`Braintree error: ${err.apiErrorResponse?.message ?? `HTTP ${res.status}`}`,
			);
		}
		return json as T;
	}

	private mapTransactionStatus(
		status: BraintreeTransactionStatus,
	): ProviderIntentResult["status"] {
		switch (status) {
			case "settled":
				return "succeeded";
			case "voided":
				return "cancelled";
			case "submitted_for_settlement":
			case "settling":
			case "settlement_pending":
			case "settlement_confirmed":
				return "processing";
			case "failed":
			case "processor_declined":
			case "gateway_rejected":
			case "settlement_declined":
				return "failed";
			default:
				return "pending";
		}
	}

	async generateClientToken(): Promise<string> {
		const data = await this.request<{ clientToken: { value: string } }>(
			"POST",
			"/client_token",
			{ client_token: { version: 2 } },
		);
		return data.clientToken.value;
	}

	async createIntent(params: {
		amount: number;
		currency: string;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<ProviderIntentResult> {
		const nonce = params.metadata?.paymentMethodNonce as string | undefined;
		if (!nonce) {
			// No nonce yet — generate a client token so the frontend can
			// render the Braintree Drop-in UI and collect card details.
			const clientToken = await this.generateClientToken();
			return {
				providerIntentId: `braintree_pending_${crypto.randomUUID()}`,
				status: "pending",
				providerMetadata: {
					paymentType: "braintree",
					braintreeClientToken: clientToken,
				},
			};
		}
		const data = await this.request<{ transaction: BraintreeTransaction }>(
			"POST",
			"/transactions",
			{
				transaction: {
					amount: this.formatAmount(params.amount),
					payment_method_nonce: nonce,
					options: { submit_for_settlement: false },
				},
			},
		);
		return {
			providerIntentId: data.transaction.id,
			status: this.mapTransactionStatus(data.transaction.status),
			providerMetadata: { braintreeStatus: data.transaction.status },
		};
	}

	async confirmIntent(providerIntentId: string): Promise<ProviderIntentResult> {
		const data = await this.request<{ transaction: BraintreeTransaction }>(
			"POST",
			`/transactions/${providerIntentId}/submit_for_settlement`,
		);
		return {
			providerIntentId: data.transaction.id,
			status: this.mapTransactionStatus(data.transaction.status),
			providerMetadata: { braintreeStatus: data.transaction.status },
		};
	}

	async cancelIntent(providerIntentId: string): Promise<ProviderIntentResult> {
		const data = await this.request<{ transaction: BraintreeTransaction }>(
			"POST",
			`/transactions/${providerIntentId}/void`,
		);
		return {
			providerIntentId: data.transaction.id,
			status: this.mapTransactionStatus(data.transaction.status),
			providerMetadata: { braintreeStatus: data.transaction.status },
		};
	}

	async createRefund(params: {
		providerIntentId: string;
		amount?: number | undefined;
		currency?: string | undefined;
		reason?: string | undefined;
	}): Promise<ProviderRefundResult> {
		const refundBody =
			params.amount !== undefined
				? { refund: { amount: this.formatAmount(params.amount) } }
				: { refund: {} };
		const data = await this.request<{ transaction: BraintreeTransaction }>(
			"POST",
			`/transactions/${params.providerIntentId}/refunds`,
			refundBody,
		);
		const txStatus = data.transaction.status;
		const refundStatus: ProviderRefundResult["status"] =
			txStatus === "settled" || txStatus === "settling"
				? "succeeded"
				: txStatus === "failed" || txStatus === "processor_declined"
					? "failed"
					: "pending";
		return {
			providerRefundId: data.transaction.id,
			status: refundStatus,
			providerMetadata: { braintreeStatus: txStatus },
		};
	}
}
