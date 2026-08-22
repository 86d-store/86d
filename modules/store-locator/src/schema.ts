import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const storeLocatorLocationShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	address: z.string(),
	city: z.string(),
	state: z.string().optional(),
	postalCode: z.string().optional(),
	country: z.string(),
	latitude: z.number(),
	longitude: z.number(),
	phone: z.string().optional(),
	email: z.string().optional(),
	website: z.string().optional(),
	imageUrl: z.string().optional(),
	hours: z.record(z.string(), z.unknown()).default({}),
	amenities: z.array(z.unknown()).default([]),
	region: z.string().optional(),
	isActive: z.boolean().default(true),
	isFeatured: z.boolean().default(false),
	pickupEnabled: z.boolean().default(false),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for store-locator. */
export const storeLocatorStorage = {
	kind: "relational",
	tables: {
		location: {
			shape: storeLocatorLocationShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
