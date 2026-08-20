import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createCartControllers } from "../service-impl";
import { addToCart } from "../store/endpoints/add-to-cart";

function extractHandler(endpoint: unknown) {
	return endpoint as (ctx: Record<string, unknown>) => Promise<unknown>;
}

describe("add-to-cart catalog capability", () => {
	it("uses the authoritative variant price and never trusts the submitted price", async () => {
		const controller = createCartControllers(createMockDataService());
		const invoke = vi.fn().mockResolvedValue({
			ok: true,
			decision: {
				product: {
					id: "product-1",
					name: "Tee",
					slug: "tee",
					status: "active",
					price: 2000,
					images: [],
				},
				variant: {
					id: "variant-1",
					productId: "product-1",
					name: "Large",
					price: 2500,
					images: [],
				},
			},
		});

		const result = await extractHandler(addToCart)({
			body: {
				productId: "product-1",
				variantId: "variant-1",
				quantity: 1,
				price: 1,
				productName: "client value",
				productSlug: "client-value",
			},
			headers: new Headers({ cookie: "86d_guest_id=guest-1" }),
			context: {
				controllers: { cart: controller },
				capabilities: { invoke },
				session: null,
			},
		});

		expect(result).toMatchObject({ item: { price: 2500 } });
		expect(invoke).toHaveBeenCalledWith(expect.anything(), {
			productId: "product-1",
			variantId: "variant-1",
		});
	});

	it("fails closed when authoritative catalog resolution is unavailable", async () => {
		const controller = createCartControllers(createMockDataService());
		const result = await extractHandler(addToCart)({
			body: {
				productId: "product-1",
				quantity: 1,
				price: 1,
				productName: "Tee",
				productSlug: "tee",
			},
			headers: new Headers({ cookie: "86d_guest_id=guest-1" }),
			context: {
				controllers: { cart: controller },
				capabilities: {
					invoke: vi.fn().mockResolvedValue({
						ok: false,
						failure: {
							code: "CAPABILITY_UNAVAILABLE",
							capability: "catalog.product.resolve",
							version: "1.0.0",
						},
					}),
				},
				session: null,
			},
		});

		expect(result).toEqual({
			code: "CART_CATALOG_UNAVAILABLE",
			error: "Authoritative product information is unavailable.",
			status: 503,
		});
	});
});
