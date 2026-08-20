import type {
	PaymentConnectionMode,
	PaymentConnectionProvider,
	PaymentProviderOperationOutcome,
	PaymentProviderOperationRequest,
	PaymentProviderReconciliationRequest,
} from "@86d-app/core/payment-connection-provider";

type BraintreePaymentStatus =
	| "AUTHORIZING"
	| "AUTHORIZED"
	| "AUTHORIZATION_EXPIRED"
	| "SUBMITTED_FOR_SETTLEMENT"
	| "SETTLEMENT_PENDING"
	| "SETTLEMENT_CONFIRMED"
	| "SETTLING"
	| "SETTLED"
	| "VOIDED"
	| "PROCESSOR_DECLINED"
	| "GATEWAY_REJECTED"
	| "SETTLEMENT_DECLINED"
	| "FAILED";

interface BraintreeMoney {
	value: string;
	currencyIsoCode: string;
}

interface BraintreeTransaction {
	__typename?: "Transaction" | undefined;
	id: string;
	legacyId?: string | undefined;
	status: BraintreePaymentStatus;
	orderId?: string | null | undefined;
	amount: BraintreeMoney;
}

interface BraintreeRefund {
	__typename: "Refund";
	id: string;
	legacyId?: string | undefined;
	status: BraintreePaymentStatus;
	orderId?: string | null | undefined;
	amount: BraintreeMoney;
	refundedTransaction?: { id: string } | null | undefined;
}

interface BraintreeGraphqlError {
	extensions?: {
		code?: string | undefined;
		errorClass?: string | undefined;
	};
}

interface BraintreeGraphqlResponse<T> {
	data?: T | null | undefined;
	errors?: BraintreeGraphqlError[] | undefined;
}

interface BraintreeConnection<T> {
	pageInfo: { hasNextPage: boolean };
	edges: Array<{ node: T }>;
}

class BraintreeRequestError extends Error {
	readonly status: number;
	readonly codes: readonly string[];

	constructor(status: number, codes: readonly string[] = []) {
		super("Braintree request failed");
		this.status = status;
		this.codes = codes;
	}
}

