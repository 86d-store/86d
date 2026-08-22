import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const savedAddressesAddressShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	label: z.string().optional(),
	firstName: z.string(),
	lastName: z.string(),
	company: z.string().optional(),
	line1: z.string(),
	line2: z.string().optional(),
	city: z.string(),
	state: z.string().optional(),
	postalCode: z.string(),
	country: z.string(),
	phone: z.string().optional(),
	isDefault: z.boolean().default(false),
	isDefaultBilling: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for saved-addresses. */
export const savedAddressesStorage = {
	kind: "relational",
	tables: {
		address: {
			shape: savedAddressesAddressShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
