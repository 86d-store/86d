import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const productsProductShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	shortDescription: z.string().optional(),
	price: z.number(),
	compareAtPrice: z.number().optional(),
	costPrice: z.number().optional(),
	sku: z.string().register(col, { unique: true }).optional(),
	barcode: z.string().optional(),
	inventory: z.int().default(0),
	trackInventory: z.boolean().default(true),
	allowBackorder: z.boolean().default(false),
	status: z.enum(["draft", "active", "archived"]).default("draft"),
	categoryId: z
		.string()
		.register(col, {
			references: {
				table: "self.category",
				column: "id",
				onDelete: "set null",
			},
		})
		.optional(),
	images: z.array(z.unknown()).default([]),
	tags: z.array(z.unknown()).default([]),
	metadata: z.record(z.string(), z.unknown()).default({}),
	weight: z.number().optional(),
	weightUnit: z.enum(["kg", "lb", "oz", "g"]).default("kg"),
	isFeatured: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const productsProductVariantShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string().register(col, {
		references: { table: "self.product", column: "id", onDelete: "cascade" },
	}),
	name: z.string(),
	sku: z.string().register(col, { unique: true }).optional(),
	barcode: z.string().optional(),
	price: z.number(),
	compareAtPrice: z.number().optional(),
	costPrice: z.number().optional(),
	inventory: z.int().default(0),
	options: z.record(z.string(), z.unknown()).default({}),
	images: z.array(z.unknown()).default([]),
	weight: z.number().optional(),
	weightUnit: z.enum(["kg", "lb", "oz", "g"]).optional(),
	position: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const productsCategoryShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	parentId: z
		.string()
		.register(col, {
			references: {
				table: "self.category",
				column: "id",
				onDelete: "set null",
			},
		})
		.optional(),
	image: z.string().optional(),
	position: z.int().default(0),
	isVisible: z.boolean().default(true),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const productsCollectionShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	image: z.string().optional(),
	isFeatured: z.boolean().default(false),
	isVisible: z.boolean().default(true),
	position: z.int().default(0),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const productsCollectionProductShape = z.object({
	id: z.string().register(col, { pk: true }),
	collectionId: z.string().register(col, {
		references: {
			table: "self.collection",
			column: "id",
			onDelete: "cascade",
		},
	}),
	productId: z.string().register(col, {
		references: { table: "self.product", column: "id", onDelete: "cascade" },
	}),
	position: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const productsCatalogRevisionShape = z.object({
	id: z.string().register(col, { pk: true }),
	sequence: z.number().register(col, { unique: true }),
	state: z
		.enum(["draft", "reviewed", "published", "superseded", "failed"])
		.register(col, { index: true }),
	baseRevisionId: z.string().register(col, { index: true }).optional(),
	contentVersion: z.number(),
	contentDigest: z.string().register(col, { index: true }),
	content: z.record(z.string(), z.unknown()),
	createdAt: z.coerce.date(),
	createdBy: z.record(z.string(), z.unknown()),
	createdAuthorityId: z.string(),
	reviewedAt: z.coerce.date().optional(),
	reviewedBy: z.record(z.string(), z.unknown()).optional(),
	reviewedAuthorityId: z.string().optional(),
	publishedAt: z.coerce.date().optional(),
	publishedBy: z.record(z.string(), z.unknown()).optional(),
	publishedAuthorityId: z.string().optional(),
	supersededAt: z.coerce.date().optional(),
	supersededByRevisionId: z.string().register(col, { index: true }).optional(),
	failedAt: z.coerce.date().optional(),
	failedBy: z.record(z.string(), z.unknown()).optional(),
	failedAuthorityId: z.string().optional(),
	failedFromState: z.enum(["draft", "reviewed"]).optional(),
	failureReason: z.string().optional(),
});

export const productsCatalogRevisionHeadShape = z.object({
	id: z.string().register(col, { pk: true }),
	nextSequence: z.number(),
	publishedRevisionId: z.string().optional(),
	publishedContentDigest: z.string().optional(),
	updatedAt: z.coerce.date(),
});

export const productsCatalogRevisionLockShape = z.object({
	id: z.string().register(col, { pk: true }),
});

export const productsCatalogRevisionAuditShape = z.object({
	id: z.string().register(col, { pk: true }),
	revisionId: z.string().register(col, { index: true }),
	fromState: z
		.enum(["draft", "reviewed", "published", "superseded", "failed"])
		.optional(),
	toState: z.enum(["draft", "reviewed", "published", "superseded", "failed"]),
	actor: z.record(z.string(), z.unknown()),
	authorityId: z.string(),
	commandExecutionId: z.string().register(col, { index: true }).optional(),
	occurredAt: z.coerce.date(),
});

export const productsCatalogRevisionOperationShape = z.object({
	id: z.string().register(col, { pk: true }),
	action: z.enum(["create_draft", "review", "publish", "fail"]),
	revisionId: z.string().register(col, { index: true }),
	requestDigest: z.string(),
	decision: z.record(z.string(), z.unknown()),
	createdAt: z.coerce.date(),
});

export const productsCatalogPresentationShape = z.object({
	id: z.string().register(col, { pk: true }),
	revisionId: z.string().register(col, { index: true }),
	revisionSequence: z.number().register(col, { index: true }),
	contentVersion: z.number(),
	contentDigest: z.string().register(col, { index: true }),
	currency: z.string(),
	projectedAt: z.coerce.date(),
	storefront: z.record(z.string(), z.unknown()),
	search: z.record(z.string(), z.unknown()),
	feeds: z.record(z.string(), z.unknown()),
});

/** Native Relational storage for products. */
export const productsStorage = {
	kind: "relational",
	tables: {
		product: {
			shape: productsProductShape,
		},
		productVariant: {
			shape: productsProductVariantShape,
		},
		category: {
			shape: productsCategoryShape,
		},
		collection: {
			shape: productsCollectionShape,
		},
		collectionProduct: {
			shape: productsCollectionProductShape,
		},
		catalogRevision: {
			shape: productsCatalogRevisionShape,
		},
		catalogRevisionHead: {
			shape: productsCatalogRevisionHeadShape,
		},
		catalogRevisionLock: {
			shape: productsCatalogRevisionLockShape,
		},
		catalogRevisionAudit: {
			shape: productsCatalogRevisionAuditShape,
		},
		catalogRevisionOperation: {
			shape: productsCatalogRevisionOperationShape,
		},
		catalogPresentation: {
			shape: productsCatalogPresentationShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
