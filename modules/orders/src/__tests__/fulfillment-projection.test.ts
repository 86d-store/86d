import { describe, expect, it } from "vitest";
import {
	projectOrderFulfillmentStatus,
	projectOwnerFulfillments,
} from "../fulfillment-projection";

const now = new Date("2026-08-14T00:00:00.000Z");

describe("Fulfillment projection", () => {
	it("maps owner lineItemId onto the Order Admin read shape", () => {
		const projected = projectOwnerFulfillments([
			{
				id: "ful-1",
				orderId: "order-1",
				status: "pending",
				items: [{ lineItemId: "item-1", quantity: 2 }],
				createdAt: now,
				updatedAt: now,
			},
		]);
		expect(projected[0]).toMatchObject({
			id: "ful-1",
			items: [{ orderItemId: "item-1", quantity: 2 }],
		});
	});

	it("projects unfulfilled / partial / fulfilled from owner rows", () => {
		const items = [
			{
				id: "item-1",
				orderId: "order-1",
				productId: "p1",
				name: "Widget",
				price: 1000,
				quantity: 2,
				subtotal: 2000,
			},
		];
		expect(projectOrderFulfillmentStatus(items, [])).toBe("unfulfilled");
		expect(
			projectOrderFulfillmentStatus(items, [
				{
					id: "ful-1",
					orderId: "order-1",
					status: "pending",
					items: [{ lineItemId: "item-1", quantity: 1 }],
					createdAt: now,
					updatedAt: now,
				},
			]),
		).toBe("partially_fulfilled");
		expect(
			projectOrderFulfillmentStatus(items, [
				{
					id: "ful-1",
					orderId: "order-1",
					status: "shipped",
					items: [{ lineItemId: "item-1", quantity: 2 }],
					createdAt: now,
					updatedAt: now,
				},
			]),
		).toBe("fulfilled");
	});

	it("ignores cancelled owner obligations", () => {
		const items = [
			{
				id: "item-1",
				orderId: "order-1",
				productId: "p1",
				name: "Widget",
				price: 1000,
				quantity: 1,
				subtotal: 1000,
			},
		];
		expect(
			projectOrderFulfillmentStatus(items, [
				{
					id: "ful-1",
					orderId: "order-1",
					status: "cancelled",
					items: [{ lineItemId: "item-1", quantity: 1 }],
					createdAt: now,
					updatedAt: now,
				},
			]),
		).toBe("unfulfilled");
	});
});
