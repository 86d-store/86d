import type { ModuleSchema } from "@86d-app/core/types/schema";

export const waitlistSchema = {
	waitlistEntry: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			variantId: { type: "string", required: false },
			variantLabel: { type: "string", required: false },
			email: { type: "string", required: true },
			customerId: { type: "string", required: false },
			status: { type: "string", required: true },
			notifiedAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
