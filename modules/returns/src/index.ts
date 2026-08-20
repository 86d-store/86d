import { acceptCapability } from "@86d-app/core/capabilities";
import { orderLineQuantityValidateCapability } from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import {
	authoritativeReturnRequestSchema,
	ReturnAuthorityError,
	requestAuthoritativeReturn,
	requestReturnInputSchema,
} from "./authority";
import {
	returnConditionSnapshotSchema,
	returnReasonSnapshotSchema,
	returnRequestedV1,
	returnResolutionSchema,
} from "./events";
import { returnsStorage } from "./schema";
import { createReturnController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	AuthoritativeReturnRequest,
	RequestReturnInput,
	RequestReturnResult,
	ReturnAuthorityErrorCode,
} from "./authority";
export type {
	CreateReturnItemParams,
	CreateReturnParams,
	ItemCondition,
	ItemReturnReason,
	RefundMethod,
	ReturnController,
	ReturnItem,
	ReturnRequest,
	ReturnRequestWithItems,
	ReturnStatus,
	ReturnSummary,
} from "./service";
export {
	authoritativeReturnRequestSchema,
	ReturnAuthorityError,
	requestAuthoritativeReturn,
	requestReturnInputSchema,
	returnConditionSnapshotSchema,
	returnReasonSnapshotSchema,
	returnRequestedV1,
	returnResolutionSchema,
};

export interface ReturnsOptions extends ModuleConfig {
	/**
	 * Maximum number of days after order to allow return requests.
	 * @default 30
	 */
	returnWindowDays?: number;
}

/**
 * Returns module factory function.
 * Manages customer return requests with an approval workflow.
 *
 * Flow: requested -> approved -> received -> completed
 * Admin can reject at any non-terminal stage.
 * Customers can cancel before completion.
 *
 * Emits events for integration with store-credits, notifications, and orders modules.
 */
export default function returns(options?: ReturnsOptions): Module {
	return {
		id: "returns",
		version: "0.0.1",
		storage: returnsStorage,
		capabilities: {
			accepts: [acceptCapability(orderLineQuantityValidateCapability)],
		},
		exports: {
			read: ["returnStatus", "returnRefundAmount"],
		},
		events: {
			emits: [
				"return.requested",
				"return.approved",
				"return.rejected",
				"return.received",
				"return.completed",
				"return.cancelled",
				"return.refunded",
			],
		},
		durableEvents: { emits: [returnRequestedV1] },

		init: async (ctx: ModuleContext) => {
			const controller = createReturnController(ctx.data);

			return {
				controllers: { returns: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/returns",
					component: "ReturnsList",
					label: "Returns",
					icon: "ArrowUUpLeft",
					group: "Sales",
				},
				{
					path: "/admin/returns/:id",
					component: "ReturnDetail",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/account/returns/:id",
					component: "ReturnStatus",
				},
			],
		},

		options,
	};
}
