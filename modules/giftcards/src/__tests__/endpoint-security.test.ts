import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGiftCardController } from "../service-impl";

/**
 * Security regression tests for gift-cards endpoints.
 *
 * Gift cards are financial instruments — mishandling them leads to fraud.
 * These tests verify:
 * - Balance isolation: card A operations never affect card B
 * - Double-spending prevention: depleted/disabled/expired cards reject redemptions
 * - Negative amount rejection: no negative debits or credits
 * - Code uniqueness: every generated code is distinct
 * - Expired card handling: expiration enforced at redemption and balance check
 * - Owner isolation: customer-scoped lists never leak other customers' cards
 * - Transaction integrity: transactions reference the correct card and amounts
 * - Cascading delete: removing a card leaves no orphaned transactions
 */
describe("gift-cards endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftCardController(mockData);
	});

	// ── Balance Isolation ──────────────────────────────────────────

	describe("balance isolation between cards", () => {
		it("redeeming from card A does not reduce card B balance", async () => {
			const cardA = await controller.create({ initialBalance: 5000 });
			const cardB = await controller.create({ initialBalance: 3000 });

			await controller.redeem(cardA.code, 2000);

			const balanceB = await controller.checkBalance(cardB.code);
			expect(balanceB?.balance).toBe(3000);
		});

		it("crediting card A does not increase card B balance", async () => {
			const cardA = await controller.create({ initialBalance: 1000 });
			const cardB = await controller.create({ initialBalance: 1000 });

			await controller.credit(cardA.id, 5000);

			const balanceB = await controller.checkBalance(cardB.code);
			expect(balanceB?.balance).toBe(1000);
			const balanceA = await controller.checkBalance(cardA.code);
			expect(balanceA?.balance).toBe(6000);
		});

		it("depleting card A leaves card B fully available", async () => {
			const cardA = await controller.create({ initialBalance: 2000 });
			const cardB = await controller.create({ initialBalance: 2000 });

			await controller.redeem(cardA.code, 2000);

			const resultA = await controller.checkBalance(cardA.code);
			expect(resultA?.status).toBe("depleted");

			const resultB = await controller.redeem(cardB.code, 2000);
			expect(resultB?.giftCard.currentBalance).toBe(0);
			expect(resultB?.transaction.amount).toBe(2000);
		});
	});

	// ── Double-Spending Prevention ─────────────────────────────────

	describe("double-spending prevention", () => {
		it("cannot redeem from a depleted card", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			await controller.redeem(card.code, 1000);

			const result = await controller.redeem(card.code, 1);
			expect(result).toBeNull();
		});

		it("cannot redeem from a disabled card", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.update(card.id, { status: "disabled" });

			const result = await controller.redeem(card.code, 100);
			expect(result).toBeNull();
		});

		it("sequential redemptions track balance accurately", async () => {
			const card = await controller.create({ initialBalance: 10000 });

			const r1 = await controller.redeem(card.code, 3000);
			expect(r1?.giftCard.currentBalance).toBe(7000);

			const r2 = await controller.redeem(card.code, 4000);
			expect(r2?.giftCard.currentBalance).toBe(3000);

			const r3 = await controller.redeem(card.code, 3000);
			expect(r3?.giftCard.currentBalance).toBe(0);
			expect(r3?.giftCard.status).toBe("depleted");

			const r4 = await controller.redeem(card.code, 1);
			expect(r4).toBeNull();
		});

		it("over-redemption is capped at available balance, not the requested amount", async () => {
			const card = await controller.create({ initialBalance: 500 });
			const result = await controller.redeem(card.code, 99999);

			expect(result?.transaction.amount).toBe(500);
			expect(result?.giftCard.currentBalance).toBe(0);
			expect(result?.giftCard.status).toBe("depleted");
		});
	});

	// ── Negative Amount Rejection ──────────────────────────────────

	describe("negative amount rejection", () => {
		it("rejects negative redemption amount", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, -500);
			expect(result).toBeNull();
		});

		it("rejects zero redemption amount", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 0);
			expect(result).toBeNull();
		});

		it("rejects negative credit amount", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.credit(card.id, -1000);
			expect(result).toBeNull();
		});

		it("rejects zero credit amount", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.credit(card.id, 0);
			expect(result).toBeNull();
		});
	});

	// ── Code Uniqueness ────────────────────────────────────────────

	describe("code uniqueness", () => {
		it("generates unique codes across many cards", async () => {
			const cards = await Promise.all(
				Array.from({ length: 50 }, () =>
					controller.create({ initialBalance: 100 }),
				),
			);
			const codes = new Set(cards.map((c) => c.code));
			expect(codes.size).toBe(50);
		});

		it("code format matches GIFT-XXXX-XXXX-XXXX pattern", async () => {
			const card = await controller.create({ initialBalance: 100 });
			expect(card.code).toMatch(/^GIFT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
		});
	});

	// ── Expired Card Handling ──────────────────────────────────────

	describe("expired card handling", () => {
		it("rejects redemption of expired card", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				expiresAt: "2020-01-01",
			});
			const result = await controller.redeem(card.code, 1000);
			expect(result).toBeNull();
		});

		it("checkBalance reports zero balance and expired status for expired card", async () => {
			const card = await controller.create({
				initialBalance: 9999,
				expiresAt: "2019-06-15",
			});
			const result = await controller.checkBalance(card.code);
			expect(result?.balance).toBe(0);
			expect(result?.status).toBe("expired");
		});

		it("card with future expiry date remains redeemable", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				expiresAt: "2099-12-31",
			});
			const result = await controller.redeem(card.code, 1000);
			expect(result).not.toBeNull();
			expect(result?.giftCard.currentBalance).toBe(4000);
		});

		it("card without expiresAt never expires", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			expect(card.expiresAt).toBeUndefined();

			const result = await controller.redeem(card.code, 1000);
			expect(result).not.toBeNull();
			expect(result?.giftCard.currentBalance).toBe(4000);
		});
	});

	// ── Owner Isolation ────────────────────────────────────────────

	describe("owner isolation", () => {
		it("list filtered by customerId never returns another customer cards", async () => {
			await controller.create({
				initialBalance: 5000,
				customerId: "victim",
			});
			await controller.create({
				initialBalance: 3000,
				customerId: "victim",
			});
			await controller.create({
				initialBalance: 1000,
				customerId: "attacker",
			});

			const attackerCards = await controller.list({
				customerId: "attacker",
			});
			expect(attackerCards).toHaveLength(1);
			for (const card of attackerCards) {
				expect(card.customerId).toBe("attacker");
			}
		});

		it("transactions for card A are not visible via listTransactions for card B", async () => {
			const cardA = await controller.create({
				initialBalance: 5000,
				customerId: "userA",
			});
			const cardB = await controller.create({
				initialBalance: 3000,
				customerId: "userB",
			});

			await controller.redeem(cardA.code, 1000);
			await controller.redeem(cardA.code, 500);
			await controller.redeem(cardB.code, 200);

			const txnsA = await controller.listTransactions(cardA.id);
			const txnsB = await controller.listTransactions(cardB.id);

			expect(txnsA).toHaveLength(2);
			expect(txnsB).toHaveLength(1);

			for (const txn of txnsA) {
				expect(txn.giftCardId).toBe(cardA.id);
			}
			for (const txn of txnsB) {
				expect(txn.giftCardId).toBe(cardB.id);
			}
		});
	});

	// ── Transaction Integrity ──────────────────────────────────────

	describe("transaction integrity", () => {
		it("debit transaction records correct giftCardId and type", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 2000, "ord_1");

			expect(result?.transaction.giftCardId).toBe(card.id);
			expect(result?.transaction.type).toBe("debit");
			expect(result?.transaction.amount).toBe(2000);
			expect(result?.transaction.balanceAfter).toBe(3000);
			expect(result?.transaction.orderId).toBe("ord_1");
		});

		it("credit transaction records correct giftCardId and type", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			const result = await controller.credit(card.id, 500, "Refund");

			expect(result?.transaction.giftCardId).toBe(card.id);
			expect(result?.transaction.type).toBe("credit");
			expect(result?.transaction.amount).toBe(500);
			expect(result?.transaction.balanceAfter).toBe(1500);
			expect(result?.transaction.note).toBe("Refund");
		});

		it("each transaction gets a unique id", async () => {
			const card = await controller.create({ initialBalance: 10000 });
			const ids = new Set<string>();

			for (let i = 0; i < 5; i++) {
				const r = await controller.redeem(card.code, 100);
				if (r?.transaction.id) ids.add(r.transaction.id);
			}

			expect(ids.size).toBe(5);
		});
	});

	// ── Cascading Delete Integrity ─────────────────────────────────

	describe("cascading delete — no orphaned transactions", () => {
		it("deleting a card removes all its transactions", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 1000);
			await controller.redeem(card.code, 500);
			await controller.credit(card.id, 200);

			const txnsBefore = await controller.listTransactions(card.id);
			expect(txnsBefore).toHaveLength(3);

			await controller.delete(card.id);

			const txnsAfter = await controller.listTransactions(card.id);
			expect(txnsAfter).toHaveLength(0);
			expect(await controller.get(card.id)).toBeNull();
		});

		it("deleting card A does not remove card B transactions", async () => {
			const cardA = await controller.create({ initialBalance: 5000 });
			const cardB = await controller.create({ initialBalance: 3000 });
			await controller.redeem(cardA.code, 1000);
			await controller.redeem(cardB.code, 500);

			await controller.delete(cardA.id);

			const txnsB = await controller.listTransactions(cardB.id);
			expect(txnsB).toHaveLength(1);
			expect(txnsB[0].giftCardId).toBe(cardB.id);

			const foundB = await controller.get(cardB.id);
			expect(foundB).not.toBeNull();
			expect(foundB?.currentBalance).toBe(2500);
		});
	});

	// ── Non-Existent Resource Handling ─────────────────────────────

	describe("non-existent resource handling", () => {
		it("redeem returns null for fabricated code", async () => {
			const result = await controller.redeem("GIFT-FAKE-CODE-XXXX", 1000);
			expect(result).toBeNull();
		});

		it("checkBalance returns null for fabricated code", async () => {
			const result = await controller.checkBalance("GIFT-DOES-NOT-EXIST");
			expect(result).toBeNull();
		});

		it("credit returns null for fabricated id", async () => {
			const result = await controller.credit("nonexistent-id", 1000);
			expect(result).toBeNull();
		});

		it("update returns null for fabricated id", async () => {
			const result = await controller.update("nonexistent-id", {
				status: "disabled",
			});
			expect(result).toBeNull();
		});

		it("delete returns false for fabricated id", async () => {
			const result = await controller.delete("nonexistent-id");
			expect(result).toBe(false);
		});
	});
});
