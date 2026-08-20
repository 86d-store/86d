import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type {
	ModuleController,
	ModuleDataService,
} from "@86d-app/core/types/module";
import { z } from "@86d-app/core/zod";
import { EasyPostProvider } from "./provider";

const identifierSchema = z.string().trim().min(1).max(255);
const providerReferenceSchema = z.string().trim().min(1).max(500);
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const currencySchema = z
	.string()
	.trim()
	.regex(/^[A-Z]{3}$/);
const timestampSchema = z.coerce.date();
const minorAmountSchema = z
	.number()
	.int()
	.nonnegative()
	.max(Number.MAX_SAFE_INTEGER);

export const shippingAddressSchema = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		company: z.string().trim().min(1).max(200).optional(),
		street1: z.string().trim().min(1).max(500),
		street2: z.string().trim().min(1).max(500).optional(),
		city: z.string().trim().min(1).max(200),
		state: z.string().trim().min(1).max(100),
		postalCode: z.string().trim().min(1).max(20),
		country: z
			.string()
			.trim()
			.length(2)
			.transform((value) => value.toUpperCase()),
		phone: z.string().trim().min(1).max(30).optional(),
	})
	.strict();

export const shippingParcelSchema = z
	.object({
		parcelReference: identifierSchema,
		lengthInches: z.number().positive().finite().max(1_000),
		widthInches: z.number().positive().finite().max(1_000),
		heightInches: z.number().positive().finite().max(1_000),
		weightOunces: z.number().positive().finite().max(1_000_000),
	})
	.strict();

export const shippingParcelPlanSchema = z
	.array(shippingParcelSchema)
	.min(1)
	.max(50)
	.refine(
		(parcels) =>
			new Set(parcels.map((parcel) => parcel.parcelReference)).size ===
			parcels.length,
		"Parcel references must be unique within a plan.",
	);

export const shippingConnectionCapabilitySchema = z.enum([
	"quote",
	"label",
	"tracking",
	"label_refund",
	"postage_adjustment",
]);
export const shippingConnectionModeSchema = z.enum(["test", "live"]);
export const shippingConnectionHealthSchema = z.enum([
	"unknown",
	"healthy",
	"degraded",
	"unhealthy",
]);
export const shippingConnectionLifecycleSchema = z.enum([
	"draft",
	"enabled",
	"disabled",
	"revoked",
]);

export const shippingConnectionSchema = z
	.object({
		id: identifierSchema,
		name: z.string().trim().min(1).max(100),
		normalizedName: z.string().min(1).max(100),
		provider: z
			.string()
			.trim()
			.min(1)
			.max(100)
			.regex(/^[a-z][a-z0-9_-]*$/),
		mode: shippingConnectionModeSchema,
		capabilities: z
			.array(shippingConnectionCapabilitySchema)
			.min(1)
			.max(5)
			.refine((values) => new Set(values).size === values.length),
		health: shippingConnectionHealthSchema,
		lifecycle: shippingConnectionLifecycleSchema,
		secretReference: z.string().trim().min(3).max(500),
		originAddress: shippingAddressSchema,
		healthCheckedAt: timestampSchema.optional(),
		enabledAt: timestampSchema.optional(),
		disabledAt: timestampSchema.optional(),
		revokedAt: timestampSchema.optional(),
		createdAt: timestampSchema,
		updatedAt: timestampSchema,
	})
	.strict();

export const createShippingConnectionInputSchema = z
	.object({
		id: identifierSchema.optional(),
		name: z.string().trim().min(1).max(100),
		provider: z
			.string()
			.trim()
			.min(1)
			.max(100)
			.regex(/^[a-z][a-z0-9_-]*$/),
		mode: shippingConnectionModeSchema,
		capabilities: z
			.array(shippingConnectionCapabilitySchema)
			.min(1)
			.max(5)
			.refine((values) => new Set(values).size === values.length),
		secretReference: z.string().trim().min(3).max(500),
		originAddress: shippingAddressSchema,
	})
	.strict();

export const shippingQuoteSchema = z
	.object({
		id: identifierSchema,
		checkoutId: identifierSchema,
		checkoutRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		connectionId: identifierSchema,
		providerQuoteReference: providerReferenceSchema,
		destinationAddress: shippingAddressSchema,
		originAddress: shippingAddressSchema,
		addressFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
		parcelPlan: shippingParcelPlanSchema,
		parcelPlanFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
		currency: currencySchema,
		status: z.enum(["active", "expired", "consumed"]),
		issuedAt: timestampSchema,
		expiresAt: timestampSchema,
		createdAt: timestampSchema,
	})
	.strict();

export const shippingOptionSchema = z
	.object({
		id: identifierSchema,
		quoteId: identifierSchema,
		connectionId: identifierSchema,
		providerQuoteReference: providerReferenceSchema,
		providerRateReference: providerReferenceSchema,
		carrier: z.string().trim().min(1).max(200),
		service: z.string().trim().min(1).max(200),
		amountMinor: minorAmountSchema,
		currency: currencySchema,
		deliveryDays: z.number().int().nonnegative().max(365).nullable(),
		deliveryDate: z.string().trim().min(1).max(100).nullable(),
		deliveryDateGuaranteed: z.boolean(),
		expiresAt: timestampSchema,
		createdAt: timestampSchema,
	})
	.strict();

const providerQuoteOptionSchema = z
	.object({
		providerRateReference: providerReferenceSchema,
		carrier: z.string().trim().min(1).max(200),
		service: z.string().trim().min(1).max(200),
		amountMinor: minorAmountSchema,
		currency: currencySchema,
		deliveryDays: z.number().int().nonnegative().max(365).nullable(),
		deliveryDate: z.string().trim().min(1).max(100).nullable(),
		deliveryDateGuaranteed: z.boolean(),
	})
	.strict();

const providerQuoteResultSchema = z
	.object({
		providerQuoteReference: providerReferenceSchema,
		verifiedDestinationAddress: shippingAddressSchema.optional(),
		options: z
			.array(providerQuoteOptionSchema)
			.min(1)
			.max(100)
			.refine(
				(options) =>
					new Set(options.map((option) => option.providerRateReference))
						.size === options.length,
				"Provider rate references must be unique.",
			),
	})
	.strict();

