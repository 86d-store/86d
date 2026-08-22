import type {
	PaymentConnectionCapability,
	PaymentConnectionProvider,
	PaymentOperationPayload,
	PaymentProviderOperationOutcome,
	PaymentProviderOperationRequest,
	PaymentProviderReconciliationRequest,
} from "@86d-app/core/payment-connection-provider";
import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(255);
const secretSchema = z.string().min(1).max(1_000);
const paypalRequestIdSchema = z.string().min(1).max(108);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const minorUnitsSchema = z
	.number()
	.int()
	.positive()
	.max(Number.MAX_SAFE_INTEGER);

const paypalLinkSchema = z
	.object({
		href: z.string().url().max(2_000),
		rel: z.string().min(1).max(100),
		method: z.string().min(1).max(20),
	})
	.passthrough();

const paypalAmountSchema = z
	.object({
		currency_code: currencySchema,
		value: z.string().regex(/^\d+(?:\.\d{2})?$/),
	})
	.passthrough();

const paypalAuthorizationSchema = z
	.object({
		id: identifierSchema,
		status: z.enum([
			"CREATED",
			"CAPTURED",
			"DENIED",
			"EXPIRED",
			"PARTIALLY_CAPTURED",
			"PENDING",
			"VOIDED",
		]),
		amount: paypalAmountSchema,
		void_state: z
			.enum(["UNATTEMPTED", "PENDING", "SUCCEEDED", "FAILED"])
			.optional(),
	})
	.passthrough();

const paypalCaptureSchema = z
	.object({
		id: identifierSchema,
		status: z.enum([
			"COMPLETED",
			"DECLINED",
			"PARTIALLY_REFUNDED",
			"PENDING",
			"REFUNDED",
			"FAILED",
		]),
		amount: paypalAmountSchema,
	})
	.passthrough();

const paypalRefundSchema = z
	.object({
		id: identifierSchema,
		status: z.enum(["COMPLETED", "FAILED", "PENDING", "CANCELLED"]),
		amount: paypalAmountSchema,
	})
	.passthrough();

const paypalOrderSchema = z
	.object({
		id: identifierSchema,
		status: z.enum([
			"CREATED",
			"SAVED",
			"APPROVED",
			"VOIDED",
			"COMPLETED",
			"PAYER_ACTION_REQUIRED",
		]),
		links: z.array(paypalLinkSchema).max(50).optional(),
		purchase_units: z
			.array(
				z
					.object({
						amount: paypalAmountSchema.optional(),
						payments: z
							.object({
								authorizations: z
									.array(paypalAuthorizationSchema)
									.max(20)
									.optional(),
								captures: z.array(paypalCaptureSchema).max(20).optional(),
							})
							.passthrough()
							.optional(),
					})
					.passthrough(),
			)
			.max(20)
			.optional(),
	})
	.passthrough();

const paypalTokenSchema = z
	.object({
		access_token: secretSchema,
		expires_in: z.number().int().positive(),
	})
	.passthrough();

const paypalErrorSchema = z
	.object({
		name: z.string().min(1).max(200).optional(),
		message: z.string().min(1).max(1_000).optional(),
		details: z
			.array(
				z
					.object({
						issue: z.string().min(1).max(200).optional(),
					})
					.passthrough(),
			)
			.max(50)
			.optional(),
	})
	.passthrough();

type PayPalAuthorization = z.infer<typeof paypalAuthorizationSchema>;
type PayPalCapture = z.infer<typeof paypalCaptureSchema>;
type PayPalRefund = z.infer<typeof paypalRefundSchema>;
type PayPalOrder = z.infer<typeof paypalOrderSchema>;

export interface PayPalPaymentConnectionProviderOptions {
	connectionId: string;
	/** PayPal merchant/payer ID the credential was verified to authorize. */
	providerAccountId: string;
	clientId: string;
	clientSecret: string;
	mode: "test" | "live";
	/** Trusted Store callback after the payer approves the exact Order. */
	returnUrl: string;
	/** Trusted Store callback after the payer cancels the exact Order. */
	cancelUrl: string;
}

class PayPalHttpError extends Error {
	readonly status: number;
	readonly providerCode: string;

	constructor(status: number, providerCode: string) {
		super(`PayPal request failed with HTTP ${status}.`);
		this.name = "PayPalHttpError";
		this.status = status;
		this.providerCode = providerCode;
	}
}

