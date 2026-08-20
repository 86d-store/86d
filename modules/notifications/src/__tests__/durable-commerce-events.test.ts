import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import notifications from "../index";

const commerceEvents = [
	"checkout.completed",
	"order.fulfilled",
	"order.cancelled",
	"order.shipped",
	"return.requested",
	"return.approved",
	"return.rejected",
	"return.completed",
];

async function initialize(
	options?: Parameters<typeof notifications>[0],
	capabilityInvoke = vi.fn(),
) {
	const data = createMockDataService();
	const bus = createEventBus();
	const init = notifications(options).init;
	if (!init) throw new Error("Notifications init is unavailable.");
	await init({
		...createMockModuleContext({
			data,
			capabilities: { invoke: capabilityInvoke },
		}),
		events: createScopedEmitter(bus, "notifications"),
	});
	return { bus, data };
}

describe("durable commerce notification boundaries", () => {
	it("does not register process-local consumers for commerce lifecycle facts", async () => {
		const { bus } = await initialize();

		for (const event of commerceEvents) {
			expect(bus.listenerCount(event), event).toBe(0);
		}
	});

	it("does not deliver or persist when process-local commerce facts are emitted", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const capabilityInvoke = vi.fn();
		const { bus, data } = await initialize(
			{
				resendApiKey: "re_test_key",
				resendFromAddress: "Store <noreply@store.example>",
			},
			capabilityInvoke,
		);
		const checkout = createScopedEmitter(bus, "checkout");
		const orders = createScopedEmitter(bus, "orders");

		await checkout.emit("checkout.completed", {
			sessionId: "session-1",
			orderId: "order-1",
			orderNumber: "1001",
			customerId: "customer-1",
			email: "shopper@example.com",
		});
		await orders.emit("order.shipped", {
			orderId: "order-1",
			orderNumber: "1001",
			email: "shopper@example.com",
		});
		await orders.emit("return.completed", {
			returnId: "return-1",
			orderId: "order-1",
			email: "shopper@example.com",
		});

		expect(data.all("notification")).toHaveLength(0);
		expect(data.all("notificationIntent")).toHaveLength(0);
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(capabilityInvoke).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
});
