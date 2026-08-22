import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const giftRegistryRegistryShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	customerName: z.string(),
	title: z.string(),
	description: z.string().optional(),
	type: z.enum([
		"wedding",
		"baby",
		"birthday",
		"housewarming",
		"holiday",
		"other",
	]),
	slug: z.string(),
	visibility: z.enum(["public", "unlisted", "private"]).default("unlisted"),
	status: z.enum(["active", "completed", "archived"]).default("active"),
	eventDate: z.coerce.date().optional(),
	coverImageUrl: z.string().optional(),
	shippingAddressId: z.string().optional(),
	thankYouMessage: z.string().optional(),
	itemCount: z.int().default(0),
	purchasedCount: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const giftRegistryRegistryItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	registryId: z.string().register(col, {
		references: { table: "self.registry", column: "id", onDelete: "cascade" },
	}),
	productId: z.string(),
	productName: z.string(),
	variantId: z.string().optional(),
	variantName: z.string().optional(),
	imageUrl: z.string().optional(),
	priceInCents: z.number(),
	quantityDesired: z.int().default(1),
	quantityReceived: z.int().default(0),
	priority: z
		.enum(["must_have", "nice_to_have", "dream"])
		.default("nice_to_have"),
	note: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const giftRegistryRegistryPurchaseShape = z.object({
	id: z.string().register(col, { pk: true }),
	registryId: z.string().register(col, {
		references: { table: "self.registry", column: "id", onDelete: "cascade" },
	}),
	registryItemId: z.string().register(col, {
		references: {
			table: "self.registryItem",
			column: "id",
			onDelete: "cascade",
		},
	}),
	purchaserId: z.string().optional(),
	purchaserName: z.string(),
	quantity: z.int().default(1),
	amountInCents: z.number(),
	orderId: z.string().optional(),
	giftMessage: z.string().optional(),
	isAnonymous: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for gift-registry. */
export const giftRegistryStorage = {
	kind: "relational",
	tables: {
		registry: {
			shape: giftRegistryRegistryShape,
		},
		registryItem: {
			shape: giftRegistryRegistryItemShape,
		},
		registryPurchase: {
			shape: giftRegistryRegistryPurchaseShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
