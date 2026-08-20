import type { PaymentConnectionMode } from "./payment-connection-provider";

/**
 * What Checkout needs to know about payment state in order to finalize.
 *
 * These are ports, not copies of the payments Module's schemas. Checkout must
 * not import from `@86d-app/payments` or `@86d-app/managed-payments`: a direct
 * package edge is an edge no Module declared, and it makes payments a build
 * dependency of a Checkout that is supposed to work without it. Naming the
 * narrow surface here keeps the dependency pointing at a shared contract
 * instead of at another Module.
 *
 * The owning Modules assert their own types satisfy these, so a shape change
 * there fails to compile here rather than drifting silently.
 */

/** The Connection a Payment is bound to, as far as finalization is concerned. */
export interface PaymentConnectionPort {
	readonly id: string;
	readonly provider: string;
	readonly mode: PaymentConnectionMode;
	readonly lifecycle: string;
	readonly health: string;
	readonly providerAccountId?: string | undefined;
}

/** A shopper Payment, as far as finalization is concerned. */
export interface PaymentAggregatePort {
	readonly id: string;
	readonly paymentOption: string;
	readonly currency: string;
	readonly expectedAmount: number;
	readonly authorizedAmount: number;
	readonly capturedAmount: number;
	/**
	 * One entry per confirmed provider operation, append-only. Checkout reads it
	 * to find the authorization behind a capture and nothing else.
	 */
	readonly providerReferences: readonly PaymentProviderReferencePort[];
}

/** A confirmed provider operation recorded against a Payment. */
export interface PaymentProviderReferencePort {
	readonly operationId: string;
	readonly operation: string;
	readonly providerReference: string;
	readonly amount: number;
	readonly currency: string;
}

/** Read access to Payment aggregates. Finalization never writes them. */
export interface PaymentAggregateReaderPort {
	get(paymentId: string): Promise<PaymentAggregatePort | null>;
}

/**
 * The write the managed payments plane performs when a provider outcome is
 * confirmed. It is deliberately the only write named here: everything else on
 * the aggregate belongs to the payments Module.
 */
export interface PaymentOutcomeRecorderPort {
	recordConfirmedOperation(input: {
		readonly paymentId: string;
		readonly connectionId: string;
		readonly operationId: string;
		readonly operation: string;
		readonly amount: number;
		readonly currency: string;
		readonly requestDigest: string;
		readonly providerReference: string;
		readonly confirmedAt: Date;
	}): Promise<{
		readonly payment: PaymentAggregatePort;
		readonly replayed: boolean;
	}>;
}

/** The outcome of submitting one operation to the managed payments plane. */
export type ManagedPaymentSubmissionPort =
	| Readonly<{ ok: true; decision: string; paymentId?: string | undefined }>
	| Readonly<{ ok: false; failure: string }>;

/** The cross-plane client, which is absent unless managed payments is installed. */
export interface ManagedPaymentClientPort {
	readonly configured: boolean;
	submitOperation(input: {
		readonly idempotencyKey: string;
		readonly provider: string;
		readonly mode: "sandbox" | "live";
		readonly kind: string;
		readonly businessId: string;
		readonly bindingId: string;
		readonly connectionId: string;
		readonly paymentId: string;
		readonly checkoutId: string;
		readonly option: string;
		readonly amountMinorUnits: number;
		readonly currency: string;
		readonly merchantPaymentAccountId?: string | undefined;
		readonly sourceOperationId?: string | undefined;
	}): Promise<ManagedPaymentSubmissionPort>;
}