export const USPS_PRIORITY_MAIL_SERVICE = "usps.priority_mail";

export function isUspsPriorityMailRate(rate: {
	carrier: string;
	service: string;
}): boolean {
	const carrier = rate.carrier.trim().toUpperCase();
	const service = rate.service
		.trim()
		.replace(/[\s_-]+/g, "")
		.toLowerCase();
	return (
		carrier === "USPS" && (service === "priority" || service === "prioritymail")
	);
}

export const createShippingQuoteInputSchema = z
	.object({
		checkoutId: identifierSchema,
		checkoutRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		connectionId: identifierSchema,
		idempotencyKey: idempotencyKeySchema,
		destinationAddress: shippingAddressSchema,
		parcelPlan: shippingParcelPlanSchema,
		currency: currencySchema,
	})
	.strict();

const shippingQuoteRequestSchema = z
	.object({
		id: identifierSchema,
		quoteId: identifierSchema,
		checkoutId: identifierSchema,
		checkoutRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		connectionId: identifierSchema,
		idempotencyKey: idempotencyKeySchema,
		requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
		state: z.enum(["running", "succeeded", "failed"]),
		attempt: z.number().int().positive(),
		failureCode: z.string().min(1).max(100).optional(),
		createdAt: timestampSchema,
		updatedAt: timestampSchema,
	})
	.strict();

export const shippingLabelSchema = z
	.object({
		id: identifierSchema,
		fulfillmentId: identifierSchema,
		quoteId: identifierSchema,
		optionId: identifierSchema,
		parcelReference: identifierSchema,
		connectionId: identifierSchema,
		idempotencyKey: idempotencyKeySchema,
		providerShipmentReference: providerReferenceSchema,
		providerLabelReference: providerReferenceSchema,
		providerTrackingReference: providerReferenceSchema.optional(),
		trackingCode: z.string().trim().min(1).max(500).optional(),
		labelUrl: z.string().url().max(2_000).optional(),
		amountMinor: minorAmountSchema,
		currency: currencySchema,
		status: z.enum([
			"pre_transit",
			"in_transit",
			"delivered",
			"refund_pending",
			"refunded",
			"voided",
			"needs_attention",
		]),
		purchasedAt: timestampSchema,
		createdAt: timestampSchema,
		updatedAt: timestampSchema,
	})
	.strict();

export const recordShippingLabelInputSchema = z
	.object({
		fulfillmentId: identifierSchema,
		checkoutId: identifierSchema,
		checkoutRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		quoteId: identifierSchema,
		optionId: identifierSchema,
		parcelReference: identifierSchema,
		idempotencyKey: idempotencyKeySchema,
		providerLabelReference: providerReferenceSchema,
		providerTrackingReference: providerReferenceSchema.optional(),
		trackingCode: z.string().trim().min(1).max(500).optional(),
		labelUrl: z.string().url().max(2_000).optional(),
	})
	.strict();

export const shippingTrackingSchema = z
	.object({
		id: identifierSchema,
		fulfillmentId: identifierSchema,
		labelId: identifierSchema,
		parcelReference: identifierSchema,
		connectionId: identifierSchema,
		providerTrackerReference: providerReferenceSchema,
		trackingCode: z.string().trim().min(1).max(500),
		status: z.enum([
			"unknown",
			"pre_transit",
			"in_transit",
			"out_for_delivery",
			"delivered",
			"available_for_pickup",
			"return_to_sender",
			"failure",
			"cancelled",
			"error",
		]),
		publicUrl: z.string().url().max(2_000).optional(),
		providerOccurredAt: timestampSchema,
		createdAt: timestampSchema,
		updatedAt: timestampSchema,
	})
	.strict();

export const recordShippingTrackingInputSchema = z
	.object({
		fulfillmentId: identifierSchema,
		labelId: identifierSchema,
		providerTrackerReference: providerReferenceSchema,
		trackingCode: z.string().trim().min(1).max(500),
		status: shippingTrackingSchema.shape.status,
		publicUrl: z.string().url().max(2_000).optional(),
		providerOccurredAt: timestampSchema,
	})
	.strict();

export const shippingLabelRefundSchema = z
	.object({
		id: identifierSchema,
		fulfillmentId: identifierSchema,
		labelId: identifierSchema,
		connectionId: identifierSchema,
		idempotencyKey: idempotencyKeySchema,
		providerRefundReference: providerReferenceSchema.optional(),
		status: z.enum(["pending", "succeeded", "failed", "needs_attention"]),
		createdAt: timestampSchema,
		updatedAt: timestampSchema,
	})
	.strict();

export const recordShippingLabelRefundInputSchema = z
	.object({
		fulfillmentId: identifierSchema,
		labelId: identifierSchema,
		idempotencyKey: idempotencyKeySchema,
		providerRefundReference: providerReferenceSchema.optional(),
		status: shippingLabelRefundSchema.shape.status,
	})
	.strict();

export const shippingPostageAdjustmentSchema = z
	.object({
		id: identifierSchema,
		fulfillmentId: identifierSchema,
		labelId: identifierSchema,
		connectionId: identifierSchema,
		idempotencyKey: idempotencyKeySchema,
		providerAdjustmentReference: providerReferenceSchema,
		kind: z.enum(["debit", "credit"]),
		amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		currency: currencySchema,
		recordedAt: timestampSchema,
		createdAt: timestampSchema,
	})
	.strict();

export const recordShippingPostageAdjustmentInputSchema = z
	.object({
		fulfillmentId: identifierSchema,
		labelId: identifierSchema,
		idempotencyKey: idempotencyKeySchema,
		providerAdjustmentReference: providerReferenceSchema,
		kind: shippingPostageAdjustmentSchema.shape.kind,
		amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		currency: currencySchema,
		recordedAt: timestampSchema,
	})
	.strict();

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
export type ShippingParcel = z.infer<typeof shippingParcelSchema>;
export type ShippingConnection = z.infer<typeof shippingConnectionSchema>;
export type ShippingConnectionCapability = z.infer<
	typeof shippingConnectionCapabilitySchema
