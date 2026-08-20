import type { ModuleSchema } from "@86d-app/core/types/schema";

export const vendorsSchema = {
	vendor: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			email: { type: "string", required: true },
			phone: { type: "string", required: false },
			description: { type: "string", required: false },
			logo: { type: "string", required: false },
			banner: { type: "string", required: false },
			website: { type: "string", required: false },
			commissionRate: { type: "number", required: true },
			status: { type: "string", required: true },
			addressLine1: { type: "string", required: false },
			addressLine2: { type: "string", required: false },
			city: { type: "string", required: false },
			state: { type: "string", required: false },
			postalCode: { type: "string", required: false },
			country: { type: "string", required: false },
			metadata: { type: "json", required: false },
			joinedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
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
			},
		},
	},
	vendorProduct: {
		fields: {
			id: { type: "string", required: true },
			vendorId: { type: "string", required: true, index: true },
			productId: { type: "string", required: true, index: true },
			commissionOverride: { type: "number", required: false },
			status: { type: "string", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	vendorPayout: {
		fields: {
			id: { type: "string", required: true },
			vendorId: { type: "string", required: true, index: true },
			amount: { type: "number", required: true },
			currency: { type: "string", required: true },
			status: { type: "string", required: true },
			method: { type: "string", required: false },
			reference: { type: "string", required: false },
			periodStart: { type: "date", required: true },
			periodEnd: { type: "date", required: true },
			notes: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			completedAt: { type: "date", required: false },
		},
	},
} satisfies ModuleSchema;
