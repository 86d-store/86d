import { acceptCapability } from "@86d-app/core/capabilities";
import {
	customerContactResolveCapability,
	customerIdentityResolveCapability,
	inventoryCheckoutCapability,
	paymentIntentCapability,
	productResolveCapability,
	storePresentationResolveCapability,
} from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import {
	orderCreateProvider,
	orderCustomerAuthorizeProvider,
	orderGuestProofAuthorizeProvider,
	orderLineQuantityValidateProvider,
	orderPurchaseVerifyProvider,
} from "./capabilities";
import { ordersStorage } from "./schema";
import { RETURN_REASONS } from "./service";
import { createOrderController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

// Export types for other modules to use via inter-module contracts
export type {
	AddNoteParams,
	CreateOrderParams,
	CreateReturnParams,
	Fulfillment,
	FulfillmentItem,
	FulfillmentStatus,
	FulfillmentWithItems,
	InvoiceData,
	Order,
	OrderAddress,
	OrderController,
	OrderFulfillmentStatus,
	OrderItem,
	OrderNote,
	OrderNoteType,
	OrderStatus,
	OrderWithDetails,
	PaymentStatus,
	ReturnItem,
	ReturnReason,
	ReturnRequest,
	ReturnRequestWithItems,
	ReturnStatus,
	ReturnType,
	UpdateReturnParams,
} from "./service";

export { RETURN_REASONS };

export interface OrdersOptions extends ModuleConfig {
	/**
	 * Currency code for orders
	 * @default "USD"
	 */
	currency?: string;
}

/**
 * Orders module factory function.
 * Provides order lifecycle management (pending → processing → completed).
 *
 * Other modules (e.g., checkout) can create orders by importing OrderController
 * through inter-module contracts.
 */
export default function orders(options?: OrdersOptions): Module {
	return {
		id: "orders",
		version: "0.0.1",
		storage: ordersStorage,
		exports: {
			read: [
				"orderNumber",
				"orderStatus",
				"orderTotal",
				"orderPaymentStatus",
				"orderItems",
			],
		},
		events: {
			emits: [
				"order.placed",
				"order.updated",
				"order.fulfilled",
				"order.cancelled",
				"order.shipped",
				"return.requested",
				"return.approved",
				"return.rejected",
				"return.refunded",
				"return.completed",
			],
		},
		capabilities: {
			provides: [
				orderCreateProvider,
				orderCustomerAuthorizeProvider,
				orderGuestProofAuthorizeProvider,
				orderLineQuantityValidateProvider,
				orderPurchaseVerifyProvider,
			],
			accepts: [
				acceptCapability(productResolveCapability, { optional: true }),
				acceptCapability(paymentIntentCapability, {
					operations: ["list", "refund"],
					optional: true,
				}),
				acceptCapability(inventoryCheckoutCapability, {
					operations: ["release"],
					optional: true,
				}),
				acceptCapability(customerContactResolveCapability, { optional: true }),
				acceptCapability(customerIdentityResolveCapability, { optional: true }),
				acceptCapability(storePresentationResolveCapability, {
					optional: true,
				}),
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createOrderController(ctx.data, {
				coreMoney: ctx.coreMoney,
			});

			return {
				controllers: { order: controller },
			};
		},

		search: { store: "/orders/store-search" },

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/orders",
					component: "OrderList",
					label: "Orders",
					icon: "ShoppingBag",
					group: "Sales",
				},
				{ path: "/admin/orders/:id", component: "OrderDetail" },
				{ path: "/admin/orders/:id/invoice", component: "OrderInvoice" },
				{ path: "/admin/orders/:id/activity", component: "OrderActivity" },
				{
					path: "/admin/orders/returns",
					component: "ReturnList",
					label: "Returns",
					icon: "ArrowUUpLeft",
					group: "Sales",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/account/orders",
					component: "OrderHistory",
				},
				{
					path: "/account/orders/:id",
					component: "OrderDetail",
				},
				{
					path: "/account/orders/returns",
					component: "OrderReturns",
				},
			],
		},

		options,
	};
}
