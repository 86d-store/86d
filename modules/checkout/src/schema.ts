import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";
import {
	checkoutRequestAuditActorSchema,
	checkoutRequestCartSnapshotSchema,
	checkoutRequestContactSchema,
	checkoutRequestReasonSchema,
} from "./checkout-request";
import {
	checkoutFinalizationAcceptedInputSchema,
	checkoutFinalizationAttemptOutcomeSchema,
	checkoutFinalizationAttentionSchema,
	checkoutFinalizationCompensationOutcomeSchema,
	checkoutFinalizationCompensationTargetSchema,
	checkoutFinalizationResultSchema,
} from "./finalization";

export const checkoutSchema = {
	checkoutSession: {
		fields: {
			id: { type: "string", required: true },
			revision: { type: "number", required: true, defaultValue: 1 },
			cartId: { type: "string", required: false },
			customerId: { type: "string", required: false },
			guestEmail: { type: "string", required: false },
			status: {
				type: ["pending", "processing", "completed", "expired", "abandoned"],
				required: true,
				defaultValue: "pending",
			},
			subtotal: { type: "number", required: true },
			taxAmount: { type: "number", required: true, defaultValue: 0 },
			shippingAmount: { type: "number", required: true, defaultValue: 0 },
			discountAmount: { type: "number", required: true, defaultValue: 0 },
			/** Amount applied from a gift card */
			giftCardAmount: { type: "number", required: true, defaultValue: 0 },
			/** Amount applied from Store credit */
			storeCreditAmount: { type: "number", required: true, defaultValue: 0 },
			total: { type: "number", required: true },
			currency: { type: "string", required: true, defaultValue: "USD" },
			/** Validated promo code applied to this session */
			discountCode: { type: "string", required: false },
			/** Gift card code applied to this session */
			giftCardCode: { type: "string", required: false },
			/** JSON snapshot of shipping address */
			shippingAddress: { type: "json", required: false },
			/** JSON snapshot of billing address */
			billingAddress: { type: "json", required: false },
			/** Display name of the selected shipping method */
			shippingMethodName: { type: "string", required: false },
			/** Payment method identifier or token from provider */
			paymentMethod: { type: "string", required: false },
			/** Payment intent ID from the payments module */
			paymentIntentId: { type: "string", required: false },
			/** Current payment status (pending, processing, succeeded, failed) */
			paymentStatus: { type: "string", required: false },
			/** Order ID once checkout is completed */
			orderId: { type: "string", required: false },
			metadata: { type: "json", required: false, defaultValue: {} },
			expiresAt: { type: "date", required: true },
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
	checkoutLineItem: {
		fields: {
			id: { type: "string", required: true },
			sessionId: {
				type: "string",
				required: true,
				references: {
					model: "checkoutSession",
					field: "id",
					onDelete: "cascade",
				},
			},
			productId: { type: "string", required: true },
			variantId: { type: "string", required: false },
			name: { type: "string", required: true },
			sku: { type: "string", required: false },
			price: { type: "number", required: true },
			quantity: { type: "number", required: true, defaultValue: 1 },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	/** Dormant, Checkout-owned ledger for a future durable finalizer. */
	checkoutFinalization: {
		fields: {
			id: { type: "string", required: true },
			checkoutId: {
				type: "string",
				required: true,
				references: {
					model: "checkoutSession",
					field: "id",
					onDelete: "restrict",
				},
			},
			operationKey: { type: "string", required: true, returned: false },
			inputDigest: { type: "string", required: true },
			inputDigestVersion: { type: "number", required: true },
			expectedRevision: { type: "number", required: true },
			state: {
				type: ["pending", "running", "compensating", "needs_attention"],
				required: true,
			},
			currentStep: {
				type: [
					"checkout_revision",
					"accepted_offer",
					"shipping_and_tax",
					"inventory",
					"payment_connection",
					"payment_outcome",
					"order",
					"commerce_commit",
					"payment_settlement",
					"checkout_completion",
					"compensation",
				],
				required: true,
			},
			attemptCount: { type: "number", required: true },
			compensationCount: { type: "number", required: true },
			acceptedInput: {
				type: "json",
				required: true,
				validator: {
					input: checkoutFinalizationAcceptedInputSchema,
					output: checkoutFinalizationAcceptedInputSchema,
				},
			},
			result: {
				type: "json",
				required: true,
				validator: {
					input: checkoutFinalizationResultSchema,
					output: checkoutFinalizationResultSchema,
				},
			},
			needsAttention: {
				type: "json",
				required: false,
				validator: {
					input: checkoutFinalizationAttentionSchema,
					output: checkoutFinalizationAttentionSchema,
				},
			},
			createdAt: { type: "date", required: true },
			updatedAt: { type: "date", required: true },
		},
	},
	/** Idempotent evidence for each future orchestrator attempt. */
	checkoutFinalizationAttempt: {
		fields: {
			id: { type: "string", required: true },
			finalizationId: {
				type: "string",
				required: true,
				references: {
					model: "checkoutFinalization",
					field: "id",
					onDelete: "restrict",
				},
			},
			attemptKey: { type: "string", required: true, returned: false },
			operationDigest: { type: "string", required: true },
			operationDigestVersion: { type: "number", required: true },
			sequence: { type: "number", required: true },
			stateBefore: { type: ["pending", "running"], required: true },
			stateAfter: {
				type: ["pending", "running", "compensating", "needs_attention"],
				required: true,
			},
			step: {
				type: [
					"checkout_revision",
					"accepted_offer",
					"shipping_and_tax",
					"inventory",
					"payment_connection",
					"payment_outcome",
					"order",
					"commerce_commit",
					"payment_settlement",
					"checkout_completion",
				],
				required: true,
			},
			nextStep: {
				type: [
					"checkout_revision",
					"accepted_offer",
					"shipping_and_tax",
					"inventory",
					"payment_connection",
					"payment_outcome",
					"order",
					"commerce_commit",
					"payment_settlement",
					"checkout_completion",
					"compensation",
				],
				required: true,
			},
			outcome: {
				type: "json",
				required: true,
				validator: {
					input: checkoutFinalizationAttemptOutcomeSchema,
					output: checkoutFinalizationAttemptOutcomeSchema,
				},
			},
			result: {
				type: "json",
				required: false,
				validator: {
					input: checkoutFinalizationResultSchema,
					output: checkoutFinalizationResultSchema,
				},
			},
			recordedAt: { type: "date", required: true },
		},
	},
	/** Append-only compensation/reconciliation evidence. */
	checkoutFinalizationCompensation: {
		fields: {
			id: { type: "string", required: true },
			finalizationId: {
				type: "string",
				required: true,
				references: {
					model: "checkoutFinalization",
					field: "id",
					onDelete: "restrict",
				},
			},
			compensationKey: { type: "string", required: true, returned: false },
			operationDigest: { type: "string", required: true },
			operationDigestVersion: { type: "number", required: true },
			sequence: { type: "number", required: true },
			action: {
				type: [
					"release_inventory_reservation",
					"reverse_discount_redemption",
					"reverse_gift_card_redemption",
					"reverse_store_credit_debit",
					"cancel_or_reconcile_payment",
					"cancel_order",
					"adjust_tax",
					"void_shipping",
					"other_reconciliation",
				],
				required: true,
			},
			target: {
				type: "json",
				required: true,
				validator: {
					input: checkoutFinalizationCompensationTargetSchema,
					output: checkoutFinalizationCompensationTargetSchema,
				},
			},
			outcome: {
				type: "json",
				required: true,
				validator: {
					input: checkoutFinalizationCompensationOutcomeSchema,
					output: checkoutFinalizationCompensationOutcomeSchema,
				},
			},
			recordedAt: { type: "date", required: true },
		},
	},
	/** Serializes Finalization admission for one Checkout identity. */
	checkoutFinalizationLock: {
		fields: {
			id: { type: "string", required: true },
			checkoutId: { type: "string", required: true },
		},
	},
	/** Non-binding request retained while a required Checkout decision is unavailable. */
	checkoutRequest: {
		fields: {
			id: { type: "string", required: true },
			requestDigest: { type: "string", required: true },
			requestDigestVersion: { type: "number", required: true },
			owner: { type: "json", required: true },
			accessProofDigest: { type: "string", required: false, returned: false },
			reason: {
				type: "json",
				required: true,
				validator: {
					input: checkoutRequestReasonSchema,
					output: checkoutRequestReasonSchema,
				},
			},
			contact: {
				type: "json",
				required: true,
				validator: {
					input: checkoutRequestContactSchema,
					output: checkoutRequestContactSchema,
				},
			},
			cartSnapshot: {
				type: "json",
				required: true,
				validator: {
					input: checkoutRequestCartSnapshotSchema,
					output: checkoutRequestCartSnapshotSchema,
				},
			},
			invitationState: {
				type: ["not_invited", "invited", "reminded", "expired"],
				required: true,
				defaultValue: "not_invited",
			},
			invitedAt: { type: "date", required: false },
			remindedAt: { type: "date", required: false },
			invitationExpiresAt: { type: "date", required: false },
			auditActor: {
				type: "json",
				required: true,
				validator: {
					input: checkoutRequestAuditActorSchema,
					output: checkoutRequestAuditActorSchema,
				},
			},
			expiresAt: { type: "date", required: true, index: true },
			createdAt: { type: "date", required: true },
			updatedAt: { type: "date", required: true },
		},
	},
	/** Durable receipt that enforces operation-key replay and mismatch rejection. */
	checkoutRequestOperation: {
		fields: {
			id: { type: "string", required: true },
			operationKey: { type: "string", required: true },
			requestDigest: { type: "string", required: true },
			requestDigestVersion: { type: "number", required: true },
			checkoutRequestId: {
				type: "string",
				required: true,
				references: {
					model: "checkoutRequest",
					field: "id",
					onDelete: "restrict",
				},
			},
			createdAt: { type: "date", required: true },
		},
	},
	/** Stable owner-local row used to serialize one create operation. */
	checkoutRequestLock: {
		fields: {
			id: { type: "string", required: true },
		},
	},
} satisfies ModuleSchema;

export const checkoutTables = transcodeModuleSchema(checkoutSchema);
