import { acceptCapability } from "@86d-app/core/capabilities";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { giftWrappingSchema } from "./schema";
import { createGiftWrappingController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export interface GiftWrappingOptions extends ModuleConfig {
	/** Maximum gift message length in characters. Default: 500. */
	maxMessageLength?: number;
}

export default function giftWrapping(options?: GiftWrappingOptions): Module {
	return {
		id: "gift-wrapping",
		version: "0.0.1",
		schema: giftWrappingSchema,

		capabilities: {
			accepts: [acceptCapability(orderCustomerAuthorizeCapability)],
		},

		exports: {
			read: ["wrapOptions", "orderWrappingTotal", "itemWrapping"],
		},

		events: {
			emits: [
				"gift-wrapping.option.created",
				"gift-wrapping.option.updated",
				"gift-wrapping.option.deleted",
				"gift-wrapping.selected",
				"gift-wrapping.removed",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createGiftWrappingController(ctx.data);
			return {
				controllers: { giftWrapping: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/gift-wrapping",
					component: "WrapOptionList",
					label: "Gift Wrapping",
					icon: "Gift",
					group: "Sales",
				},
				{
					path: "/admin/gift-wrapping/:id",
					component: "WrapOptionDetail",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/gift-wrapping",
					component: "WrapOptionBrowse",
				},
			],
		},

		options,
	};
}

export type {
	GiftWrappingController,
	ListOptionsParams,
	OrderWrappingTotal,
	SelectWrappingParams,
	WrapOption,
	WrapSelection,
	WrapSummary,
} from "./service";
