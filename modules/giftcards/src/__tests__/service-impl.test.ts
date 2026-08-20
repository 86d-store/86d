import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGiftCardController } from "../service-impl";

describe("createGiftCardController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftCardController(mockData);
	});

	// ── create ───────────────────────────────────────────────────────────

	describe("create", () => {
		it("creates a gift card with default values", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			expect(card.id).toBeDefined();
			expect(card.code).toMatch(/^GIFT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
			expect(card.initialBalance).toBe(5000);
			expect(card.currentBalance).toBe(5000);
			expect(card.currency).toBe("USD");
			expect(card.status).toBe("active");
		});

		it("creates a gift card with custom currency", async () => {
			const card = await controller.create({
				initialBalance: 1000,
				currency: "EUR",
			});
			expect(card.currency).toBe("EUR");
		});

		it("stores optional fields", async () => {
			const card = await controller.create({
				initialBalance: 2500,
				expiresAt: "2025-12-31",
				recipientEmail: "bob@example.com",
				customerId: "cust_1",
				purchaseOrderId: "ord_1",
				note: "Happy birthday!",
			});
			expect(card.expiresAt).toBe("2025-12-31");
			expect(card.recipientEmail).toBe("bob@example.com");
			expect(card.customerId).toBe("cust_1");
			expect(card.purchaseOrderId).toBe("ord_1");
			expect(card.note).toBe("Happy birthday!");
		});

		it("generates unique codes", async () => {
			const card1 = await controller.create({ initialBalance: 1000 });
			const card2 = await controller.create({ initialBalance: 1000 });
			expect(card1.code).not.toBe(card2.code);
		});
	});

	// ── get ──────────────────────────────────────────────────────────────

	describe("get", () => {
		it("returns an existing gift card", async () => {
			const created = await controller.create({ initialBalance: 5000 });
			const found = await controller.get(created.id);
			expect(found?.id).toBe(created.id);
			expect(found?.initialBalance).toBe(5000);
		});

		it("returns null for non-existent card", async () => {
			const found = await controller.get("missing");
			expect(found).toBeNull();
		});
	});

	// ── getByCode ────────────────────────────────────────────────────────

	describe("getByCode", () => {
		it("returns a card by its code", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const found = await controller.getByCode(card.code);
			expect(found?.id).toBe(card.id);
		});

		it("handles case-insensitive lookup", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const found = await controller.getByCode(card.code.toLowerCase());
			// The code is stored uppercase; lookup uppercases input
			expect(found?.id).toBe(card.id);
		});

		it("returns null for non-existent code", async () => {
			const found = await controller.getByCode("GIFT-XXXX-YYYY-ZZZZ");
			expect(found).toBeNull();
		});
	});

	// ── list ─────────────────────────────────────────────────────────────

	describe("list", () => {
		it("lists all gift cards", async () => {
			await controller.create({ initialBalance: 1000 });
			await controller.create({ initialBalance: 2000 });
			const all = await controller.list();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			await controller.update(card.id, { status: "disabled" });
			await controller.create({ initialBalance: 2000 });
			const disabled = await controller.list({ status: "disabled" });
			expect(disabled).toHaveLength(1);
		});

		it("filters by customerId", async () => {
			await controller.create({
				initialBalance: 1000,
				customerId: "cust_1",
			});
			await controller.create({ initialBalance: 2000 });
			const results = await controller.list({ customerId: "cust_1" });
			expect(results).toHaveLength(1);
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create({ initialBalance: 1000 * (i + 1) });
			}
			const page = await controller.list({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── update ───────────────────────────────────────────────────────────

	describe("update", () => {
		it("updates status", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const updated = await controller.update(card.id, {
				status: "disabled",
			});
			expect(updated?.status).toBe("disabled");
		});

		it("updates expiresAt", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const updated = await controller.update(card.id, {
				expiresAt: "2026-06-30",
			});
			expect(updated?.expiresAt).toBe("2026-06-30");
		});

		it("updates note and recipientEmail", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const updated = await controller.update(card.id, {
				note: "Updated note",
				recipientEmail: "new@example.com",
			});
			expect(updated?.note).toBe("Updated note");
			expect(updated?.recipientEmail).toBe("new@example.com");
		});

		it("returns null for non-existent card", async () => {
			const result = await controller.update("missing", {
				status: "disabled",
			});
			expect(result).toBeNull();
		});

		it("preserves fields not being updated", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				note: "Original note",
			});
			const updated = await controller.update(card.id, {
				status: "disabled",
			});
			expect(updated?.note).toBe("Original note");
			expect(updated?.initialBalance).toBe(5000);
		});
	});

	// ── delete ───────────────────────────────────────────────────────────

	describe("delete", () => {
		it("deletes a gift card and its transactions", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 1000);
			const result = await controller.delete(card.id);
			expect(result).toBe(true);
			const found = await controller.get(card.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent card", async () => {
			const result = await controller.delete("missing");
			expect(result).toBe(false);
		});
	});

	// ── checkBalance ─────────────────────────────────────────────────────

	describe("checkBalance", () => {
		it("returns balance for an active card", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.checkBalance(card.code);
			expect(result?.balance).toBe(5000);
			expect(result?.currency).toBe("USD");
			expect(result?.status).toBe("active");
		});

		it("returns expired status for expired card", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				expiresAt: "2020-01-01",
			});
			const result = await controller.checkBalance(card.code);
			expect(result?.balance).toBe(0);
			expect(result?.status).toBe("expired");
		});

		it("returns null for non-existent code", async () => {
			const result = await controller.checkBalance("GIFT-XXXX-YYYY-ZZZZ");
			expect(result).toBeNull();
		});
	});

	// ── redeem ───────────────────────────────────────────────────────────

	describe("redeem", () => {
		it("deducts from the gift card balance", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 2000);
			expect(result).not.toBeNull();
			expect(result?.transaction.amount).toBe(2000);
			expect(result?.transaction.type).toBe("debit");
			expect(result?.giftCard.currentBalance).toBe(3000);
			expect(result?.giftCard.status).toBe("active");
		});

		it("depletes the card when full balance is redeemed", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 5000);
			expect(result?.giftCard.currentBalance).toBe(0);
			expect(result?.giftCard.status).toBe("depleted");
		});

		it("caps redemption at available balance", async () => {
			const card = await controller.create({ initialBalance: 3000 });
			const result = await controller.redeem(card.code, 5000);
			expect(result?.transaction.amount).toBe(3000);
			expect(result?.giftCard.currentBalance).toBe(0);
		});

		it("returns null for non-existent code", async () => {
			const result = await controller.redeem("GIFT-XXXX-YYYY-ZZZZ", 1000);
			expect(result).toBeNull();
		});

		it("returns null for disabled card", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.update(card.id, { status: "disabled" });
			const result = await controller.redeem(card.code, 1000);
			expect(result).toBeNull();
		});

		it("returns null for expired card", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				expiresAt: "2020-01-01",
			});
			const result = await controller.redeem(card.code, 1000);
			expect(result).toBeNull();
		});

		it("returns null for zero amount", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 0);
			expect(result).toBeNull();
		});

		it("stores orderId in transaction", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.redeem(card.code, 2000, "ord_1");
			expect(result?.transaction.orderId).toBe("ord_1");
		});
	});

	// ── credit ───────────────────────────────────────────────────────────

	describe("credit", () => {
		it("adds to the gift card balance", async () => {
			const card = await controller.create({ initialBalance: 3000 });
			const result = await controller.credit(card.id, 2000);
			expect(result?.giftCard.currentBalance).toBe(5000);
			expect(result?.transaction.type).toBe("credit");
			expect(result?.transaction.amount).toBe(2000);
		});

		it("reactivates a depleted card", async () => {
			const card = await controller.create({ initialBalance: 1000 });
			await controller.redeem(card.code, 1000);
			const result = await controller.credit(card.id, 500);
			expect(result?.giftCard.status).toBe("active");
			expect(result?.giftCard.currentBalance).toBe(500);
		});

		it("returns null for non-existent card", async () => {
			const result = await controller.credit("missing", 1000);
			expect(result).toBeNull();
		});

		it("returns null for zero amount", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.credit(card.id, 0);
			expect(result).toBeNull();
		});

		it("stores custom note and orderId", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const result = await controller.credit(
				card.id,
				1000,
				"Refund credit",
				"ord_1",
			);
			expect(result?.transaction.note).toBe("Refund credit");
			expect(result?.transaction.orderId).toBe("ord_1");
		});
	});

	// ── listTransactions ─────────────────────────────────────────────────

	describe("listTransactions", () => {
		it("lists transactions for a gift card", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 1000);
			await controller.redeem(card.code, 500);
			await controller.credit(card.id, 200);
			const txns = await controller.listTransactions(card.id);
			expect(txns).toHaveLength(3);
		});

		it("returns empty array for card with no transactions", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const txns = await controller.listTransactions(card.id);
			expect(txns).toHaveLength(0);
		});

		it("supports take and skip", async () => {
			const card = await controller.create({ initialBalance: 10000 });
			for (let i = 0; i < 5; i++) {
				await controller.redeem(card.code, 100);
			}
			const page = await controller.listTransactions(card.id, {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countAll ─────────────────────────────────────────────────────────

	describe("countAll", () => {
		it("counts all gift cards", async () => {
			await controller.create({ initialBalance: 1000 });
			await controller.create({ initialBalance: 2000 });
			await controller.create({ initialBalance: 3000 });
			const count = await controller.countAll();
			expect(count).toBe(3);
		});

		it("returns 0 when no cards exist", async () => {
			const count = await controller.countAll();
			expect(count).toBe(0);
		});
	});
});
