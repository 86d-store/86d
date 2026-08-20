import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { loyaltyStorage } from "./schema";
import { createLoyaltyController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	LoyaltyAccount,
	LoyaltyController,
	LoyaltyRule,
	LoyaltySummary,
	LoyaltyTier,
	LoyaltyTransaction,
} from "./service";

export interface LoyaltyOptions extends ModuleConfig {
	/** Explicit activation gate. Loyalty is disabled unless set to true. */
	enabled?: boolean;
	/** Points earned per dollar spent (default: 1) */
	pointsPerDollar?: string;
	/** Minimum points required for redemption */
	minRedemption?: string;
	/** Points-to-currency conversion rate (e.g. 100 points = $1) */
	redemptionRate?: string;
}

export default function loyalty(options?: LoyaltyOptions): Module {
	const enabled = options?.enabled === true;

	return {
		id: "loyalty",
		version: "0.0.1",
		storage: loyaltyStorage,
		exports: {
			read: ["loyaltyBalance", "loyaltyTier", "loyaltyLifetimeEarned"],
		},
		requires: ["customers"],
		events: {
			emits: [
				"loyalty.pointsEarned",
				"loyalty.pointsRedeemed",
				"loyalty.tierChanged",
				"loyalty.accountSuspended",
				"loyalty.accountReactivated",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createLoyaltyController(ctx.data);
			return { controllers: { loyalty: controller } };
		},
		...(enabled ? { search: { store: "/loyalty/store-search" } } : {}),
		endpoints: {
			store: enabled ? storeEndpoints : {},
			admin: enabled ? adminEndpoints : {},
		},
		admin: {
			pages: enabled
				? [
						{
							path: "/admin/loyalty",
							component: "LoyaltyOverview",
							label: "Loyalty",
							icon: "Star",
							group: "Customers",
						},
						{
							path: "/admin/loyalty/rules",
							component: "LoyaltyRules",
							label: "Earn Rules",
							icon: "Settings",
							group: "Customers",
						},
						{
							path: "/admin/loyalty/tiers",
							component: "LoyaltyTiers",
							label: "Tiers",
							icon: "Trophy",
							group: "Customers",
						},
					]
				: [],
		},
		store: {
			pages: enabled
				? [
						{
							path: "/loyalty",
							component: "LoyaltyPage",
						},
					]
				: [],
		},
		options,
	};
}
