import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import {
	customerContactResolveProvider,
	customerIdentityResolveCapability,
	customerIdentityResolveProvider,
} from "./capabilities";
import {
	createStoreCustomerIdentityService,
	storeCustomerAuditBindingSchema,
	storeCustomerAuthBindingSchema,
	storeCustomerIdentityInputSchema,
} from "./identity-binding";
import { customersSchema, customersTables } from "./schema";
import { DEFAULT_LOYALTY_RULES } from "./service";
import { createCustomerController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	StoreCustomer,
	StoreCustomerAuditBinding,
	StoreCustomerAuthBinding,
	StoreCustomerIdentityInput,
	StoreCustomerIdentityService,
	StoreCustomerResolutionResult,
} from "./identity-binding";
// Export types for other modules to use via inter-module contracts
export type {
	Customer,
	CustomerAddress,
	CustomerController,
	ImportCustomerResult,
	ImportCustomerRow,
	LoyaltyBalance,
	LoyaltyRules,
	LoyaltyStats,
	LoyaltyTransaction,
} from "./service";
export {
	createStoreCustomerIdentityService,
	customerIdentityResolveCapability,
	DEFAULT_LOYALTY_RULES,
	storeCustomerAuditBindingSchema,
	storeCustomerAuthBindingSchema,
	storeCustomerIdentityInputSchema,
};

export interface CustomersOptions extends ModuleConfig {
	/**
	 * Whether to automatically create a customer record when a user signs up
	 * @default true
	 */
	autoCreateOnSignup?: boolean;
}

/**
 * Customers module factory function.
 * Provides customer profile and address management.
 *
 * Exports (for other modules):
 *   read: ["customerEmail", "customerFirstName", "customerLastName", "customerPhone"]
 */
export default function customers(options?: CustomersOptions): Module {
	return {
		id: "customers",
		version: "0.0.1",
		schema: customersSchema,
		tables: customersTables,
		capabilities: {
			provides: [
				customerContactResolveProvider,
				customerIdentityResolveProvider,
			],
		},
		exports: {
			read: [
				"customerEmail",
				"customerName",
				"customerPhone",
				"customerAddresses",
			],
		},
		events: {
			emits: ["customer.created", "customer.updated"],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createCustomerController(ctx.data, ctx.events);
			return {
				controllers: { customer: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/customers",
					component: "CustomerList",
					label: "Customers",
					icon: "Users",
					group: "Customers",
				},
				{ path: "/admin/customers/:id", component: "CustomerDetail" },
				{
					path: "/admin/customers/tags",
					component: "CustomerTags",
					label: "Tags",
					icon: "Tag",
					group: "Customers",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/account",
					component: "AccountProfile",
				},
			],
		},

		options,
	};
}
