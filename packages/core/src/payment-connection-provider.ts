import type { JsonValue } from "./commands";

/** Provider operations that may be granted to one immutable Payment Connection. */
export type PaymentConnectionCapability =
	| "intent"
	| "authorization"
	| "capture"
	| "refund"
	| "void";

export type PaymentConnectionMode = "test" | "live";

export type PaymentOperationPayload =
	| Readonly<{
			operation: "intent";
			amount: number;
			currency: string;
			metadata?: JsonValue | undefined;
	  }>
	| Readonly<{
			operation: "authorization";
			amount: number;
			currency: string;
			providerPaymentReference?: string | undefined;
			metadata?: JsonValue | undefined;
	  }>
	| Readonly<{
			operation: "capture";
			amount: number;
			currency: string;
			providerPaymentReference: string;
			metadata?: JsonValue | undefined;
	  }>
	| Readonly<{
			operation: "refund";
			amount: number;
			currency: string;
			providerPaymentReference: string;
			reason?: string | undefined;
			metadata?: JsonValue | undefined;
	  }>
	| Readonly<{
			operation: "void";
			providerPaymentReference: string;
			metadata?: JsonValue | undefined;
	  }>;

/**
 * Immutable provider provenance produced by the exact source operation.
 *
 * Continuations must use this descriptor to validate the cited provider
 * resource and money before issuing any upstream request. It is intentionally
 * derived from the durable operation owner, never from browser input.
 */
export type PaymentProviderOperationSource = Readonly<{
	operationId: string;
	operation: PaymentConnectionCapability;
	providerReference: string;
	amount: number;
	currency: string;
}>;

/**
 * Every provider call carries the durable owner record that makes a retry
 * unambiguous. An adapter must forward `idempotencyKey` unchanged when the
 * upstream API supports idempotency.
 */
export type PaymentProviderOperationRequest = Readonly<{
	operationId: string;
	connectionId: string;
	idempotencyKey: string;
	requestDigest: string;
	attempt: number;
	/** Immutable durable-operation creation time, not the provider-call time. */
	createdAt: Date;
	payload: PaymentOperationPayload;
	/** Required at runtime for every referenced continuation. */
	source?: PaymentProviderOperationSource | undefined;
}>;

export type PaymentProviderOperationOutcome = Readonly<{
	/**
	 * `pending` and `requires_action` are provider-confirmed, nonfinal states.
	 * They must not be collapsed into `ambiguous`, which means the provider
	 * outcome itself is unknown.
	 */
	state: "succeeded" | "failed" | "pending" | "requires_action" | "ambiguous";
	providerReference?: string | undefined;
	/** Bounded normalized facts only; never credentials, client secrets, or raw payloads. */
	result?: JsonValue | undefined;
}>;

export type PaymentProviderReconciliationRequest = Readonly<{
	operationId: string;
	connectionId: string;
	operation: PaymentConnectionCapability;
	idempotencyKey: string;
	requestDigest: string;
	attempt: number;
	/** Immutable durable-operation creation time, not the reconciliation time. */
	createdAt: Date;
	/**
	 * The immutable payload persisted before the original provider call.
	 * Reconciliation may inspect canonical provider state or safely repeat an
	 * idempotent request, but it may never rebuild financial input from a
	 * browser or from mutable Store configuration.
	 */
	payload: PaymentOperationPayload;
	providerReference?: string | undefined;
	/** Required at runtime for every referenced continuation. */
	source?: PaymentProviderOperationSource | undefined;
}>;

/**
 * A server-created adapter bound to exactly one Payment Connection.
 *
 * Credentials stay inside the adapter closure. The Store Runtime passes only
 * the immutable Connection identity and durable operation envelope.
 */
export interface PaymentConnectionProvider {
	readonly connectionId: string;
	/**
	 * Immutable provider-owned merchant/account identity authorized by the
	 * credentials inside this adapter. Credential rotation must never change it.
	 */
	readonly providerAccountId: string;
	readonly provider: string;
	readonly mode: PaymentConnectionMode;
	readonly capabilities: readonly PaymentConnectionCapability[];

	execute(
		request: PaymentProviderOperationRequest,
	): Promise<PaymentProviderOperationOutcome>;

	reconcile(
		request: PaymentProviderReconciliationRequest,
	): Promise<PaymentProviderOperationOutcome>;
}
