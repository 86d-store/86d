import type { ModuleSchema } from "@86d-app/core/types/schema";

export const brandsSchema = {
	brand: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			description: { type: "string", required: false },
			logo: { type: "string", required: false },
			bannerImage: { type: "string", required: false },
			website: { type: "string", required: false },
			isActive: { type: "boolean", required: true },
			isFeatured: { type: "boolean", required: true },
			position: { type: "number", required: true },
			seoTitle: { type: "string", required: false },
			seoDescription: { type: "string", required: false },
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
	brandProduct: {
		fields: {
			id: { type: "string", required: true },
			brandId: { type: "string", required: true, index: true },
			productId: { type: "string", required: true, index: true },
			assignedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