const ZERO_DECIMAL_CURRENCIES = new Set([
	"BIF",
	"CLP",
	"DJF",
	"GNF",
	"ISK",
	"JPY",
	"KMF",
	"KRW",
	"LAK",
	"PYG",
	"RWF",
	"UGX",
	"VND",
	"VUV",
	"XAF",
	"XOF",
	"XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

const PAYMENT_FIELDS = `
	id
	legacyId
	status
	orderId
	amount { value currencyIsoCode }
`;

const REFUND_FIELDS = `
	__typename
	id
	legacyId
	status
	orderId
	amount { value currencyIsoCode }
	refundedTransaction { id }
`;

const AUTHORIZE_PAYMENT_METHOD = `
	mutation AuthorizePaymentMethod($input: AuthorizePaymentMethodInput!) {
		authorizePaymentMethod(input: $input) {
			clientMutationId
			transaction { ${PAYMENT_FIELDS} }
		}
	}
`;

const CAPTURE_TRANSACTION = `
	mutation CaptureTransaction($input: CaptureTransactionInput!) {
		captureTransaction(input: $input) {
			clientMutationId
			transaction { ${PAYMENT_FIELDS} }
		}
	}
`;

const VOID_TRANSACTION = `
	mutation VoidTransaction($input: VoidTransactionInput!) {
		voidTransaction(input: $input) {
			clientMutationId
			transaction { ${PAYMENT_FIELDS} }
		}
	}
`;

const REFUND_TRANSACTION = `
	mutation RefundTransaction($input: RefundTransactionInput!) {
		refundTransaction(input: $input) {
			clientMutationId
			refund { ${REFUND_FIELDS} }
		}
	}
`;

const SEARCH_TRANSACTIONS = `
	query ReconcileTransaction($input: TransactionSearchInput!) {
		transactions(input: $input, first: 2) {
			pageInfo { hasNextPage }
			edges { node { ${PAYMENT_FIELDS} } }
		}
	}
`;

const GET_TRANSACTION = `
	query ReconcileTransactionNode($id: ID!) {
		node(id: $id) {
			__typename
			... on Transaction { ${PAYMENT_FIELDS} }
		}
	}
`;

const SEARCH_REFUNDS = `
	query ReconcileRefund($input: RefundSearchInput!) {
		refunds(input: $input, first: 2) {
			pageInfo { hasNextPage }
			edges { node { ${REFUND_FIELDS} } }
		}
	}
`;

const GET_REFUND = `
	query ReconcileRefundNode($id: ID!) {
		node(id: $id) {
			__typename
			... on Refund { ${REFUND_FIELDS} }
		}
	}
`;

export interface BraintreePaymentConnectionProviderOptions {
	/** Immutable Store-owned Payment Connection identity. */
	connectionId: string;
	/** Braintree merchant ID the credential was verified to authorize. */
	providerAccountId: string;
	publicKey: string;
	privateKey: string;
	mode: PaymentConnectionMode;
	/**
	 * Connection-owned Braintree merchant account for each enabled currency.
	 * Braintree derives transaction currency from this upstream account.
	 */
	merchantAccountIds: Readonly<Record<string, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataString(metadata: unknown, key: string): string | undefined {
	if (!isRecord(metadata)) return undefined;
	const value = metadata[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeCurrency(currency: string): string | undefined {
	const normalized = currency.trim().toUpperCase();
	return /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
}

function currencyExponent(currency: string): number {
	if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
	if (THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
	return 2;
}

function minorUnitsToDecimal(
	amount: number,
	currency: string,
): string | undefined {
	if (!Number.isSafeInteger(amount) || amount <= 0) return undefined;
	const exponent = currencyExponent(currency);
	if (exponent === 0) return String(amount);
	const scale = 10 ** exponent;
	const whole = Math.floor(amount / scale);
	const fraction = String(amount % scale).padStart(exponent, "0");
	return `${whole}.${fraction}`;
}

function decimalToMinorUnits(
	value: string,
	currency: string,
): number | undefined {
	const match = /^(0|[1-9]\d*)(?:\.(\d{1,3}))?$/.exec(value);
	if (!match) return undefined;
	const exponent = currencyExponent(currency);
	const fraction = match[2] ?? "";
	if (fraction.length > exponent) return undefined;
	const scale = 10 ** exponent;
	const amount =
		Number(match[1]) * scale + Number(fraction.padEnd(exponent, "0"));
	return Number.isSafeInteger(amount) ? amount : undefined;
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
			Number.isSafeInteger(source.amount) &&
			source.amount > 0 &&
			normalizeCurrency(source.currency)
			? undefined
			: "source_provenance_mismatch";
	}
	const currency = normalizeCurrency(payload.currency);
	if (
		!currency ||
		normalizeCurrency(source.currency) !== currency ||
		!Number.isSafeInteger(source.amount) ||
		source.amount <= 0
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
 * Braintree GraphQL adapter for one immutable Payment Connection.
 *
 * Mutations forward `idempotencyKey` unchanged as Braintree's `apiRequestKey`
 * and use `operationId` as both `clientMutationId` and `orderId`. Braintree
 * retains apiRequestKey duplicate protection for 30 days; the Store's durable
 * envelope remains the permanent local operation identity. Intent is not
 * advertised because this adapter starts with authorization, and each
 * authorization permits one capture operation.
 */
export class BraintreePaymentConnectionProvider
	implements PaymentConnectionProvider
{
	readonly provider = "braintree";
	readonly capabilities = [
		"authorization",
		"capture",
		"void",
		"refund",
	] as const;
	readonly connectionId: string;
	readonly providerAccountId: string;
	readonly mode: PaymentConnectionMode;

	private readonly publicKey: string;
	private readonly privateKey: string;
	private readonly endpoint: string;
	private readonly merchantAccountIds = new Map<string, string>();

	constructor(options: BraintreePaymentConnectionProviderOptions) {
		if (options.connectionId.trim().length === 0) {
			throw new Error("Braintree Payment Connection ID is required");
		}
		if (
			options.providerAccountId.trim().length === 0 ||
			options.providerAccountId.trim().length > 255
		) {
			throw new Error("Braintree provider account ID is required");
		}
		if (
			options.publicKey.trim().length === 0 ||
			options.privateKey.trim().length === 0
		) {
			throw new Error("Braintree API credentials are required");
		}
		for (const [inputCurrency, merchantAccountId] of Object.entries(
			options.merchantAccountIds,
		)) {
			const currency = normalizeCurrency(inputCurrency);
			if (!currency || merchantAccountId.trim().length === 0) {
				throw new Error("Braintree currency mappings must be valid");
			}
			this.merchantAccountIds.set(currency, merchantAccountId);
		}
		if (this.merchantAccountIds.size === 0) {
			throw new Error("At least one Braintree merchant account is required");
		}

		this.connectionId = options.connectionId;
		this.providerAccountId = options.providerAccountId.trim();
		this.publicKey = options.publicKey;
		this.privateKey = options.privateKey;
		this.mode = options.mode;
		this.endpoint =
			options.mode === "test"
				? "https://payments.sandbox.braintree-api.com/graphql"
				: "https://payments.braintree-api.com/graphql";
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
					return localFailure("intent_not_supported");
				case "authorization":
					return await this.authorizePayment(request, request.payload);
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
				error instanceof BraintreeRequestError &&
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
						...(error.codes.length > 0
							? { providerCodes: [...error.codes] }
							: {}),
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
					return localFailure("intent_not_supported");
				case "authorization":
					return await this.reconcileAuthorization(request, request.payload);
				case "capture":
					return await this.reconcileCapture(request, request.payload);
				case "void":
					return await this.reconcileVoid(request, request.payload);
				case "refund":
					return await this.reconcileRefund(request, request.payload);
				default:
					return unknownOutcome("reconciliation_not_implemented");
			}
		} catch {
			return unknownOutcome("provider_reconciliation_unknown");
		}
	}

	private async reconcileAuthorization(
		request: PaymentProviderReconciliationRequest,
		payload: Extract<
			PaymentProviderReconciliationRequest["payload"],
			{ operation: "authorization" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		if (payload.providerPaymentReference) {
			return localFailure("authorization_source_not_supported");
		}
		if (request.providerReference) {
			const transaction = await this.getTransaction(request.providerReference);
			return this.mapAuthorization(transaction, payload, request.operationId);
		}
		const response = await this.graphql<{
			transactions?:
				| BraintreeConnection<BraintreeTransaction>
				| null
				| undefined;
		}>(SEARCH_TRANSACTIONS, {
			input: { orderId: { is: request.operationId } },
		});
		const connection = response.transactions;
		if (
			!connection ||
			connection.pageInfo.hasNextPage ||
			connection.edges.length !== 1
		) {
			return unknownOutcome("provider_operation_not_uniquely_identified");
		}
		const transaction = connection.edges[0]?.node;
		if (!transaction) {
			return unknownOutcome("provider_operation_not_found");
		}
		return this.mapAuthorization(transaction, payload, request.operationId);
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
		const transaction = await this.getTransaction(
			payload.providerPaymentReference,
		);
		return this.mapCapture(transaction, payload, request.operationId);
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
		const transaction = await this.getTransaction(
			payload.providerPaymentReference,
		);
		return this.mapVoid(transaction, payload.providerPaymentReference);
	}

	private async reconcileRefund(
		request: PaymentProviderReconciliationRequest,
		payload: Extract<
			PaymentProviderReconciliationRequest["payload"],
			{ operation: "refund" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		if (request.providerReference) {
			const refund = await this.getRefund(request.providerReference);
			return this.mapRefund(refund, payload, request.operationId);
		}
		const response = await this.graphql<{
			refunds?: BraintreeConnection<BraintreeRefund> | null | undefined;
		}>(SEARCH_REFUNDS, {
			input: { orderId: { is: request.operationId } },
		});
		const connection = response.refunds;
		if (
			!connection ||
			connection.pageInfo.hasNextPage ||
			connection.edges.length !== 1
		) {
			return unknownOutcome("provider_operation_not_uniquely_identified");
		}
		const refund = connection.edges[0]?.node;
		if (!refund) {
			return unknownOutcome("provider_operation_not_found");
		}
		return this.mapRefund(refund, payload, request.operationId);
	}

	private async getTransaction(id: string): Promise<BraintreeTransaction> {
		const response = await this.graphql<{
			node?: BraintreeTransaction | null | undefined;
		}>(GET_TRANSACTION, { id });
		if (
			response.node?.__typename !== "Transaction" ||
			response.node.id !== id
		) {
			throw new BraintreeRequestError(200);
		}
		return response.node;
	}

	private async getRefund(id: string): Promise<BraintreeRefund> {
		const response = await this.graphql<{
			node?: BraintreeRefund | null | undefined;
		}>(GET_REFUND, { id });
		if (response.node?.__typename !== "Refund" || response.node.id !== id) {
			throw new BraintreeRequestError(200);
		}
		return response.node;
	}

	private async authorizePayment(
		request: PaymentProviderOperationRequest,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "authorization" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		if (payload.providerPaymentReference) {
			return localFailure("authorization_source_not_supported");
		}
		const currency = normalizeCurrency(payload.currency);
		if (!currency) return localFailure("invalid_currency");
		const amount = minorUnitsToDecimal(payload.amount, currency);
		if (!amount) return localFailure("invalid_amount");
		const merchantAccountId = this.merchantAccountIds.get(currency);
		if (!merchantAccountId) return localFailure("unsupported_currency");
		const paymentMethodId =
			metadataString(payload.metadata, "paymentMethodId") ??
			metadataString(payload.metadata, "paymentMethodNonce");
		if (!paymentMethodId) return localFailure("payment_method_required");

		const response = await this.graphql<{
			authorizePaymentMethod?:
				| {
						clientMutationId?: string | null | undefined;
						transaction?: BraintreeTransaction | null | undefined;
				  }
				| null
				| undefined;
		}>(AUTHORIZE_PAYMENT_METHOD, {
			input: {
				apiRequestKey: request.idempotencyKey,
				clientMutationId: request.operationId,
				paymentMethodId,
				transaction: {
					amount,
					merchantAccountId,
					orderId: request.operationId,
				},
			},
		});
		const result = response.authorizePaymentMethod;
		if (
			!result ||
			result.clientMutationId !== request.operationId ||
			!result.transaction
		) {
			return unknownOutcome("provider_response_mismatch");
		}
		return this.mapAuthorization(
			result.transaction,
			payload,
			request.operationId,
		);
	}

	private mapAuthorization(
		transaction: BraintreeTransaction,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "authorization" }
		>,
		expectedOrderId: string,
	): PaymentProviderOperationOutcome {
		const currency = normalizeCurrency(payload.currency);
		if (typeof transaction.id !== "string" || transaction.id.length === 0) {
			return unknownOutcome("provider_response_mismatch");
		}
		if (
			!currency ||
			transaction.orderId !== expectedOrderId ||
			transaction.amount.currencyIsoCode !== currency ||
			decimalToMinorUnits(transaction.amount.value, currency) !== payload.amount
		) {
			return unknownOutcome("provider_response_mismatch", transaction.id);
		}
		const result = {
			kind: "transaction",
			providerStatus: transaction.status,
			amount: payload.amount,
			currency,
			...(transaction.legacyId
				? { legacyProviderReference: transaction.legacyId }
				: {}),
		} as const;
		if (transaction.status === "AUTHORIZED") {
			return {
				state: "succeeded",
				providerReference: transaction.id,
				result,
			};
		}
		if (
			[
				"AUTHORIZATION_EXPIRED",
				"PROCESSOR_DECLINED",
				"GATEWAY_REJECTED",
				"FAILED",
			].includes(transaction.status)
		) {
			return {
				state: "failed",
				providerReference: transaction.id,
				result,
			};
		}
		if (transaction.status === "AUTHORIZING") {
			return {
				state: "pending",
				providerReference: transaction.id,
				result,
			};
		}
		return {
			state: "ambiguous",
			providerReference: transaction.id,
			result,
		};
	}

	private async capture(
		request: PaymentProviderOperationRequest,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "capture" }
		>,
	): Promise<PaymentProviderOperationOutcome> {
		const currency = normalizeCurrency(payload.currency);
		if (!currency) return localFailure("invalid_currency");
		const amount = minorUnitsToDecimal(payload.amount, currency);
		if (!amount) return localFailure("invalid_amount");
		const response = await this.graphql<{
			captureTransaction?:
				| {
						clientMutationId?: string | null | undefined;
						transaction?: BraintreeTransaction | null | undefined;
				  }
				| null
				| undefined;
		}>(CAPTURE_TRANSACTION, {
			input: {
				apiRequestKey: request.idempotencyKey,
				clientMutationId: request.operationId,
				transactionId: payload.providerPaymentReference,
				transaction: { amount, orderId: request.operationId },
			},
		});
		const result = response.captureTransaction;
		if (
			!result ||
			result.clientMutationId !== request.operationId ||
			!result.transaction
		) {
			return unknownOutcome("provider_response_mismatch");
		}
		return this.mapCapture(result.transaction, payload, request.operationId);
	}

	private mapCapture(
		transaction: BraintreeTransaction,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "capture" }
		>,
		expectedOrderId: string,
	): PaymentProviderOperationOutcome {
		const currency = normalizeCurrency(payload.currency);
		if (transaction.id !== payload.providerPaymentReference) {
			return unknownOutcome("provider_response_mismatch");
		}
		if (
			!currency ||
			transaction.orderId !== expectedOrderId ||
			transaction.amount.currencyIsoCode !== currency ||
			decimalToMinorUnits(transaction.amount.value, currency) !== payload.amount
		) {
			return unknownOutcome("provider_response_mismatch", transaction.id);
		}
		const result = {
			kind: "transaction",
			providerStatus: transaction.status,
			amount: payload.amount,
			currency,
			...(transaction.legacyId
				? { legacyProviderReference: transaction.legacyId }
				: {}),
		} as const;
		if (
			[
				"SUBMITTED_FOR_SETTLEMENT",
				"SETTLEMENT_PENDING",
				"SETTLEMENT_CONFIRMED",
				"SETTLING",
				"SETTLED",
			].includes(transaction.status)
		) {
			return {
				state: "succeeded",
				providerReference: transaction.id,
				result,
			};
		}
		if (
			[
				"AUTHORIZATION_EXPIRED",
				"VOIDED",
				"PROCESSOR_DECLINED",
				"GATEWAY_REJECTED",
				"SETTLEMENT_DECLINED",
				"FAILED",
			].includes(transaction.status)
		) {
			return {
				state: "failed",
				providerReference: transaction.id,
				result,
			};
		}
		if (transaction.status === "AUTHORIZING") {
			return {
				state: "pending",
				providerReference: transaction.id,
				result,
			};
		}
		return {
			state: "ambiguous",
			providerReference: transaction.id,
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
		const response = await this.graphql<{
			voidTransaction?:
				| {
						clientMutationId?: string | null | undefined;
						transaction?: BraintreeTransaction | null | undefined;
				  }
				| null
				| undefined;
		}>(VOID_TRANSACTION, {
			input: {
				apiRequestKey: request.idempotencyKey,
				clientMutationId: request.operationId,
				transactionId: payload.providerPaymentReference,
			},
		});
		const result = response.voidTransaction;
		if (
			!result ||
			result.clientMutationId !== request.operationId ||
			!result.transaction
		) {
			return unknownOutcome("provider_response_mismatch");
		}
		return this.mapVoid(result.transaction, payload.providerPaymentReference);
	}

	private mapVoid(
		transaction: BraintreeTransaction,
		expectedProviderReference: string,
	): PaymentProviderOperationOutcome {
		const currency = normalizeCurrency(transaction.amount.currencyIsoCode);
		const amount = currency
			? decimalToMinorUnits(transaction.amount.value, currency)
			: undefined;
		if (transaction.id !== expectedProviderReference) {
			return unknownOutcome("provider_response_mismatch");
		}
		if (!currency || amount === undefined) {
			return unknownOutcome("provider_response_mismatch", transaction.id);
		}
		const result = {
			kind: "transaction",
			providerStatus: transaction.status,
			amount,
			currency,
			...(transaction.legacyId
				? { legacyProviderReference: transaction.legacyId }
				: {}),
		} as const;
		if (transaction.status === "VOIDED") {
			return {
				state: "succeeded",
				providerReference: transaction.id,
				result,
			};
		}
		if (
			[
				"SETTLEMENT_CONFIRMED",
				"SETTLING",
				"SETTLED",
				"SETTLEMENT_DECLINED",
				"PROCESSOR_DECLINED",
				"GATEWAY_REJECTED",
				"FAILED",
			].includes(transaction.status)
		) {
			return {
				state: "failed",
				providerReference: transaction.id,
				result,
			};
		}
		if (
			[
				"AUTHORIZING",
				"AUTHORIZED",
				"SUBMITTED_FOR_SETTLEMENT",
				"SETTLEMENT_PENDING",
			].includes(transaction.status)
		) {
			return {
				state: "pending",
				providerReference: transaction.id,
				result,
			};
		}
		return {
			state: "ambiguous",
			providerReference: transaction.id,
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
		const currency = normalizeCurrency(payload.currency);
		if (!currency) return localFailure("invalid_currency");
		const amount = minorUnitsToDecimal(payload.amount, currency);
		if (!amount) return localFailure("invalid_amount");
		const response = await this.graphql<{
			refundTransaction?:
				| {
						clientMutationId?: string | null | undefined;
						refund?: BraintreeRefund | null | undefined;
				  }
				| null
				| undefined;
		}>(REFUND_TRANSACTION, {
			input: {
				apiRequestKey: request.idempotencyKey,
				clientMutationId: request.operationId,
				transactionId: payload.providerPaymentReference,
				refund: {
					amount,
					orderId: request.operationId,
				},
			},
		});
		const result = response.refundTransaction;
		if (
			!result ||
			result.clientMutationId !== request.operationId ||
			!result.refund
		) {
			return unknownOutcome("provider_response_mismatch");
		}
		return this.mapRefund(result.refund, payload, request.operationId);
	}

	private mapRefund(
		refund: BraintreeRefund,
		payload: Extract<
			PaymentProviderOperationRequest["payload"],
			{ operation: "refund" }
		>,
		expectedOrderId: string,
	): PaymentProviderOperationOutcome {
		const currency = normalizeCurrency(payload.currency);
		if (
			refund.__typename !== "Refund" ||
			typeof refund.id !== "string" ||
			refund.id.length === 0
		) {
			return unknownOutcome("provider_response_mismatch");
		}
		if (
			!currency ||
			refund.orderId !== expectedOrderId ||
			refund.refundedTransaction?.id !== payload.providerPaymentReference ||
			refund.amount.currencyIsoCode !== currency ||
			decimalToMinorUnits(refund.amount.value, currency) !== payload.amount
		) {
			return unknownOutcome("provider_response_mismatch", refund.id);
		}
		const result = {
			kind: "refund",
			providerStatus: refund.status,
			amount: payload.amount,
			currency,
			sourceProviderReference: payload.providerPaymentReference,
			...(refund.legacyId ? { legacyProviderReference: refund.legacyId } : {}),
		} as const;
		if (
			[
				"SUBMITTED_FOR_SETTLEMENT",
				"SETTLEMENT_PENDING",
				"SETTLEMENT_CONFIRMED",
				"SETTLING",
				"SETTLED",
			].includes(refund.status)
		) {
			return {
				state: "succeeded",
				providerReference: refund.id,
				result,
			};
		}
		if (
			[
				"VOIDED",
				"PROCESSOR_DECLINED",
				"GATEWAY_REJECTED",
				"SETTLEMENT_DECLINED",
				"FAILED",
			].includes(refund.status)
		) {
			return { state: "failed", providerReference: refund.id, result };
		}
		return { state: "ambiguous", providerReference: refund.id, result };
	}

	private async graphql<T>(
		query: string,
		variables: Record<string, unknown>,
	): Promise<T> {
		const response = await fetch(this.endpoint, {
			method: "POST",
			headers: {
				Authorization: `Basic ${btoa(`${this.publicKey}:${this.privateKey}`)}`,
				"Braintree-Version": "2019-01-01",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query, variables }),
		});
		const json = (await response.json()) as BraintreeGraphqlResponse<T>;
		const codes = (json.errors ?? [])
			.map((error) => error.extensions?.code ?? error.extensions?.errorClass)
			.filter((code): code is string => typeof code === "string");
		if (!response.ok || json.errors?.length) {
			throw new BraintreeRequestError(response.status, codes);
		}
		if (!json.data) throw new BraintreeRequestError(response.status, codes);
		return json.data;
	}
}

export function createBraintreePaymentConnectionProvider(
	options: BraintreePaymentConnectionProviderOptions,
): BraintreePaymentConnectionProvider {
	return new BraintreePaymentConnectionProvider(options);
}
