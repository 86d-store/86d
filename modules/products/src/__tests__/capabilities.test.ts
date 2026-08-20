import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { productResolveProvider } from "../capabilities";
import { createProductController } from "../service-impl";

const providerContext = (data: ReturnType<typeof createMockDataService>) => ({
	data,
	storeId: "store-1",
	options: {},
});

describe("catalog.product.resolve capability", () => {
	it("returns only active catalog data and a matching variant", async () => {
		const data = createMockDataService();
		const products = createProductController(data);
		const product = await products.createProduct({
			name: "Tee",
			slug: "tee",
			price: 2500,
			status: "active",
			images: ["tee.jpg"],
		});
		const variant = await products.createVariant({
			productId: product.id,
			name: "Large",
			price: 2800,
			options: { size: "L" },
		});

		const result = await productResolveProvider.handle(providerContext(data), {
			productId: product.id,
			variantId: variant.id,
		});

		expect(result).toEqual({
			ok: true,
			decision: {
				product: {
					id: product.id,
					name: "Tee",
					slug: "tee",
					status: "active",
					price: 2500,
					images: ["tee.jpg"],
				},
				variant: {
					id: variant.id,
					productId: product.id,
					name: "Large",
					price: 2800,
					images: [],
				},
			},
		});
	});

	it("fails closed for missing, inactive, and mismatched products", async () => {
		const data = createMockDataService();
		const products = createProductController(data);
		const inactive = await products.createProduct({
			name: "Draft",
			slug: "draft",
			price: 1000,
		});
		const other = await products.createProduct({
			name: "Other",
			slug: "other",
			price: 1200,
			status: "active",
		});
		const otherVariant = await products.createVariant({
			productId: other.id,
			name: "Only",
			price: 1200,
			options: {},
		});

		await expect(
			productResolveProvider.handle(providerContext(data), {
				productId: "missing",
			}),
		).resolves.toMatchObject({ ok: false, failure: { code: "not_found" } });
		await expect(
			productResolveProvider.handle(providerContext(data), {
				productId: inactive.id,
			}),
		).resolves.toMatchObject({ ok: false, failure: { code: "not_active" } });
		await expect(
			productResolveProvider.handle(providerContext(data), {
				productId: inactive.id,
				variantId: otherVariant.id,
			}),
		).resolves.toMatchObject({ ok: false, failure: { code: "not_active" } });
	});
});
