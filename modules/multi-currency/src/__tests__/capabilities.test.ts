import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { handleProductPriceConversion } from "../capabilities";
import { createMultiCurrencyController } from "../service-impl";

describe("product price conversion capability", () => {
	it("fails explicitly when the requested currency is unavailable", async () => {
		await expect(
			handleProductPriceConversion(
				createMultiCurrencyController(createMockDataService()),
				{
					productId: "product-1",
					basePriceInCents: 1000,
					currencyCode: "EUR",
				},
			),
		).resolves.toEqual({
			ok: false,
			failure: {
				code: "CURRENCY_UNAVAILABLE",
				message: "Authoritative currency conversion is unavailable.",
			},
		});
	});
});
