import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { handleGiftCardCheckout } from "../capabilities";
import { createGiftCardController } from "../service-impl";

describe("gift card checkout capability", () => {
	it("reports an unknown card as a typed failure", async () => {
		await expect(
			handleGiftCardCheckout(
				createGiftCardController(createMockDataService()),
				{
					operation: "balance",
					code: "GIFT-MISSING",
				},
			),
		).resolves.toEqual({
			ok: false,
			failure: { code: "GIFT_CARD_NOT_FOUND", message: "Gift card not found." },
		});
	});
});
