import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";
import { storeCustomerAuditBindingSchema } from "./identity-binding";

export const customersSchema = {
	customer: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			email: {
				type: "string",
				required: true,
				unique: true,
			},
			firstName: {
				type: "string",
				required: true,
			},
			lastName: {
				type: "string",
				required: true,
			},
			phone: {
				type: "string",
				required: false,
			},
			dateOfBirth: {
				type: "date",
				required: false,
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
	customerAddress: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			customerId: {
				type: "string",
				required: true,
				references: {
					model: "customer",
					field: "id",
					onDelete: "cascade",
				},
			},
			type: {
				type: ["billing", "shipping"],
				required: true,
				defaultValue: "shipping",
			},
			firstName: {
				type: "string",
				required: true,
			},
			lastName: {
				type: "string",
				required: true,
			},
			company: {
				type: "string",
				required: false,
			},
			line1: {
				type: "string",
				required: true,
			},
			line2: {
				type: "string",
				required: false,
			},
			city: {
				type: "string",
				required: true,
			},
			state: {
				type: "string",
				required: true,
			},
			postalCode: {
				type: "string",
				required: true,
			},
			country: {
				type: "string",
				required: true,
			},
			phone: {
				type: "string",
				required: false,
			},
			isDefault: {
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
				onUpdate: () => new Date(),
			},
		},
	},
	/** One verified authentication principal bound to one Store Customer. */
	storeCustomerAuthBinding: {
		fields: {
			id: { type: "string", required: true },
			bindingVersion: { type: "number", required: true },
			customerId: {
				type: "string",
				required: true,
				unique: true,
				references: {
					model: "customer",
					field: "id",
					onDelete: "restrict",
				},
			},
			authProvider: { type: "string", required: true },
			authSubjectDigest: { type: "string", required: true, index: true },
			verifiedEmail: { type: "string", required: true, index: true },
			customerCreated: { type: "boolean", required: true },
			auditBinding: {
				type: "json",
				required: true,
				validator: {
					input: storeCustomerAuditBindingSchema,
					output: storeCustomerAuditBindingSchema,
				},
			},
			boundAt: { type: "date", required: true },
		},
	},
	/** Stable owner-local rows that serialize principal and normalized-email claims. */
	storeCustomerIdentityLock: {
		fields: {
			id: { type: "string", required: true },
		},
	},
} satisfies ModuleSchema;

export const customersTables = transcodeModuleSchema(customersSchema);
