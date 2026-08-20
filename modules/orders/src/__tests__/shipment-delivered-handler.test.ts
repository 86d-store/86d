import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import orders from "../index";
import { createOrderController } from "../service-impl";

/**
 * Characterizes the Order/Fulfillment authority boundary.
 *
 * Shipping delivery is parcel evidence. It cannot close the commercial Order;
 * only the versioned Order closure policy (or an audited manual close) can do
 * that after every Payment, dispute, Return, and Fulfillment obligation is
 * terminal.
 */

describe("shipment.delivered Order boundary", () => {
	let data: ReturnType<typeof createMockDataService>;
	let bus: ReturnType<typeof createEventBus>;

	beforeEach(() => {
		data = createMockDataService();
		bus = createEventBus();
	});

	async function setupHandler() {
		const module = orders();
		const scopedEmitter = createScopedEmitter(bus, "orders");
		const emittedFulfillments: Array<{ orderId: string }> = [];
		bus.on("order.fulfilled", (ev) => {
			const payload = ev.payload as { orderId: string };
			emittedFulfillments.push(payload);
		});
		await module.init?.({
			...createMockModuleContext({ data }),
			events: scopedEmitter,
		});
		const controller = createOrderController(data);
		return { controller, emittedFulfillments };
	}

	async function createTestOrder(
		controller: ReturnType<typeof createOrderController>,
	) {
		return controller.create({
			customerId: "cust_001",
			items: [
				{
					productId: "prod_001",
					name: "Test Product",
					quantity: 1,
					price: 1000,
				},
			],
			shippingAddress: {
				firstName: "Jane",
				lastName: "Smith",
				line1: "123 Main St",
				city: "Springfield",
				state: "IL",
				postalCode: "62701",
				country: "US",
			},
			subtotal: 1000,
			total: 1000,
		});
	}

	it("does not close an Order when one parcel is delivered", async () => {
		const { controller, emittedFulfillments } = await setupHandler();
		const order = await createTestOrder(controller);

		await bus.emit("shipment.delivered", "shipping", {
			orderId: order.id,
			shipmentId: "shp_001",
			trackingNumber: "9400111899223450385668",
			status: "delivered",
		});

		const updated = await controller.getById(order.id);
		expect(updated?.status).toBe("pending");
		expect(emittedFulfillments).toHaveLength(0);
	});

	it("keeps a split Order open across delivered parcels and duplicate facts", async () => {
		const { controller, emittedFulfillments } = await setupHandler();
		const order = await controller.create({
			customerId: "cust_001",
			items: [
				{
					productId: "prod_001",
					name: "First Product",
					quantity: 1,
					price: 1000,
				},
				{
					productId: "prod_002",
					name: "Second Product",
					quantity: 1,
					price: 1500,
				},
			],
			subtotal: 2500,
			total: 2500,
		});
		const delivered = (shipmentId: string) =>
			bus.emit("shipment.delivered", "shipping", {
				orderId: order.id,
				shipmentId,
				status: "delivered",
			});

		await delivered("shipment-first");
		await delivered("shipment-first");
		await delivered("shipment-second");

		expect((await controller.getById(order.id))?.status).toBe("pending");
		expect(emittedFulfillments).toHaveLength(0);
	});

	it("skips update when order is already completed", async () => {
		const { controller, emittedFulfillments } = await setupHandler();
		const order = await createTestOrder(controller);
		await controller.updateStatus(order.id, "completed");

		await bus.emit("shipment.delivered", "shipping", {
			orderId: order.id,
			shipmentId: "shp_002",
		});

		expect(emittedFulfillments).toHaveLength(0);
	});

	it("skips update when order is cancelled", async () => {
		const { controller, emittedFulfillments } = await setupHandler();
		const order = await createTestOrder(controller);
		await controller.cancel(order.id);

		await bus.emit("shipment.delivered", "shipping", {
			orderId: order.id,
			shipmentId: "shp_003",
		});

		expect(emittedFulfillments).toHaveLength(0);
	});

	it("skips gracefully when orderId is missing from payload", async () => {
		const { emittedFulfillments } = await setupHandler();

		await bus.emit("shipment.delivered", "shipping", {
			shipmentId: "shp_004",
		});

		expect(emittedFulfillments).toHaveLength(0);
	});

	it("skips gracefully when orderId does not match any order", async () => {
		const { emittedFulfillments } = await setupHandler();

		await bus.emit("shipment.delivered", "shipping", {
			orderId: "order_nonexistent",
			shipmentId: "shp_005",
		});

		expect(emittedFulfillments).toHaveLength(0);
	});
});
