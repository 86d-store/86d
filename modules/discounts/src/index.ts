import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { discountCodeProvider } from "./capabilities";
import { discountsSchema, discountsTables } from "./schema";
import { createDiscountController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

// Export types for inter-module contracts (e.g., checkout module)
export type {
	ApplyResult,
	BulkCodeResult,
	CartAutoDiscountResult,
	CartPriceRule,
	CartPriceRuleApplyResult,
	CartPriceRuleCondition,
	CartPriceRuleConditionType,
	CodeStats,
	Discount,
	DiscountAnalytics,
	DiscountAppliesTo,
	DiscountCode,
	DiscountController,
	DiscountSummary,
	DiscountType,
} from "./service";

export interface DiscountsOptions extends ModuleConfig {
	/**
	 * Whether to allow stacking multiple discounts by default
	 * @default false
	 */
	allowStacking?: boolean;
}

/**
 * Discounts module factory.
 * Provides promo codes, percentage/fixed/free-shipping discounts.
 *
 * Other modules (e.g., checkout) can apply discounts by getting the
 * `discount` controller from the runtime context.
 */
export default function discounts(options?: DiscountsOptions): Module {
	return {
		id: "discounts",
		version: "0.0.1",
		schema: discountsSchema,
		tables: discountsTables,
		capabilities: { provides: [discountCodeProvider] },
		exports: {
			read: ["discountValidation", "discountAmount", "discountCode"],
		},
		events: {
			emits: ["discount.applied", "discount.expired", "discount.autoApplied"],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createDiscountController(ctx.data);
			return {
				controllers: { discount: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/discounts",
					component: "DiscountList",
					label: "Discounts",
					icon: "Tag",
					group: "Marketing",
				},
				{
					path: "/admin/discounts/analytics",
					component: "DiscountAnalytics",
					label: "Discount Analytics",
					icon: "ChartBar",
					group: "Marketing",
				},
				{
					path: "/admin/discounts/price-rules",
					component: "PriceRuleAdmin",
					label: "Price Rules",
					icon: "Lightning",
					group: "Marketing",
				},
				{ path: "/admin/discounts/new", component: "DiscountForm" },
				{ path: "/admin/discounts/:id", component: "DiscountDetail" },
				{ path: "/admin/discounts/:id/edit", component: "DiscountForm" },
			],
		},

		options,
	};
}
