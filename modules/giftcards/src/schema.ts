import type { ModuleSchema } from "@86d-app/core/types/schema";

export const giftCardSchema = {
	giftCard: {
		fields: {
			id: { type: "string", required: true },
			/** Unique redemption code (uppercase alphanumeric, e.g. GIFT-XXXX-XXXX) */
			code: { type: "string", required: true },
			initialBalance: { type: "number", required: true },
			currentBalance: { type: "number", required: true },
			currency: { type: "string", required: true },
			/** active | disabled | expired | depleted */
			status: { type: "string", required: true },
			expiresAt: { type: "string", required: false },
			/** Customer who received the gift card */
			recipientEmail: { type: "string", required: false },
			/** Name of the recipient */
			recipientName: { type: "string", required: false },
			/** Customer ID if linked to an account */
			customerId: { type: "string", required: false },
			/** Customer who purchased the gift card */
			purchasedByCustomerId: { type: "string", required: false },
			/** Name of the sender */
			senderName: { type: "string", required: false },
			/** Email of the sender */
			senderEmail: { type: "string", required: false },
			/** Personal message from sender to recipient */
			message: { type: "string", required: false },
			/** email | physical | digital */
			deliveryMethod: { type: "string", required: false },
			/** Whether the gift card has been delivered to the recipient */
			delivered: { type: "boolean", required: false },
			/** When the delivery was sent */
			deliveredAt: { type: "date", required: false },
			/** Scheduled delivery date (for delayed sending) */
			scheduledDeliveryAt: { type: "string", required: false },
			/** Order that purchased this gift card */
			purchaseOrderId: { type: "string", required: false },
			/** Admin note for manual issuances */
			note: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	giftCardTransaction: {
		fields: {
			id: { type: "string", required: true },
			giftCardId: { type: "string", required: true },
			/** debit (redemption) | credit (refund/topup) | purchase | topup */
			type: { type: "string", required: true },
			amount: { type: "number", required: true },
			balanceAfter: { type: "number", required: true },
			/** Order that triggered this transaction */
			orderId: { type: "string", required: false },
			/** Customer who initiated the transaction */
			customerId: { type: "string", required: false },
			note: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
