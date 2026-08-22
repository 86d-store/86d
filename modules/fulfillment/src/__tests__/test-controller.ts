import { orderLineQuantityValidateCapability } from "@86d-app/core/commerce-capabilities";
import type { ScopedEventEmitter } from "@86d-app/core/events";
import {
	createMockTransactionRunner,
	type MockDataService,
} from "@86d-app/core/test-utils";
import type { OrderLineQuantityAuthority } from "../authority";
import {
	createFulfillmentController,
	type FulfillmentControllerOptions,
} from "../service-impl";

const orderLineAuthority: OrderLineQuantityAuthority = {
	async invoke(_definition, request) {
		const validated =
			orderLineQuantityValidateCapability.request.parse(request);
		return {
			ok: true,
			decision: orderLineQuantityValidateCapability.decision.parse({
				orderId: validated.orderId,
				items: validated.items.map((item) => ({
					orderItemId: item.orderItemId,
					requestedQuantity: item.quantity,
					orderedQuantity: 1_000_000,
				})),
			}),
		};
	},
};

/** Exercise the controller through its required Order and transaction seams. */
export function createTestFulfillmentController(
	data: MockDataService,
	events?: ScopedEventEmitter | undefined,
	options?: FulfillmentControllerOptions | undefined,
) {
	return createFulfillmentController(data, {
		events,
		options,
		capabilities: orderLineAuthority,
		transactions: createMockTransactionRunner({ data }),
	});
}
