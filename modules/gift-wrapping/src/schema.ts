import type { ModuleSchema } from "@86d-app/core/types/schema";

export const giftWrappingSchema = {
	wrapOption: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			/** Price in cents for this wrapping option */
			priceInCents: { type: "number", required: true },
			/** Preview image URL */
			imageUrl: { type: "string", required: false },
			/** Whether this option is available for selection */
			active: { type: "boolean", required: true, defaultValue: true },
			/** Display order */
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
	wrapSelection: {
		fields: {
			id: { type: "string", required: true },
			/** Associated order ID */
			orderId: { type: "string", required: true, index: true },
			/** Order line-item ID */
			orderItemId: { type: "string", required: true, index: true },
			/** Chosen wrapping option */
			wrapOptionId: {
				type: "string",
				required: true,
				references: {
					model: "wrapOption",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Name of the wrapping option (denormalized for order history) */
			wrapOptionName: { type: "string", required: true },
			/** Price charged in cents (snapshot at time of selection) */
			priceInCents: { type: "number", required: true },
			/** Recipient name on the gift tag */
			recipientName: { type: "string", required: false },
			/** Custom gift message */
			giftMessage: { type: "string", required: false },
			/** Customer who selected the wrapping */
			customerId: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
