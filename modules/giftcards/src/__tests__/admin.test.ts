import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { GiftCard, GiftCardTransaction } from "../service";
import { createGiftCardController } from "../service-impl";

type DataService = ReturnType<typeof createMockDataService>;

function giftCard(overrides: Partial<GiftCard> = {}): GiftCard {
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

async function seedCard(
	data: DataService,
	overrides: Partial<GiftCard> = {},
): Promise<GiftCard> {
	const stored = giftCard(overrides);
	await data.upsert("giftCard", stored.id, { ...stored });
	return stored;
}

async function seedTransaction(
	data: DataService,
	overrides: Partial<GiftCardTransaction> = {},
): Promise<GiftCardTransaction> {
	const stored: GiftCardTransaction = {
		id: "transaction_1",
		giftCardId: "card_1",
		type: "debit",
		amount: 1_000,
		balanceAfter: 4_000,
		createdAt: new Date("2026-01-02T00:00:00.000Z"),
		...overrides,
	};
	await data.upsert("giftCardTransaction", stored.id, { ...stored });
	return stored;
}

describe("gift card admin read model", () => {
	let data: DataService;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createGiftCardController(data);
	});

	it("lists existing cards by status", async () => {
		await seedCard(data, { id: "active" });
		await seedCard(data, {
			id: "disabled",
			code: "GIFT-QRST-UVWX-YZ23",
			status: "disabled",
		});

		await expect(controller.list({ status: "disabled" })).resolves.toEqual([
			expect.objectContaining({ id: "disabled", status: "disabled" }),
		]);
	});

	it("reads a selected card and its transaction history", async () => {
		const card = await seedCard(data);
		const transaction = await seedTransaction(data);

		await expect(controller.get(card.id)).resolves.toEqual(card);
		await expect(controller.listTransactions(card.id)).resolves.toEqual([
			transaction,
		]);
	});

	it("returns empty read projections for missing records", async () => {
		await expect(controller.get("missing")).resolves.toBeNull();
		await expect(controller.listTransactions("missing")).resolves.toEqual([]);
	});

	it("summarizes legacy balances and debit history", async () => {
		await seedCard(data, {
			id: "active",
			currentBalance: 4_000,
		});
		await seedCard(data, {
			id: "depleted",
			code: "GIFT-QRST-UVWX-YZ23",
			initialBalance: 2_000,
			currentBalance: 0,
			status: "depleted",
		});
		await seedTransaction(data);

		await expect(controller.getStats()).resolves.toEqual({
			totalIssued: 2,
			totalActive: 1,
			totalDepleted: 1,
			totalDisabled: 0,
			totalExpired: 0,
			totalIssuedValue: 7_000,
			totalRedeemedValue: 1_000,
			totalOutstandingBalance: 4_000,
		});
	});

	it("does not expose admin mutation primitives", () => {
		const surface = Object.fromEntries(Object.entries(controller));
		for (const method of [
			"create",
			"update",
			"delete",
			"credit",
			"bulkCreate",
			"disableExpired",
		]) {
			expect(surface[method]).toBeUndefined();
		}
	});
});
