import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const customersCustomerShape = z.object({
	id: z.string().register(col, { pk: true }),
	email: z.string().register(col, { unique: true }),
	firstName: z.string(),
	lastName: z.string(),
	phone: z.string().optional(),
	dateOfBirth: z.coerce.date().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const customersCustomerAddressShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string().register(col, {
		references: { table: "self.customer", column: "id", onDelete: "cascade" },
	}),
	type: z.enum(["billing", "shipping"]).default("shipping"),
	firstName: z.string(),
	lastName: z.string(),
	company: z.string().optional(),
	line1: z.string(),
	line2: z.string().optional(),
	city: z.string(),
	state: z.string(),
	postalCode: z.string(),
	country: z.string(),
	phone: z.string().optional(),
	isDefault: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const customersStoreCustomerAuthBindingShape = z.object({
	id: z.string().register(col, { pk: true }),
	bindingVersion: z.number(),
	customerId: z.string().register(col, {
		unique: true,
		references: {
			table: "self.customer",
			column: "id",
			onDelete: "restrict",
		},
	}),
	authProvider: z.string(),
	authSubjectDigest: z.string().register(col, { index: true }),
	verifiedEmail: z.string().register(col, { index: true }),
	customerCreated: z.boolean(),
	auditBinding: z.record(z.string(), z.unknown()),
	boundAt: z.coerce.date(),
});

export const customersStoreCustomerIdentityLockShape = z.object({
	id: z.string().register(col, { pk: true }),
});

/** Native Relational storage for customers. */
export const customersStorage = {
	kind: "relational",
	tables: {
		customer: {
			shape: customersCustomerShape,
		},
		customerAddress: {
			shape: customersCustomerAddressShape,
		},
		storeCustomerAuthBinding: {
			shape: customersStoreCustomerAuthBindingShape,
		},
		storeCustomerIdentityLock: {
			shape: customersStoreCustomerIdentityLockShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
