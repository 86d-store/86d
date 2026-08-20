import type {
	PaymentConnectionMode,
	PaymentConnectionProvider,
	PaymentProviderOperationOutcome,
	PaymentProviderOperationRequest,
	PaymentProviderReconciliationRequest,
} from "@86d-app/core/payment-connection-provider";

type StripePaymentIntentStatus =
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
	amount_capturable: number;
	amount_received: number;
	currency: string;
	status: StripePaymentIntentStatus;
	metadata: Record<string, string>;
}

interface StripeRefund {
	id: string;
	object: "refund";
	amount: number;
	currency: string;
	payment_intent: string | null;
	status: "pending" | "requires_action" | "succeeded" | "failed" | "canceled";
	metadata: Record<string, string>;
}

interface StripeList<T> {
	object: "list" | "search_result";
	data: T[];
	has_more: boolean;
}

interface StripeErrorResponse {
	error?: {
		code?: string | undefined;
		type?: string | undefined;
	};
}

class StripeRequestError extends Error {
	readonly status: number;
	readonly code: string | undefined;

	constructor(status: number, code: string | undefined) {
		super("Stripe request failed");
		this.status = status;
		this.code = code;
	}
}

const STRIPE_API_VERSION = "2026-02-25.clover";

export interface StripePaymentConnectionProviderOptions {
	/** Immutable Store-owned Payment Connection identity. */
	connectionId: string;
	/** Stripe account ID the credential was verified to authorize. */
	providerAccountId: string;
	/** Server-side Stripe secret key. */
	apiKey: string;
	mode: PaymentConnectionMode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataString(metadata: unknown, key: string): string | undefined {
	if (!isRecord(metadata)) return undefined;
	const value = metadata[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizedCurrency(currency: string): string | undefined {
	const normalized = currency.trim().toUpperCase();
	return /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
}

function isPositiveMinorAmount(amount: number): boolean {
	return Number.isSafeInteger(amount) && amount > 0;
}

function stripeApiKeyMode(apiKey: string): PaymentConnectionMode | undefined {
	const match = /^(?:sk|rk)_(test|live)_.+$/.exec(apiKey);
	return match?.[1] === "test" || match?.[1] === "live" ? match[1] : undefined;
}

function localFailure(reason: string): PaymentProviderOperationOutcome {
	return { state: "failed", result: { reason } };
}

function unknownOutcome(
	reason: string,
	providerReference?: string,
): PaymentProviderOperationOutcome {
	return {
		state: "ambiguous",
		...(providerReference ? { providerReference } : {}),
		result: { reason },
	};
}

function sourceValidationFailure(
	request:
		| PaymentProviderOperationRequest
		| PaymentProviderReconciliationRequest,
): string | undefined {
	const payload = request.payload;
	if (payload.operation === "intent") {
		return request.source ? "source_provenance_mismatch" : undefined;
	}
	if (
		payload.operation === "authorization" &&
		!payload.providerPaymentReference
	) {
		return request.source ? "source_provenance_mismatch" : undefined;
	}
	const source = request.source;
	if (!source) return "source_provenance_required";
	if (source.providerReference !== payload.providerPaymentReference) {
		return "source_provenance_mismatch";
	}
	if (payload.operation === "void") {
		return source.operation === "authorization" &&
			isPositiveMinorAmount(source.amount) &&
			normalizedCurrency(source.currency)
			? undefined
			: "source_provenance_mismatch";
	}
	const currency = normalizedCurrency(payload.currency);
	if (
		!currency ||
		normalizedCurrency(source.currency) !== currency ||
		!isPositiveMinorAmount(source.amount)
	) {
		return "source_provenance_mismatch";
	}
	if (payload.operation === "authorization") {
		return source.operation === "intent" && source.amount === payload.amount
			? undefined
			: "source_provenance_mismatch";
	}
	if (payload.operation === "capture") {
		if (source.operation !== "authorization") {
			return "source_provenance_mismatch";
		}
		return source.amount === payload.amount
			? undefined
			: "single_final_capture_required";
	}
	return source.operation === "capture" && payload.amount <= source.amount
		? undefined
		: "source_provenance_mismatch";
}

/**
 * Stripe adapter for one immutable Payment Connection.
 *
 * PaymentIntents always use manual capture. This adapter performs one final
 * capture per authorization; callers must create a new authorization rather
 * than attempt incremental captures. Every POST receives the durable operation
 * idempotency key verbatim; retries must never invent another key.
 */
export class StripePaymentConnectionProvider
	implements PaymentConnectionProvider
{
	readonly provider = "stripe";
	readonly capabilities = [
		"intent",
		"authorization",
		"capture",
		"void",
		"refund",
	] as const;
	readonly connectionId: string;
	readonly providerAccountId: string;
	readonly mode: PaymentConnectionMode;

	private readonly apiKey: string;
	private readonly baseUrl = "https://api.stripe.com/v1";

	constructor(options: StripePaymentConnectionProviderOptions) {
		if (options.connectionId.trim().length === 0) {
			throw new Error("Stripe Payment Connection ID is required");
		}
		if (
			options.providerAccountId.trim().length === 0 ||
			options.providerAccountId.trim().length > 255
		) {
			throw new Error("Stripe provider account ID is required");
		}
		if (options.apiKey.trim().length === 0) {
			throw new Error("Stripe API key is required");
		}
		const apiKeyMode = stripeApiKeyMode(options.apiKey);
		if (!apiKeyMode) {
			throw new Error("Stripe API key must be an sk/rk test or live key");
		}
		if (apiKeyMode !== options.mode) {
			throw new Error(
				"Stripe API key mode does not match Payment Connection mode",
			);
		}
		this.connectionId = options.connectionId;
		this.providerAccountId = options.providerAccountId.trim();
		this.apiKey = options.apiKey;
		this.mode = options.mode;
	}

	async execute(
		request: PaymentProviderOperationRequest,
	): Promise<PaymentProviderOperationOutcome> {
		if (request.connectionId !== this.connectionId) {
			return localFailure("connection_mismatch");
		}
		const sourceFailure = sourceValidationFailure(request);
		if (sourceFailure) return localFailure(sourceFailure);

		try {
			switch (request.payload.operation) {
				case "intent":
					return await this.createIntent(request, request.payload);
				case "authorization":
					return await this.authorize(request, request.payload);
				case "capture":
					return await this.capture(request, request.payload);
				case "void":
					return await this.voidPayment(request, request.payload);
				case "refund":
					return await this.refund(request, request.payload);
				default:
					return localFailure("unsupported_operation");
			}
		} catch (error) {
			if (
				error instanceof StripeRequestError &&
				error.status >= 400 &&
				error.status < 500 &&
				error.status !== 408 &&
				error.status !== 409 &&
				error.status !== 429
			) {
				return {
					state: "failed",
					result: {
						reason: "provider_rejected_request",
						providerHttpStatus: error.status,
						...(error.code ? { providerCode: error.code } : {}),
					},
				};
			}
			return unknownOutcome("provider_request_unknown");
		}
	}

	async reconcile(
		request: PaymentProviderReconciliationRequest,
	): Promise<PaymentProviderOperationOutcome> {
		if (request.connectionId !== this.connectionId) {
			return localFailure("connection_mismatch");
		}
		if (request.operation !== request.payload.operation) {
			return localFailure("operation_mismatch");
		}
		const sourceFailure = sourceValidationFailure(request);
		if (sourceFailure) return localFailure(sourceFailure);
		try {
			switch (request.payload.operation) {
				case "intent":
					return await this.reconcileCreatedIntent(request, request.payload);
				case "refund":
					return await this.reconcileRefund(request, request.payload);
				case "capture":
					return await this.reconcileCapture(request, request.payload);
				case "authorization":
					return await this.reconcileAuthorization(request, request.payload);
				case "void":
					return await this.reconcileVoid(request, request.payload);
				default:
					return unknownOutcome("reconciliation_not_implemented");
			}
		} catch {
			return unknownOutcome("provider_reconciliation_unknown");
		}
	}

	private async reconcileCreatedIntent(
		request: PaymentProviderReconciliationRequest,
		payload: Extract<
			PaymentProviderReconciliationRequest["payload"],
			{ operation: "intent" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		if (request.providerReference) {
			const intent = await this.get<StripePaymentIntent>(
				`/payment_intents/${encodeURIComponent(request.providerReference)}`,
			);
			if (intent.id !== request.providerReference) {
				return unknownOutcome("provider_response_mismatch");
			}
			return this.mapPaymentIntent("intent", intent, payload);
		}

		const search = await this.get<StripeList<StripePaymentIntent>>(
			"/payment_intents/search",
			{
				query: `metadata['86d_operation_id']:'${this.escapeSearchValue(request.operationId)}'`,
				limit: "2",
			},
		);
		const exact = search.data.filter(
			(intent) =>
				intent.metadata["86d_operation_id"] === request.operationId &&
				intent.metadata["86d_request_digest"] === request.requestDigest,
		);
		if (exact.length !== 1 || search.data.length !== 1 || search.has_more) {
			return unknownOutcome("provider_operation_not_uniquely_identified");
		}
		const intent = exact[0];
		if (!intent) {
			return unknownOutcome("provider_operation_not_found");
		}
		return this.mapPaymentIntent("intent", intent, payload);
	}

	private async reconcileAuthorization(
		request: PaymentProviderReconciliationRequest,
		payload: Extract<
			PaymentProviderReconciliationRequest["payload"],
			{ operation: "authorization" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		if (
			request.providerReference &&
			payload.providerPaymentReference &&
			request.providerReference !== payload.providerPaymentReference
		) {
			return unknownOutcome("provider_reference_mismatch");
		}
		const providerReference =
			request.providerReference ?? payload.providerPaymentReference;
		if (providerReference) {
			const intent = await this.get<StripePaymentIntent>(
				`/payment_intents/${encodeURIComponent(providerReference)}`,
			);
			if (intent.id !== providerReference) {
				return unknownOutcome("provider_response_mismatch");
			}
			return this.mapPaymentIntent("authorization", intent, payload);
		}

		const search = await this.get<StripeList<StripePaymentIntent>>(
			"/payment_intents/search",
			{
				query: `metadata['86d_operation_id']:'${this.escapeSearchValue(request.operationId)}'`,
				limit: "2",
			},
		);
		const exact = search.data.filter(
			(intent) =>
				intent.metadata["86d_operation_id"] === request.operationId &&
				intent.metadata["86d_request_digest"] === request.requestDigest,
		);
		if (exact.length !== 1 || search.data.length !== 1 || search.has_more) {
			return unknownOutcome("provider_operation_not_uniquely_identified");
		}
		const intent = exact[0];
		if (!intent) {
			return unknownOutcome("provider_operation_not_found");
		}
		return this.mapPaymentIntent("authorization", intent, payload);
	}

	private async reconcileRefund(
		request: PaymentProviderReconciliationRequest,
		payload: Extract<
			PaymentProviderReconciliationRequest["payload"],
			{ operation: "refund" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		if (request.providerReference) {
			const refund = await this.get<StripeRefund>(
				`/refunds/${encodeURIComponent(request.providerReference)}`,
			);
			if (refund.id !== request.providerReference) {
				return unknownOutcome("provider_response_mismatch");
			}
			return this.mapRefund(refund, payload);
		}

		const refunds = await this.get<StripeList<StripeRefund>>("/refunds", {
			payment_intent: payload.providerPaymentReference,
			limit: "100",
		});
		const exact = refunds.data.filter(
			(refund) =>
				refund.metadata["86d_operation_id"] === request.operationId &&
				refund.metadata["86d_request_digest"] === request.requestDigest,
		);
		if (exact.length !== 1 || refunds.has_more) {
			return unknownOutcome("provider_operation_not_uniquely_identified");
		}
		const refund = exact[0];
		if (!refund) {
			return unknownOutcome("provider_operation_not_found");
		}
		return this.mapRefund(refund, payload);
	}

	private async reconcileCapture(
		request: PaymentProviderReconciliationRequest,
		payload: Extract<
			PaymentProviderReconciliationRequest["payload"],
			{ operation: "capture" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		if (
			request.providerReference &&
			request.providerReference !== payload.providerPaymentReference
		) {
			return unknownOutcome("provider_reference_mismatch");
		}
		const intent = await this.get<StripePaymentIntent>(
			`/payment_intents/${encodeURIComponent(payload.providerPaymentReference)}`,
		);
		if (
			intent.id !== payload.providerPaymentReference ||
			intent.metadata["86d_operation_id"] !== request.operationId ||
			intent.metadata["86d_request_digest"] !== request.requestDigest
		) {
			return unknownOutcome("provider_response_mismatch");
		}
		return this.mapCapture(intent, payload);
	}

	private async reconcileVoid(
		request: PaymentProviderReconciliationRequest,
		payload: Extract<
			PaymentProviderReconciliationRequest["payload"],
			{ operation: "void" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		if (
			request.providerReference &&
			request.providerReference !== payload.providerPaymentReference
		) {
			return unknownOutcome("provider_reference_mismatch");
		}
		const intent = await this.get<StripePaymentIntent>(
			`/payment_intents/${encodeURIComponent(payload.providerPaymentReference)}`,
		);
		if (intent.id !== payload.providerPaymentReference) {
			return unknownOutcome("provider_response_mismatch");
		}
		return this.mapVoid(intent);
	}

	private escapeSearchValue(value: string): string {
		return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
	}

	private async createIntent(
		request: PaymentProviderOperationRequest,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "intent" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		const currency = normalizedCurrency(payload.currency);
		if (!currency) return localFailure("invalid_currency");
		if (!isPositiveMinorAmount(payload.amount)) {
			return localFailure("invalid_amount");
		}
		const intent = await this.post<StripePaymentIntent>(
			"/payment_intents",
			{
				amount: String(payload.amount),
				currency: currency.toLowerCase(),
				capture_method: "manual",
				"automatic_payment_methods[enabled]": "true",
				"metadata[86d_operation_id]": request.operationId,
				"metadata[86d_request_digest]": request.requestDigest,
			},
			request.idempotencyKey,
		);
		return this.mapPaymentIntent("intent", intent, payload);
	}

	private async authorize(
		request: PaymentProviderOperationRequest,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "authorization" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		const currency = normalizedCurrency(payload.currency);
		if (!currency) return localFailure("invalid_currency");
		if (!isPositiveMinorAmount(payload.amount)) {
			return localFailure("invalid_amount");
		}
		const paymentMethodId = metadataString(payload.metadata, "paymentMethodId");
		if (!paymentMethodId) return localFailure("payment_method_required");

		const existingReference = payload.providerPaymentReference;
		const intent = existingReference
			? await this.post<StripePaymentIntent>(
					`/payment_intents/${encodeURIComponent(existingReference)}/confirm`,
					{ payment_method: paymentMethodId },
					request.idempotencyKey,
				)
			: await this.post<StripePaymentIntent>(
					"/payment_intents",
					{
						amount: String(payload.amount),
						currency: currency.toLowerCase(),
						capture_method: "manual",
						confirm: "true",
						payment_method: paymentMethodId,
						"metadata[86d_operation_id]": request.operationId,
						"metadata[86d_request_digest]": request.requestDigest,
					},
					request.idempotencyKey,
				);
		if (existingReference && intent.id !== existingReference) {
			return unknownOutcome("provider_response_mismatch");
		}
		return this.mapPaymentIntent("authorization", intent, payload);
	}

	private async capture(
		request: PaymentProviderOperationRequest,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "capture" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		const currency = normalizedCurrency(payload.currency);
		if (!currency) return localFailure("invalid_currency");
		if (!isPositiveMinorAmount(payload.amount)) {
			return localFailure("invalid_amount");
		}
		const intent = await this.post<StripePaymentIntent>(
			`/payment_intents/${encodeURIComponent(payload.providerPaymentReference)}/capture`,
			{
				amount_to_capture: String(payload.amount),
				final_capture: "true",
				"metadata[86d_operation_id]": request.operationId,
				"metadata[86d_request_digest]": request.requestDigest,
			},
			request.idempotencyKey,
		);
		if (intent.id !== payload.providerPaymentReference) {
			return unknownOutcome("provider_response_mismatch");
		}
		return this.mapCapture(intent, payload);
	}

	private mapCapture(
		intent: StripePaymentIntent,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "capture" }
		>,
	): PaymentProviderOperationOutcome {
		const currency = normalizedCurrency(payload.currency);
		if (intent.id !== payload.providerPaymentReference) {
			return unknownOutcome("provider_response_mismatch");
		}
		if (
			!currency ||
			intent.currency.toUpperCase() !== currency ||
			intent.amount_received !== payload.amount
		) {
			return unknownOutcome("provider_response_mismatch", intent.id);
		}
		const result = {
			kind: "payment_intent",
			providerStatus: intent.status,
			requestedAmount: payload.amount,
			paymentIntentAmount: intent.amount,
			amountCapturable: intent.amount_capturable,
			amountReceived: intent.amount_received,
			currency,
		} as const;
		if (intent.status === "succeeded") {
			return {
				state: "succeeded",
				providerReference: intent.id,
				result,
			};
		}
		if (
			intent.status === "canceled" ||
			intent.status === "requires_payment_method"
		) {
			return { state: "failed", providerReference: intent.id, result };
		}
		return {
			state:
				intent.status === "requires_action" ? "requires_action" : "pending",
			providerReference: intent.id,
			result,
		};
	}

	private async voidPayment(
		request: PaymentProviderOperationRequest,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "void" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		const intent = await this.post<StripePaymentIntent>(
			`/payment_intents/${encodeURIComponent(payload.providerPaymentReference)}/cancel`,
			{ cancellation_reason: "requested_by_customer" },
			request.idempotencyKey,
		);
		if (intent.id !== payload.providerPaymentReference) {
			return unknownOutcome("provider_response_mismatch");
		}
		return this.mapVoid(intent);
	}

	private mapVoid(
		intent: StripePaymentIntent,
	): PaymentProviderOperationOutcome {
		const result = {
			kind: "payment_intent",
			providerStatus: intent.status,
			amount: intent.amount,
			amountCapturable: intent.amount_capturable,
			amountReceived: intent.amount_received,
			currency: intent.currency.toUpperCase(),
		} as const;
		if (intent.status === "canceled") {
			return {
				state: "succeeded",
				providerReference: intent.id,
				result,
			};
		}
		if (intent.status === "succeeded") {
			return { state: "failed", providerReference: intent.id, result };
		}
		return {
			state:
				intent.status === "requires_action" ? "requires_action" : "pending",
			providerReference: intent.id,
			result,
		};
	}

	private async refund(
		request: PaymentProviderOperationRequest,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "refund" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		const currency = normalizedCurrency(payload.currency);
		if (!currency) return localFailure("invalid_currency");
		if (!isPositiveMinorAmount(payload.amount)) {
			return localFailure("invalid_amount");
		}
		const refund = await this.post<StripeRefund>(
			"/refunds",
			{
				payment_intent: payload.providerPaymentReference,
				amount: String(payload.amount),
				"metadata[86d_operation_id]": request.operationId,
				"metadata[86d_request_digest]": request.requestDigest,
			},
			request.idempotencyKey,
		);
		return this.mapRefund(refund, payload);
	}

	private mapRefund(
		refund: StripeRefund,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "refund" }
		>,
	): PaymentProviderOperationOutcome {
		const currency = normalizedCurrency(payload.currency);
		if (
			refund.object !== "refund" ||
			typeof refund.id !== "string" ||
			refund.id.length === 0
		) {
			return unknownOutcome("provider_response_mismatch");
		}
		if (
			!currency ||
			!Number.isSafeInteger(refund.amount) ||
			typeof refund.currency !== "string" ||
			refund.payment_intent !== payload.providerPaymentReference ||
			refund.amount !== payload.amount ||
			refund.currency.toUpperCase() !== currency
		) {
			return unknownOutcome("provider_response_mismatch", refund.id);
		}
		const result = {
			kind: "refund",
			providerStatus: refund.status,
			amount: refund.amount,
			currency,
			sourceProviderReference: payload.providerPaymentReference,
		} as const;
		if (refund.status === "succeeded") {
			return {
				state: "succeeded",
				providerReference: refund.id,
				result,
			};
		}
		if (refund.status === "failed" || refund.status === "canceled") {
			return { state: "failed", providerReference: refund.id, result };
		}
		return {
			state:
				refund.status === "requires_action" ? "requires_action" : "pending",
			providerReference: refund.id,
			result,
		};
	}

	private mapPaymentIntent(
		operation: "intent" | "authorization",
		intent: StripePaymentIntent,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "intent" | "authorization" }
		>,
	): PaymentProviderOperationOutcome {
		const currency = normalizedCurrency(payload.currency);
		if (
			intent.object !== "payment_intent" ||
			typeof intent.id !== "string" ||
			intent.id.length === 0
		) {
			return unknownOutcome("provider_response_mismatch");
		}
		if (
			!currency ||
			!Number.isSafeInteger(intent.amount) ||
			!Number.isSafeInteger(intent.amount_capturable) ||
			!Number.isSafeInteger(intent.amount_received) ||
			typeof intent.currency !== "string" ||
			intent.currency.toUpperCase() !== currency ||
			intent.amount !== payload.amount
		) {
			return unknownOutcome("provider_response_mismatch", intent.id);
		}
		const result = {
			kind: "payment_intent",
			providerStatus: intent.status,
			amount: intent.amount,
			amountCapturable: intent.amount_capturable,
			amountReceived: intent.amount_received,
			currency,
		} as const;
		if (operation === "intent") {
			return {
				state: intent.status === "canceled" ? "failed" : "succeeded",
				providerReference: intent.id,
				result,
			};
		}
		if (operation === "authorization" && intent.status === "requires_capture") {
			return {
				state: "succeeded",
				providerReference: intent.id,
				result,
			};
		}
		if (
			intent.status === "canceled" ||
			intent.status === "requires_payment_method"
		) {
			return {
				state: "failed",
				providerReference: intent.id,
				result,
			};
		}
		if (intent.status === "requires_action") {
			return {
				state: "requires_action",
				providerReference: intent.id,
				result,
			};
		}
		if (
			intent.status === "processing" ||
			intent.status === "requires_confirmation"
		) {
			return {
				state: "pending",
				providerReference: intent.id,
				result,
			};
		}
		return {
			state: "ambiguous",
			providerReference: intent.id,
			result,
		};
	}

	private async post<T>(
		path: string,
		body: Record<string, string>,
		idempotencyKey: string,
	): Promise<T> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/x-www-form-urlencoded",
				"Idempotency-Key": idempotencyKey,
				"Stripe-Version": STRIPE_API_VERSION,
			},
			body: new URLSearchParams(body).toString(),
		});
		const json = (await response.json()) as T | StripeErrorResponse;
		if (!response.ok) {
			const error = json as StripeErrorResponse;
			throw new StripeRequestError(response.status, error.error?.code);
		}
		return json as T;
	}

	private async get<T>(
		path: string,
		query?: Record<string, string>,
	): Promise<T> {
		const suffix = query ? `?${new URLSearchParams(query).toString()}` : "";
		const response = await fetch(`${this.baseUrl}${path}${suffix}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Stripe-Version": STRIPE_API_VERSION,
			},
		});
		const json = (await response.json()) as T | StripeErrorResponse;
		if (!response.ok) {
			const error = json as StripeErrorResponse;
			throw new StripeRequestError(response.status, error.error?.code);
		}
		return json as T;
	}
}

export function createStripePaymentConnectionProvider(
	options: StripePaymentConnectionProviderOptions,
): StripePaymentConnectionProvider {
	return new StripePaymentConnectionProvider(options);
}
