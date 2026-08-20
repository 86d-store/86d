import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const paymentsSchema = {
	paymentConnection: {
		fields: {
			id: { type: "string", required: true },
			providerAccountId: { type: "string", required: true },
			name: { type: "string", required: true },
			normalizedName: { type: "string", required: true, index: true },
			provider: { type: "string", required: true },
			mode: { type: ["test", "live"], required: true },
			capabilities: { type: "json", required: true, defaultValue: [] },
			health: {
				type: ["unknown", "healthy", "degraded", "unhealthy"],
				required: true,
				defaultValue: "unknown",
			},
			lifecycle: {
				type: ["draft", "enabled", "disabled", "revoked"],
				required: true,
				defaultValue: "draft",
			},
			/** Opaque server-side locator. Never return this field from an endpoint. */
			secretReference: { type: "string", required: true },
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
	/** Stable row used to serialize Payment Connection names. */
	paymentConnectionLockV2: {
		fields: {
			id: { type: "string", required: true },
		},
	},
	/** Payment-owned financial aggregate. Checkout and Order remain references. */
	paymentV2: {
		fields: {
			id: { type: "string", required: true },
			modelVersion: { type: "number", required: true, defaultValue: 2 },
			checkoutId: { type: "string", required: true, index: true },
			orderId: { type: "string", required: false, index: true },
			connectionId: { type: "string", required: true, index: true },
			paymentOption: {
				type: ["card", "apple_pay", "google_pay", "paypal"],
				required: true,
			},
			expectedAmount: { type: "number", required: true },
			eligibleMerchandiseAmount: { type: "number", required: true },
			currency: { type: "string", required: true },
			authorizedAmount: { type: "number", required: true, defaultValue: 0 },
			capturedAmount: { type: "number", required: true, defaultValue: 0 },
			voidedAmount: { type: "number", required: true, defaultValue: 0 },
			confirmedRefundedAmount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			providerReferences: { type: "json", required: true, defaultValue: [] },
			dispute: { type: "json", required: true },
			state: {
				type: [
					"pending",
					"authorized",
					"partially_captured",
					"captured",
					"partially_refunded",
					"refunded",
					"voided",
				],
				required: true,
				defaultValue: "pending",
			},
			terminalState: {
				type: ["none", "refunded", "voided"],
				required: true,
				defaultValue: "none",
			},
			creationIdempotencyKey: { type: "string", required: true, index: true },
			creationDigest: { type: "string", required: true },
			creationDigestVersion: {
				type: "number",
				required: true,
				defaultValue: 1,
			},
			revision: { type: "number", required: true, defaultValue: 1 },
			terminalAt: { type: "date", required: false },
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
	/** Owner-local lock row used to serialize every mutation of one Payment. */
	paymentV2Lock: {
		fields: {
			id: { type: "string", required: true },
			paymentId: { type: "string", required: true, index: true },
		},
	},
	/** Immutable provider dispute facts; the aggregate stores their projection. */
	paymentDisputeFactV2: {
		fields: {
			id: { type: "string", required: true },
			paymentId: { type: "string", required: true, index: true },
			connectionId: { type: "string", required: true, index: true },
			eventId: { type: "string", required: true, index: true },
			eventDigest: { type: "string", required: true },
			providerDisputeReference: { type: "string", required: true, index: true },
			state: {
				type: ["open", "won", "lost", "reversed"],
				required: true,
			},
			occurredAt: { type: "date", required: true },
			appliedRevision: { type: "number", required: true },
		},
	},
	/** Durable v2 operation aggregate. Routing and request identity are immutable. */
	paymentOperationV2: {
		fields: {
			id: { type: "string", required: true },
			modelVersion: { type: "number", required: true, defaultValue: 2 },
			paymentId: { type: "string", required: true, index: true },
			connectionId: { type: "string", required: true, index: true },
			sourceOperationId: { type: "string", required: false, index: true },
			operation: {
				type: ["intent", "authorization", "capture", "refund", "void"],
				required: true,
			},
			idempotencyKey: { type: "string", required: true, index: true },
			requestDigest: { type: "string", required: true },
			/** Canonical financial input persisted before any provider I/O. */
			payload: { type: "json", required: true },
			requestDigestVersion: {
				type: "number",
				required: true,
				defaultValue: 1,
			},
			state: {
				type: [
					"pending",
					"requires_action",
					"running",
					"succeeded",
					"failed",
					"ambiguous",
					"needs_attention",
					"dead_letter",
				],
				required: true,
				defaultValue: "pending",
			},
			revision: { type: "number", required: true, defaultValue: 1 },
			attempt: { type: "number", required: true, defaultValue: 1 },
			reconciliationAttempts: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			manualReconciliationCount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			providerReference: { type: "string", required: false },
			outcome: { type: "json", required: false },
			needsAttentionReason: { type: "string", required: false },
			needsAttentionAt: { type: "date", required: false },
			leaseExpiresAt: { type: "date", required: false, index: true },
			nextReconciliationAt: { type: "date", required: false, index: true },
			lastReconciliationAt: { type: "date", required: false },
			lastReconciliationTrigger: {
				type: ["scheduled", "manual"],
				required: false,
			},
			lastManualReconciliationReason: { type: "string", required: false },
			lastManualReconciliationAt: { type: "date", required: false },
			deadLetteredAt: { type: "date", required: false },
			completedAt: { type: "date", required: false },
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
	/** Append-only attempt history; each row becomes final after its provider call. */
	paymentOperationAttemptV2: {
		fields: {
			id: { type: "string", required: true },
			paymentOperationId: { type: "string", required: true, index: true },
			connectionId: { type: "string", required: true, index: true },
			attempt: { type: "number", required: true },
			idempotencyKey: { type: "string", required: true, index: true },
			requestDigest: { type: "string", required: true },
			trigger: {
				type: ["initial", "scheduled_reconciliation", "manual_reconciliation"],
				required: true,
				defaultValue: "initial",
			},
			triggerReason: { type: "string", required: false },
			state: {
				type: [
					"running",
					"pending",
					"requires_action",
					"succeeded",
					"failed",
					"ambiguous",
				],
				required: true,
			},
			providerReference: { type: "string", required: false },
			outcome: { type: "json", required: false },
			startedAt: { type: "date", required: true },
			finishedAt: { type: "date", required: false },
		},
	},
	/** Stable row used to serialize one idempotent Payment operation. */
	paymentOperationLockV2: {
		fields: {
			id: { type: "string", required: true },
		},
	},
	/** Verified, Connection-bound provider ingress. Raw payloads are never stored. */
	paymentWebhookReceiptV2: {
		fields: {
			id: { type: "string", required: true },
			modelVersion: { type: "number", required: true, defaultValue: 2 },
			storeId: { type: "string", required: true, index: true },
			connectionId: { type: "string", required: true, index: true },
			provider: { type: "string", required: true, index: true },
			providerEventId: { type: "string", required: true, index: true },
			providerEventType: { type: "string", required: true },
			payloadDigest: { type: "string", required: true },
			verificationKeyReference: { type: "string", required: true },
			fact: { type: "json", required: true },
			state: {
				type: [
					"verified",
					"processing",
					"applied",
					"rejected",
					"needs_attention",
				],
				required: true,
				defaultValue: "verified",
			},
			processingAttempts: { type: "number", required: true, defaultValue: 0 },
			revision: { type: "number", required: true, defaultValue: 1 },
			leaseExpiresAt: { type: "date", required: false, index: true },
			finalDisposition: { type: "string", required: false },
			lastFailureCode: { type: "string", required: false },
			verifiedAt: { type: "date", required: true },
			appliedAt: { type: "date", required: false },
			createdAt: { type: "date", required: true },
			updatedAt: { type: "date", required: true },
		},
	},
	/** Stable row used to serialize one provider event identity. */
	paymentWebhookReceiptLockV2: {
		fields: {
			id: { type: "string", required: true },
		},
	},
	paymentIntent: {
		fields: {
			id: { type: "string", required: true },
			/** Provider-assigned intent ID (e.g. Stripe's pi_xxx) */
			providerIntentId: { type: "string", required: false },
			customerId: { type: "string", required: false },
			email: { type: "string", required: false },
			/** Amount in smallest currency unit (e.g. cents) */
			amount: { type: "number", required: true },
			currency: { type: "string", required: true, defaultValue: "USD" },
			status: {
				type: [
					"pending",
					"processing",
					"succeeded",
					"failed",
					"cancelled",
					"refunded",
				],
				required: true,
				defaultValue: "pending",
			},
			paymentMethodId: { type: "string", required: false },
			orderId: { type: "string", required: false },
			checkoutSessionId: { type: "string", required: false },
			metadata: { type: "json", required: false, defaultValue: {} },
			providerMetadata: { type: "json", required: false, defaultValue: {} },
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
	paymentMethod: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true },
			/** Provider-assigned method ID (e.g. Stripe's pm_xxx) */
			providerMethodId: { type: "string", required: true },
			/** card | bank_transfer | wallet */
			type: { type: "string", required: true, defaultValue: "card" },
			last4: { type: "string", required: false },
			brand: { type: "string", required: false },
			expiryMonth: { type: "number", required: false },
			expiryYear: { type: "number", required: false },
			isDefault: { type: "boolean", required: true, defaultValue: false },
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
	refund: {
		fields: {
			id: { type: "string", required: true },
			paymentIntentId: { type: "string", required: true },
			/** Provider-assigned refund ID */
			providerRefundId: { type: "string", required: true },
			/** Refund amount in smallest currency unit */
			amount: { type: "number", required: true },
			reason: { type: "string", required: false },
			status: {
				type: ["pending", "succeeded", "failed"],
				required: true,
				defaultValue: "pending",
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
} satisfies ModuleSchema;

export const paymentsTables = transcodeModuleSchema(paymentsSchema);
