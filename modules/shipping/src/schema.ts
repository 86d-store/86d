import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const shippingShippingZoneShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	countries: z.array(z.unknown()).default([]),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingRateShape = z.object({
	id: z.string().register(col, { pk: true }),
	zoneId: z.string().register(col, {
		references: {
			table: "self.shippingZone",
			column: "id",
			onDelete: "cascade",
		},
	}),
	name: z.string(),
	price: z.int().default(0),
	minOrderAmount: z.number().optional(),
	maxOrderAmount: z.number().optional(),
	minWeight: z.number().optional(),
	maxWeight: z.number().optional(),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingMethodShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	estimatedDaysMin: z.number(),
	estimatedDaysMax: z.number(),
	isActive: z.boolean().default(true),
	sortOrder: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingCarrierShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	code: z.string().register(col, { unique: true }),
	trackingUrlTemplate: z.string().optional(),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShipmentShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string(),
	carrierId: z.string().optional(),
	methodId: z.string().optional(),
	trackingNumber: z.string().optional(),
	status: z.string().default("pending"),
	shippedAt: z.coerce.date().optional(),
	deliveredAt: z.coerce.date().optional(),
	estimatedDelivery: z.coerce.date().optional(),
	notes: z.string().optional(),
	externalShipmentId: z.string().optional(),
	labelUrl: z.string().optional(),
	publicTrackingUrl: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingConnectionV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	normalizedName: z.string().register(col, { unique: true, index: true }),
	provider: z.string().register(col, { index: true }),
	mode: z.enum(["test", "live"]),
	capabilities: z.record(z.string(), z.unknown()),
	health: z
		.enum(["unknown", "healthy", "degraded", "unhealthy"])
		.default("unknown"),
	lifecycle: z
		.enum(["draft", "enabled", "disabled", "revoked"])
		.register(col, { index: true })
		.default("draft"),
	secretReference: z.string(),
	originAddress: z.record(z.string(), z.unknown()),
	healthCheckedAt: z.coerce.date().optional(),
	enabledAt: z.coerce.date().optional(),
	disabledAt: z.coerce.date().optional(),
	revokedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingQuoteRequestV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	quoteId: z.string().register(col, { unique: true }),
	checkoutId: z.string().register(col, { index: true }),
	checkoutRevision: z.number(),
	connectionId: z.string().register(col, {
		references: {
			table: "self.shippingConnectionV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	idempotencyKey: z.string(),
	requestDigest: z.string(),
	state: z.enum(["running", "succeeded", "failed"]),
	attempt: z.number(),
	failureCode: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingQuoteV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	checkoutId: z.string().register(col, { index: true }),
	checkoutRevision: z.number(),
	connectionId: z.string().register(col, {
		references: {
			table: "self.shippingConnectionV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	providerQuoteReference: z.string(),
	destinationAddress: z.record(z.string(), z.unknown()),
	originAddress: z.record(z.string(), z.unknown()),
	addressFingerprint: z.string(),
	parcelPlan: z.record(z.string(), z.unknown()),
	parcelPlanFingerprint: z.string(),
	currency: z.string(),
	status: z.enum(["active", "expired", "consumed"]).default("active"),
	issuedAt: z.coerce.date(),
	expiresAt: z.coerce.date().register(col, { index: true }),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingOptionV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	quoteId: z.string().register(col, {
		index: true,
		references: {
			table: "self.shippingQuoteV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	connectionId: z.string().register(col, {
		references: {
			table: "self.shippingConnectionV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	providerQuoteReference: z.string(),
	providerRateReference: z.string(),
	carrier: z.string(),
	service: z.string(),
	amountMinor: z.number(),
	currency: z.string(),
	deliveryDays: z.number().optional(),
	deliveryDate: z.string().optional(),
	deliveryDateGuaranteed: z.boolean(),
	expiresAt: z.coerce.date().register(col, { index: true }),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingLabelV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	fulfillmentId: z.string().register(col, { index: true }),
	quoteId: z.string().register(col, {
		references: {
			table: "self.shippingQuoteV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	optionId: z.string().register(col, {
		references: {
			table: "self.shippingOptionV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	parcelReference: z.string(),
	connectionId: z.string().register(col, {
		references: {
			table: "self.shippingConnectionV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	idempotencyKey: z.string(),
	providerShipmentReference: z.string(),
	providerLabelReference: z.string(),
	providerTrackingReference: z.string().optional(),
	trackingCode: z.string().optional(),
	labelUrl: z.string().optional(),
	amountMinor: z.number(),
	currency: z.string(),
	status: z
		.enum([
			"pre_transit",
			"in_transit",
			"delivered",
			"refund_pending",
			"refunded",
			"voided",
			"needs_attention",
		])
		.default("pre_transit"),
	purchasedAt: z.coerce.date(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingTrackingV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	fulfillmentId: z.string().register(col, { index: true }),
	labelId: z.string().register(col, {
		index: true,
		references: {
			table: "self.shippingLabelV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	parcelReference: z.string(),
	connectionId: z.string().register(col, {
		references: {
			table: "self.shippingConnectionV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	providerTrackerReference: z.string(),
	trackingCode: z.string(),
	status: z.string(),
	publicUrl: z.string().optional(),
	providerOccurredAt: z.coerce.date(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingLabelRefundV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	fulfillmentId: z.string().register(col, { index: true }),
	labelId: z.string().register(col, {
		index: true,
		references: {
			table: "self.shippingLabelV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	connectionId: z.string().register(col, {
		references: {
			table: "self.shippingConnectionV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	idempotencyKey: z.string(),
	providerRefundReference: z.string().optional(),
	status: z.enum(["pending", "succeeded", "failed", "needs_attention"]),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingPostageAdjustmentV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	fulfillmentId: z.string().register(col, { index: true }),
	labelId: z.string().register(col, {
		index: true,
		references: {
			table: "self.shippingLabelV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	connectionId: z.string().register(col, {
		references: {
			table: "self.shippingConnectionV2",
			column: "id",
			onDelete: "restrict",
		},
	}),
	idempotencyKey: z.string(),
	providerAdjustmentReference: z.string(),
	kind: z.enum(["debit", "credit"]),
	amountMinor: z.number(),
	currency: z.string(),
	recordedAt: z.coerce.date(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const shippingShippingBoundaryLockV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
});

/** Native Relational storage for shipping. */
export const shippingStorage = {
	kind: "relational",
	tables: {
		shippingZone: {
			shape: shippingShippingZoneShape,
		},
		shippingRate: {
			shape: shippingShippingRateShape,
		},
		shippingMethod: {
			shape: shippingShippingMethodShape,
		},
		shippingCarrier: {
			shape: shippingShippingCarrierShape,
		},
		shipment: {
			shape: shippingShipmentShape,
		},
		shippingConnectionV2: {
			shape: shippingShippingConnectionV2Shape,
		},
		shippingQuoteRequestV2: {
			shape: shippingShippingQuoteRequestV2Shape,
		},
		shippingQuoteV2: {
			shape: shippingShippingQuoteV2Shape,
		},
		shippingOptionV2: {
			shape: shippingShippingOptionV2Shape,
		},
		shippingLabelV2: {
			shape: shippingShippingLabelV2Shape,
		},
		shippingTrackingV2: {
			shape: shippingShippingTrackingV2Shape,
		},
		shippingLabelRefundV2: {
			shape: shippingShippingLabelRefundV2Shape,
		},
		shippingPostageAdjustmentV2: {
			shape: shippingShippingPostageAdjustmentV2Shape,
		},
		shippingBoundaryLockV2: {
			shape: shippingShippingBoundaryLockV2Shape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
