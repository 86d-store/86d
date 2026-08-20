import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const shippingSchema = {
	shippingZone: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			/** ISO 3166-1 alpha-2 country codes; empty = all countries (wildcard) */
			countries: { type: "json", required: true, defaultValue: [] },
			isActive: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shippingRate: {
		fields: {
			id: { type: "string", required: true },
			zoneId: {
				type: "string",
				required: true,
				references: { model: "shippingZone", field: "id", onDelete: "cascade" },
			},
			name: { type: "string", required: true },
			/** Price in cents */
			price: { type: "number", required: true, defaultValue: 0 },
			/** Minimum order amount in cents */
			minOrderAmount: { type: "number", required: false },
			/** Maximum order amount in cents */
			maxOrderAmount: { type: "number", required: false },
			/** Minimum weight in grams */
			minWeight: { type: "number", required: false },
			/** Maximum weight in grams */
			maxWeight: { type: "number", required: false },
			isActive: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shippingMethod: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			/** Minimum estimated delivery days */
			estimatedDaysMin: { type: "number", required: true },
			/** Maximum estimated delivery days */
			estimatedDaysMax: { type: "number", required: true },
			isActive: { type: "boolean", required: true, defaultValue: true },
			/** Display order (lower = first) */
			sortOrder: { type: "number", required: true, defaultValue: 0 },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shippingCarrier: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			/** Unique code identifier, e.g. "fedex", "ups" */
			code: { type: "string", required: true, unique: true },
			/** Tracking URL template with {tracking} placeholder */
			trackingUrlTemplate: { type: "string", required: false },
			isActive: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shipment: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true },
			carrierId: { type: "string", required: false },
			methodId: { type: "string", required: false },
			trackingNumber: { type: "string", required: false },
			status: { type: "string", required: true, defaultValue: "pending" },
			shippedAt: { type: "date", required: false },
			deliveredAt: { type: "date", required: false },
			estimatedDelivery: { type: "date", required: false },
			notes: { type: "string", required: false },
			externalShipmentId: { type: "string", required: false },
			labelUrl: { type: "string", required: false },
			publicTrackingUrl: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shippingConnectionV2: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			normalizedName: {
				type: "string",
				required: true,
				unique: true,
				index: true,
			},
			provider: { type: "string", required: true, index: true },
			mode: { type: ["test", "live"], required: true },
			capabilities: { type: "json", required: true },
			health: {
				type: ["unknown", "healthy", "degraded", "unhealthy"],
				required: true,
				defaultValue: "unknown",
			},
			lifecycle: {
				type: ["draft", "enabled", "disabled", "revoked"],
				required: true,
				defaultValue: "draft",
				index: true,
			},
			secretReference: {
				type: "string",
				required: true,
				returned: false,
			},
			originAddress: { type: "json", required: true },
			healthCheckedAt: { type: "date", required: false },
			enabledAt: { type: "date", required: false },
			disabledAt: { type: "date", required: false },
			revokedAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shippingQuoteRequestV2: {
		fields: {
			id: { type: "string", required: true },
			quoteId: { type: "string", required: true, unique: true },
			checkoutId: { type: "string", required: true, index: true },
			checkoutRevision: { type: "number", required: true },
			connectionId: {
				type: "string",
				required: true,
				references: {
					model: "shippingConnectionV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			idempotencyKey: { type: "string", required: true },
			requestDigest: { type: "string", required: true },
			state: {
				type: ["running", "succeeded", "failed"],
				required: true,
			},
			attempt: { type: "number", required: true },
			failureCode: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shippingQuoteV2: {
		fields: {
			id: { type: "string", required: true },
			checkoutId: { type: "string", required: true, index: true },
			checkoutRevision: { type: "number", required: true },
			connectionId: {
				type: "string",
				required: true,
				references: {
					model: "shippingConnectionV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			providerQuoteReference: { type: "string", required: true },
			destinationAddress: { type: "json", required: true },
			originAddress: { type: "json", required: true },
			addressFingerprint: { type: "string", required: true },
			parcelPlan: { type: "json", required: true },
			parcelPlanFingerprint: { type: "string", required: true },
			currency: { type: "string", required: true },
			status: {
				type: ["active", "expired", "consumed"],
				required: true,
				defaultValue: "active",
			},
			issuedAt: { type: "date", required: true },
			expiresAt: { type: "date", required: true, index: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	shippingOptionV2: {
		fields: {
			id: { type: "string", required: true },
			quoteId: {
				type: "string",
				required: true,
				index: true,
				references: {
					model: "shippingQuoteV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			connectionId: {
				type: "string",
				required: true,
				references: {
					model: "shippingConnectionV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			providerQuoteReference: { type: "string", required: true },
			providerRateReference: { type: "string", required: true },
			carrier: { type: "string", required: true },
			service: { type: "string", required: true },
			amountMinor: { type: "number", required: true },
			currency: { type: "string", required: true },
			deliveryDays: { type: "number", required: false },
			deliveryDate: { type: "string", required: false },
			deliveryDateGuaranteed: { type: "boolean", required: true },
			expiresAt: { type: "date", required: true, index: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	shippingLabelV2: {
		fields: {
			id: { type: "string", required: true },
			fulfillmentId: { type: "string", required: true, index: true },
			quoteId: {
				type: "string",
				required: true,
				references: {
					model: "shippingQuoteV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			optionId: {
				type: "string",
				required: true,
				references: {
					model: "shippingOptionV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			parcelReference: { type: "string", required: true },
			connectionId: {
				type: "string",
				required: true,
				references: {
					model: "shippingConnectionV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			idempotencyKey: { type: "string", required: true },
			providerShipmentReference: { type: "string", required: true },
			providerLabelReference: { type: "string", required: true },
			providerTrackingReference: { type: "string", required: false },
			trackingCode: { type: "string", required: false },
			labelUrl: { type: "string", required: false },
			amountMinor: { type: "number", required: true },
			currency: { type: "string", required: true },
			status: {
				type: [
					"pre_transit",
					"in_transit",
					"delivered",
					"refund_pending",
					"refunded",
					"voided",
					"needs_attention",
				],
				required: true,
				defaultValue: "pre_transit",
			},
			purchasedAt: { type: "date", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shippingTrackingV2: {
		fields: {
			id: { type: "string", required: true },
			fulfillmentId: { type: "string", required: true, index: true },
			labelId: {
				type: "string",
				required: true,
				index: true,
				references: {
					model: "shippingLabelV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			parcelReference: { type: "string", required: true },
			connectionId: {
				type: "string",
				required: true,
				references: {
					model: "shippingConnectionV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			providerTrackerReference: { type: "string", required: true },
			trackingCode: { type: "string", required: true },
			status: { type: "string", required: true },
			publicUrl: { type: "string", required: false },
			providerOccurredAt: { type: "date", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shippingLabelRefundV2: {
		fields: {
			id: { type: "string", required: true },
			fulfillmentId: { type: "string", required: true, index: true },
			labelId: {
				type: "string",
				required: true,
				index: true,
				references: {
					model: "shippingLabelV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			connectionId: {
				type: "string",
				required: true,
				references: {
					model: "shippingConnectionV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			idempotencyKey: { type: "string", required: true },
			providerRefundReference: { type: "string", required: false },
			status: {
				type: ["pending", "succeeded", "failed", "needs_attention"],
				required: true,
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	shippingPostageAdjustmentV2: {
		fields: {
			id: { type: "string", required: true },
			fulfillmentId: { type: "string", required: true, index: true },
			labelId: {
				type: "string",
				required: true,
				index: true,
				references: {
					model: "shippingLabelV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			connectionId: {
				type: "string",
				required: true,
				references: {
					model: "shippingConnectionV2",
					field: "id",
					onDelete: "restrict",
				},
			},
			idempotencyKey: { type: "string", required: true },
			providerAdjustmentReference: { type: "string", required: true },
			kind: { type: ["debit", "credit"], required: true },
			amountMinor: { type: "number", required: true },
			currency: { type: "string", required: true },
			recordedAt: { type: "date", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	shippingBoundaryLockV2: {
		fields: {
			id: { type: "string", required: true },
		},
	},
} satisfies ModuleSchema;

export const shippingTables = transcodeModuleSchema(shippingSchema);
