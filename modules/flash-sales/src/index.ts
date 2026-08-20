import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { flashSalesStorage } from "./schema";
import { createFlashSaleController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ActiveFlashSaleProduct,
	FlashSale,
	FlashSaleController,
	FlashSaleProduct,
	FlashSaleStats,
	FlashSaleStatus,
	FlashSaleWithProducts,
} from "./service";

export interface FlashSalesOptions extends ModuleConfig {
	/** Maximum number of products per flash sale. Default: no limit. */
	maxProductsPerSale?: number;
}

export default function flashSales(options?: FlashSalesOptions): Module {
	return {
		id: "flash-sales",
		version: "0.0.1",
		storage: flashSalesStorage,
		requires: ["products"],
		exports: {
			read: [
				"activeFlashSales",
				"flashSalePrice",
				"flashSaleCountdown",
				"flashSaleStockRemaining",
			],
		},
		events: {
			emits: [
				"flash-sale.created",
				"flash-sale.updated",
				"flash-sale.deleted",
				"flash-sale.started",
				"flash-sale.ended",
				"flash-sale.product.added",
				"flash-sale.product.removed",
				"flash-sale.product.sold",
				"flash-sale.product.sold-out",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createFlashSaleController(ctx.data);
			return { controllers: { flashSales: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/flash-sales",
					component: "FlashSaleList",
					label: "Flash Sales",
					icon: "Lightning",
					group: "Sales",
				},
				{
					path: "/admin/flash-sales/:id",
					component: "FlashSaleDetail",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/flash-sales",
					component: "FlashSaleListing",
				},
				{
					path: "/flash-sales/:slug",
					component: "FlashSaleDetail",
				},
			],
		},
		options,
	};
}
