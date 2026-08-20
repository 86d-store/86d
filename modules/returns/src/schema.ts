import type { ModuleSchema } from "@86d-app/core/types/schema";

export const returnsSchema = {
	/** Internal serialization rows for deterministic Return request admission. */
	returnAuthorityOperationLock: {
		fields: {
			id: { type: "string", required: true },
			operationId: { type: "string", required: true, unique: true },
		},
	},
	returnAuthorityOrderLock: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true, unique: true },
		},
	},
	/** Immutable v1 request snapshot; lifecycle state is deliberately separate. */
	returnAuthorityRequest: {
		fields: {
			id: { type: "string", required: true },
			contractVersion: { type: "number", required: true },
			operationId: { type: "string", required: true, unique: true },
			requestDigest: { type: "string", required: true },
			orderId: { type: "string", required: true },
			customerId: { type: "string", required: true },
			actor: { type: "json", required: true },
			authority: { type: "json", required: true },
			requestedResolution: { type: "string", required: true },
			reasonSnapshot: { type: "string", required: true },
			items: { type: "json", required: true },
			requestedAt: { type: "date", required: true },
		},
	},
	returnAuthorityReceipt: {
		fields: {
			id: { type: "string", required: true },
			operationId: { type: "string", required: true, unique: true },
			requestDigest: { type: "string", required: true },
			returnRequestId: { type: "string", required: true },
			createdAt: { type: "date", required: true },
		},
	},
	returnRequest: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			orderId: {
				type: "string",
				required: true,
				references: {
					model: "order",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			customerId: {
				type: "string",
				required: true,
			},
			customerEmail: {
				type: "string",
				required: false,
			},
			status: {
				type: [
					"requested",
					"approved",
					"rejected",
					"received",
					"completed",
					"cancelled",
				] as const,
				required: true,
				defaultValue: "requested",
			},
			refundMethod: {
				type: ["original_payment", "store_credit", "exchange"] as const,
				required: true,
				defaultValue: "original_payment",
			},
			refundAmount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			currency: {
				type: "string",
				required: true,
				defaultValue: "USD",
			},
			reason: {
				type: "string",
				required: true,
			},
			customerNotes: {
				type: "string",
				required: false,
			},
			adminNotes: {
				type: "string",
				required: false,
			},
			trackingNumber: {
				type: "string",
				required: false,
			},
			trackingCarrier: {
				type: "string",
				required: false,
			},
			requestedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			resolvedAt: {
				type: "date",
				required: false,
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
	returnItem: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			returnRequestId: {
				type: "string",
				required: true,
				references: {
					model: "returnRequest",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			orderItemId: {
				type: "string",
				required: true,
			},
			productName: {
				type: "string",
				required: true,
			},
			sku: {
				type: "string",
				required: false,
			},
			quantity: {
				type: "number",
				required: true,
			},
			unitPrice: {
				type: "number",
				required: true,
			},
			reason: {
				type: [
					"damaged",
					"defective",
					"wrong_item",
					"not_as_described",
					"changed_mind",
					"too_small",
					"too_large",
					"other",
				] as const,
				required: true,
			},
			condition: {
				type: ["unopened", "opened", "used", "damaged"] as const,
				required: true,
				defaultValue: "opened",
			},
			notes: {
				type: "string",
				required: false,
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
