import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { brandsSchema } from "./schema";
import { createBrandController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Brand,
	BrandController,
	BrandProduct,
	BrandStats,
	BrandWithProductCount,
} from "./service";

export interface BrandsOptions extends ModuleConfig {
	/** Maximum products per brand page listing. Default: 100. */
	maxProductsPerPage?: string;
}

export default function brands(options?: BrandsOptions): Module {
	return {
		id: "brands",
		version: "0.0.1",
		schema: brandsSchema,
		exports: {
			read: ["activeBrands", "featuredBrands", "brandProducts", "productBrand"],
		},
		events: {
			emits: [
				"brand.created",
				"brand.updated",
				"brand.deleted",
				"brand.product.assigned",
				"brand.product.unassigned",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createBrandController(ctx.data, ctx.events);
			return { controllers: { brands: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/brands",
					component: "BrandAdmin",
					label: "Brands",
					icon: "Award",
					group: "Catalog",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/brands",
					component: "BrandList",
				},
			],
		},
		options,
	};
}
