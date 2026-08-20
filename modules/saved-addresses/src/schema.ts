import type { ModuleSchema } from "@86d-app/core/types/schema";

export const savedAddressesSchema = {
	address: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true },
			label: { type: "string", required: false },
			firstName: { type: "string", required: true },
			lastName: { type: "string", required: true },
			company: { type: "string", required: false },
			line1: { type: "string", required: true },
			line2: { type: "string", required: false },
			city: { type: "string", required: true },
			state: { type: "string", required: false },
			postalCode: { type: "string", required: true },
			country: { type: "string", required: true },
			phone: { type: "string", required: false },
			isDefault: { type: "boolean", required: true, defaultValue: false },
			isDefaultBilling: {
				type: "boolean",
				required: true,
				defaultValue: false,
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
} satisfies ModuleSchema;
