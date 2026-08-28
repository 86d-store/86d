import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
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

export interface GiftCardOptions extends ModuleConfig {
	/** Default currency for gift cards (default: "USD") */
	defaultCurrency?: string;
	/** Maximum gift card value allowed (default: 10000) */
	maxBalance?: number;
	/** Comma-separated allowed denominations for purchase (e.g. "1000,2500,5000,10000") */
	denominations?: string;
	/** Maximum number of gift cards per bulk creation (default: 100) */
	maxBulkCount?: number;
}

export default function giftCards(options?: GiftCardOptions): Module {
	return {
		id: "gift-cards",
		version: "0.1.0",
		storage: giftcardsStorage,
		capabilities: { provides: [giftCardCheckoutProvider] },
		exports: {
			read: ["giftCardBalance", "giftCardStatus"],
		},
		events: {
			emits: [
				"giftCard.created",
				"giftCard.purchased",
				"giftCard.redeemed",
				"giftCard.credited",
				"giftCard.depleted",
				"giftCard.sent",
				"giftCard.toppedUp",
				"giftCard.expired",
			],
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
				{ path: "/gift-cards/redeem", component: "GiftCardRedeem" },
			],
		},
		options,
	};
}
