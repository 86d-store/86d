import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateGiftCardParams } from "../service";
import { createGiftCardController } from "../service-impl";

/**
 * Admin workflow and edge-case tests for the gift-cards module.
 *
 * Covers: card creation, redemption, balance checking, credits, expiration,
 * transaction history, deletion, listing, and code uniqueness.
 */

function makeCard(
	overrides: Partial<CreateGiftCardParams> = {},
): CreateGiftCardParams {
	return {
		initialBalance: 5000,
		...overrides,
	};
}

describe("gift-cards — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftCardController(mockData);
	});

	// ── Card creation ──────────────────────────────────────────────

	describe("card creation", () => {
		it("creates a card with default values", async () => {
			const card = await controller.create(makeCard());
			expect(card.id).toBeDefined();
			expect(card.code).toMatch(/^GIFT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
			expect(card.initialBalance).toBe(5000);
			expect(card.currentBalance).toBe(5000);
			expect(card.currency).toBe("USD");
			expect(card.status).toBe("active");
		});

		it("creates a card with custom currency", async () => {
			const card = await controller.create(makeCard({ currency: "EUR" }));
			expect(card.currency).toBe("EUR");
		});

		it("creates a card with expiration date", async () => {
			const expires = "2027-12-31";
			const card = await controller.create(makeCard({ expiresAt: expires }));
			expect(card.expiresAt).toBe(expires);
		});

		it("creates a card with recipient email", async () => {
			const card = await controller.create(
				makeCard({ recipientEmail: "gift@example.com" }),
			);
			expect(card.recipientEmail).toBe("gift@example.com");
		});

		it("creates a card with purchase order reference", async () => {
			const card = await controller.create(
				makeCard({ purchaseOrderId: "order_99" }),
			);
			expect(card.purchaseOrderId).toBe("order_99");
		});

		it("creates a card with a note", async () => {
			const card = await controller.create(
				makeCard({ note: "Happy birthday!" }),
			);
			expect(card.note).toBe("Happy birthday!");
		});

		it("each card gets a unique code", async () => {
			const codes = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const card = await controller.create(makeCard());
				codes.add(card.code);
			}
			expect(codes.size).toBe(20);
		});

		it("creates cards with various denominations", async () => {
			const denominations = [100, 500, 1000, 2500, 5000, 10000, 50000];
			for (const amount of denominations) {
				const card = await controller.create(
					makeCard({ initialBalance: amount }),
				);
				expect(card.initialBalance).toBe(amount);
				expect(card.currentBalance).toBe(amount);
			}
		});
	});

	// ── Get by code ────────────────────────────────────────────────

	describe("get by code", () => {
		it("finds card by exact code", async () => {
			const card = await controller.create(makeCard());
			const found = await controller.getByCode(card.code);
			expect(found?.id).toBe(card.id);
		});

		it("finds card by lowercase code (case-insensitive)", async () => {
			const card = await controller.create(makeCard());
			const found = await controller.getByCode(card.code.toLowerCase());
			expect(found?.id).toBe(card.id);
		});

		it("returns null for non-existent code", async () => {
			const found = await controller.getByCode("GIFT-XXXX-XXXX-XXXX");
			expect(found).toBeNull();
		});
	});

	// ── Redemption ─────────────────────────────────────────────────

	describe("redemption", () => {
		it("redeems full balance", async () => {
			const card = await controller.create(makeCard({ initialBalance: 3000 }));
			const result = await controller.redeem(card.code, 3000, "order_1");
			expect(result?.transaction.amount).toBe(3000);
			expect(result?.giftCard.currentBalance).toBe(0);
			expect(result?.giftCard.status).toBe("depleted");
		});

		it("redeems partial balance", async () => {
			const card = await controller.create(makeCard({ initialBalance: 5000 }));
			const result = await controller.redeem(card.code, 2000, "order_1");
			expect(result?.transaction.amount).toBe(2000);
			expect(result?.giftCard.currentBalance).toBe(3000);
			expect(result?.giftCard.status).toBe("active");
		});

		it("caps redemption to available balance", async () => {
			const card = await controller.create(makeCard({ initialBalance: 1000 }));
			const result = await controller.redeem(card.code, 5000, "order_1");
			expect(result?.transaction.amount).toBe(1000);
			expect(result?.giftCard.currentBalance).toBe(0);
			expect(result?.giftCard.status).toBe("depleted");
		});

		it("returns null for zero amount redemption", async () => {
			const card = await controller.create(makeCard());
			const result = await controller.redeem(card.code, 0);
			expect(result).toBeNull();
		});

		it("returns null for negative amount redemption", async () => {
			const card = await controller.create(makeCard());
			const result = await controller.redeem(card.code, -100);
			expect(result).toBeNull();
		});

		it("returns null for non-existent code", async () => {
			const result = await controller.redeem("GIFT-FAKE-CODE-HERE", 1000);
			expect(result).toBeNull();
		});

		it("returns null for depleted card", async () => {
			const card = await controller.create(makeCard({ initialBalance: 1000 }));
			await controller.redeem(card.code, 1000);
			const result = await controller.redeem(card.code, 100);
			expect(result).toBeNull();
		});

		it("returns null for disabled card", async () => {
			const card = await controller.create(makeCard());
			await controller.update(card.id, { status: "disabled" });
			const result = await controller.redeem(card.code, 100);
			expect(result).toBeNull();
		});

		it("multiple partial redemptions drain balance correctly", async () => {
			const card = await controller.create(makeCard({ initialBalance: 5000 }));
			await controller.redeem(card.code, 1000);
			await controller.redeem(card.code, 1500);
			const result = await controller.redeem(card.code, 1000);

			expect(result?.giftCard.currentBalance).toBe(1500);
			expect(result?.transaction.balanceAfter).toBe(1500);
		});

		it("records orderId in transaction", async () => {
			const card = await controller.create(makeCard());
			const result = await controller.redeem(card.code, 1000, "order_42");
			expect(result?.transaction.orderId).toBe("order_42");
		});

		it("handles redemption without orderId", async () => {
			const card = await controller.create(makeCard());
			const result = await controller.redeem(card.code, 1000);
			expect(result?.transaction.orderId).toBeUndefined();
		});
	});

	// ── Expiration ─────────────────────────────────────────────────

	describe("expiration", () => {
		it("checkBalance returns expired status for past-dated card", async () => {
			const pastDate = "2020-01-01";
			const card = await controller.create(makeCard({ expiresAt: pastDate }));
			const result = await controller.checkBalance(card.code);
			expect(result?.status).toBe("expired");
			expect(result?.balance).toBe(0);
		});

		it("redeem returns null for expired card", async () => {
			const pastDate = "2020-01-01";
			const card = await controller.create(makeCard({ expiresAt: pastDate }));
			const result = await controller.redeem(card.code, 1000);
			expect(result).toBeNull();
		});

		it("checkBalance returns active status for future-dated card", async () => {
			const futureDate = "2099-12-31";
			const card = await controller.create(makeCard({ expiresAt: futureDate }));
			const result = await controller.checkBalance(card.code);
			expect(result?.status).toBe("active");
			expect(result?.balance).toBe(5000);
		});

		it("checkBalance returns null for non-existent code", async () => {
			const result = await controller.checkBalance("GIFT-NONE-NONE-NONE");
			expect(result).toBeNull();
		});
	});

	// ── Credit (add funds) ─────────────────────────────────────────

	describe("credit (add funds)", () => {
		it("adds funds to an active card", async () => {
			const card = await controller.create(makeCard({ initialBalance: 1000 }));
			const result = await controller.credit(card.id, 2000, "Bonus");
			expect(result?.giftCard.currentBalance).toBe(3000);
			expect(result?.transaction.type).toBe("credit");
			expect(result?.transaction.amount).toBe(2000);
		});

		it("re-activates a depleted card when credited", async () => {
			const card = await controller.create(makeCard({ initialBalance: 1000 }));
			await controller.redeem(card.code, 1000);
			const result = await controller.credit(card.id, 500);
			expect(result?.giftCard.status).toBe("active");
			expect(result?.giftCard.currentBalance).toBe(500);
		});

		it("returns null for zero credit", async () => {
			const card = await controller.create(makeCard());
			const result = await controller.credit(card.id, 0);
			expect(result).toBeNull();
		});

		it("returns null for negative credit", async () => {
			const card = await controller.create(makeCard());
			const result = await controller.credit(card.id, -100);
			expect(result).toBeNull();
		});

		it("returns null for non-existent card", async () => {
			const result = await controller.credit("fake-id", 1000);
			expect(result).toBeNull();
		});

		it("records orderId and note in credit transaction", async () => {
			const card = await controller.create(makeCard());
			const result = await controller.credit(
				card.id,
				1000,
				"Refund applied",
				"order_88",
			);
			expect(result?.transaction.note).toBe("Refund applied");
			expect(result?.transaction.orderId).toBe("order_88");
		});
	});

	// ── Update / delete ────────────────────────────────────────────

	describe("update and delete", () => {
		it("updates card status", async () => {
			const card = await controller.create(makeCard());
			const updated = await controller.update(card.id, { status: "disabled" });
			expect(updated?.status).toBe("disabled");
		});

		it("updates expiration date", async () => {
			const card = await controller.create(makeCard());
			const newDate = "2028-06-15";
			const updated = await controller.update(card.id, {
				expiresAt: newDate,
			});
			expect(updated?.expiresAt).toBe(newDate);
		});

		it("updates note", async () => {
			const card = await controller.create(makeCard());
			const updated = await controller.update(card.id, {
				note: "Updated note",
			});
			expect(updated?.note).toBe("Updated note");
		});

		it("update returns null for non-existent card", async () => {
			const result = await controller.update("fake-id", { note: "test" });
			expect(result).toBeNull();
		});

		it("deletes a card and its transactions", async () => {
			const card = await controller.create(makeCard());
			await controller.redeem(card.code, 1000);
			const deleted = await controller.delete(card.id);
			expect(deleted).toBe(true);
			const found = await controller.get(card.id);
			expect(found).toBeNull();
		});

		it("delete returns false for non-existent card", async () => {
			const result = await controller.delete("fake-id");
			expect(result).toBe(false);
		});
	});

	// ── Listing ────────────────────────────────────────────────────

	describe("listing", () => {
		it("lists all cards", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create(makeCard());
			}
			const cards = await controller.list({});
			expect(cards).toHaveLength(5);
		});

		it("filters by status", async () => {
			const c1 = await controller.create(makeCard());
			await controller.create(makeCard());
			await controller.update(c1.id, { status: "disabled" });

			const active = await controller.list({ status: "active" });
			expect(active).toHaveLength(1);

			const disabled = await controller.list({ status: "disabled" });
			expect(disabled).toHaveLength(1);
		});

		it("filters by customerId", async () => {
			await controller.create(makeCard({ customerId: "cust_1" }));
			await controller.create(makeCard({ customerId: "cust_1" }));
			await controller.create(makeCard({ customerId: "cust_2" }));

			const cards = await controller.list({ customerId: "cust_1" });
			expect(cards).toHaveLength(2);
		});

		it("paginates cards", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.create(makeCard());
			}
			const page = await controller.list({ take: 3, skip: 2 });
			expect(page).toHaveLength(3);
		});

		it("returns empty for non-matching filter", async () => {
			await controller.create(makeCard());
			const cards = await controller.list({ customerId: "nonexistent" });
			expect(cards).toHaveLength(0);
		});
	});

	// ── Transaction listing ────────────────────────────────────────

	describe("transaction listing", () => {
		it("lists transactions for a card", async () => {
			const card = await controller.create(makeCard());
			await controller.redeem(card.code, 1000, "o1");
			await controller.redeem(card.code, 500, "o2");
			await controller.credit(card.id, 200, "refund");

			const txns = await controller.listTransactions(card.id, {});
			expect(txns).toHaveLength(3);
		});

		it("paginates transactions", async () => {
			const card = await controller.create(makeCard());
			for (let i = 0; i < 8; i++) {
				await controller.redeem(card.code, 100);
			}
			const page = await controller.listTransactions(card.id, {
				take: 3,
				skip: 2,
			});
			expect(page).toHaveLength(3);
		});

		it("returns empty for card with no transactions", async () => {
			const card = await controller.create(makeCard());
			const txns = await controller.listTransactions(card.id, {});
			expect(txns).toHaveLength(0);
		});
	});

	// ── Count ──────────────────────────────────────────────────────

	describe("countAll", () => {
		it("returns zero when no cards exist", async () => {
			expect(await controller.countAll()).toBe(0);
		});

		it("counts all cards regardless of status", async () => {
			const c1 = await controller.create(makeCard());
			await controller.create(makeCard());
			await controller.update(c1.id, { status: "disabled" });

			expect(await controller.countAll()).toBe(2);
		});
	});
});