>;
export type ShippingQuote = z.infer<typeof shippingQuoteSchema>;
export type ShippingOption = z.infer<typeof shippingOptionSchema>;
export type ShippingLabel = z.infer<typeof shippingLabelSchema>;
export type ShippingTracking = z.infer<typeof shippingTrackingSchema>;
export type ShippingLabelRefund = z.infer<typeof shippingLabelRefundSchema>;
export type ShippingPostageAdjustment = z.infer<
	typeof shippingPostageAdjustmentSchema
>;
export type CreateShippingConnectionInput = z.infer<
	typeof createShippingConnectionInputSchema
>;
export type CreateShippingQuoteInput = z.infer<
	typeof createShippingQuoteInputSchema
>;
export type RecordShippingLabelInput = z.infer<
	typeof recordShippingLabelInputSchema
>;
export type RecordShippingTrackingInput = z.infer<
	typeof recordShippingTrackingInputSchema
>;
export type RecordShippingLabelRefundInput = z.infer<
	typeof recordShippingLabelRefundInputSchema
>;
export type RecordShippingPostageAdjustmentInput = z.infer<
	typeof recordShippingPostageAdjustmentInputSchema
>;

type ProviderQuoteRequest = Readonly<{
	originAddress: ShippingAddress;
	destinationAddress: ShippingAddress;
	parcelPlan: readonly ShippingParcel[];
	currency: string;
}>;

type ProviderQuoteResult = z.infer<typeof providerQuoteResultSchema>;

export interface ShippingConnectionProvider {
	readonly connectionId: string;
	readonly provider: string;
	readonly mode: "test" | "live";
	readonly capabilities: readonly ShippingConnectionCapability[];
	verify(): Promise<
		{ ok: true; accountName: string } | { ok: false; error: string }
	>;
	quote(request: ProviderQuoteRequest): Promise<ProviderQuoteResult>;
}

export type ShippingFoundationErrorCode =
	| "connection_conflict"
	| "connection_not_found"
	| "connection_not_usable"
	| "connection_revoked"
	| "idempotency_conflict"
	| "label_not_found"
	| "original_connection_mismatch"
	| "provider_not_bound"
	| "quote_expired"
	| "quote_in_progress"
	| "quote_not_found"
	| "quote_option_mismatch"
	| "transaction_unavailable";

export class ShippingFoundationError extends Error {
	readonly code: ShippingFoundationErrorCode;

	constructor(code: ShippingFoundationErrorCode, message: string) {
		super(message);
		this.code = code;
		this.name = "ShippingFoundationError";
	}
}

export interface ShippingFoundationController extends ModuleController {
	ensureConnection(
		input: CreateShippingConnectionInput,
	): Promise<ShippingConnection>;
	getConnection(id: string): Promise<ShippingConnection | null>;
	listConnections(): Promise<ShippingConnection[]>;
	updateConnectionOrigin(
		id: string,
		originAddress: ShippingAddress,
	): Promise<ShippingConnection>;
	checkConnection(id: string): Promise<ShippingConnection>;
	enableConnection(id: string): Promise<ShippingConnection>;
	disableConnection(id: string): Promise<ShippingConnection>;
	revokeConnection(id: string): Promise<ShippingConnection>;
	createQuote(input: CreateShippingQuoteInput): Promise<{
		quote: ShippingQuote;
		options: ShippingOption[];
	}>;
	getQuote(id: string): Promise<ShippingQuote | null>;
	getOption(id: string): Promise<ShippingOption | null>;
	recordPurchasedLabel(input: RecordShippingLabelInput): Promise<ShippingLabel>;
	recordTracking(input: RecordShippingTrackingInput): Promise<ShippingTracking>;
	recordLabelRefund(
		input: RecordShippingLabelRefundInput,
	): Promise<ShippingLabelRefund>;
	recordPostageAdjustment(
		input: RecordShippingPostageAdjustmentInput,
	): Promise<ShippingPostageAdjustment>;
}

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function normalizeConnectionName(name: string): string {
	return name.normalize("NFKC").toLocaleLowerCase("en-US");
}

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function connectionSignature(input: CreateShippingConnectionInput): string {
	return JSON.stringify([
		input.name,
		input.provider,
		input.mode,
		[...input.capabilities].sort(),
		input.secretReference,
		input.originAddress,
	]);
}

function storedConnectionSignature(connection: ShippingConnection): string {
	return connectionSignature({
		id: connection.id,
		name: connection.name,
		provider: connection.provider,
		mode: connection.mode,
		capabilities: connection.capabilities,
		secretReference: connection.secretReference,
		originAddress: connection.originAddress,
	});
}

function quoteRequestSignature(input: CreateShippingQuoteInput): string {
	return JSON.stringify([
		input.checkoutId,
		input.checkoutRevision,
		input.connectionId,
		input.idempotencyKey,
		input.destinationAddress,
		input.parcelPlan,
		input.currency,
	]);
}

function requireConnection(
	row: Record<string, unknown> | null,
): ShippingConnection {
	if (!row) {
		throw new ShippingFoundationError(
			"connection_not_found",
			"Shipping Connection not found.",
		);
	}
	return shippingConnectionSchema.parse(row);
}

function requireLabel(row: Record<string, unknown> | null): ShippingLabel {
	if (!row) {
		throw new ShippingFoundationError(
			"label_not_found",
			"Shipping label not found.",
		);
	}
	return shippingLabelSchema.parse(row);
}

function decimalCurrencyToMinor(value: string): number {
	const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(value);
	if (!match) throw new Error("Provider returned an invalid shipping amount.");
	const whole = Number(match[1]);
	const fraction = Number((match[2] ?? "").padEnd(2, "0"));
	const amount = whole * 100 + fraction;
	if (!Number.isSafeInteger(amount)) {
		throw new Error("Provider returned an unsafe shipping amount.");
	}
	return amount;
}

