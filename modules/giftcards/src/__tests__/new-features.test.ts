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
	entry: GiftCardTransaction,
): Promise<void> {
	await data.upsert("giftCardTransaction", entry.id, { ...entry });
}

describe("gift card retained features", () => {
	let data: DataService;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createGiftCardController(
			data,
			createMockTransactionRunner({ data }),
		);
	});

	describe("sendGiftCard", () => {
		it("records recipient details without changing value", async () => {
			const stored = await seedCard(data, { customerId: "customer_1" });

			const sent = await controller.sendGiftCard({
				giftCardId: stored.id,
				customerId: "customer_1",
				recipientEmail: "friend@example.com",
				recipientName: "Friend",
				senderName: "Customer",
				message: "Happy birthday",
			});

			expect(sent).toMatchObject({
				currentBalance: 5_000,
				initialBalance: 5_000,
				status: "active",
				recipientEmail: "friend@example.com",
				recipientName: "Friend",
				senderName: "Customer",
				message: "Happy birthday",
				deliveryMethod: "email",
				delivered: false,
			});
			expect(sent?.deliveredAt).toBeUndefined();
			expect(data.size("giftCardTransaction")).toBe(0);
		});

		it("does not forward an already delivered card", async () => {
			const stored = await seedCard(data, {
				customerId: "customer_1",
				delivered: true,
				recipientEmail: "first@example.com",
			});

			await expect(
				controller.sendGiftCard({
					giftCardId: stored.id,
					customerId: "customer_1",
					recipientEmail: "second@example.com",
				}),
			).resolves.toBeNull();
		});
	});

	describe("listByCustomer", () => {
		it("supports bounded pagination over owned cards", async () => {
			await seedCard(data, { id: "card_1", customerId: "customer_1" });
			await seedCard(data, {
				id: "card_2",
				code: "GIFT-QRST-UVWX-YZ23",
				customerId: "customer_1",
			});
			await seedCard(data, {
				id: "card_3",
				code: "GIFT-4567-89AB-CDEF",
				customerId: "customer_1",
			});

			await expect(
				controller.listByCustomer("customer_1", { take: 1, skip: 1 }),
			).resolves.toEqual([expect.objectContaining({ id: "card_2" })]);
		});
	});

	describe("getStats", () => {
		it("counts legacy status and debit history without mutating either", async () => {
			const active = await seedCard(data, {
				id: "active",
				initialBalance: 5_000,
				currentBalance: 4_000,
			});
			await seedCard(data, {
				id: "depleted",
				code: "GIFT-QRST-UVWX-YZ23",
				initialBalance: 3_000,
				currentBalance: 0,
				status: "depleted",
			});
			const debit: GiftCardTransaction = {
				id: "debit_1",
				giftCardId: active.id,
				type: "debit",
				amount: 1_000,
				balanceAfter: 4_000,
				createdAt: new Date("2026-01-02T00:00:00.000Z"),
			};
			await seedTransaction(data, debit);

			await expect(controller.getStats()).resolves.toEqual({
				totalIssued: 2,
				totalActive: 1,
				totalDepleted: 1,
				totalDisabled: 0,
				totalExpired: 0,
				totalIssuedValue: 8_000,
				totalRedeemedValue: 1_000,
				totalOutstandingBalance: 4_000,
			});
			expect(await data.get("giftCard", active.id)).toEqual(active);
			expect(await data.get("giftCardTransaction", debit.id)).toEqual(debit);
		});
	});
});
