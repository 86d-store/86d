import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const cartCartShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string().optional(),
	guestId: z.string().register(col, { unique: true }).optional(),
	status: z.enum(["active", "abandoned", "converted"]).default("active"),
	expiresAt: z.coerce.date(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const cartCartItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	cartId: z.string().register(col, {
		references: { table: "self.cart", column: "id", onDelete: "cascade" },
	}),
	productId: z.string(),
	variantId: z.string().optional(),
	quantity: z.int().default(1),
	price: z.number(),
	productName: z.string(),
	productSlug: z.string(),
	productImage: z.string().optional(),
	variantName: z.string().optional(),
	variantOptions: z.record(z.string(), z.unknown()).default({}),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for cart. */
export const cartStorage = {
	kind: "relational",
	tables: {
		cart: {
			shape: cartCartShape,
		},
		cartItem: {
			shape: cartCartItemShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