function toEasyPostAddress(address: ShippingAddress) {
	return {
		...(address.name ? { name: address.name } : {}),
		...(address.company ? { company: address.company } : {}),
		street1: address.street1,
		...(address.street2 ? { street2: address.street2 } : {}),
		city: address.city,
		state: address.state,
		zip: address.postalCode,
		country: address.country,
		...(address.phone ? { phone: address.phone } : {}),
	};
}

function toVerifiedShippingAddress(
	address: {
		name?: string | undefined;
		company?: string | undefined;
		street1: string;
		street2?: string | undefined;
		city: string;
		state: string;
		zip: string;
		country: string;
		phone?: string | undefined;
	},
	fallback: ShippingAddress,
) {
	return shippingAddressSchema.parse({
		name: address.name || fallback.name,
		company: address.company || fallback.company,
		street1: address.street1,
		...(address.street2 ? { street2: address.street2 } : {}),
		city: address.city,
		state: address.state,
		postalCode: address.zip,
		country: address.country,
		phone: address.phone || fallback.phone,
	});
}

export function createEasyPostShippingConnectionProvider(input: {
	connectionId: string;
	apiKey: string;
	testMode: boolean;
}): ShippingConnectionProvider {
	const connectionId = identifierSchema.parse(input.connectionId);
	const provider = new EasyPostProvider(input.apiKey, input.testMode);
	return {
		connectionId,
		provider: "easypost",
		mode: input.testMode ? "test" : "live",
		capabilities: ["quote"],
		verify: () => provider.verifyConnection(),
		async quote(request) {
			if (request.parcelPlan.length !== 1) {
				throw new Error(
					"EasyPost quote activation requires a single server-owned parcel plan.",
				);
			}
			const parcel = request.parcelPlan[0];
			if (!parcel) throw new Error("A parcel is required.");
			const verified = await provider.verifyAddress(
				toEasyPostAddress(request.destinationAddress),
			);
			const verifiedDestinationAddress = toVerifiedShippingAddress(
				verified,
				request.destinationAddress,
			);
			const response = await provider.getRates({
				fromAddress: toEasyPostAddress(request.originAddress),
				toAddress: toEasyPostAddress(verifiedDestinationAddress),
				parcel: {
					length: parcel.lengthInches,
					width: parcel.widthInches,
					height: parcel.heightInches,
					weight: parcel.weightOunces,
				},
			});
			const priorityRates = response.rates.filter(isUspsPriorityMailRate);
			const cheapest = priorityRates.reduce<
				(typeof priorityRates)[number] | undefined
			>((current, rate) => {
				if (!current) return rate;
				return decimalCurrencyToMinor(rate.rate) <
					decimalCurrencyToMinor(current.rate)
					? rate
					: current;
			}, undefined);
			if (!cheapest) {
				throw new Error(
					"EasyPost did not return a USPS Priority Mail option for this destination.",
				);
			}
			return providerQuoteResultSchema.parse({
				providerQuoteReference: response.id,
				verifiedDestinationAddress,
				options: [
					{
						providerRateReference: cheapest.id,
						carrier: "USPS",
						service: USPS_PRIORITY_MAIL_SERVICE,
						amountMinor: decimalCurrencyToMinor(cheapest.rate),
						currency: cheapest.currency.toUpperCase(),
						deliveryDays:
							cheapest.delivery_days ?? cheapest.est_delivery_days ?? null,
						deliveryDate: cheapest.delivery_date,
						deliveryDateGuaranteed: cheapest.delivery_date_guaranteed,
					},
				],
			});
		},
	};
}