const PAYPAL_SUPPORTED_CURRENCIES = new Set([
	"AUD",
	"BRL",
	"CAD",
	"CHF",
	"CNY",
	"CZK",
	"DKK",
	"EUR",
	"GBP",
	"HKD",
	"HUF",
	"ILS",
	"JPY",
	"MXN",
	"MYR",
	"NOK",
	"NZD",
	"PHP",
	"PLN",
	"SEK",
	"SGD",
	"THB",
	"TWD",
	"USD",
]);
const PAYPAL_ZERO_DIGIT_CURRENCIES = new Set(["HUF", "JPY", "TWD"]);
/** Orders v2 documents six-hour retention; stay one hour inside that bound. */
const PAYPAL_ORDER_REPLAY_WINDOW_MS = 5 * 60 * 60 * 1_000;
/**
 * PayPal documents exact-key capture replay but not a capture retention floor.
 * Five minutes is our deliberately short operational recovery bound, not a
 * provider-published retention guarantee.
 */
const PAYPAL_CAPTURE_REPLAY_WINDOW_MS = 5 * 60 * 1_000;
/** PayPal publishes 45-day refund retention; stay one day inside that bound. */
const PAYPAL_REFUND_REPLAY_WINDOW_MS = 44 * 24 * 60 * 60 * 1_000;

function paypalCurrency(currency: string): string {
	const parsed = currencySchema.parse(currency);
	if (!PAYPAL_SUPPORTED_CURRENCIES.has(parsed)) {
		throw new Error("PayPal does not support the requested currency.");
	}
	return parsed;
}

function formatMinorUnits(amount: number, currency: string): string {
	const parsed = minorUnitsSchema.parse(amount);
	if (PAYPAL_ZERO_DIGIT_CURRENCIES.has(paypalCurrency(currency))) {
		return String(parsed);
	}
	return `${Math.floor(parsed / 100)}.${String(parsed % 100).padStart(2, "0")}`;
}

function assertAmount(
	actual: z.infer<typeof paypalAmountSchema>,
	expectedAmount: number,
	expectedCurrency: string,
): void {
	if (!amountMatches(actual, expectedAmount, expectedCurrency)) {
		throw new Error(
			"PayPal returned money facts that conflict with the request.",
		);
	}
}

function amountMatches(
	actual: z.infer<typeof paypalAmountSchema>,
	expectedAmount: number,
	expectedCurrency: string,
): boolean {
	return (
		actual.value === formatMinorUnits(expectedAmount, expectedCurrency) &&
		actual.currency_code === paypalCurrency(expectedCurrency)
	);
}

function responseMoneyMismatch(
	providerReference: string,
	resource: string,
): PaymentProviderOperationOutcome {
	return {
		state: "ambiguous",
		providerReference,
		result: { reason: "provider_response_money_mismatch", resource },
	};
}

function sourceProvenanceIsValid(
	request:
		| PaymentProviderOperationRequest
		| PaymentProviderReconciliationRequest,
): boolean {
	const { payload, source } = request;
	if (
		payload.operation === "intent" ||
		(payload.operation === "authorization" &&
			payload.providerPaymentReference === undefined)
	) {
		return source === undefined;
	}
	if (!source || !("providerPaymentReference" in payload)) return false;
	if (source.providerReference !== payload.providerPaymentReference)
		return false;
	if (payload.operation === "authorization") {
		return (
			source.operation === "intent" &&
			source.amount === payload.amount &&
			source.currency === payload.currency
		);
	}
	if (payload.operation === "capture") {
		return (
			source.operation === "authorization" &&
			source.currency === payload.currency &&
			payload.amount <= source.amount
		);
	}
	if (payload.operation === "refund") {
		return (
			source.operation === "capture" &&
			source.currency === payload.currency &&
			payload.amount <= source.amount
		);
	}
	return payload.operation === "void" && source.operation === "authorization";
}

function approvalUrl(order: PayPalOrder): string | undefined {
	return order.links?.find(
		(link) => link.rel === "payer-action" || link.rel === "approve",
	)?.href;
}

function trustedCallbackUrl(value: string): string {
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.username.length > 0 ||
		url.password.length > 0 ||
		url.hash.length > 0
	) {
		throw new Error(
			"PayPal callback URLs must be trusted HTTPS URLs without credentials or fragments.",
		);
	}
	return url.toString();
}

function replayIsWithinWindow(createdAt: Date, windowMs: number): boolean {
	const age = Date.now() - createdAt.getTime();
	return age >= 0 && age <= windowMs;
}

