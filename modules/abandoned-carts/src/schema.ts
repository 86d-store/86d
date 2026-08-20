import type { ModuleSchema } from "@86d-app/core/types/schema";

export const abandonedCartSchema = {
	abandonedCart: {
		fields: {
			id: { type: "string", required: true },
			/** Session or cart ID from the cart module */
			cartId: { type: "string", required: true },
			/** Customer ID if logged in */
			customerId: { type: "string", required: false },
			/** Email address (from customer or entered at checkout) */
			email: { type: "string", required: false },
			/** Cart items snapshot at time of abandonment */
			items: { type: "json", required: true, defaultValue: [] },
			/** Total cart value at time of abandonment */
			cartTotal: { type: "number", required: true },
			/** Currency code */
			currency: { type: "string", required: true, defaultValue: "USD" },
			/** active | recovered | expired | dismissed */
			status: { type: "string", required: true, defaultValue: "active" },
			/** Unique token for recovery link */
			recoveryToken: { type: "string", required: true },
			/** Number of recovery attempts sent */
			attemptCount: { type: "number", required: true, defaultValue: 0 },
			/** When the last activity on the cart occurred */
			lastActivityAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			/** When the cart was marked as abandoned */
			abandonedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			/** When the cart was recovered (converted to order) */
			recoveredAt: { type: "date", required: false },
			/** Order ID if recovered */
			recoveredOrderId: { type: "string", required: false },
			/** Metadata for extensibility */
			metadata: { type: "json", required: false, defaultValue: {} },
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
	recoveryAttempt: {
		fields: {
			id: { type: "string", required: true },
			/** Reference to the abandoned cart */
			abandonedCartId: { type: "string", required: true },
			/** email | sms | push */
			channel: { type: "string", required: true },
			/** Recipient address (email, phone, etc.) */
			recipient: { type: "string", required: true },
			/** sent | delivered | opened | clicked | failed */
			status: { type: "string", required: true, defaultValue: "sent" },
			/** Subject line or message preview */
			subject: { type: "string", required: false },
			/** When the recipient opened the message */
			openedAt: { type: "date", required: false },
			/** When the recipient clicked the recovery link */
			clickedAt: { type: "date", required: false },
			sentAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