export function createShippingFoundationController(
	data: ModuleDataService,
	transactions: ModuleTransactionRunner | undefined,
	providers: readonly ShippingConnectionProvider[] = [],
	options?: { quoteTtlSeconds?: number | undefined },
): ShippingFoundationController {
	const quoteTtlSeconds = z
		.number()
		.int()
		.min(60)
		.max(3_600)
		.parse(options?.quoteTtlSeconds ?? 900);
	const providersByConnection = new Map<string, ShippingConnectionProvider>();
	for (const provider of providers) {
		if (providersByConnection.has(provider.connectionId)) {
			throw new ShippingFoundationError(
				"provider_not_bound",
				`More than one provider is bound to Shipping Connection "${provider.connectionId}".`,
			);
		}
		providersByConnection.set(provider.connectionId, provider);
	}

	async function transact<T>(
		work: (transaction: LockingModuleDataTransaction) => Promise<T>,
	): Promise<T> {
		if (!transactions) {
			throw new ShippingFoundationError(
				"transaction_unavailable",
				"Shipping v2 writes require owner-local transactions.",
			);
		}
		return transactions.transaction((transaction) => {
			if (!isLockingTransaction(transaction)) {
				throw new ShippingFoundationError(
					"transaction_unavailable",
					"Shipping v2 writes require row locking.",
				);
			}
			return work(transaction);
		});
	}

	async function lock(
		transaction: LockingModuleDataTransaction,
		id: string,
	): Promise<void> {
		await transaction.upsert("shippingBoundaryLockV2", id, { id });
		await transaction.getForUpdate("shippingBoundaryLockV2", id);
	}

	function providerFor(
		connection: ShippingConnection,
		capability: ShippingConnectionCapability,
	): ShippingConnectionProvider {
		const provider = providersByConnection.get(connection.id);
		if (
			!provider ||
			provider.provider !== connection.provider ||
			provider.mode !== connection.mode ||
			!provider.capabilities.includes(capability)
		) {
			throw new ShippingFoundationError(
				"provider_not_bound",
				"No matching provider is bound to the original Shipping Connection.",
			);
		}
		return provider;
	}

	function usableProvider(
		connection: ShippingConnection,
		capability: ShippingConnectionCapability,
	): ShippingConnectionProvider {
		if (
			connection.lifecycle !== "enabled" ||
			connection.health !== "healthy" ||
			!connection.capabilities.includes(capability)
		) {
			throw new ShippingFoundationError(
				"connection_not_usable",
				"Shipping Connection is not enabled and healthy for this operation.",
			);
		}
		return providerFor(connection, capability);
	}

	async function getQuoteResult(quoteId: string): Promise<{
		quote: ShippingQuote;
		options: ShippingOption[];
	}> {
		const quoteRow = await data.get("shippingQuoteV2", quoteId);
		if (!quoteRow) {
			throw new ShippingFoundationError(
				"quote_not_found",
				"Shipping quote not found.",
			);
		}
		const quote = shippingQuoteSchema.parse(quoteRow);
		const optionRows = await data.findMany("shippingOptionV2", {
			where: { quoteId },
		});
		const quoteOptions = optionRows
			.map((row) => shippingOptionSchema.parse(row))
			.sort((left, right) => left.amountMinor - right.amountMinor);
		if (quoteOptions.length === 0) {
			throw new ShippingFoundationError(
				"quote_not_found",
				"Shipping quote options are missing.",
			);
		}
		return { quote, options: quoteOptions };
	}

	async function loadValidOptionLocked(
		transaction: LockingModuleDataTransaction,
		input: {
			checkoutId: string;
			checkoutRevision: number;
			quoteId: string;
			optionId: string;
		},
	): Promise<{ quote: ShippingQuote; option: ShippingOption }> {
		await lock(transaction, `shipping-quote:${input.quoteId}`);
		const quoteRow = await transaction.getForUpdate(
			"shippingQuoteV2",
			input.quoteId,
		);
		if (!quoteRow) {
			throw new ShippingFoundationError(
				"quote_not_found",
				"Shipping quote not found.",
			);
		}
		const quote = shippingQuoteSchema.parse(quoteRow);
		const optionRow = await transaction.get("shippingOptionV2", input.optionId);
		if (!optionRow) {
			throw new ShippingFoundationError(
				"quote_option_mismatch",
				"Shipping option not found.",
			);
		}
		const option = shippingOptionSchema.parse(optionRow);
		if (
			quote.checkoutId !== input.checkoutId ||
			quote.checkoutRevision !== input.checkoutRevision ||
			option.quoteId !== quote.id ||
			option.connectionId !== quote.connectionId ||
			option.currency !== quote.currency
		) {
			throw new ShippingFoundationError(
				"quote_option_mismatch",
				"Shipping option does not belong to this Checkout revision and quote.",
			);
		}
		if (
			quote.status !== "active" ||
			quote.expiresAt.getTime() <= Date.now() ||
			option.expiresAt.getTime() <= Date.now()
		) {
			throw new ShippingFoundationError(
				"quote_expired",
				"Shipping quote has expired.",
			);
		}
		return { quote, option };
	}

	async function labelForFulfillment(
		transaction: LockingModuleDataTransaction,
		fulfillmentId: string,
		labelId: string,
	): Promise<ShippingLabel> {
		const label = requireLabel(
			await transaction.getForUpdate("shippingLabelV2", labelId),
		);
		if (label.fulfillmentId !== fulfillmentId) {
			throw new ShippingFoundationError(
				"original_connection_mismatch",
				"Shipping operation does not belong to this Fulfillment.",
			);
		}
		return label;
	}

	return {
		async ensureConnection(input) {
			const parsed = createShippingConnectionInputSchema.parse(input);
			const id = parsed.id ?? crypto.randomUUID();
			const normalizedName = normalizeConnectionName(parsed.name);
			return transact(async (transaction) => {
				await lock(
					transaction,
					`shipping-connection-name:${await sha256(normalizedName)}`,
				);
				await lock(transaction, `shipping-connection-id:${id}`);
				const existingRow = await transaction.getForUpdate(
					"shippingConnectionV2",
					id,
				);
				if (existingRow) {
					const existing = shippingConnectionSchema.parse(existingRow);
					if (
						storedConnectionSignature(existing) !== connectionSignature(parsed)
					) {
						throw new ShippingFoundationError(
							"connection_conflict",
							"Shipping Connection ID is already bound to different configuration.",
						);
					}
					return existing;
				}
				const matching = await transaction.findMany("shippingConnectionV2", {
					where: { normalizedName },
					take: 1,
				});
				if (matching.length > 0) {
					throw new ShippingFoundationError(
						"connection_conflict",
						"A Shipping Connection already uses this name.",
					);
				}
				const now = new Date();
				const connection = shippingConnectionSchema.parse({
					id,
					name: parsed.name,
					normalizedName,
					provider: parsed.provider,
					mode: parsed.mode,
					capabilities: parsed.capabilities,
					health: "unknown",
					lifecycle: "draft",
					secretReference: parsed.secretReference,
					originAddress: parsed.originAddress,
					createdAt: now,
					updatedAt: now,
				});
				await transaction.upsert("shippingConnectionV2", id, connection);
				return connection;
			});
		},

		async getConnection(id) {
			const row = await data.get(
				"shippingConnectionV2",
				identifierSchema.parse(id),
			);
			return row ? shippingConnectionSchema.parse(row) : null;
		},

		async listConnections() {
			const rows = await data.findMany("shippingConnectionV2", {
				orderBy: { createdAt: "asc" },
			});
			return rows.map((row) => shippingConnectionSchema.parse(row));
		},

		async updateConnectionOrigin(id, originAddress) {
			const connectionId = identifierSchema.parse(id);
			const parsedOrigin = shippingAddressSchema.parse(originAddress);
			return transact(async (transaction) => {
				const connection = requireConnection(
					await transaction.getForUpdate("shippingConnectionV2", connectionId),
				);
				if (connection.lifecycle === "revoked") {
					throw new ShippingFoundationError(
						"connection_revoked",
						"A revoked Shipping Connection cannot be updated.",
					);
				}
				const now = new Date();
				const updated = shippingConnectionSchema.parse({
					...connection,
					originAddress: parsedOrigin,
					health: "unknown",
					healthCheckedAt: undefined,
					lifecycle: "draft",
					enabledAt: undefined,
					disabledAt: undefined,
					updatedAt: now,
				});
				await transaction.upsert("shippingConnectionV2", connectionId, updated);
				return updated;
			});
		},

		async checkConnection(id) {
			const connectionId = identifierSchema.parse(id);
			const connection = requireConnection(
				await data.get("shippingConnectionV2", connectionId),
			);
			if (connection.lifecycle === "revoked") {
				throw new ShippingFoundationError(
					"connection_revoked",
					"A revoked Shipping Connection cannot be checked.",
				);
			}
			const provider = providerFor(connection, "quote");
			const result = await provider.verify();
			return transact(async (transaction) => {
				const current = requireConnection(
					await transaction.getForUpdate("shippingConnectionV2", connectionId),
				);
				if (current.lifecycle === "revoked") {
					throw new ShippingFoundationError(
						"connection_revoked",
						"A revoked Shipping Connection cannot be checked.",
					);
				}
				const now = new Date();
				const updated = shippingConnectionSchema.parse({
					...current,
					health: result.ok ? "healthy" : "unhealthy",
					healthCheckedAt: now,
					updatedAt: now,
				});
				await transaction.upsert("shippingConnectionV2", connectionId, updated);
				return updated;
			});
		},

		async enableConnection(id) {
			const connectionId = identifierSchema.parse(id);
			return transact(async (transaction) => {
				const connection = requireConnection(
					await transaction.getForUpdate("shippingConnectionV2", connectionId),
				);
				if (connection.lifecycle === "revoked") {
					throw new ShippingFoundationError(
						"connection_revoked",
						"A revoked Shipping Connection cannot be enabled.",
					);
				}
				if (connection.health !== "healthy") {
					throw new ShippingFoundationError(
						"connection_not_usable",
						"Shipping Connection must be healthy before enablement.",
					);
				}
				for (const capability of connection.capabilities) {
					providerFor(connection, capability);
				}
				const now = new Date();
				const updated = shippingConnectionSchema.parse({
					...connection,
					lifecycle: "enabled",
					enabledAt: now,
					updatedAt: now,
				});
				await transaction.upsert("shippingConnectionV2", connectionId, updated);
				return updated;
			});
		},

		async disableConnection(id) {
			const connectionId = identifierSchema.parse(id);
			return transact(async (transaction) => {
				const connection = requireConnection(
					await transaction.getForUpdate("shippingConnectionV2", connectionId),
				);
				if (connection.lifecycle === "revoked") {
					throw new ShippingFoundationError(
						"connection_revoked",
						"A revoked Shipping Connection cannot be disabled.",
					);
				}
				const now = new Date();
				const updated = shippingConnectionSchema.parse({
					...connection,
					lifecycle: "disabled",
					disabledAt: now,
					updatedAt: now,
				});
				await transaction.upsert("shippingConnectionV2", connectionId, updated);
				return updated;
			});
		},

		async revokeConnection(id) {
			const connectionId = identifierSchema.parse(id);
			return transact(async (transaction) => {
				const connection = requireConnection(
					await transaction.getForUpdate("shippingConnectionV2", connectionId),
				);
				if (connection.lifecycle === "revoked") return connection;
				const now = new Date();
				const updated = shippingConnectionSchema.parse({
					...connection,
					lifecycle: "revoked",
					revokedAt: now,
					updatedAt: now,
				});
				await transaction.upsert("shippingConnectionV2", connectionId, updated);
				return updated;
			});
		},

		async createQuote(input) {
			const parsed = createShippingQuoteInputSchema.parse(input);
			const quoteId = `shipquote_${await sha256(
				JSON.stringify([parsed.checkoutId, parsed.idempotencyKey]),
			)}`;
			const requestId = `shipquote-request:${quoteId}`;
			const requestDigest = await sha256(quoteRequestSignature(parsed));
			const claim = await transact(async (transaction) => {
				await lock(transaction, requestId);
				const existingRow = await transaction.getForUpdate(
					"shippingQuoteRequestV2",
					requestId,
				);
				if (existingRow) {
					const existing = shippingQuoteRequestSchema.parse(existingRow);
					if (existing.requestDigest !== requestDigest) {
						throw new ShippingFoundationError(
							"idempotency_conflict",
							"Shipping quote key was already used for different inputs.",
						);
					}
					if (existing.state === "succeeded") return false;
					if (existing.state === "running") {
						throw new ShippingFoundationError(
							"quote_in_progress",
							"Shipping quote request is already in progress.",
						);
					}
					const updated = shippingQuoteRequestSchema.parse({
						...existing,
						state: "running",
						attempt: existing.attempt + 1,
						failureCode: undefined,
						updatedAt: new Date(),
					});
					await transaction.upsert(
						"shippingQuoteRequestV2",
						requestId,
						updated,
					);
					return true;
				}
				const now = new Date();
				const request = shippingQuoteRequestSchema.parse({
					id: requestId,
					quoteId,
					checkoutId: parsed.checkoutId,
					checkoutRevision: parsed.checkoutRevision,
					connectionId: parsed.connectionId,
					idempotencyKey: parsed.idempotencyKey,
					requestDigest,
					state: "running",
					attempt: 1,
					createdAt: now,
					updatedAt: now,
				});
				await transaction.upsert("shippingQuoteRequestV2", requestId, request);
				return true;
			});
			if (!claim) return getQuoteResult(quoteId);

			try {
				const connection = requireConnection(
					await data.get("shippingConnectionV2", parsed.connectionId),
				);
				const provider = usableProvider(connection, "quote");
				const providerQuote = providerQuoteResultSchema.parse(
					await provider.quote({
						originAddress: connection.originAddress,
						destinationAddress: parsed.destinationAddress,
						parcelPlan: parsed.parcelPlan,
						currency: parsed.currency,
					}),
				);
				if (
					providerQuote.options.some(
						(option) => option.currency !== parsed.currency,
					)
				) {
					throw new Error("Provider quote currency does not match Checkout.");
				}
				const destinationAddress =
					providerQuote.verifiedDestinationAddress ?? parsed.destinationAddress;
				const now = new Date();
				const expiresAt = new Date(now.getTime() + quoteTtlSeconds * 1_000);
				const quote = shippingQuoteSchema.parse({
					id: quoteId,
					checkoutId: parsed.checkoutId,
					checkoutRevision: parsed.checkoutRevision,
					connectionId: connection.id,
					providerQuoteReference: providerQuote.providerQuoteReference,
					destinationAddress,
					originAddress: connection.originAddress,
					addressFingerprint: await sha256(JSON.stringify(destinationAddress)),
					parcelPlan: parsed.parcelPlan,
					parcelPlanFingerprint: await sha256(
						JSON.stringify(parsed.parcelPlan),
					),
					currency: parsed.currency,
					status: "active",
					issuedAt: now,
					expiresAt,
					createdAt: now,
				});
				const quoteOptions = await Promise.all(
					providerQuote.options.map(async (option) =>
						shippingOptionSchema.parse({
							id: `shipoption_${await sha256(
								JSON.stringify([quoteId, option.providerRateReference]),
							)}`,
							quoteId,
							connectionId: connection.id,
							providerQuoteReference: providerQuote.providerQuoteReference,
							providerRateReference: option.providerRateReference,
							carrier: option.carrier,
							service: option.service,
							amountMinor: option.amountMinor,
							currency: option.currency,
							deliveryDays: option.deliveryDays,
							deliveryDate: option.deliveryDate,
							deliveryDateGuaranteed: option.deliveryDateGuaranteed,
							expiresAt,
							createdAt: now,
						}),
					),
				);
				await transact(async (transaction) => {
					await lock(transaction, requestId);
					const request = shippingQuoteRequestSchema.parse(
						await transaction.getForUpdate("shippingQuoteRequestV2", requestId),
					);
					if (
						request.requestDigest !== requestDigest ||
						request.state !== "running"
					) {
						throw new ShippingFoundationError(
							"idempotency_conflict",
							"Shipping quote claim changed before persistence.",
						);
					}
					await transaction.upsert("shippingQuoteV2", quote.id, quote);
					for (const option of quoteOptions) {
						await transaction.upsert("shippingOptionV2", option.id, option);
					}
					await transaction.upsert(
						"shippingQuoteRequestV2",
						requestId,
						shippingQuoteRequestSchema.parse({
							...request,
							state: "succeeded",
							updatedAt: new Date(),
						}),
					);
				});
				return { quote, options: quoteOptions };
			} catch (error) {
				await transact(async (transaction) => {
					await lock(transaction, requestId);
					const row = await transaction.getForUpdate(
						"shippingQuoteRequestV2",
						requestId,
					);
					if (!row) return;
					const request = shippingQuoteRequestSchema.parse(row);
					if (request.state !== "running") return;
					await transaction.upsert(
						"shippingQuoteRequestV2",
						requestId,
						shippingQuoteRequestSchema.parse({
							...request,
							state: "failed",
							failureCode:
								error instanceof ShippingFoundationError
									? error.code
									: "provider_quote_failed",
							updatedAt: new Date(),
						}),
					);
				});
				throw error;
			}
		},

		async getQuote(id) {
			const row = await data.get("shippingQuoteV2", identifierSchema.parse(id));
			return row ? shippingQuoteSchema.parse(row) : null;
		},

		async getOption(id) {
			const row = await data.get(
				"shippingOptionV2",
				identifierSchema.parse(id),
			);
			return row ? shippingOptionSchema.parse(row) : null;
		},

		async recordPurchasedLabel(input) {
			const parsed = recordShippingLabelInputSchema.parse(input);
			const labelId = `shiplabel_${await sha256(
				JSON.stringify([parsed.fulfillmentId, parsed.idempotencyKey]),
			)}`;
			return transact(async (transaction) => {
				const { quote, option } = await loadValidOptionLocked(
					transaction,
					parsed,
				);
				if (
					!quote.parcelPlan.some(
						(parcel) => parcel.parcelReference === parsed.parcelReference,
					)
				) {
					throw new ShippingFoundationError(
						"quote_option_mismatch",
						"Label parcel is not part of the quoted parcel plan.",
					);
				}
				await lock(transaction, `shipping-label:${labelId}`);
				const existingRow = await transaction.getForUpdate(
					"shippingLabelV2",
					labelId,
				);
				if (existingRow) {
					const existing = shippingLabelSchema.parse(existingRow);
					if (
						existing.fulfillmentId !== parsed.fulfillmentId ||
						existing.quoteId !== parsed.quoteId ||
						existing.optionId !== parsed.optionId ||
						existing.parcelReference !== parsed.parcelReference ||
						existing.connectionId !== quote.connectionId ||
						existing.providerShipmentReference !==
							quote.providerQuoteReference ||
						existing.providerLabelReference !== parsed.providerLabelReference
					) {
						throw new ShippingFoundationError(
							"idempotency_conflict",
							"Label key was already used for a different provider result.",
						);
					}
					return existing;
				}
				const now = new Date();
				const label = shippingLabelSchema.parse({
					id: labelId,
					fulfillmentId: parsed.fulfillmentId,
					quoteId: quote.id,
					optionId: option.id,
					parcelReference: parsed.parcelReference,
					connectionId: quote.connectionId,
					idempotencyKey: parsed.idempotencyKey,
					providerShipmentReference: quote.providerQuoteReference,
					providerLabelReference: parsed.providerLabelReference,
					...(parsed.providerTrackingReference
						? { providerTrackingReference: parsed.providerTrackingReference }
						: {}),
					...(parsed.trackingCode ? { trackingCode: parsed.trackingCode } : {}),
					...(parsed.labelUrl ? { labelUrl: parsed.labelUrl } : {}),
					amountMinor: option.amountMinor,
					currency: option.currency,
					status: "pre_transit",
					purchasedAt: now,
					createdAt: now,
					updatedAt: now,
				});
				await transaction.upsert("shippingLabelV2", label.id, label);
				return label;
			});
		},

		async recordTracking(input) {
			const parsed = recordShippingTrackingInputSchema.parse(input);
			const trackingId = `shiptracking_${await sha256(
				JSON.stringify([parsed.labelId, parsed.providerTrackerReference]),
			)}`;
			return transact(async (transaction) => {
				await lock(transaction, `shipping-label:${parsed.labelId}`);
				const label = await labelForFulfillment(
					transaction,
					parsed.fulfillmentId,
					parsed.labelId,
				);
				await lock(transaction, `shipping-tracking:${trackingId}`);
				const existingRow = await transaction.getForUpdate(
					"shippingTrackingV2",
					trackingId,
				);
				const existing = existingRow
					? shippingTrackingSchema.parse(existingRow)
					: null;
				if (
					existing &&
					(existing.connectionId !== label.connectionId ||
						existing.trackingCode !== parsed.trackingCode)
				) {
					throw new ShippingFoundationError(
						"original_connection_mismatch",
						"Tracking must retain the label's original Shipping Connection.",
					);
				}
				if (
					existing &&
					existing.providerOccurredAt.getTime() >=
						parsed.providerOccurredAt.getTime()
				) {
					return existing;
				}
				const now = new Date();
				const tracking = shippingTrackingSchema.parse({
					id: trackingId,
					fulfillmentId: label.fulfillmentId,
					labelId: label.id,
					parcelReference: label.parcelReference,
					connectionId: label.connectionId,
					providerTrackerReference: parsed.providerTrackerReference,
					trackingCode: parsed.trackingCode,
					status: parsed.status,
					...(parsed.publicUrl ? { publicUrl: parsed.publicUrl } : {}),
					providerOccurredAt: parsed.providerOccurredAt,
					createdAt: existing?.createdAt ?? now,
					updatedAt: now,
				});
				await transaction.upsert("shippingTrackingV2", tracking.id, tracking);
				return tracking;
			});
		},

		async recordLabelRefund(input) {
			const parsed = recordShippingLabelRefundInputSchema.parse(input);
			const refundId = `shiprefund_${await sha256(
				JSON.stringify([parsed.labelId, parsed.idempotencyKey]),
			)}`;
			return transact(async (transaction) => {
				await lock(transaction, `shipping-label:${parsed.labelId}`);
				const label = await labelForFulfillment(
					transaction,
					parsed.fulfillmentId,
					parsed.labelId,
				);
				await lock(transaction, `shipping-refund:${refundId}`);
				const existingRow = await transaction.getForUpdate(
					"shippingLabelRefundV2",
					refundId,
				);
				const existing = existingRow
					? shippingLabelRefundSchema.parse(existingRow)
					: null;
				if (
					existing &&
					(existing.connectionId !== label.connectionId ||
						(existing.providerRefundReference !== undefined &&
							parsed.providerRefundReference !== undefined &&
							existing.providerRefundReference !==
								parsed.providerRefundReference))
				) {
					throw new ShippingFoundationError(
						"idempotency_conflict",
						"Label refund key is already bound to a different provider result.",
					);
				}
				if (existing?.status === "succeeded") return existing;
				const now = new Date();
				const providerRefundReference =
					parsed.providerRefundReference ?? existing?.providerRefundReference;
				if (parsed.status === "succeeded" && !providerRefundReference) {
					throw new ShippingFoundationError(
						"idempotency_conflict",
						"A succeeded label refund requires a provider reference.",
					);
				}
				const refund = shippingLabelRefundSchema.parse({
					id: refundId,
					fulfillmentId: label.fulfillmentId,
					labelId: label.id,
					connectionId: label.connectionId,
					idempotencyKey: parsed.idempotencyKey,
					...(providerRefundReference ? { providerRefundReference } : {}),
					status: parsed.status,
					createdAt: existing?.createdAt ?? now,
					updatedAt: now,
				});
				await transaction.upsert("shippingLabelRefundV2", refund.id, refund);
				return refund;
			});
		},

		async recordPostageAdjustment(input) {
			const parsed = recordShippingPostageAdjustmentInputSchema.parse(input);
			const adjustmentId = `shipadjustment_${await sha256(
				JSON.stringify([parsed.labelId, parsed.idempotencyKey]),
			)}`;
			return transact(async (transaction) => {
				await lock(transaction, `shipping-label:${parsed.labelId}`);
				const label = await labelForFulfillment(
					transaction,
					parsed.fulfillmentId,
					parsed.labelId,
				);
				if (label.currency !== parsed.currency) {
					throw new ShippingFoundationError(
						"original_connection_mismatch",
						"Postage adjustment currency must match the original label.",
					);
				}
				await lock(transaction, `shipping-adjustment:${adjustmentId}`);
				const existingRow = await transaction.getForUpdate(
					"shippingPostageAdjustmentV2",
					adjustmentId,
				);
				if (existingRow) {
					const existing = shippingPostageAdjustmentSchema.parse(existingRow);
					if (
						existing.connectionId !== label.connectionId ||
						existing.providerAdjustmentReference !==
							parsed.providerAdjustmentReference ||
						existing.kind !== parsed.kind ||
						existing.amountMinor !== parsed.amountMinor ||
						existing.currency !== parsed.currency
					) {
						throw new ShippingFoundationError(
							"idempotency_conflict",
							"Postage adjustment key is already bound to another result.",
						);
					}
					return existing;
				}
				const adjustment = shippingPostageAdjustmentSchema.parse({
					id: adjustmentId,
					fulfillmentId: label.fulfillmentId,
					labelId: label.id,
					connectionId: label.connectionId,
					idempotencyKey: parsed.idempotencyKey,
					providerAdjustmentReference: parsed.providerAdjustmentReference,
					kind: parsed.kind,
					amountMinor: parsed.amountMinor,
					currency: parsed.currency,
					recordedAt: parsed.recordedAt,
					createdAt: new Date(),
				});
				await transaction.upsert(
					"shippingPostageAdjustmentV2",
					adjustment.id,
					adjustment,
				);
				return adjustment;
			});
		},
	};
}
