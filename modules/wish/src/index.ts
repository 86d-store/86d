import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { wishSchema } from "./schema";
import { createWishController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ChannelStats,
	WishController,
	WishOrder,
	WishOrderStatus,
	WishProduct,
	WishProductStatus,
} from "./service";

export interface WishOptions extends ModuleConfig {
	/** Wish API access token */
	accessToken?: string;
	/** Wish merchant ID */
	merchantId?: string;
}

export default function wish(options?: WishOptions): Module {
	return {
		id: "wish",
		version: "0.1.0",
		schema: wishSchema,
		exports: {
			read: [
				"wishProductTitle",
				"wishProductStatus",
				"wishProductPrice",
				"wishProductId",
			],
		},
		events: {
			emits: [
				"wish.product.synced",
				"wish.product.disabled",
				"wish.order.received",
				"wish.order.shipped",
				"wish.refund.created",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createWishController(ctx.data, ctx.events, {
				accessToken: options?.accessToken,
			});
			return { controllers: { wish: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/wish",
					component: "WishAdmin",
					label: "Wish",
					icon: "Star",
					group: "Sales",
				},
			],
		},
		options,
	};
}
