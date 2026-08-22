import type {
	PaymentProvider,
	ProviderIntentResult,
	ProviderRefundResult,
} from "@86d-app/core/payment-provider";

// Square's Payment status values
type SquarePaymentStatus =
	| "APPROVED"
	| "PENDING"
	| "COMPLETED"
	| "CANCELED"
	| "FAILED";

// Square's Refund status values
type SquareRefundStatus = "PENDING" | "COMPLETED" | "REJECTED" | "FAILED";

interface SquareAmountMoney {
	amount: number;
	currency: string;
}

interface SquarePayment {
	id: string;
	status: SquarePaymentStatus;
	amount_money: SquareAmountMoney;
}

interface SquareRefund {
	id: string;
	status: SquareRefundStatus;
	amount_money: SquareAmountMoney;
}

interface SquarePaymentResponse {
	payment: SquarePayment;
}

interface SquareRefundResponse {
	refund: SquareRefund;
}

interface SquareErrorDetail {
	detail: string;
	category: string;
	code: string;
}

interface SquareErrorResponse {
	errors: SquareErrorDetail[];
}

export class SquarePaymentProvider implements PaymentProvider {
	private readonly accessToken: string;
	private readonly baseUrl = "https://connect.squareup.com";
	private readonly squareVersion = "2024-01-18";

	constructor(accessToken: string) {
		this.accessToken = accessToken;
	}

	private async request<T>(
		method: "GET" | "POST",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const jsonBody =
			body !== undefined && method === "POST"
				? JSON.stringify(body)
				: undefined;
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
				"Square-Version": this.squareVersion,
				"Content-Type": "application/json",
			},
			...(jsonBody !== undefined ? { body: jsonBody } : {}),
		});
		const json: unknown = await res.json();
		if (!res.ok) {
			const err = json as SquareErrorResponse;
			const detail = err.errors[0]?.detail ?? `HTTP ${res.status}`;
			throw new Error(`Square error: ${detail}`);
		}
		return json as T;
	}

	async verifyConnection(): Promise<
		{ ok: true; locationCount: number } | { ok: false; error: string }
	> {
		try {
			const data = await this.request<{
				locations?: Array<{ id: string }>;
			}>("GET", "/v2/locations");
			return { ok: true, locationCount: data.locations?.length ?? 0 };
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}

	private mapPaymentStatus(
		status: SquarePaymentStatus,
	): ProviderIntentResult["status"] {
		switch (status) {
			case "COMPLETED":
				return "succeeded";
			case "CANCELED":
				return "cancelled";
			case "FAILED":
				return "failed";
			case "APPROVED":
			case "PENDING":
				return "pending";
			default:
				return "pending";
		}
	}

	private mapRefundStatus(
		status: SquareRefundStatus,
	): ProviderRefundResult["status"] {
		switch (status) {
			case "COMPLETED":
				return "succeeded";
			case "FAILED":
			case "REJECTED":
				return "failed";
			default:
				return "pending";
		}
	}

	async createIntent(params: {
		amount: number;
		currency: string;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<ProviderIntentResult> {
		const sourceId = params.metadata?.paymentMethodNonce as string | undefined;
		if (!sourceId) {
			// No tokenized card yet — signal that the frontend must render
			// the Square Web Payments SDK to collect card details.
			return {
				providerIntentId: `square_pending_${crypto.randomUUID()}`,
				status: "pending",
				providerMetadata: {
					paymentType: "square",
				},
			};
		}

		const body: Record<string, unknown> = {
			source_id: sourceId,
			amount_money: {
				amount: params.amount,
				currency: params.currency.toUpperCase(),
			},
			autocomplete: false,
			idempotency_key: `create-${sourceId}`,
		};
		const response = await this.request<SquarePaymentResponse>(
			"POST",
			"/v2/payments",
			body,
		);
		return {
			providerIntentId: response.payment.id,
			status: this.mapPaymentStatus(response.payment.status),
			providerMetadata: {
				squareStatus: response.payment.status,
				amountMoney: response.payment.amount_money,
			},
		};
	}

	async confirmIntent(providerIntentId: string): Promise<ProviderIntentResult> {
		const response = await this.request<SquarePaymentResponse>(
			"POST",
			`/v2/payments/${providerIntentId}/complete`,
		);
		return {
			providerIntentId: response.payment.id,
			status: this.mapPaymentStatus(response.payment.status),
			providerMetadata: { squareStatus: response.payment.status },
		};
	}

	async cancelIntent(providerIntentId: string): Promise<ProviderIntentResult> {
		const response = await this.request<SquarePaymentResponse>(
			"POST",
			`/v2/payments/${providerIntentId}/cancel`,
		);
		return {
			providerIntentId: response.payment.id,
			status: this.mapPaymentStatus(response.payment.status),
			providerMetadata: { squareStatus: response.payment.status },
		};
	}

	async createRefund(params: {
		providerIntentId: string;
		amount?: number | undefined;
		currency?: string | undefined;
		reason?: string | undefined;
	}): Promise<ProviderRefundResult> {
		const refundKey =
			params.amount !== undefined
				? `refund-${params.providerIntentId}-${params.amount}-${(params.currency ?? "USD").toUpperCase()}`
				: `refund-${params.providerIntentId}-full`;
		const body: Record<string, unknown> = {
			idempotency_key: refundKey,
			payment_id: params.providerIntentId,
		};
		if (params.amount !== undefined) {
			body.amount_money = {
				amount: params.amount,
				currency: (params.currency ?? "USD").toUpperCase(),
			};
		}
		if (params.reason !== undefined) {
			body.reason = params.reason;
		}
		const response = await this.request<SquareRefundResponse>(
			"POST",
			"/v2/refunds",
			body,
		);
		return {
			providerRefundId: response.refund.id,
			status: this.mapRefundStatus(response.refund.status),
			providerMetadata: { squareStatus: response.refund.status },
		};
	}
}
