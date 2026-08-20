import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const ordersSchema = {
	order: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			orderNumber: {
				type: "string",
				required: true,
				unique: true,
			},
			customerId: {
				type: "string",
				required: false,
			},
			guestEmail: {
				type: "string",
				required: false,
			},
			status: {
				type: [
					"pending",
					"processing",
					"on_hold",
					"completed",
					"cancelled",
					"refunded",
				],
				required: true,
				defaultValue: "pending",
			},
			paymentStatus: {
				type: ["unpaid", "paid", "partially_paid", "refunded", "voided"],
				required: true,
				defaultValue: "unpaid",
			},
			subtotal: {
				type: "number",
				required: true,
			},
			taxAmount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			shippingAmount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			discountAmount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			giftCardAmount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			storeCreditAmount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			total: {
				type: "number",
				required: true,
			},
			currency: {
				type: "string",
				required: true,
				defaultValue: "USD",
			},
			/** Immutable references to the accepted server-owned offer. */
			checkoutId: { type: "string", required: false },
			acceptedOfferId: { type: "string", required: false },
			catalogRevision: { type: "string", required: false },
			priceSourceVersion: { type: "string", required: false },
			taxQuoteId: { type: "string", required: false },
			shippingQuoteId: { type: "string", required: false },
			shippingOptionId: { type: "string", required: false },
			inventoryReservationIds: {
				type: "json",
				required: false,
				defaultValue: [],
			},
			paymentConnectionId: { type: "string", required: false },
			paymentOperationId: { type: "string", required: false },
			/** Explicit closure is evaluated separately from delivery evidence. */
			closedAt: { type: "date", required: false },
			closureReason: { type: "string", required: false },
			closurePolicyVersion: { type: "number", required: false },
			notes: {
				type: "string",
				required: false,
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
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
	orderItem: {
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
					onDelete: "cascade",
				},
			},
			productId: {
				type: "string",
				required: true,
			},
			variantId: {
				type: "string",
				required: false,
			},
			name: {
				type: "string",
				required: true,
			},
			sku: {
				type: "string",
				required: false,
			},
			price: {
				type: "number",
				required: true,
			},
			quantity: {
				type: "number",
				required: true,
			},
			subtotal: {
				type: "number",
				required: true,
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
		},
	},
	orderAddress: {
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
					onDelete: "cascade",
				},
			},
			type: {
				type: ["billing", "shipping"],
				required: true,
			},
			firstName: {
				type: "string",
				required: true,
			},
			lastName: {
				type: "string",
				required: true,
			},
			company: {
				type: "string",
				required: false,
			},
			line1: {
				type: "string",
				required: true,
			},
			line2: {
				type: "string",
				required: false,
			},
			city: {
				type: "string",
				required: true,
			},
			state: {
				type: "string",
				required: true,
			},
			postalCode: {
				type: "string",
				required: true,
			},
			country: {
				type: "string",
				required: true,
			},
			phone: {
				type: "string",
				required: false,
			},
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
					onDelete: "cascade",
				},
			},
			status: {
				type: [
					"requested",
					"approved",
					"rejected",
					"shipped_back",
					"received",
					"refunded",
					"completed",
				],
				required: true,
				defaultValue: "requested",
			},
			type: {
				type: ["refund", "exchange", "store_credit"],
				required: true,
				defaultValue: "refund",
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
			refundAmount: {
				type: "number",
				required: false,
			},
			trackingNumber: {
				type: "string",
				required: false,
			},
			trackingUrl: {
				type: "string",
				required: false,
			},
			carrier: {
				type: "string",
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
					onDelete: "cascade",
				},
			},
			orderItemId: {
				type: "string",
				required: true,
			},
			quantity: {
				type: "number",
				required: true,
			},
			reason: {
				type: "string",
				required: false,
			},
		},
	},
	orderNote: {
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
					onDelete: "cascade",
				},
			},
			type: {
				type: ["note", "system"],
				required: true,
				defaultValue: "note",
			},
			content: {
				type: "string",
				required: true,
			},
			authorId: {
				type: "string",
				required: false,
			},
			authorName: {
				type: "string",
				required: false,
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	orderCustomerAttribution: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true, index: true },
			fromCustomerId: { type: "string", required: false },
			toCustomerId: { type: "string", required: true },
			reason: {
				type: ["legacy_subject_rewrite", "guest_claim"],
				required: true,
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const ordersTables = transcodeModuleSchema(ordersSchema);
