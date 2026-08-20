import type { ModuleSchema } from "@86d-app/core/types/schema";

export const storeLocatorSchema = {
	location: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			name: {
				type: "string",
				required: true,
			},
			slug: {
				type: "string",
				required: true,
				unique: true,
			},
			description: {
				type: "string",
				required: false,
			},
			address: {
				type: "string",
				required: true,
			},
			city: {
				type: "string",
				required: true,
			},
			state: {
				type: "string",
				required: false,
			},
			postalCode: {
				type: "string",
				required: false,
			},
			country: {
				type: "string",
				required: true,
			},
			latitude: {
				type: "number",
				required: true,
			},
			longitude: {
				type: "number",
				required: true,
			},
			phone: {
				type: "string",
				required: false,
			},
			email: {
				type: "string",
				required: false,
			},
			website: {
				type: "string",
				required: false,
			},
			imageUrl: {
				type: "string",
				required: false,
			},
			hours: {
				type: "json",
				required: false,
				defaultValue: {},
			},
			amenities: {
				type: "json",
				required: false,
				defaultValue: [],
			},
			region: {
				type: "string",
				required: false,
			},
			isActive: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			isFeatured: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			pickupEnabled: {
				type: "boolean",
				required: true,
				defaultValue: false,
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
