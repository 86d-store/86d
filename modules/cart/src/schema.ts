import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const cartSchema = {
	cart: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			customerId: {
				type: "string",
				required: false,
			},
			guestId: {
				type: "string",
				required: false,
				unique: true,
			},
			status: {
				type: ["active", "abandoned", "converted"],
				required: true,
				defaultValue: "active",
			},
			expiresAt: {
				type: "date",
				required: true,
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
	cartItem: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			cartId: {
				type: "string",
				required: true,
				references: {
					model: "cart",
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
			quantity: {
				type: "number",
				required: true,
				defaultValue: 1,
			},
			price: {
				type: "number",
				required: true,
			},
			productName: {
				type: "string",
				required: true,
			},
			productSlug: {
				type: "string",
				required: true,
			},
			productImage: {
				type: "string",
				required: false,
			},
			variantName: {
				type: "string",
				required: false,
			},
			variantOptions: {
				type: "json",
				required: false,
				defaultValue: {},
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
} satisfies ModuleSchema;

export const cartTables = transcodeModuleSchema(cartSchema);
