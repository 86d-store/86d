import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { membershipsSchema } from "./schema";
import { createMembershipController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	BenefitType,
	BillingInterval,
	Membership,
	MembershipBenefit,
	MembershipController,
	MembershipPlan,
	MembershipProduct,
	MembershipStats,
	MembershipStatus,
	MembershipWithPlan,
} from "./service";

export interface MembershipsOptions extends ModuleConfig {
	/** Default trial days for new plans when not specified. Default: "0". */
	defaultTrialDays?: string;
	/** Maximum members allowed per plan when not specified. No default (unlimited). */
	defaultMaxMembers?: string;
}

export default function memberships(options?: MembershipsOptions): Module {
	return {
		id: "memberships",
		version: "0.0.1",
		schema: membershipsSchema,
		exports: {
			read: [
				"activePlans",
				"customerMembership",
				"customerBenefits",
				"productAccess",
			],
		},
		requires: ["customers"],
		events: {
			emits: [
				"membership.subscribed",
				"membership.cancelled",
				"membership.paused",
				"membership.resumed",
				"membership.expired",
				"membership.plan.created",
				"membership.plan.updated",
				"membership.plan.deleted",
				"membership.benefit.added",
				"membership.benefit.removed",
				"membership.product.gated",
				"membership.product.ungated",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createMembershipController(ctx.data);
			return { controllers: { memberships: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/memberships",
					component: "MembershipAdmin",
					label: "Memberships",
					icon: "Crown",
					group: "Customers",
				},
				{
					path: "/admin/memberships/plans",
					component: "MembershipPlans",
					label: "Plans",
					icon: "Layers",
					group: "Customers",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/memberships",
					component: "PlanListing",
				},
				{
					path: "/memberships/:slug",
					component: "PlanDetail",
				},
			],
		},
		options,
	};
}
