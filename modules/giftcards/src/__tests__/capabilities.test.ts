import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { handleGiftCardCheckout } from "../capabilities";
import { createGiftCardController } from "../service-impl";

describe("gift card checkout capability", () => {
	it("fails application closed before exposing a balance decision", async () => {
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
			failure: {
				code: "GIFT_CARD_REDEMPTION_FAILED",
				message: "Gift card checkout application is unavailable.",
			},
		});
	});

	it("fails closed without mutating balance for a redemption request", async () => {
		const data = createMockDataService();
		const controller = createGiftCardController(data);
		const card = {
			id: "card_1",
			code: "GIFT-ABCD-EFGH-JKNP",
			initialBalance: 1_000,
			currentBalance: 1_000,
			currency: "USD",
			status: "active" as const,
			delivered: false,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		};
		await data.upsert("giftCard", card.id, { ...card });

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
