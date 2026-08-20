import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { handleShippingQuote } from "../capabilities";
import { createShippingController } from "../service-impl";

describe("shipping quote capability", () => {
	it("reports no option explicitly instead of inventing a zero quote", async () => {
		await expect(
			handleShippingQuote(createShippingController(createMockDataService()), {
				country: "US",
				orderAmount: 1000,
			}),
		).resolves.toEqual({
			ok: false,
			failure: {
				code: "NO_SHIPPING_OPTION",
				message: "No authoritative shipping option is available.",
			},
		});
	});
});
