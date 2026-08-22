import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const wishlistWishlistItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	customerEmail: z.string().optional(),
	productId: z.string(),
	productName: z.string(),
	productImage: z.string().optional(),
	note: z.string().optional(),
	addedAt: z.coerce.date().default(() => new Date()),
});

export const wishlistWishlistShareShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	token: z.string(),
	active: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
	expiresAt: z.coerce.date().optional(),
});

/** Native Relational storage for wishlist. */
export const wishlistStorage = {
	kind: "relational",
	tables: {
		wishlistItem: {
			shape: wishlistWishlistItemShape,
		},
		wishlistShare: {
			shape: wishlistWishlistShareShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
