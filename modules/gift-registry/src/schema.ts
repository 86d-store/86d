import type { ModuleSchema } from "@86d-app/core/types/schema";

export const giftRegistrySchema = {
	registry: {
		fields: {
			id: { type: "string", required: true },
			/** Owner customer ID */
			customerId: { type: "string", required: true },
			customerName: { type: "string", required: true },
			title: { type: "string", required: true },
			description: { type: "string", required: false },
			type: {
				type: [
					"wedding",
					"baby",
					"birthday",
					"housewarming",
					"holiday",
					"other",
				] as const,
				required: true,
			},
			/** Unique shareable slug for public URL */
			slug: { type: "string", required: true },
			visibility: {
				type: ["public", "unlisted", "private"] as const,
				required: true,
				defaultValue: "unlisted",
			},
			status: {
				type: ["active", "completed", "archived"] as const,
				required: true,
				defaultValue: "active",
			},
			/** Optional event date (e.g. wedding day) */
			eventDate: { type: "date", required: false },
			/** Cover image URL */
			coverImageUrl: { type: "string", required: false },
			/** Shipping address (encrypted/opaque to purchasers) */
			shippingAddressId: { type: "string", required: false },
			/** Thank-you message shown after purchase */
			thankYouMessage: { type: "string", required: false },
			/** Total items on the registry */
			itemCount: { type: "number", required: true, defaultValue: 0 },
			/** Items that have been fully purchased */
			purchasedCount: { type: "number", required: true, defaultValue: 0 },
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
	registryItem: {
		fields: {
			id: { type: "string", required: true },
			registryId: {
				type: "string",
				required: true,
				references: {
					model: "registry",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			/** Product variant ID (e.g. size/color) */
			variantId: { type: "string", required: false },
			variantName: { type: "string", required: false },
			imageUrl: { type: "string", required: false },
			/** Price per unit in cents */
			priceInCents: { type: "number", required: true },
			/** How many the registrant wants */
			quantityDesired: { type: "number", required: true, defaultValue: 1 },
			/** How many have been purchased */
			quantityReceived: { type: "number", required: true, defaultValue: 0 },
			/** Priority for sorting */
			priority: {
				type: ["must_have", "nice_to_have", "dream"] as const,
				required: true,
				defaultValue: "nice_to_have",
			},
			/** Registrant's personal note about why they want this item */
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
				onUpdate: () => new Date(),
			},
		},
	},
	registryPurchase: {
		fields: {
			id: { type: "string", required: true },
			registryId: {
				type: "string",
				required: true,
				references: {
					model: "registry",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			registryItemId: {
				type: "string",
				required: true,
				references: {
					model: "registryItem",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** Purchaser customer ID (null for guest purchases) */
			purchaserId: { type: "string", required: false },
			purchaserName: { type: "string", required: true },
			/** Quantity purchased */
			quantity: { type: "number", required: true, defaultValue: 1 },
			/** Total amount paid in cents */
			amountInCents: { type: "number", required: true },
			/** Associated order ID */
			orderId: { type: "string", required: false },
			/** Gift message from purchaser */
			giftMessage: { type: "string", required: false },
			/** Whether the registrant can see who purchased */
			isAnonymous: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
