import {
	createMockDataService,
	createMockTransactionRunner,
} from "@86d-app/core/test-utils";
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

	it("fails closed without mutating balance for a redemption request", async () => {
		const data = createMockDataService();
		const controller = createGiftCardController(
			data,
			createMockTransactionRunner({ data }),
		);
		const card = await controller.create({ initialBalance: 1000 });

		await expect(
			handleGiftCardCheckout(controller, {
				operation: "redeem",
				code: card.code,
				amount: 1000,
				orderId: "order_1",
			}),
		).resolves.toEqual({
			ok: false,
			failure: {
				code: "GIFT_CARD_REDEMPTION_FAILED",
				message: "Gift card redemption is unavailable.",
			},
		});
		expect(await controller.checkBalance(card.code)).toMatchObject({
			balance: 1000,
			status: "active",
		});
		expect(await controller.listTransactions(card.id)).toEqual([]);
	});
});
