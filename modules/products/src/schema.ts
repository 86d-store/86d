import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const productsSchema = {
	product: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			name: {
				type: "string",
				required: true,
			},
			slug: {
				type: "string",
				required: true,
				unique: true,
			},
			description: {
				type: "string",
				required: false,
			},
			shortDescription: {
				type: "string",
				required: false,
			},
			price: {
				type: "number",
				required: true,
			},
			compareAtPrice: {
				type: "number",
				required: false,
			},
			costPrice: {
				type: "number",
				required: false,
			},
			sku: {
				type: "string",
				required: false,
				unique: true,
			},
			barcode: {
				type: "string",
				required: false,
			},
			inventory: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			trackInventory: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			allowBackorder: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			status: {
				type: ["draft", "active", "archived"],
				required: true,
				defaultValue: "draft",
			},
			categoryId: {
				type: "string",
				required: false,
				references: {
					model: "category",
					field: "id",
					onDelete: "set null",
				},
			},
			images: {
				type: "json",
				required: false,
				defaultValue: [],
			},
			tags: {
				type: "json",
				required: false,
				defaultValue: [],
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
			weight: {
				type: "number",
				required: false,
			},
			weightUnit: {
				type: ["kg", "lb", "oz", "g"],
				required: false,
				defaultValue: "kg",
			},
			isFeatured: {
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
	productVariant: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			productId: {
				type: "string",
				required: true,
				references: {
					model: "product",
					field: "id",
					onDelete: "cascade",
				},
			},
			name: {
				type: "string",
				required: true,
			},
			sku: {
				type: "string",
				required: false,
				unique: true,
			},
			barcode: {
				type: "string",
				required: false,
			},
			price: {
				type: "number",
				required: true,
			},
			compareAtPrice: {
				type: "number",
				required: false,
			},
			costPrice: {
				type: "number",
				required: false,
			},
			inventory: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			options: {
				type: "json",
				required: true,
				defaultValue: {},
			},
			images: {
				type: "json",
				required: false,
				defaultValue: [],
			},
			weight: {
				type: "number",
				required: false,
			},
			weightUnit: {
				type: ["kg", "lb", "oz", "g"],
				required: false,
			},
			position: {
				type: "number",
				required: true,
				defaultValue: 0,
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
	category: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			name: {
				type: "string",
				required: true,
			},
			slug: {
				type: "string",
				required: true,
				unique: true,
			},
			description: {
				type: "string",
				required: false,
			},
			parentId: {
				type: "string",
				required: false,
				references: {
					model: "category",
					field: "id",
					onDelete: "set null",
				},
			},
			image: {
				type: "string",
				required: false,
			},
			position: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			isVisible: {
				type: "boolean",
				required: true,
				defaultValue: true,
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
	collection: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			name: {
				type: "string",
				required: true,
			},
			slug: {
				type: "string",
				required: true,
				unique: true,
			},
			description: {
				type: "string",
				required: false,
			},
			image: {
				type: "string",
				required: false,
			},
			isFeatured: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			isVisible: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			position: {
				type: "number",
				required: true,
				defaultValue: 0,
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
	collectionProduct: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			collectionId: {
				type: "string",
				required: true,
				references: {
					model: "collection",
					field: "id",
					onDelete: "cascade",
				},
			},
			productId: {
				type: "string",
				required: true,
				references: {
					model: "product",
					field: "id",
					onDelete: "cascade",
				},
			},
			position: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	/** Immutable Product, Variant, and accepted Category publication snapshot. */
	catalogRevision: {
		fields: {
			id: { type: "string", required: true },
			sequence: { type: "number", required: true, unique: true },
			state: {
				type: ["draft", "reviewed", "published", "superseded", "failed"],
				required: true,
				index: true,
			},
			baseRevisionId: { type: "string", required: false, index: true },
			contentVersion: { type: "number", required: true },
			contentDigest: { type: "string", required: true, index: true },
			content: { type: "json", required: true },
			createdAt: { type: "date", required: true },
			createdBy: { type: "json", required: true },
			createdAuthorityId: { type: "string", required: true },
			reviewedAt: { type: "date", required: false },
			reviewedBy: { type: "json", required: false },
			reviewedAuthorityId: { type: "string", required: false },
			publishedAt: { type: "date", required: false },
			publishedBy: { type: "json", required: false },
			publishedAuthorityId: { type: "string", required: false },
			supersededAt: { type: "date", required: false },
			supersededByRevisionId: {
				type: "string",
				required: false,
				index: true,
			},
			failedAt: { type: "date", required: false },
			failedBy: { type: "json", required: false },
			failedAuthorityId: { type: "string", required: false },
			failedFromState: { type: ["draft", "reviewed"], required: false },
			failureReason: { type: "string", required: false },
		},
	},
	/** One protected pointer serializes draft numbering and publication CAS. */
	catalogRevisionHead: {
		fields: {
			id: { type: "string", required: true },
			nextSequence: { type: "number", required: true },
			publishedRevisionId: { type: "string", required: false },
			publishedContentDigest: { type: "string", required: false },
			updatedAt: { type: "date", required: true },
		},
	},
	/** Stable row acquired with FOR UPDATE before any Catalog transition. */
	catalogRevisionLock: {
		fields: {
			id: { type: "string", required: true },
		},
	},
	/** Append-only transition explanation keyed by operation identity. */
	catalogRevisionAudit: {
		fields: {
			id: { type: "string", required: true },
			revisionId: { type: "string", required: true, index: true },
			fromState: {
				type: ["draft", "reviewed", "published", "superseded", "failed"],
				required: false,
			},
			toState: {
				type: ["draft", "reviewed", "published", "superseded", "failed"],
				required: true,
			},
			actor: { type: "json", required: true },
			authorityId: { type: "string", required: true },
			commandExecutionId: { type: "string", required: false, index: true },
			occurredAt: { type: "date", required: true },
		},
	},
	/** Successful transition receipt prevents duplicate effects on Command retry. */
	catalogRevisionOperation: {
		fields: {
			id: { type: "string", required: true },
			action: {
				type: ["create_draft", "review", "publish", "fail"],
				required: true,
			},
			revisionId: { type: "string", required: true, index: true },
			requestDigest: { type: "string", required: true },
			decision: { type: "json", required: true },
			createdAt: { type: "date", required: true },
		},
	},
	/** Atomic Storefront, search, and feed read state for one publication. */
	catalogPresentation: {
		fields: {
			id: { type: "string", required: true },
			revisionId: { type: "string", required: true, index: true },
			revisionSequence: { type: "number", required: true, index: true },
			contentVersion: { type: "number", required: true },
			contentDigest: { type: "string", required: true, index: true },
			currency: { type: "string", required: true },
			projectedAt: { type: "date", required: true },
			storefront: { type: "json", required: true },
			search: { type: "json", required: true },
			feeds: { type: "json", required: true },
		},
	},
} satisfies ModuleSchema;

export const productsTables = transcodeModuleSchema(productsSchema);
