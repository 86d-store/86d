import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { vendorsSchema } from "./schema";
import { createVendorController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	PayoutStats,
	PayoutStatus,
	Vendor,
	VendorController,
	VendorPayout,
	VendorProduct,
	VendorProductStatus,
	VendorStats,
	VendorStatus,
} from "./service";

export interface VendorsOptions extends ModuleConfig {
	/** Default commission rate for new vendors (percentage). Default: "10". */
	defaultCommissionRate?: string;
	/** Whether new vendor applications require admin approval. Default: "true". */
	requireApproval?: string;
}

export default function vendors(options?: VendorsOptions): Module {
	return {
		id: "vendors",
		version: "0.0.1",
		schema: vendorsSchema,
		exports: {
			read: [
				"activeVendors",
				"vendorProfile",
				"vendorProducts",
				"productVendor",
			],
		},
		requires: ["products"],
		events: {
			emits: [
				"vendor.created",
				"vendor.updated",
				"vendor.deleted",
				"vendor.status.changed",
				"vendor.application.submitted",
				"vendor.product.assigned",
				"vendor.product.unassigned",
				"vendor.payout.created",
				"vendor.payout.status.changed",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createVendorController(ctx.data);
			return { controllers: { vendors: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		store: {
			pages: [
				{ path: "/vendors", component: "VendorDirectory" },
				{ path: "/vendors/:slug", component: "VendorProfile" },
				{ path: "/vendors/apply", component: "VendorApply" },
			],
		},
		admin: {
			pages: [
				{
					path: "/admin/vendors",
					component: "VendorAdmin",
					label: "Vendors",
					icon: "Store",
					group: "Catalog",
				},
				{
					path: "/admin/vendors/payouts",
					component: "VendorPayouts",
					label: "Payouts",
					icon: "Wallet",
					group: "Catalog",
				},
			],
		},
		options,
	};
}
