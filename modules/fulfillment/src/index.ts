import { acceptCapability } from "@86d-app/core/capabilities";
import {
	customerIdentityResolveCapability,
	orderCustomerAuthorizeCapability,
	orderGuestProofAuthorizeCapability,
	orderLineQuantityValidateCapability,
} from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { fulfillmentCreatedV1 } from "./events";
import { fulfillmentStorage } from "./schema";
import { createFulfillmentController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type { FulfillmentAuthorityErrorCode } from "./authority";
export type {
	Fulfillment,
	FulfillmentController,
	FulfillmentItem,
	FulfillmentStatus,
} from "./service";

export interface FulfillmentOptions extends ModuleConfig {
	/** Auto-transition to "shipped" when tracking is added */
	autoShipOnTracking?: boolean;
}

export default function fulfillment(options?: FulfillmentOptions): Module {
	return {
		id: "fulfillment",
		version: "0.0.1",
		storage: fulfillmentStorage,
		capabilities: {
			accepts: [
				acceptCapability(orderLineQuantityValidateCapability),
				acceptCapability(orderCustomerAuthorizeCapability),
				acceptCapability(orderGuestProofAuthorizeCapability, {
					optional: true,
				}),
				acceptCapability(customerIdentityResolveCapability, { optional: true }),
			],
		},
		events: {
			emits: [
				"fulfillment.created",
				"fulfillment.shipped",
				"fulfillment.delivered",
				"fulfillment.cancelled",
			],
		},
		// Creation state and this completed-change fact commit atomically. The
		// in-memory event above remains compatibility notification only.
		durableEvents: { emits: [fulfillmentCreatedV1] },
		init: async (ctx: ModuleContext) => {
			const controller = createFulfillmentController(ctx.data, {
				events: ctx.events,
				options: {
					autoShipOnTracking: options?.autoShipOnTracking,
				},
				capabilities: ctx.capabilities,
				transactions: ctx.transactions,
			});
			return { controllers: { fulfillment: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/fulfillment",
					component: "FulfillmentAdmin",
					label: "Fulfillment",
					icon: "PackageCheck",
					group: "Fulfillment",
				},
			],
		},
		options,
	};
}
