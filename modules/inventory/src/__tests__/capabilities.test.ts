import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { handleInventoryCheckout } from "../capabilities";
import { createInventoryController } from "../service-impl";

describe("inventory checkout capability", () => {
	it("returns an explicit reservation decision", async () => {
		const controller = createInventoryController(createMockDataService());
		await controller.setStock({ productId: "product-1", quantity: 2 });

		await expect(
			handleInventoryCheckout(controller, {
				operation: "reserve",
				productId: "product-1",
				quantity: 3,
			}),
		).resolves.toEqual({
			ok: false,
			failure: {
				code: "INSUFFICIENT_STOCK",
				message: "Inventory could not reserve the requested quantity.",
			},
		});
	});

	it("sets and adjusts stock for owning-module integrations", async () => {
		const controller = createInventoryController(createMockDataService());
		await expect(
			handleInventoryCheckout(controller, {
				operation: "set",
				productId: "product-1",
				quantity: 5,
				productName: "Tee",
			}),
		).resolves.toMatchObject({
			ok: true,
			decision: { operation: "set", stock: { quantity: 5, available: 5 } },
		});
		await expect(
			handleInventoryCheckout(controller, {
				operation: "adjust",
				productId: "product-1",
				delta: 2,
			}),
		).resolves.toMatchObject({
			ok: true,
			decision: { operation: "adjust", stock: { quantity: 7, available: 7 } },
		});
	});
});
