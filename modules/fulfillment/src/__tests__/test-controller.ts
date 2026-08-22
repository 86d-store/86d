import { orderLineQuantityValidateCapability } from "@86d-app/core/commerce-capabilities";
import type { ScopedEventEmitter } from "@86d-app/core/events";
import {
	createMockTransactionRunner,
	type MockDataService,
} from "@86d-app/core/test-utils";
import type { OrderLineQuantityAuthority } from "../authority";
import {
	createFulfillmentController,
	type FulfillmentControllerDeps,
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

function isDepsObject(value: unknown): value is FulfillmentControllerDeps {
	if (!value || typeof value !== "object") return false;
	if ("emit" in value) return false;
	return (
		"events" in value ||
		"options" in value ||
		"capabilities" in value ||
		"transactions" in value
	);
}

/** Exercise the controller through its required Order and transaction seams. */
export function createTestFulfillmentController(
	data: MockDataService,
	eventsOrDeps?: ScopedEventEmitter | FulfillmentControllerDeps | undefined,
	options?: FulfillmentControllerOptions | undefined,
) {
	const defaults = {
		capabilities: orderLineAuthority,
		transactions: createMockTransactionRunner({ data }),
	};

	if (isDepsObject(eventsOrDeps)) {
		return createFulfillmentController(data, {
			...defaults,
			...eventsOrDeps,
			capabilities: eventsOrDeps.capabilities ?? defaults.capabilities,
			transactions: eventsOrDeps.transactions ?? defaults.transactions,
		});
	}

	return createFulfillmentController(data, {
		...defaults,
		events: eventsOrDeps,
		options,
	});
}
