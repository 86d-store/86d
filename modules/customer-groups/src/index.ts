import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { customerGroupsStorage } from "./schema";
import { createCustomerGroupControllers } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	AdjustmentScope,
	AdjustmentType,
	CustomerGroup,
	CustomerGroupController,
	GroupMembership,
	GroupPriceAdjustment,
	GroupRule,
	GroupType,
	RuleOperator,
} from "./service";

export interface CustomerGroupsOptions extends ModuleConfig {
	/**
	 * Default group slug to assign new customers to automatically
	 * @default undefined
	 */
	defaultGroupSlug?: string;

	/**
	 * Whether to include expired memberships in group lookups
	 * @default false
	 */
	includeExpiredMemberships?: boolean;
}

/**
 * Customer groups module factory function
 * Creates a customer segmentation system with manual/automatic groups,
 * rule-based assignment, and group-specific price adjustments
 */
export default function customerGroups(
	options?: CustomerGroupsOptions,
): Module {
	return {
		id: "customer-groups",
		version: "1.0.0",
		storage: customerGroupsStorage,
		exports: {
			read: [
				"customerGroup",
				"groupMembership",
				"groupRule",
				"groupPriceAdjustment",
			],
		},
		events: {
			emits: [
				"customer-group.created",
				"customer-group.updated",
				"customer-group.deleted",
				"customer-group.member.added",
				"customer-group.member.removed",
				"customer-group.rule.added",
				"customer-group.rule.removed",
				"customer-group.pricing.updated",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createCustomerGroupControllers(ctx.data);

			return {
				controllers: { customerGroups: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/customer-groups",
					component: "CustomerGroupList",
					label: "Customer Groups",
					icon: "UsersThree",
					group: "Customers",
				},
				{
					path: "/admin/customer-groups/:id",
					component: "CustomerGroupDetail",
				},
			],
		},
		options,
	};
}
