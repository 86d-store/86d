import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { bulkPricingSchema } from "./schema";
import { createBulkPricingController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	BulkPricingController,
	BulkPricingSummary,
	DiscountType,
	PricingRule,
	PricingScope,
	PricingTier,
	ResolvedBulkPrice,
	TierPreview,
} from "./service";

export interface BulkPricingOptions extends ModuleConfig {
	/** Default priority for new pricing rules. Default: 0. */
	defaultPriority?: number;
}

export default function bulkPricing(options?: BulkPricingOptions): Module {
	return {
		id: "bulk-pricing",
		version: "0.0.1",
		schema: bulkPricingSchema,
		requires: ["products"],
		exports: {
			read: ["resolvedBulkPrice", "pricingTiers", "pricingRules"],
		},
		events: {
			emits: [
				"bulk-pricing.rule.created",
				"bulk-pricing.rule.updated",
				"bulk-pricing.rule.deleted",
				"bulk-pricing.tier.created",
				"bulk-pricing.tier.updated",
				"bulk-pricing.tier.deleted",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createBulkPricingController(ctx.data);
			return { controllers: { bulkPricing: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/bulk-pricing",
					component: "BulkPricingList",
					label: "Bulk Pricing",
					icon: "Stack",
					group: "Catalog",
				},
				{
					path: "/admin/bulk-pricing/:id",
					component: "BulkPricingDetail",
				},
			],
		},
		options,
	};
}
