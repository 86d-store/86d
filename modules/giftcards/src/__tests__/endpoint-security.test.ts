import {
	createMockDataService,
	createMockTransactionRunner,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { GiftCard } from "../service";
import { createGiftCardController } from "../service-impl";

type DataService = ReturnType<typeof createMockDataService>;

function card(overrides: Partial<GiftCard> = {}): GiftCard {
	const now = new Date("2026-01-01T00:00:00.000Z");
	return {
		id: "card_1",
		code: "GIFT-ABCD-EFGH-JKNP",
		initialBalance: 5_000,
		currentBalance: 5_000,
		currency: "USD",
		status: "active",
		delivered: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

describe("gift card controller security boundary", () => {
	let data: DataService;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createGiftCardController(
			data,
			createMockTransactionRunner({ data }),
		);
	});

	it("has no callable direct balance mutation or deletion surface", () => {
		const surface = Object.fromEntries(Object.entries(controller));
		for (const method of [
			"create",
			"update",
			"delete",
			"redeem",
			"credit",
			"purchase",
			"topUp",
			"bulkCreate",
			"disableExpired",
		]) {
			expect(surface[method]).toBeUndefined();
		}
	});

	it("does not leak another customer's cards through customer listing", async () => {
		const ownerCard = card({ customerId: "owner" });
		const otherCard = card({
			id: "card_2",
			code: "GIFT-QRST-UVWX-YZ23",
			customerId: "other",
		});
		await data.upsert("giftCard", ownerCard.id, { ...ownerCard });
		await data.upsert("giftCard", otherCard.id, { ...otherCard });

		await expect(controller.listByCustomer("owner")).resolves.toEqual([
			ownerCard,
		]);
	});

	it("refuses delivery changes from a non-owner", async () => {
		const stored = card({ customerId: "owner" });
		await data.upsert("giftCard", stored.id, { ...stored });

		await expect(
			controller.sendGiftCard({
				giftCardId: stored.id,
				customerId: "attacker",
				recipientEmail: "attacker@example.com",
			}),
		).resolves.toBeNull();
		expect(await data.get("giftCard", stored.id)).toEqual(stored);
	});

	it("refuses delivery changes for non-active cards", async () => {
		for (const status of ["disabled", "expired", "depleted"] as const) {
			const stored = card({
				id: `card_${status}`,
				code: `GIFT-${status.toUpperCase()}-CARD-TEST`,
				customerId: "owner",
				status,
			});
			await data.upsert("giftCard", stored.id, { ...stored });

			await expect(
				controller.sendGiftCard({
					giftCardId: stored.id,
					customerId: "owner",
					recipientEmail: "recipient@example.com",
				}),
			).resolves.toBeNull();
			expect(await data.get("giftCard", stored.id)).toEqual(stored);
		}
	});

	it("never creates transaction rows while sending", async () => {
		const stored = card({ customerId: "owner" });
		await data.upsert("giftCard", stored.id, { ...stored });

		await controller.sendGiftCard({
			giftCardId: stored.id,
			customerId: "owner",
			recipientEmail: "recipient@example.com",
		});

		expect(data.size("giftCardTransaction")).toBe(0);
		expect((await controller.get(stored.id))?.currentBalance).toBe(5_000);
	});
});