function onlyAuthorization(order: PayPalOrder): PayPalAuthorization {
	const authorizations =
		order.purchase_units?.flatMap(
			(unit) => unit.payments?.authorizations ?? [],
		) ?? [];
	if (authorizations.length !== 1) {
		throw new Error("PayPal did not return exactly one authorization.");
	}
	const authorization = authorizations[0];
	if (!authorization) {
		throw new Error("PayPal did not return an authorization.");
	}
	return authorization;
}

function authorizationOutcome(
	authorization: PayPalAuthorization,
): PaymentProviderOperationOutcome {
	const result = {
		resource: "authorization",
		paypalStatus: authorization.status,
		amount: authorization.amount.value,
		currency: authorization.amount.currency_code,
	};
	if (["DENIED", "EXPIRED"].includes(authorization.status)) {
		return {
			state: "failed",
			providerReference: authorization.id,
			result,
		};
	}
	if (authorization.status === "PENDING") {
		return {
			state: "pending",
			providerReference: authorization.id,
			result,
		};
	}
	return {
		state: "succeeded",
		providerReference: authorization.id,
		result,
	};
}

function captureOutcome(
	capture: PayPalCapture,
): PaymentProviderOperationOutcome {
	const result = {
		resource: "capture",
		paypalStatus: capture.status,
		amount: capture.amount.value,
		currency: capture.amount.currency_code,
	};
	if (["DECLINED", "FAILED"].includes(capture.status)) {
		return { state: "failed", providerReference: capture.id, result };
	}
	if (capture.status === "PENDING") {
		return { state: "pending", providerReference: capture.id, result };
	}
	return { state: "succeeded", providerReference: capture.id, result };
}

function refundOutcome(refund: PayPalRefund): PaymentProviderOperationOutcome {
	const result = {
		resource: "refund",
		paypalStatus: refund.status,
		amount: refund.amount.value,
		currency: refund.amount.currency_code,
	};
	if (["FAILED", "CANCELLED"].includes(refund.status)) {
		return { state: "failed", providerReference: refund.id, result };
	}
	if (refund.status === "PENDING") {
		return { state: "pending", providerReference: refund.id, result };
	}
	return { state: "succeeded", providerReference: refund.id, result };
}

function definiteProviderRejection(error: unknown): error is PayPalHttpError {
	return (
		error instanceof PayPalHttpError &&
		error.status >= 400 &&
		error.status < 500 &&
		![408, 409, 425, 429].includes(error.status)
	);
}

/**
 * PayPal Orders v2 adapter for one immutable Third-party Payment Connection.
 *
 * The contract deliberately uses AUTHORIZE, followed by an exact authorization
 * capture or void. Every supported POST receives the caller's durable
 * idempotency key unchanged in `PayPal-Request-Id`.
 */
