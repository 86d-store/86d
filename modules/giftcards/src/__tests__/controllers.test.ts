import {
	createMockDataService,
	createMockTransactionRunner,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { GiftCard } from "../service";
import { createGiftCardController } from "../service-impl";

type DataService = ReturnType<typeof createMockDataService>;

function legacyCard(overrides: Partial<GiftCard> = {}): GiftCard {
	const createdAt = new Date("2025-01-01T00:00:00.000Z");
	return {
		id: "card_1",
		code: "GIFT-ABCD-EFGH-JKNP",
		initialBalance: 2_500,
		currentBalance: 2_500,
		currency: "USD",
		status: "active",
		delivered: false,
		createdAt,
		updatedAt: createdAt,
		...overrides,
	};
}

async function seed(
	data: DataService,
	overrides: Partial<GiftCard> = {},
): Promise<GiftCard> {
	const card = legacyCard(overrides);
	await data.upsert("giftCard", card.id, { ...card });
	return card;
}

describe("gift card controller containment", () => {
	let data: DataService;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createGiftCardController(
			data,
			createMockTransactionRunner({ data }),
		);
	});

	it("keeps legacy money fields readable", async () => {
		const card = await seed(data, {
			initialBalance: 10_000,
			currentBalance: 4_500,
			purchaseOrderId: "order_1",
		});

		await expect(controller.get(card.id)).resolves.toMatchObject({
			initialBalance: 10_000,
			currentBalance: 4_500,
			purchaseOrderId: "order_1",
		});
	});

	it("does not modify stored balances during reads", async () => {
		const card = await seed(data);
		await data.upsert("giftCardTransaction", "transaction_1", {
			id: "transaction_1",
			giftCardId: card.id,
			type: "debit",
			amount: 500,
			balanceAfter: 2_000,
			createdAt: new Date("2025-01-02T00:00:00.000Z"),
		});

		await controller.get(card.id);
		await controller.getByCode(card.code);
		await controller.list();
		await controller.checkBalance(card.code);
		await controller.listTransactions(card.id);
		await controller.countAll();
		await controller.listByCustomer("missing");
		await controller.getStats();

		expect(await data.get("giftCard", card.id)).toEqual(card);
		expect(data.size("giftCardTransaction")).toBe(1);
	});

	it("ignores malformed legacy rows instead of projecting unsafe data", async () => {
		await data.upsert("giftCard", "malformed", {
			id: "malformed",
			code: "GIFT-MALF-ORMD-ROW2",
			initialBalance: "not-a-number",
		});
		await data.upsert("giftCardTransaction", "malformed", {
			id: "malformed",
			giftCardId: "card_1",
			type: "debit",
			amount: "not-a-number",
		});

		await expect(controller.get("malformed")).resolves.toBeNull();
		await expect(controller.list()).resolves.toEqual([]);
		await expect(controller.countAll()).resolves.toBe(0);
		await expect(controller.listTransactions("card_1")).resolves.toEqual([]);
	});

	it("uses persisted status for future-dated and non-expiring cards", async () => {
		const future = await seed(data, {
			status: "disabled",
			expiresAt: "2099-01-01T00:00:00.000Z",
		});

		await expect(controller.checkBalance(future.code)).resolves.toEqual({
			balance: 2_500,
			currency: "USD",
			status: "disabled",
		});
	});

	it("does not re-send an already delivered card", async () => {
		const card = await seed(data, {
			customerId: "customer_1",
			delivered: true,
			recipientEmail: "original@example.com",
		});

		await expect(
			controller.sendGiftCard({
				giftCardId: card.id,
				customerId: "customer_1",
				recipientEmail: "replacement@example.com",
			}),
		).resolves.toBeNull();
		expect(await data.get("giftCard", card.id)).toEqual(card);
	});

	it("returns null when sending a missing card", async () => {
		await expect(
			controller.sendGiftCard({
				giftCardId: "missing",
				customerId: "customer_1",
				recipientEmail: "recipient@example.com",
			}),
		).resolves.toBeNull();
	});
});
