import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { affiliatesSchema } from "./schema";
import { createAffiliateController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Affiliate,
	AffiliateController,
	AffiliateConversion,
	AffiliateLink,
	AffiliatePayout,
	AffiliateStats,
	AffiliateStatus,
	ConversionStatus,
	PayoutMethod,
	PayoutStatus,
} from "./service";

export interface AffiliatesOptions extends ModuleConfig {
	/** Default commission rate for new affiliates (default: "10") */
	defaultCommissionRate?: string;
	/** Minimum payout amount (default: "50") */
	minimumPayout?: string;
	/** Cookie duration in days for tracking (default: "30") */
	cookieDurationDays?: string;
}

export default function affiliates(options?: AffiliatesOptions): Module {
	return {
		id: "affiliates",
		version: "0.0.1",
		schema: affiliatesSchema,
		exports: {
			read: ["affiliateCode", "affiliateStatus"],
		},
		events: {
			emits: [
				"affiliates.application_submitted",
				"affiliates.approved",
				"affiliates.suspended",
				"affiliates.rejected",
				"affiliates.conversion_recorded",
				"affiliates.conversion_approved",
				"affiliates.payout_completed",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createAffiliateController(ctx.data);
			return { controllers: { affiliates: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		store: {
			pages: [
				{ path: "/affiliate/apply", component: "AffiliateApply" },
				{ path: "/affiliate/dashboard", component: "AffiliateDashboard" },
			],
		},
		admin: {
			pages: [
				{
					path: "/admin/affiliates",
					component: "AffiliateList",
					label: "Affiliates",
					icon: "Users",
					group: "Customers",
				},
				{
					path: "/admin/affiliates/applications",
					component: "ApplicationList",
					label: "Applications",
					icon: "ClipboardList",
					group: "Customers",
				},
				{
					path: "/admin/affiliates/conversions",
					component: "ConversionList",
					label: "Conversions",
					icon: "TrendingUp",
					group: "Customers",
				},
				{
					path: "/admin/affiliates/payouts",
					component: "PayoutList",
					label: "Payouts",
					icon: "DollarSign",
					group: "Customers",
				},
			],
		},
		options,
	};
}
