import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { warrantiesSchema } from "./schema";
import { createWarrantyController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export interface WarrantiesOptions extends ModuleConfig {
	/**
	 * Whether to automatically register manufacturer warranties on order completion.
	 * @default false
	 */
	autoRegisterOnPurchase?: boolean;
}

/**
 * Warranties module factory function.
 * Manages product warranty plans, customer registrations, and warranty claims.
 *
 * Three entities:
 * - WarrantyPlan: defines coverage type, duration, and price
 * - WarrantyRegistration: links a plan to a customer's purchased product
 * - WarrantyClaim: tracks customer issues against active registrations
 *
 * Claim flow: submitted -> under_review -> approved -> in_repair -> resolved -> closed
 * Admin can deny at any non-terminal stage.
 *
 * Emits events for integration with notifications, orders, and store-credits modules.
 */
export default function warranties(options?: WarrantiesOptions): Module {
	return {
		id: "warranties",
		version: "0.0.1",
		schema: warrantiesSchema,

		exports: {
			read: ["warrantyStatus", "warrantyExpiration"],
		},

		events: {
			emits: [
				"warranty.registered",
				"warranty.expired",
				"warranty.voided",
				"claim.submitted",
				"claim.approved",
				"claim.denied",
				"claim.resolved",
				"claim.closed",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createWarrantyController(ctx.data);

			return {
				controllers: { warranties: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/warranties",
					component: "WarrantiesList",
					label: "Warranties",
					icon: "ShieldCheck",
					group: "Sales",
				},
				{
					path: "/admin/warranties/claims/:id",
					component: "ClaimDetail",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/account/warranties",
					component: "WarrantyStatus",
				},
			],
		},

		options,
	};
}

export type {
	ClaimIssueType,
	ClaimResolution,
	ClaimStatus,
	ClaimSummary,
	CreateWarrantyPlanParams,
	RegisterWarrantyParams,
	RegistrationStatus,
	SubmitClaimParams,
	UpdateWarrantyPlanParams,
	WarrantyClaim,
	WarrantyController,
	WarrantyPlan,
	WarrantyPlanType,
	WarrantyRegistration,
} from "./service";
