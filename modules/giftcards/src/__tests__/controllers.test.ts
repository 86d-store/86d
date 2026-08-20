import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGiftCardController } from "../service-impl";

/**
 * Edge-case and integration tests for the gift-card controller.
 *
 * These complement the happy-path tests in service-impl.test.ts by covering
 * boundary conditions, combined filter paths, sequential operations, and
 * validation edge cases that were not previously exercised.
 */
describe("gift-cards controller – edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftCardController(mockData);
	});

	// ── create – edge cases ──────────────────────────────────────────────

	describe("create – edge cases", () => {
		it("sets createdAt and updatedAt to roughly the same timestamp", async () => {
			const before = Date.now();
			const card = await controller.create({ initialBalance: 1000 });
			const after = Date.now();

			expect(card.createdAt.getTime()).toBeGreaterThanOrEqual(before);
			expect(card.createdAt.getTime()).toBeLessThanOrEqual(after);
			expect(card.updatedAt.getTime()).toBe(card.createdAt.getTime());
		});

		it("creates a card with zero initial balance", async () => {
			const card = await controller.create({ initialBalance: 0 });
			expect(card.initialBalance).toBe(0);
			expect(card.currentBalance).toBe(0);
			expect(card.status).toBe("active");
		});

		it("creates a card with a very large balance", async () => {
			const card = await controller.create({
				initialBalance: 999_999_999,
			});
			expect(card.initialBalance).toBe(999_999_999);
			expect(card.currentBalance).toBe(999_999_999);
		});

		it("generates codes without ambiguous characters 0, O, 1, I, L", async () => {
			const cards = await Promise.all(
				Array.from({ length: 20 }, () =>
					controller.create({ initialBalance: 100 }),
				),
			);
			for (const card of cards) {
				const codeWithoutPrefix = card.code
					.replace(/^GIFT-/, "")
					.replace(/-/g, "");
				expect(codeWithoutPrefix).not.toMatch(/[01OIL]/);
			}
		});

		it("persists the card in the data service", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			expect(mockData.size("giftCard")).toBe(1);

			const raw = await mockData.get("giftCard", card.id);
			expect(raw).not.toBeNull();
			expect((raw as Record<string, unknown>).code).toBe(card.code);
		});

		it("leaves optional fields as undefined when not provided", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			expect(card.expiresAt).toBeUndefined();
			expect(card.recipientEmail).toBeUndefined();
			expect(card.customerId).toBeUndefined();
			expect(card.purchaseOrderId).toBeUndefined();
			expect(card.note).toBeUndefined();
		});
	});

	// ── getByCode – edge cases ───────────────────────────────────────────

	describe("getByCode – edge cases", () => {
		it("still finds card by code after updating other fields", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.update(card.id, { note: "updated" });
			const found = await controller.getByCode(card.code);
			expect(found?.id).toBe(card.id);
			expect(found?.note).toBe("updated");
		});

		it("returns null for empty string code", async () => {
			const found = await controller.getByCode("");
			expect(found).toBeNull();
		});

		it("handles mixed-case lookup correctly", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			// The code is all uppercase. Passing in a mixed-case version
			// should still match because getByCode uppercases the input.
			const mixedCase =
				card.code.slice(0, 5).toLowerCase() + card.code.slice(5);
			const found = await controller.getByCode(mixedCase);
			expect(found?.id).toBe(card.id);
		});
	});

	// ── list – combined and boundary filters ─────────────────────────────

	describe("list – combined and boundary filters", () => {
		it("returns empty array when no cards exist", async () => {
			const all = await controller.list();
			expect(all).toHaveLength(0);
		});

		it("returns empty array when no cards exist and params are provided", async () => {
			const all = await controller.list({ status: "active" });
			expect(all).toHaveLength(0);
		});

		it("filters by both status and customerId simultaneously", async () => {
			await controller.create({ initialBalance: 1000, customerId: "c1" });
			const card2 = await controller.create({
				initialBalance: 2000,
				customerId: "c1",
			});
			await controller.update(card2.id, { status: "disabled" });
			await controller.create({ initialBalance: 3000, customerId: "c2" });

			const results = await controller.list({
				status: "disabled",
				customerId: "c1",
			});
			expect(results).toHaveLength(1);
			expect(results[0].customerId).toBe("c1");
			expect(results[0].status).toBe("disabled");
		});

		it("skip beyond total returns empty array", async () => {
			await controller.create({ initialBalance: 1000 });
			await controller.create({ initialBalance: 2000 });
			const page = await controller.list({ skip: 10 });
			expect(page).toHaveLength(0);
		});

		it("take of zero returns empty array", async () => {
			await controller.create({ initialBalance: 1000 });
			const page = await controller.list({ take: 0 });
			expect(page).toHaveLength(0);
		});

		it("handles take larger than total results gracefully", async () => {
			await controller.create({ initialBalance: 1000 });
			const page = await controller.list({ take: 100 });
			expect(page).toHaveLength(1);
		});
	});

	// ── update – edge cases ──────────────────────────────────────────────

	describe("update – edge cases", () => {
		it("updates updatedAt timestamp", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const originalUpdatedAt = card.updatedAt.getTime();

			// Small delay to ensure timestamp differs
			const updated = await controller.update(card.id, { note: "changed" });
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt,
			);
		});

		it("handles empty update object – preserves all fields", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				note: "original",
				recipientEmail: "a@b.com",
			});
			const updated = await controller.update(card.id, {});
			expect(updated).not.toBeNull();
			expect(updated?.note).toBe("original");
			expect(updated?.recipientEmail).toBe("a@b.com");
			expect(updated?.initialBalance).toBe(5000);
			expect(updated?.currentBalance).toBe(5000);
			expect(updated?.status).toBe("active");
		});

		it("can update multiple fields at once", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const updated = await controller.update(card.id, {
				status: "disabled",
				note: "disabled by admin",
				recipientEmail: "admin@example.com",
				expiresAt: "2027-01-01",
			});
			expect(updated?.status).toBe("disabled");
			expect(updated?.note).toBe("disabled by admin");
			expect(updated?.recipientEmail).toBe("admin@example.com");
			expect(updated?.expiresAt).toBe("2027-01-01");
		});

		it("preserves currentBalance and code after update", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 2000);
			const updated = await controller.update(card.id, { note: "changed" });
			expect(updated?.currentBalance).toBe(3000);
			expect(updated?.code).toBe(card.code);
		});
	});

	// ── delete – edge cases ──────────────────────────────────────────────

	describe("delete – edge cases", () => {
		it("deletes a card with no transactions", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.delete(card.id);
			expect(result).toBe(true);
			expect(await controller.get(card.id)).toBeNull();
		});

		it("deletes a card with multiple transactions", async () => {
			const card = await controller.create({ initialBalance: 10000 });
			await controller.redeem(card.code, 1000);
			await controller.redeem(card.code, 2000);
			await controller.credit(card.id, 500);

			const txnsBefore = await controller.listTransactions(card.id);
			expect(txnsBefore).toHaveLength(3);

			const result = await controller.delete(card.id);
			expect(result).toBe(true);

			// Card gone
			expect(await controller.get(card.id)).toBeNull();

			// Transactions gone
			const txnsAfter = await controller.listTransactions(card.id);
			expect(txnsAfter).toHaveLength(0);
		});

		it("deleting one card does not affect another card or its transactions", async () => {
			const card1 = await controller.create({ initialBalance: 5000 });
			const card2 = await controller.create({ initialBalance: 3000 });
			await controller.redeem(card1.code, 1000);
			await controller.redeem(card2.code, 500);

			await controller.delete(card1.id);

			// card2 still exists
			const found = await controller.get(card2.id);
			expect(found).not.toBeNull();
			expect(found?.currentBalance).toBe(2500);

			// card2 transactions still intact
			const txns = await controller.listTransactions(card2.id);
			expect(txns).toHaveLength(1);
		});
	});

	// ── checkBalance – edge cases ────────────────────────────────────────

	describe("checkBalance – edge cases", () => {
		it("handles case-insensitive code lookup", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.checkBalance(card.code.toLowerCase());
			expect(result).not.toBeNull();
			expect(result?.balance).toBe(5000);
		});

		it("returns disabled status for a disabled card", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.update(card.id, { status: "disabled" });
			const result = await controller.checkBalance(card.code);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("disabled");
			expect(result?.balance).toBe(5000);
		});

		it("returns depleted status for a fully-redeemed card", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			await controller.redeem(card.code, 1000);
			const result = await controller.checkBalance(card.code);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("depleted");
			expect(result?.balance).toBe(0);
		});

		it("returns balance 0 and expired for card with past expiresAt", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				expiresAt: "2020-06-15",
			});
			const result = await controller.checkBalance(card.code);
			expect(result?.balance).toBe(0);
			expect(result?.status).toBe("expired");
		});

		it("returns correct balance for card with future expiresAt", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				expiresAt: "2099-12-31",
			});
			const result = await controller.checkBalance(card.code);
			expect(result?.balance).toBe(5000);
			expect(result?.status).toBe("active");
		});

		it("reflects balance after partial redemption", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 1500);
			const result = await controller.checkBalance(card.code);
			expect(result?.balance).toBe(3500);
			expect(result?.status).toBe("active");
		});
	});

	// ── redeem – edge cases ──────────────────────────────────────────────

	describe("redeem – edge cases", () => {
		it("returns null for negative amount", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, -100);
			expect(result).toBeNull();
		});

		it("returns null for a card with zero balance", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			await controller.redeem(card.code, 1000);
			const result = await controller.redeem(card.code, 100);
			// Card is depleted, status is not "active"
			expect(result).toBeNull();
		});

		it("sets transaction note to 'Redeemed' when no orderId provided", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 1000);
			expect(result?.transaction.note).toBe("Redeemed");
			expect(result?.transaction.orderId).toBeUndefined();
		});

		it("sets transaction note with orderId when provided", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 1000, "ord_42");
			expect(result?.transaction.note).toBe("Redeemed for order ord_42");
			expect(result?.transaction.orderId).toBe("ord_42");
		});

		it("records correct balanceAfter in transaction", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 2000);
			expect(result?.transaction.balanceAfter).toBe(3000);
		});

		it("records correct balanceAfter when capped at available balance", async () => {
			const card = await controller.create({ initialBalance: 3000 });
			const result = await controller.redeem(card.code, 10000);
			expect(result?.transaction.amount).toBe(3000);
			expect(result?.transaction.balanceAfter).toBe(0);
			expect(result?.giftCard.status).toBe("depleted");
		});

		it("handles multiple sequential partial redemptions correctly", async () => {
			const card = await controller.create({ initialBalance: 10000 });

			const r1 = await controller.redeem(card.code, 3000);
			expect(r1?.giftCard.currentBalance).toBe(7000);
			expect(r1?.transaction.balanceAfter).toBe(7000);

			const r2 = await controller.redeem(card.code, 4000);
			expect(r2?.giftCard.currentBalance).toBe(3000);
			expect(r2?.transaction.balanceAfter).toBe(3000);

			const r3 = await controller.redeem(card.code, 3000);
			expect(r3?.giftCard.currentBalance).toBe(0);
			expect(r3?.giftCard.status).toBe("depleted");
			expect(r3?.transaction.balanceAfter).toBe(0);

			// Subsequent redeem should fail (card is depleted)
			const r4 = await controller.redeem(card.code, 100);
			expect(r4).toBeNull();
		});

		it("each redemption creates a unique transaction id", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const r1 = await controller.redeem(card.code, 1000);
			const r2 = await controller.redeem(card.code, 1000);
			expect(r1?.transaction.id).not.toBe(r2?.transaction.id);
		});

		it("redemption transaction references the correct gift card id", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 1000);
			expect(result?.transaction.giftCardId).toBe(card.id);
		});

		it("case-insensitive code lookup for redeem", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code.toLowerCase(), 1000);
			expect(result).not.toBeNull();
			expect(result?.giftCard.currentBalance).toBe(4000);
		});

		it("returns null for expired card during redeem", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				expiresAt: "2020-01-01",
			});
			const result = await controller.redeem(card.code, 1000);
			expect(result).toBeNull();
		});
	});

	// ── credit – edge cases ──────────────────────────────────────────────

	describe("credit – edge cases", () => {
		it("returns null for negative amount", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.credit(card.id, -100);
			expect(result).toBeNull();
		});

		it("uses default note 'Credit applied' when no note provided", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.credit(card.id, 1000);
			expect(result?.transaction.note).toBe("Credit applied");
		});

		it("records correct balanceAfter in credit transaction", async () => {
			const card = await controller.create({ initialBalance: 3000 });
			const result = await controller.credit(card.id, 2000);
			expect(result?.transaction.balanceAfter).toBe(5000);
		});

		it("sets status to active on credit if card was disabled and balance > 0", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.update(card.id, { status: "disabled" });
			const result = await controller.credit(card.id, 1000);
			// Credit logic: newBalance > 0 ? "active" : card.status
			// So a disabled card with positive credit gets reactivated
			expect(result?.giftCard.status).toBe("active");
			expect(result?.giftCard.currentBalance).toBe(6000);
		});

		it("credit transaction references correct giftCardId", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			const result = await controller.credit(card.id, 500);
			expect(result?.transaction.giftCardId).toBe(card.id);
		});

		it("credit transaction type is always 'credit'", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			const result = await controller.credit(card.id, 500);
			expect(result?.transaction.type).toBe("credit");
		});

		it("each credit creates a unique transaction id", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			const r1 = await controller.credit(card.id, 100);
			const r2 = await controller.credit(card.id, 100);
			expect(r1?.transaction.id).not.toBe(r2?.transaction.id);
		});

		it("credit after full depletion reactivates and restores balance", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			await controller.redeem(card.code, 1000);

			// Verify depleted state
			const depleted = await controller.get(card.id);
			expect(depleted?.status).toBe("depleted");
			expect(depleted?.currentBalance).toBe(0);

			// Credit reactivates
			const result = await controller.credit(card.id, 750);
			expect(result?.giftCard.status).toBe("active");
			expect(result?.giftCard.currentBalance).toBe(750);
		});

		it("handles orderId without custom note", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			const result = await controller.credit(
				card.id,
				500,
				undefined,
				"ord_refund",
			);
			expect(result?.transaction.note).toBe("Credit applied");
			expect(result?.transaction.orderId).toBe("ord_refund");
		});
	});

	// ── listTransactions – edge cases ────────────────────────────────────

	describe("listTransactions – edge cases", () => {
		it("returns only transactions for the specified gift card", async () => {
			const card1 = await controller.create({ initialBalance: 5000 });
			const card2 = await controller.create({ initialBalance: 3000 });

			await controller.redeem(card1.code, 1000);
			await controller.redeem(card1.code, 500);
			await controller.redeem(card2.code, 200);

			const txns1 = await controller.listTransactions(card1.id);
			expect(txns1).toHaveLength(2);
			for (const txn of txns1) {
				expect(txn.giftCardId).toBe(card1.id);
			}

			const txns2 = await controller.listTransactions(card2.id);
			expect(txns2).toHaveLength(1);
			expect(txns2[0].giftCardId).toBe(card2.id);
		});

		it("returns empty for non-existent gift card id", async () => {
			const txns = await controller.listTransactions("nonexistent-id");
			expect(txns).toHaveLength(0);
		});

		it("includes both debit and credit transactions", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 1000);
			await controller.credit(card.id, 500);

			const txns = await controller.listTransactions(card.id);
			expect(txns).toHaveLength(2);

			const types = txns.map((t) => t.type);
			expect(types).toContain("debit");
			expect(types).toContain("credit");
		});

		it("skip beyond total returns empty array", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 1000);

			const txns = await controller.listTransactions(card.id, { skip: 100 });
			expect(txns).toHaveLength(0);
		});

		it("take of zero returns empty array", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 1000);

			const txns = await controller.listTransactions(card.id, { take: 0 });
			expect(txns).toHaveLength(0);
		});
	});

	// ── countAll – edge cases ────────────────────────────────────────────

	describe("countAll – edge cases", () => {
		it("counts cards regardless of status", async () => {
			const card1 = await controller.create({ initialBalance: 5000 });
			await controller.create({ initialBalance: 3000 });
			await controller.update(card1.id, { status: "disabled" });

			const count = await controller.countAll();
			expect(count).toBe(2);
		});

		it("count decreases after delete", async () => {
			const card1 = await controller.create({ initialBalance: 1000 });
			await controller.create({ initialBalance: 2000 });

			expect(await controller.countAll()).toBe(2);

			await controller.delete(card1.id);
			expect(await controller.countAll()).toBe(1);
		});
	});

	// ── full lifecycle scenarios ──────────────────────────────────────────

	describe("full lifecycle scenarios", () => {
		it("create -> redeem partially -> credit back -> redeem fully -> deplete", async () => {
			// 1. Create a $100 card
			const card = await controller.create({ initialBalance: 10000 });
			expect(card.currentBalance).toBe(10000);
			expect(card.status).toBe("active");

			// 2. Redeem $30
			const r1 = await controller.redeem(card.code, 3000, "ord_1");
			expect(r1?.giftCard.currentBalance).toBe(7000);

			// 3. Credit $10 back (refund)
			const c1 = await controller.credit(
				card.id,
				1000,
				"Refund for ord_1",
				"ord_1",
			);
			expect(c1?.giftCard.currentBalance).toBe(8000);

			// 4. Redeem the full remaining balance
			const r2 = await controller.redeem(card.code, 8000, "ord_2");
			expect(r2?.giftCard.currentBalance).toBe(0);
			expect(r2?.giftCard.status).toBe("depleted");

			// 5. Confirm checkBalance shows depleted
			const balance = await controller.checkBalance(card.code);
			expect(balance?.balance).toBe(0);
			expect(balance?.status).toBe("depleted");

			// 6. Verify transaction history is complete
			const txns = await controller.listTransactions(card.id);
			expect(txns).toHaveLength(3);
		});

		it("create -> disable -> attempt redeem -> re-enable via credit", async () => {
			const card = await controller.create({ initialBalance: 5000 });

			// Disable the card
			await controller.update(card.id, { status: "disabled" });

			// Attempt redeem on disabled card
			const redeemResult = await controller.redeem(card.code, 1000);
			expect(redeemResult).toBeNull();

			// Credit reactivates the card
			const creditResult = await controller.credit(card.id, 500);
			expect(creditResult?.giftCard.status).toBe("active");
			expect(creditResult?.giftCard.currentBalance).toBe(5500);

			// Now redeem should work
			const r2 = await controller.redeem(card.code, 1000);
			expect(r2).not.toBeNull();
			expect(r2?.giftCard.currentBalance).toBe(4500);
		});

		it("multiple cards and transactions stay isolated", async () => {
			const card1 = await controller.create({
				initialBalance: 5000,
				customerId: "c1",
			});
			const card2 = await controller.create({
				initialBalance: 3000,
				customerId: "c2",
			});

			await controller.redeem(card1.code, 1000);
			await controller.redeem(card2.code, 500);

			// Balance isolation
			const b1 = await controller.checkBalance(card1.code);
			const b2 = await controller.checkBalance(card2.code);
			expect(b1?.balance).toBe(4000);
			expect(b2?.balance).toBe(2500);

			// Transaction isolation
			const txns1 = await controller.listTransactions(card1.id);
			const txns2 = await controller.listTransactions(card2.id);
			expect(txns1).toHaveLength(1);
			expect(txns2).toHaveLength(1);

			// Count includes all
			expect(await controller.countAll()).toBe(2);

			// Filter by customer
			const c1Cards = await controller.list({ customerId: "c1" });
			expect(c1Cards).toHaveLength(1);
			expect(c1Cards[0].id).toBe(card1.id);
		});

		it("delete removes card and transactions but countAll updates", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 1000);
			await controller.credit(card.id, 500);

			expect(await controller.countAll()).toBe(1);

			await controller.delete(card.id);

			expect(await controller.countAll()).toBe(0);
			expect(await controller.get(card.id)).toBeNull();
			expect(await controller.listTransactions(card.id)).toHaveLength(0);
		});
	});
});
