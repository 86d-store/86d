import type { ModuleTransactionRunner } from "@86d-app/core/durable-events";
import {
	createMockDataService,
	createMockTransactionRunner,
} from "@86d-app/core/test-utils";
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

function transaction(
	overrides: Partial<GiftCardTransaction> = {},
): GiftCardTransaction {
	return {
		id: "transaction_1",
		giftCardId: "card_1",
		type: "debit",
		amount: 1_000,
		balanceAfter: 4_000,
		createdAt: new Date("2026-01-02T00:00:00.000Z"),
		...overrides,
	};
}

async function seedCard(
	data: DataService,
	overrides: Partial<GiftCard> = {},
): Promise<GiftCard> {
	const card = giftCard(overrides);
	await data.upsert("giftCard", card.id, { ...card });
	return card;
}

async function seedTransaction(
	data: DataService,
	overrides: Partial<GiftCardTransaction> = {},
): Promise<GiftCardTransaction> {
	const entry = transaction(overrides);
	await data.upsert("giftCardTransaction", entry.id, { ...entry });
	return entry;
}

describe("createGiftCardController", () => {
	let data: DataService;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createGiftCardController(
			data,
			createMockTransactionRunner({ data }),
		);
	});

	it("exposes only contained read and delivery operations", () => {
		expect(Object.keys(controller).sort()).toEqual(
			[
				"checkBalance",
				"countAll",
				"get",
				"getByCode",
				"getStats",
				"list",
				"listAdminPage",
				"listByCustomer",
				"listTransactions",
				"sendGiftCard",
			].sort(),
		);
	});

	it("does not expose direct money or destructive primitives", () => {
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
			expect(surface).not.toHaveProperty(method);
		}
	});

	it("reads an existing card by id and code without changing it", async () => {
		const card = await seedCard(data);

		await expect(controller.get(card.id)).resolves.toEqual(card);
		await expect(
			controller.getByCode(card.code.toLowerCase()),
		).resolves.toEqual(card);
		await expect(controller.get("missing")).resolves.toBeNull();
		await expect(controller.getByCode("missing")).resolves.toBeNull();
		expect(data.size("giftCard")).toBe(1);
	});

	it("filters and paginates legacy cards", async () => {
		await seedCard(data, { id: "card_1", customerId: "customer_1" });
		await seedCard(data, {
			id: "card_2",
			code: "GIFT-QRST-UVWX-YZ23",
			customerId: "customer_1",
			status: "disabled",
		});
		await seedCard(data, {
			id: "card_3",
			code: "GIFT-4567-89AB-CDEF",
			customerId: "customer_2",
		});

		await expect(controller.list({ status: "disabled" })).resolves.toEqual([
			expect.objectContaining({ id: "card_2" }),
		]);
		await expect(
			controller.list({ customerId: "customer_1", take: 1, skip: 1 }),
		).resolves.toEqual([expect.objectContaining({ id: "card_2" })]);
		await expect(controller.countAll()).resolves.toBe(3);
	});

	it("searches, sorts, and paginates across the complete admin result set", async () => {
		for (let index = 0; index < 25; index++) {
			await seedCard(data, {
				id: `card_${index.toString().padStart(2, "0")}`,
				code: `GIFT-CARD-${index.toString().padStart(4, "0")}`,
				currentBalance: index,
				recipientEmail:
					index >= 20
						? `matching-${index}@example.com`
						: `other-${index}@example.com`,
				createdAt: new Date(
					`2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
				),
			});
		}

		await expect(
			controller.listAdminPage({
				search: "matching",
				sort: "balance",
				direction: "desc",
				take: 2,
				skip: 1,
			}),
		).resolves.toEqual({
			cards: [
				expect.objectContaining({ id: "card_23" }),
				expect.objectContaining({ id: "card_22" }),
			],
			total: 5,
		});
	});

	it("continues the admin projection beyond one storage read batch", async () => {
		for (let index = 0; index <= 1_000; index += 1) {
			await seedCard(data, {
				id: `batch-card-${index.toString().padStart(4, "0")}`,
				code: `GIFT-BATCH-${index.toString().padStart(4, "0")}`,
				recipientEmail: index === 1_000 ? "last-batch@example.com" : undefined,
			});
		}

		await expect(
			controller.listAdminPage({ search: "last-batch", take: 20, skip: 0 }),
		).resolves.toEqual({
			cards: [expect.objectContaining({ id: "batch-card-1000" })],
			total: 1,
		});
	});

	it("searches the visible status and UTC creation date projection", async () => {
		await seedCard(data, {
			id: "legacy-status",
			status: "archived-by-import",
			createdAt: new Date("2026-03-14T00:00:00.000Z"),
		});

		await expect(
			controller.listAdminPage({ search: "archived-by-import" }),
		).resolves.toMatchObject({ total: 1 });
		await expect(
			controller.listAdminPage({ search: "Mar 14, 2026" }),
		).resolves.toMatchObject({ total: 1 });
	});

	it("checks active, expired, and missing balances", async () => {
		const active = await seedCard(data);
		const expired = await seedCard(data, {
			id: "card_expired",
			code: "GIFT-EXPR-2345-6789",
			expiresAt: "2020-01-01T00:00:00.000Z",
		});

		await expect(controller.checkBalance(active.code)).resolves.toEqual({
			balance: 5_000,
			currency: "USD",
			status: "active",
		});
		await expect(controller.checkBalance(expired.code)).resolves.toEqual({
			balance: 0,
			currency: "USD",
			status: "expired",
		});
		await expect(controller.checkBalance("missing")).resolves.toBeNull();
	});

	it("reads and paginates existing transaction history", async () => {
		await seedTransaction(data, { id: "transaction_1" });
		await seedTransaction(data, { id: "transaction_2", amount: 500 });
		await seedTransaction(data, {
			id: "transaction_other",
			giftCardId: "card_2",
		});

		await expect(
			controller.listTransactions("card_1", { take: 1, skip: 1 }),
		).resolves.toEqual([
			expect.objectContaining({ id: "transaction_2", amount: 500 }),
		]);
		await expect(controller.listTransactions("missing")).resolves.toEqual([]);
	});

	it("keeps unknown legacy status, delivery, and transaction values readable", async () => {
		const card = await seedCard(data, {
			status: "archived-by-legacy-import",
			deliveryMethod: "carrier-pigeon",
		});
		const entry = await seedTransaction(data, {
			type: "legacy-adjustment",
		});

		await expect(controller.get(card.id)).resolves.toMatchObject({
			status: "archived-by-legacy-import",
			deliveryMethod: "carrier-pigeon",
		});
		await expect(controller.listTransactions(card.id)).resolves.toEqual([
			expect.objectContaining({ id: entry.id, type: "legacy-adjustment" }),
		]);
	});

	it("lists only cards owned by the requested customer", async () => {
		await seedCard(data, { id: "owned_1", customerId: "customer_1" });
		await seedCard(data, {
			id: "owned_2",
			code: "GIFT-QRST-UVWX-YZ23",
			customerId: "customer_1",
		});
		await seedCard(data, {
			id: "other",
			code: "GIFT-4567-89AB-CDEF",
			customerId: "customer_2",
		});

		const cards = await controller.listByCustomer("customer_1");
		expect(cards.map((card) => card.id)).toEqual(["owned_1", "owned_2"]);
	});

	it("records delivery intent without claiming that a message was delivered", async () => {
		const card = await seedCard(data, { customerId: "customer_1" });

		const result = await controller.sendGiftCard({
			giftCardId: card.id,
			customerId: "customer_1",
			recipientEmail: "recipient@example.com",
			recipientName: "Recipient",
			senderName: "Sender",
			message: "Enjoy",
		});

		expect(result).toMatchObject({
			recipientEmail: "recipient@example.com",
			recipientName: "Recipient",
			senderName: "Sender",
			message: "Enjoy",
			deliveryMethod: "email",
			delivered: false,
		});
		expect(result?.deliveredAt).toBeUndefined();
		await expect(controller.get(card.id)).resolves.toMatchObject({
			recipientEmail: "recipient@example.com",
			deliveryMethod: "email",
			delivered: false,
		});
		expect((await controller.get(card.id))?.deliveredAt).toBeUndefined();
	});

	it("records only one recipient when concurrent sends target the same card", async () => {
		const runner = createMockTransactionRunner({ data });
		let tail = Promise.resolve();
		const serialTransactions: ModuleTransactionRunner = {
			transaction<T>(work): Promise<T> {
				const result = tail.then(() => runner.transaction(work));
				tail = result.then(
					() => undefined,
					() => undefined,
				);
				return result;
			},
		};
		const lockedController = createGiftCardController(data, serialTransactions);
		const card = await seedCard(data, { customerId: "customer_1" });

		const results = await Promise.all([
			lockedController.sendGiftCard({
				giftCardId: card.id,
				customerId: "customer_1",
				recipientEmail: "first@example.com",
			}),
			lockedController.sendGiftCard({
				giftCardId: card.id,
				customerId: "customer_1",
				recipientEmail: "second@example.com",
			}),
		]);

		expect(results.filter((result) => result !== null)).toHaveLength(1);
		await expect(lockedController.get(card.id)).resolves.toMatchObject({
			recipientEmail: "first@example.com",
			delivered: false,
		});
	});

	it("fails delivery metadata closed without transactional row locking", async () => {
		const unlockedController = createGiftCardController(data);
		const card = await seedCard(data, { customerId: "customer_1" });

		await expect(
			unlockedController.sendGiftCard({
				giftCardId: card.id,
				customerId: "customer_1",
				recipientEmail: "recipient@example.com",
			}),
		).resolves.toBeNull();
		await expect(unlockedController.get(card.id)).resolves.toEqual(card);
	});

	it("allows the recorded purchaser to send a card", async () => {
		const card = await seedCard(data, {
			purchasedByCustomerId: "customer_1",
		});

		await expect(
			controller.sendGiftCard({
				giftCardId: card.id,
				customerId: "customer_1",
				recipientEmail: "recipient@example.com",
			}),
		).resolves.toMatchObject({
			recipientEmail: "recipient@example.com",
			deliveryMethod: "email",
			delivered: false,
		});
	});

	it.each([
		["a different customer", { customerId: "customer_1" }, "customer_2"],
		[
			"a disabled card",
			{ customerId: "customer_1", status: "disabled" as const },
			"customer_1",
		],
		[
			"a delivered card without recipient metadata",
			{
				customerId: "customer_1",
				delivered: true,
			},
			"customer_1",
		],
		[
			"recipient metadata without the delivered flag",
			{
				customerId: "customer_1",
				delivered: false,
				recipientEmail: "first@example.com",
			},
			"customer_1",
		],
		[
			"recipient-name metadata without an email",
			{
				customerId: "customer_1",
				recipientName: "Original recipient",
			},
			"customer_1",
		],
		[
			"sender metadata",
			{
				customerId: "customer_1",
				senderEmail: "sender@example.com",
			},
			"customer_1",
		],
		[
			"scheduled delivery metadata",
			{
				customerId: "customer_1",
				scheduledDeliveryAt: "2099-01-01T00:00:00.000Z",
			},
			"customer_1",
		],
		[
			"a persisted delivery method",
			{
				customerId: "customer_1",
				deliveryMethod: "physical",
			},
			"customer_1",
		],
		[
			"a past-dated card",
			{
				customerId: "customer_1",
				expiresAt: "2020-01-01T00:00:00.000Z",
			},
			"customer_1",
		],
	])("refuses to send for %s", async (_case, overrides, customerId) => {
		const card = await seedCard(data, overrides);

		await expect(
			controller.sendGiftCard({
				giftCardId: card.id,
				customerId,
				recipientEmail: "second@example.com",
			}),
		).resolves.toBeNull();
		await expect(controller.get(card.id)).resolves.toEqual(card);
	});

	it("projects statistics from existing cards and transactions", async () => {
		await seedCard(data, { id: "active", initialBalance: 5_000 });
		await seedCard(data, {
			id: "depleted",
			code: "GIFT-QRST-UVWX-YZ23",
			initialBalance: 3_000,
			currentBalance: 0,
			status: "depleted",
		});
		await seedCard(data, {
			id: "disabled",
			code: "GIFT-4567-89AB-CDEF",
			initialBalance: 2_000,
			currentBalance: 2_000,
			status: "disabled",
		});
		await seedCard(data, {
			id: "expired",
			code: "GIFT-GHJK-MNPQ-RSTU",
			initialBalance: 1_000,
			currentBalance: 1_000,
			expiresAt: "2020-01-01T00:00:00.000Z",
		});
		await seedCard(data, {
			id: "status_expired",
			code: "GIFT-STAT-EXPR-2345",
			initialBalance: 1_000,
			currentBalance: 1_000,
			status: "expired",
		});
		await seedCard(data, {
			id: "legacy_unknown",
			code: "GIFT-UNKN-STAT-2345",
			initialBalance: 500,
			currentBalance: 500,
			status: "legacy-hold",
		});
		await seedTransaction(data, { amount: 1_500 });
		await seedTransaction(data, {
			id: "credit_1",
			type: "credit",
			amount: 500,
		});

		await expect(controller.getStats()).resolves.toEqual({
			totalIssued: 6,
			totalActive: 1,
			totalDepleted: 1,
			totalDisabled: 1,
			totalExpired: 2,
			totalIssuedValue: 12_500,
			totalRedeemedValue: 1_500,
			totalOutstandingBalance: 9_500,
		});
	});
});