export class PayPalPaymentConnectionProvider
	implements PaymentConnectionProvider
{
	readonly connectionId: string;
	readonly providerAccountId: string;
	readonly provider = "paypal";
	readonly mode: "test" | "live";
	readonly capabilities = Object.freeze([
		"intent",
		"authorization",
		"capture",
		"refund",
		"void",
	] satisfies readonly PaymentConnectionCapability[]);

	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly baseUrl: string;
	private readonly returnUrl: string;
	private readonly cancelUrl: string;
	private accessToken: string | null = null;
	private tokenExpiresAt = 0;

	constructor(options: PayPalPaymentConnectionProviderOptions) {
		this.connectionId = identifierSchema.parse(options.connectionId);
		this.providerAccountId = identifierSchema.parse(options.providerAccountId);
		this.clientId = secretSchema.parse(options.clientId);
		this.clientSecret = secretSchema.parse(options.clientSecret);
		this.returnUrl = trustedCallbackUrl(options.returnUrl);
		this.cancelUrl = trustedCallbackUrl(options.cancelUrl);
		this.mode = options.mode;
		this.baseUrl =
			options.mode === "test"
				? "https://api-m.sandbox.paypal.com"
				: "https://api-m.paypal.com";
	}

	async execute(
		request: PaymentProviderOperationRequest,
	): Promise<PaymentProviderOperationOutcome> {
		if (request.connectionId !== this.connectionId) {
			return { state: "failed", result: { reason: "connection_mismatch" } };
		}
		if (!paypalRequestIdSchema.safeParse(request.idempotencyKey).success) {
			return { state: "failed", result: { reason: "idempotency_key_invalid" } };
		}
		if (!sourceProvenanceIsValid(request)) {
			return {
				state: "failed",
				result: { reason: "source_provenance_invalid" },
			};
		}
		try {
			switch (request.payload.operation) {
				case "intent":
					return await this.createOrder(request, request.payload);
				case "authorization":
					return await this.authorizeOrder(request, request.payload);
				case "capture":
					return await this.captureAuthorization(request, request.payload);
				case "refund":
					return await this.refundCapture(request, request.payload);
				case "void":
					return await this.voidAuthorization(request, request.payload);
			}
		} catch (error) {
			if (!definiteProviderRejection(error)) throw error;
			return {
				state: "failed",
				result: {
					reason: "provider_rejected",
					providerCode: error.providerCode,
				},
			};
		}
	}

	async reconcile(
		request: PaymentProviderReconciliationRequest,
	): Promise<PaymentProviderOperationOutcome> {
		if (request.connectionId !== this.connectionId) {
			return { state: "failed", result: { reason: "connection_mismatch" } };
		}
		if (request.operation !== request.payload.operation) {
			return { state: "failed", result: { reason: "operation_mismatch" } };
		}
		if (!paypalRequestIdSchema.safeParse(request.idempotencyKey).success) {
			return { state: "failed", result: { reason: "idempotency_key_invalid" } };
		}
		if (!sourceProvenanceIsValid(request)) {
			return {
				state: "failed",
				result: { reason: "source_provenance_invalid" },
			};
		}
		if (!request.providerReference) {
			if (request.operation === "void") {
				return this.getVoidOutcome(request.payload);
			}
			if (
				request.payload.operation === "intent" &&
				replayIsWithinWindow(request.createdAt, PAYPAL_ORDER_REPLAY_WINDOW_MS)
			) {
				return this.replayExactRequest(request);
			}
			if (
				request.payload.operation === "capture" &&
				replayIsWithinWindow(request.createdAt, PAYPAL_CAPTURE_REPLAY_WINDOW_MS)
			) {
				return this.replayExactRequest(request);
			}
			if (
				request.payload.operation === "refund" &&
				replayIsWithinWindow(request.createdAt, PAYPAL_REFUND_REPLAY_WINDOW_MS)
			) {
				return this.replayExactRequest(request);
			}
			if (request.payload.operation === "authorization" && request.source) {
				const order = await this.getOrder(request.source.providerReference);
				const authorizations =
					order.purchase_units?.flatMap(
						(unit) => unit.payments?.authorizations ?? [],
					) ?? [];
				if (authorizations.length === 1 && authorizations[0]) {
					assertAmount(
						authorizations[0].amount,
						request.payload.amount,
						request.payload.currency,
					);
					return authorizationOutcome(authorizations[0]);
				}
			}
			return {
				state: "ambiguous",
				result: { reason: "provider_reference_required_for_reconciliation" },
			};
		}

		switch (request.payload.operation) {
			case "intent": {
				const order = await this.getOrder(request.providerReference);
				const returnedAmount = order.purchase_units?.[0]?.amount;
				if (!returnedAmount) {
					throw new Error("PayPal did not return the reconciled order amount.");
				}
				assertAmount(
					returnedAmount,
					request.payload.amount,
					request.payload.currency,
				);
				return this.orderOutcome(order);
			}
			case "authorization": {
				const authorization = await this.getAuthorization(
					request.providerReference,
				);
				assertAmount(
					authorization.amount,
					request.payload.amount,
					request.payload.currency,
				);
				return authorizationOutcome(authorization);
			}
			case "capture": {
				const capture = await this.getCapture(request.providerReference);
				assertAmount(
					capture.amount,
					request.payload.amount,
					request.payload.currency,
				);
				return captureOutcome(capture);
			}
			case "refund": {
				const refund = await this.getRefund(request.providerReference);
				assertAmount(
					refund.amount,
					request.payload.amount,
					request.payload.currency,
				);
				return refundOutcome(refund);
			}
			case "void":
				return this.getVoidOutcome(request.payload);
		}
	}

	private replayExactRequest(
		request: PaymentProviderReconciliationRequest,
	): Promise<PaymentProviderOperationOutcome> {
		return this.execute({
			operationId: request.operationId,
			connectionId: request.connectionId,
			idempotencyKey: request.idempotencyKey,
			requestDigest: request.requestDigest,
			attempt: request.attempt,
			createdAt: request.createdAt,
			payload: request.payload,
			...(request.source ? { source: request.source } : {}),
		});
	}

	private async createOrder(
		request: PaymentProviderOperationRequest,
		payload: Extract<PaymentOperationPayload, { operation: "intent" }>,
	): Promise<PaymentProviderOperationOutcome> {
		const order = paypalOrderSchema.parse(
			await this.requestJson("POST", "/v2/checkout/orders", {
				body: {
					intent: "AUTHORIZE",
					payment_source: {
						paypal: {
							experience_context: {
								return_url: this.returnUrl,
								cancel_url: this.cancelUrl,
								user_action: "PAY_NOW",
							},
						},
					},
					purchase_units: [
						{
							amount: {
								currency_code: payload.currency,
								value: formatMinorUnits(payload.amount, payload.currency),
							},
						},
					],
				},
				idempotencyKey: request.idempotencyKey,
			}),
		);
		const returnedAmount = order.purchase_units?.[0]?.amount;
		if (!returnedAmount) {
			return responseMoneyMismatch(order.id, "order");
		}
		if (!amountMatches(returnedAmount, payload.amount, payload.currency)) {
			return responseMoneyMismatch(order.id, "order");
		}
		return this.orderOutcome(order);
	}

	private orderOutcome(order: PayPalOrder): PaymentProviderOperationOutcome {
		if (order.status === "VOIDED") {
			return {
				state: "failed",
				providerReference: order.id,
				result: { resource: "order", paypalStatus: order.status },
			};
		}
		const url = approvalUrl(order);
		const result = url
			? {
					resource: "order",
					paypalStatus: order.status,
					approvalUrl: url,
				}
			: { resource: "order", paypalStatus: order.status };
		if (
			order.status === "PAYER_ACTION_REQUIRED" ||
			(["CREATED", "SAVED"].includes(order.status) && url)
		) {
			return {
				state: "requires_action",
				providerReference: order.id,
				result,
			};
		}
		if (["CREATED", "SAVED"].includes(order.status)) {
			return {
				state: "pending",
				providerReference: order.id,
				result,
			};
		}
		return {
			state: "succeeded",
			providerReference: order.id,
			result,
		};
	}

	private async authorizeOrder(
		request: PaymentProviderOperationRequest,
		payload: Extract<PaymentOperationPayload, { operation: "authorization" }>,
	): Promise<PaymentProviderOperationOutcome> {
		const orderId = payload.providerPaymentReference;
		if (!orderId) {
			return {
				state: "failed",
				result: { reason: "paypal_order_reference_required" },
			};
		}
		const order = paypalOrderSchema.parse(
			await this.requestJson(
				"POST",
				`/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
				{ body: {}, idempotencyKey: request.idempotencyKey },
			),
		);
		const authorization = onlyAuthorization(order);
		if (
			!amountMatches(authorization.amount, payload.amount, payload.currency)
		) {
			return responseMoneyMismatch(authorization.id, "authorization");
		}
		return authorizationOutcome(authorization);
	}

	private async captureAuthorization(
		request: PaymentProviderOperationRequest,
		payload: Extract<PaymentOperationPayload, { operation: "capture" }>,
	): Promise<PaymentProviderOperationOutcome> {
		const capture = paypalCaptureSchema.parse(
			await this.requestJson(
				"POST",
				`/v2/payments/authorizations/${encodeURIComponent(
					payload.providerPaymentReference,
				)}/capture`,
				{
					body: {
						amount: {
							currency_code: payload.currency,
							value: formatMinorUnits(payload.amount, payload.currency),
						},
						final_capture: false,
					},
					idempotencyKey: request.idempotencyKey,
				},
			),
		);
		if (!amountMatches(capture.amount, payload.amount, payload.currency)) {
			return responseMoneyMismatch(capture.id, "capture");
		}
		return captureOutcome(capture);
	}

	private async voidAuthorization(
		request: PaymentProviderOperationRequest,
		payload: Extract<PaymentOperationPayload, { operation: "void" }>,
	): Promise<PaymentProviderOperationOutcome> {
		const authorizationId = payload.providerPaymentReference;
		await this.requestNoContent(
			"POST",
			`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`,
			request.idempotencyKey,
		);
		return this.getVoidOutcome(payload);
	}

	private async getVoidOutcome(
		payload: PaymentOperationPayload,
	): Promise<PaymentProviderOperationOutcome> {
		if (payload.operation !== "void") {
			return { state: "failed", result: { reason: "void_payload_required" } };
		}
		const authorization = await this.getAuthorization(
			payload.providerPaymentReference,
		);
		const result = {
			resource: "authorization_void",
			paypalStatus: authorization.status,
			voidState: authorization.void_state ?? "UNATTEMPTED",
		};
		if (
			authorization.status === "VOIDED" ||
			authorization.void_state === "SUCCEEDED"
		) {
			return {
				state: "succeeded",
				providerReference: authorization.id,
				result,
			};
		}
		if (authorization.void_state === "FAILED") {
			return {
				state: "failed",
				providerReference: authorization.id,
				result,
			};
		}
		return {
			state: "pending",
			providerReference: authorization.id,
			result,
		};
	}

	private async refundCapture(
		request: PaymentProviderOperationRequest,
		payload: Extract<PaymentOperationPayload, { operation: "refund" }>,
	): Promise<PaymentProviderOperationOutcome> {
		const refund = paypalRefundSchema.parse(
			await this.requestJson(
				"POST",
				`/v2/payments/captures/${encodeURIComponent(
					payload.providerPaymentReference,
				)}/refund`,
				{
					body: {
						amount: {
							currency_code: payload.currency,
							value: formatMinorUnits(payload.amount, payload.currency),
						},
						...(payload.reason ? { note_to_payer: payload.reason } : {}),
					},
					idempotencyKey: request.idempotencyKey,
				},
			),
		);
		if (!amountMatches(refund.amount, payload.amount, payload.currency)) {
			return responseMoneyMismatch(refund.id, "refund");
		}
		return refundOutcome(refund);
	}

	private getOrder(id: string): Promise<PayPalOrder> {
		return this.requestJson(
			"GET",
			`/v2/checkout/orders/${encodeURIComponent(id)}`,
		).then((value) => paypalOrderSchema.parse(value));
	}

	private getAuthorization(id: string): Promise<PayPalAuthorization> {
		return this.requestJson(
			"GET",
			`/v2/payments/authorizations/${encodeURIComponent(id)}`,
		).then((value) => paypalAuthorizationSchema.parse(value));
	}

	private getCapture(id: string): Promise<PayPalCapture> {
		return this.requestJson(
			"GET",
			`/v2/payments/captures/${encodeURIComponent(id)}`,
		).then((value) => paypalCaptureSchema.parse(value));
	}

	private getRefund(id: string): Promise<PayPalRefund> {
		return this.requestJson(
			"GET",
			`/v2/payments/refunds/${encodeURIComponent(id)}`,
		).then((value) => paypalRefundSchema.parse(value));
	}

	private async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.tokenExpiresAt) {
			return this.accessToken;
		}
		const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
			method: "POST",
			headers: {
				Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: "grant_type=client_credentials",
		});
		const body = await this.readBody(response);
		if (!response.ok) throw this.httpError(response.status, body);
		const token = paypalTokenSchema.parse(body);
		this.accessToken = token.access_token;
		this.tokenExpiresAt =
			Date.now() + Math.max(0, token.expires_in - 60) * 1_000;
		return token.access_token;
	}

	private async requestJson(
		method: "GET" | "POST",
		path: string,
		options?: {
			body?: Readonly<Record<string, unknown>> | undefined;
			idempotencyKey?: string | undefined;
		},
	): Promise<unknown> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${await this.getAccessToken()}`,
				Accept: "application/json",
				"Content-Type": "application/json",
				...(options?.idempotencyKey
					? { "PayPal-Request-Id": options.idempotencyKey }
					: {}),
				...(method === "POST" ? { Prefer: "return=representation" } : {}),
			},
			...(options?.body ? { body: JSON.stringify(options.body) } : {}),
		});
		const body = await this.readBody(response);
		if (!response.ok) throw this.httpError(response.status, body);
		return body;
	}

	private async requestNoContent(
		method: "POST",
		path: string,
		idempotencyKey: string,
	): Promise<void> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${await this.getAccessToken()}`,
				Accept: "application/json",
				"Content-Type": "application/json",
				"PayPal-Request-Id": idempotencyKey,
			},
		});
		if (response.ok) return;
		throw this.httpError(response.status, await this.readBody(response));
	}

	private async readBody(response: Response): Promise<unknown> {
		const text = await response.text();
		if (text.length === 0) return {};
		try {
			return JSON.parse(text);
		} catch {
			throw new Error("PayPal returned a non-JSON response.");
		}
	}

	private httpError(status: number, body: unknown): PayPalHttpError {
		const error = paypalErrorSchema.safeParse(body);
		const providerCode = error.success
			? (error.data.details?.[0]?.issue ?? error.data.name ?? "unknown")
			: "invalid_error_response";
		return new PayPalHttpError(status, providerCode);
	}
}
