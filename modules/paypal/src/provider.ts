import type {
	PaymentProvider,
	ProviderIntentResult,
	ProviderRefundResult,
} from "@86d-app/core/payment-provider";

// PayPal order status values
type PayPalOrderStatus =
	| "CREATED"
	| "SAVED"
	| "APPROVED"
	| "VOIDED"
	| "COMPLETED"
	| "PAYER_ACTION_REQUIRED";

interface PayPalLink {
	href: string;
	rel: string;
	method: string;
}

interface PayPalOrder {
	id: string;
	status: PayPalOrderStatus;
	links?: PayPalLink[];
	purchase_units?: Array<{
		payments?: {
			authorizations?: Array<{ id: string; status: string }>;
			captures?: Array<{ id: string; status: string }>;
		};
	}>;
}

interface PayPalRefund {
	id: string;
	status: "COMPLETED" | "FAILED" | "PENDING" | "CANCELLED";
}

interface PayPalTokenResponse {
	access_token: string;
	expires_in: number;
}

interface PayPalErrorResponse {
	name: string;
	message: string;
	details?: Array<{ issue: string; description: string }>;
}

export class PayPalPaymentProvider implements PaymentProvider {
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly baseUrl: string;
	private accessToken: string | null = null;
	private tokenExpiry = 0;

	constructor(clientId: string, clientSecret: string, sandbox = false) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.baseUrl = sandbox
			? "https://api-m.sandbox.paypal.com"
			: "https://api-m.paypal.com";
	}

	private async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.tokenExpiry) {
			return this.accessToken;
		}
		const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
		const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
			method: "POST",
			headers: {
				Authorization: `Basic ${credentials}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: "grant_type=client_credentials",
		});
		if (!res.ok) {
			const err = (await res.json()) as PayPalErrorResponse;
			throw new Error(`PayPal auth error: ${err.message}`);
		}
		const data = (await res.json()) as PayPalTokenResponse;
		this.accessToken = data.access_token;
		this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
		return this.accessToken;
	}

	private async request<T>(
		method: "GET" | "POST" | "PATCH",
		path: string,
		body?: Record<string, unknown>,
		extraHeaders?: Record<string, string>,
	): Promise<T> {
		const token = await this.getAccessToken();
		const encodedBody = body !== undefined ? JSON.stringify(body) : undefined;
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				Accept: "application/json",
				...extraHeaders,
			},
			...(encodedBody !== undefined ? { body: encodedBody } : {}),
		});
		const json = (await res.json()) as T | PayPalErrorResponse;
		if (!res.ok) {
			const err = json as PayPalErrorResponse;
			throw new Error(`PayPal error: ${err.message}`);
		}
		return json as T;
	}

	async verifyConnection(): Promise<
		{ ok: true; mode: "sandbox" | "live" } | { ok: false; error: string }
	> {
		try {
			await this.getAccessToken();
			const mode = this.baseUrl.includes("sandbox")
				? ("sandbox" as const)
				: ("live" as const);
			return { ok: true, mode };
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

	private mapOrderStatus(
		status: PayPalOrderStatus,
	): ProviderIntentResult["status"] {
		switch (status) {
			case "COMPLETED":
				return "succeeded";
			case "VOIDED":
				return "cancelled";
			case "APPROVED":
				return "processing";
			case "CREATED":
			case "SAVED":
			case "PAYER_ACTION_REQUIRED":
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
		const order = await this.request<PayPalOrder>(
			"POST",
			"/v2/checkout/orders",
			{
				intent: "CAPTURE",
				purchase_units: [
					{
						amount: {
							currency_code: params.currency.toUpperCase(),
							value: this.formatAmount(params.amount),
						},
					},
				],
			},
		);
		const approvalLink = order.links?.find((l) => l.rel === "approve");
		return {
			providerIntentId: order.id,
			status: this.mapOrderStatus(order.status),
			providerMetadata: {
				paypalStatus: order.status,
				paypalOrderId: order.id,
				paymentType: "paypal",
				...(approvalLink ? { approvalUrl: approvalLink.href } : {}),
			},
		};
	}

	async confirmIntent(providerIntentId: string): Promise<ProviderIntentResult> {
		const order = await this.request<PayPalOrder>(
			"POST",
			`/v2/checkout/orders/${providerIntentId}/capture`,
		);
		return {
			providerIntentId: order.id,
			status: this.mapOrderStatus(order.status),
			providerMetadata: { paypalStatus: order.status },
		};
	}

	async cancelIntent(providerIntentId: string): Promise<ProviderIntentResult> {
		// PayPal orders that have not been approved/captured expire naturally.
		// Check the current status and return cancelled — no explicit cancel endpoint for orders.
		const order = await this.request<PayPalOrder>(
			"GET",
			`/v2/checkout/orders/${providerIntentId}`,
		);
		// If already voided/completed we report accordingly; otherwise treat as cancelled.
		const status =
			order.status === "VOIDED" || order.status === "COMPLETED"
				? this.mapOrderStatus(order.status)
				: ("cancelled" as const);
		return {
			providerIntentId: order.id,
			status,
			providerMetadata: { paypalStatus: "VOIDED" },
		};
	}

	async createRefund(params: {
		providerIntentId: string;
		amount?: number | undefined;
		currency?: string | undefined;
		reason?: string | undefined;
	}): Promise<ProviderRefundResult> {
		// Step 1: fetch the order to find the capture ID
		const order = await this.request<PayPalOrder>(
			"GET",
			`/v2/checkout/orders/${params.providerIntentId}`,
		);
		const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
		if (!captureId) {
			throw new Error(
				`PayPal error: No capture found for order ${params.providerIntentId}`,
			);
		}

		// Step 2: issue the refund against the capture
		const refundBody: Record<string, unknown> = {};
		if (params.amount !== undefined) {
			refundBody.amount = {
				currency_code: (params.currency ?? "USD").toUpperCase(),
				value: this.formatAmount(params.amount),
			};
		}
		if (params.reason !== undefined) {
			refundBody.note_to_payer = params.reason;
		}

		const idempotencyKey =
			params.amount !== undefined
				? `refund-${captureId}-${params.amount}-${(params.currency ?? "USD").toUpperCase()}`
				: `refund-${captureId}-full`;
		const refund = await this.request<PayPalRefund>(
			"POST",
			`/v2/payments/captures/${captureId}/refund`,
			refundBody,
			{ "PayPal-Request-Id": idempotencyKey },
		);

		const refundStatus =
			refund.status === "COMPLETED"
				? ("succeeded" as const)
				: refund.status === "FAILED"
					? ("failed" as const)
					: ("pending" as const);

		return {
			providerRefundId: refund.id,
			status: refundStatus,
			providerMetadata: { paypalStatus: refund.status },
		};
	}
}
