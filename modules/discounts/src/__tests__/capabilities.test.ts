import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { handleDiscountCode } from "../capabilities";
import { createDiscountController } from "../service-impl";

describe("discount code capability", () => {
	it("returns an explicit rejection for an unknown code", async () => {
		await expect(
			handleDiscountCode(createDiscountController(createMockDataService()), {
				operation: "validate",
				code: "MISSING",
				subtotal: 1000,
			}),
		).resolves.toMatchObject({
			ok: true,
			decision: { valid: false, discountAmount: 0, freeShipping: false },
		});
	});
});
