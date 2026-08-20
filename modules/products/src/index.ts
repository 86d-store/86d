import { acceptCapability } from "@86d-app/core/capabilities";
import { inventoryCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import { catalogPublishedV1 } from "@86d-app/core/durable-events";
import type { Module, ModuleConfig } from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { productResolveProvider } from "./capabilities";
import { catalogPresentationConsumer } from "./catalog-presentation";
import {
	applyCatalogRevisionOperation,
	catalogDraftCommandInputSchema,
	catalogRevisionCategorySchema,
	catalogRevisionContentSchema,
	catalogRevisionOperationDecisionSchema,
	catalogRevisionOperationFailureCodeSchema,
	catalogRevisionOperationInputSchema,
	catalogRevisionProductSchema,
	catalogRevisionRecordSchema,
	catalogRevisionStateSchema,
	catalogRevisionVariantSchema,
	catalogTransitionCommandInputSchema,
	catalogTransitionTransportSchema,
	digestCatalogRevisionContent,
} from "./catalog-revisions";
import { controllers } from "./controllers";
import {
	toMarkdownCollectionDetail,
	toMarkdownCollectionListing,
	toMarkdownProductDetail,
	toMarkdownProductListing,
} from "./markdown";
import { productsStorage } from "./schema";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	CatalogRevisionContent,
	CatalogRevisionOperationContext,
	CatalogRevisionOperationDecision,
	CatalogRevisionOperationFailureCode,
	CatalogRevisionOperationInput,
	CatalogRevisionOperationResult,
	CatalogRevisionRecord,
	CatalogRevisionState,
} from "./catalog-revisions";
export {
	applyCatalogRevisionOperation,
	catalogDraftCommandInputSchema,
	catalogRevisionCategorySchema,
	catalogRevisionContentSchema,
	catalogRevisionOperationDecisionSchema,
	catalogRevisionOperationFailureCodeSchema,
	catalogRevisionOperationInputSchema,
	catalogRevisionProductSchema,
	catalogRevisionRecordSchema,
	catalogRevisionStateSchema,
	catalogRevisionVariantSchema,
	catalogTransitionCommandInputSchema,
	catalogTransitionTransportSchema,
	digestCatalogRevisionContent,
};

export interface ProductsOptions extends ModuleConfig {
	/**
	 * Default number of products per page
	 * @default 20
	 */
	defaultPageSize?: number;
	/**
	 * Maximum number of products per page
	 * @default 100
	 */
	maxPageSize?: number;
	/**
	 * Enable inventory tracking by default
	 * @default true
	 */
	trackInventory?: boolean;
}

export default function products(options?: ProductsOptions): Module {
	return {
		id: "products",
		version: "0.0.1",
		storage: productsStorage,
		exports: {
			read: [
				"productTitle",
				"productPrice",
				"productSlug",
				"productStatus",
				"categoryName",
				"categorySlug",
				"collectionName",
				"collectionSlug",
			],
		},
		events: {
			emits: ["product.created", "product.updated", "product.deleted"],
		},
		durableEvents: {
			emits: [catalogPublishedV1],
			handles: [catalogPresentationConsumer],
		},
		controllers,
		capabilities: {
			provides: [productResolveProvider],
			accepts: [
				acceptCapability(inventoryCheckoutCapability, {
					operations: ["set"],
					optional: true,
				}),
			],
		},
		options,
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		search: { store: "/products/store-search" },
		admin: {
			pages: [
				{
					path: "/admin/products",
					component: "ProductList",
					label: "Products",
					icon: "Package",
					group: "Catalog",
				},
				{
					path: "/admin/products/new",
					component: "ProductNew",
				},
				{
					path: "/admin/products/:id/edit",
					component: "ProductEdit",
				},
				{
					path: "/admin/products/:id",
					component: "ProductDetail",
				},
				{
					path: "/admin/categories",
					component: "CategoriesAdmin",
					label: "Categories",
					icon: "SquaresFour",
					group: "Catalog",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/products",
					component: "ProductListing",
					toMarkdown: toMarkdownProductListing,
				},
				{
					path: "/products/:slug",
					component: "ProductDetail",
					toMarkdown: toMarkdownProductDetail,
				},
				{
					path: "/collections",
					component: "CollectionGrid",
					toMarkdown: toMarkdownCollectionListing,
				},
				{
					path: "/collections/:slug",
					component: "CollectionDetail",
					toMarkdown: toMarkdownCollectionDetail,
				},
			],
		},
	};
}
