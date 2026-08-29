import type { Module, ModuleContext } from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { giftCardCheckoutProvider } from "./capabilities";
import { giftcardsStorage } from "./schema";
import { createGiftCardController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	GiftCard,
	GiftCardController,
	GiftCardStats,
	GiftCardTransaction,
} from "./service";

export type GiftCardOptions = Record<string, never>;

export default function giftCards(_options?: GiftCardOptions): Module {
	return {
		id: "gift-cards",
		version: "0.1.0",
		storage: giftcardsStorage,
		capabilities: { provides: [giftCardCheckoutProvider] },
		exports: {
			read: ["giftCardBalance", "giftCardStatus"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createGiftCardController(ctx.data, ctx.transactions);
			return { controllers: { giftCards: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/gift-cards",
					component: "GiftCardOverview",
					label: "Gift Cards",
					icon: "Gift",
					group: "Sales",
				},
			],
		},
		store: {
			pages: [
				{ path: "/gift-cards", component: "GiftCardLanding" },
				{ path: "/gift-cards/balance", component: "GiftCardBalance" },
			],
		},
	};
}
