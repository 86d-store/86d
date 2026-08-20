import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { collectionsSchema, collectionsTables } from "./schema";
import { createCollectionController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Collection,
	CollectionCondition,
	CollectionConditions,
	CollectionController,
	CollectionProduct,
	CollectionSortOrder,
	CollectionStats,
	CollectionType,
	CollectionWithProductCount,
} from "./service";

export interface CollectionsOptions extends ModuleConfig {
	/** Maximum products per collection. Default: 500. */
	maxProductsPerCollection?: string;
}

export default function collections(options?: CollectionsOptions): Module {
	return {
		id: "collections",
		version: "0.0.1",
		schema: collectionsSchema,
		tables: collectionsTables,
		exports: {
			read: [
				"activeCollections",
				"featuredCollections",
				"collectionProducts",
				"productCollections",
			],
		},
		events: {
			emits: [
				"collection.created",
				"collection.updated",
				"collection.deleted",
				"collection.product.added",
				"collection.product.removed",
				"collection.products.reordered",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createCollectionController(ctx.data);
			return { controllers: { collections: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/collections",
					component: "CollectionAdmin",
					label: "Collections",
					icon: "FolderOpen",
					group: "Catalog",
				},
			],
		},
		options,
	};
}
