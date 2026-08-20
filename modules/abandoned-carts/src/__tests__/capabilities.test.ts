import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { abandonedCartRecoveryResolveProvider } from "../capabilities";
import { createAbandonedCartController } from "../service-impl";

describe("abandoned-carts.recovery.resolve capability", () => {
	it("returns only the data needed to render recovery email", async () => {
		const data = createMockDataService();
		const cart = await createAbandonedCartController(data).create({
			cartId: "cart-1",
			cartTotal: 2500,
			currency: "USD",
			items: [
				{
					productId: "product-1",
					name: "Tee",
					price: 2500,
					quantity: 1,
				},
			],
		});

		const result = await abandonedCartRecoveryResolveProvider.handle(
			{ data, storeId: "store-1", options: {} },
			{ cartId: cart.id },
		);

		expect(result).toMatchObject({
			ok: true,
			decision: {
				cartTotal: 2500,
				currency: "USD",
				items: [{ name: "Tee", price: 2500, quantity: 1 }],
			},
		});
	});
});
