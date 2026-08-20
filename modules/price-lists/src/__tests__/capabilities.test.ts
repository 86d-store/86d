import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { handlePriceListResolve } from "../capabilities";
import { createPriceListController } from "../service-impl";

describe("price-list resolution capability", () => {
	it("represents an uncovered product by omitting it from the decision", async () => {
		await expect(
			handlePriceListResolve(
				createPriceListController(createMockDataService()),
				{
					productIds: ["product-1"],
				},
			),
		).resolves.toEqual({ ok: true, decision: { prices: {} } });
	});
});
