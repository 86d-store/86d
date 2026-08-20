import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { handleStoreCreditCheckout } from "../capabilities";
import { createStoreCreditController } from "../service-impl";

describe("store credit checkout capability", () => {
	it("returns the authoritative zero balance explicitly", async () => {
		await expect(
			handleStoreCreditCheckout(
				createStoreCreditController(createMockDataService()),
				{ operation: "balance", customerId: "customer-1" },
			),
		).resolves.toEqual({
			ok: true,
			decision: { operation: "balance", balance: 0 },
		});
	});
});
