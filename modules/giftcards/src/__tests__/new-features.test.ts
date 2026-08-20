import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGiftCardController } from "../service-impl";

/**
 * Tests for expanded gift-cards features:
 * - Purchase (customer-facing gift card buying)
 * - Top-up (add balance to owned card)
 * - Send gift card (email delivery)
 * - List by customer
 * - Bulk create (admin)
 * - Statistics (admin)
 * - Disable expired (admin)
 */
describe("gift-cards — new features", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createGiftCardController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftCardController(mockData);
	});

	// ── Purchase ──────────────────────────────────────────────────

	describe("purchase", () => {
		it("creates a gift card for self when no recipient email", async () => {
			const card = await controller.purchase({
				amount: 5000,
				customerId: "cust_1",
				customerEmail: "buyer@example.com",
			});
			expect(card.currentBalance).toBe(5000);
			expect(card.customerId).toBe("cust_1");
			expect(card.purchasedByCustomerId).toBe("cust_1");
			expect(card.senderEmail).toBe("buyer@example.com");
			expect(card.recipientEmail).toBeUndefined();
		});

		it("creates a gift card for someone else when recipient email provided", async () => {
			const card = await controller.purchase({
				amount: 2500,
				customerId: "cust_1",
				customerEmail: "buyer@example.com",
				recipientEmail: "friend@example.com",
				recipientName: "Alice",
				senderName: "Bob",
				message: "Happy birthday!",
			});
			expect(card.currentBalance).toBe(2500);
			// Not assigned to the buyer's customerId when it's a gift
			expect(card.customerId).toBeUndefined();
			expect(card.purchasedByCustomerId).toBe("cust_1");
			expect(card.recipientEmail).toBe("friend@example.com");
			expect(card.recipientName).toBe("Alice");
			expect(card.senderName).toBe("Bob");
			expect(card.message).toBe("Happy birthday!");
		});

		it("records a purchase transaction", async () => {
			const card = await controller.purchase({
				amount: 3000,
				customerId: "cust_1",
				customerEmail: "buyer@example.com",
			});
			const txns = await controller.listTransactions(card.id);
			expect(txns).toHaveLength(1);
			expect(txns[0].type).toBe("purchase");
			expect(txns[0].amount).toBe(3000);
			expect(txns[0].balanceAfter).toBe(3000);
			expect(txns[0].customerId).toBe("cust_1");
		});

		it("sets delivery method to digital by default", async () => {
			const card = await controller.purchase({
				amount: 1000,
				customerId: "cust_1",
				customerEmail: "buyer@example.com",
			});
			expect(card.deliveryMethod).toBe("digital");
		});

		it("respects custom delivery method", async () => {
			const card = await controller.purchase({
				amount: 1000,
				customerId: "cust_1",
				customerEmail: "buyer@example.com",
				deliveryMethod: "email",
			});
			expect(card.deliveryMethod).toBe("email");
		});

		it("respects custom currency", async () => {
			const card = await controller.purchase({
				amount: 5000,
				currency: "EUR",
				customerId: "cust_1",
				customerEmail: "buyer@example.com",
			});
			expect(card.currency).toBe("EUR");
		});

		it("supports scheduled delivery", async () => {
			const card = await controller.purchase({
				amount: 5000,
				customerId: "cust_1",
				customerEmail: "buyer@example.com",
				recipientEmail: "friend@example.com",
				scheduledDeliveryAt: "2027-12-25",
			});
			expect(card.scheduledDeliveryAt).toBe("2027-12-25");
		});

		it("purchase note includes recipient email when sent as gift", async () => {
			const card = await controller.purchase({
				amount: 5000,
				customerId: "cust_1",
				customerEmail: "buyer@example.com",
				recipientEmail: "friend@example.com",
			});
			const txns = await controller.listTransactions(card.id);
			expect(txns[0].note).toContain("friend@example.com");
		});

		it("purchase note says 'for self' when no recipient", async () => {
			const card = await controller.purchase({
				amount: 5000,
				customerId: "cust_1",
				customerEmail: "buyer@example.com",
			});
			const txns = await controller.listTransactions(card.id);
			expect(txns[0].note).toContain("self");
		});
	});

	// ── Top-up ────────────────────────────────────────────────────

	describe("topUp", () => {
		it("adds balance to an owned card", async () => {
			const card = await controller.create({
				initialBalance: 2000,
				customerId: "cust_1",
			});
			const result = await controller.topUp({
				giftCardId: card.id,
				customerId: "cust_1",
				amount: 3000,
			});
			expect(result).not.toBeNull();
			expect(result?.giftCard.currentBalance).toBe(5000);
			expect(result?.transaction.type).toBe("topup");
			expect(result?.transaction.amount).toBe(3000);
		});

		it("returns null if customer does not own the card", async () => {
			const card = await controller.create({
				initialBalance: 2000,
				customerId: "cust_1",
			});
			const result = await controller.topUp({
				giftCardId: card.id,
				customerId: "cust_2",
				amount: 1000,
			});
			expect(result).toBeNull();
		});

		it("returns null for disabled card", async () => {
			const card = await controller.create({
				initialBalance: 2000,
				customerId: "cust_1",
			});
			await controller.update(card.id, { status: "disabled" });
			const result = await controller.topUp({
				giftCardId: card.id,
				customerId: "cust_1",
				amount: 1000,
			});
			expect(result).toBeNull();
		});

		it("returns null for non-existent card", async () => {
			const result = await controller.topUp({
				giftCardId: "nonexistent",
				customerId: "cust_1",
				amount: 1000,
			});
			expect(result).toBeNull();
		});

		it("returns null for zero amount", async () => {
			const card = await controller.create({
				initialBalance: 2000,
				customerId: "cust_1",
			});
			const result = await controller.topUp({
				giftCardId: card.id,
				customerId: "cust_1",
				amount: 0,
			});
			expect(result).toBeNull();
		});

		it("returns null for negative amount", async () => {
			const card = await controller.create({
				initialBalance: 2000,
				customerId: "cust_1",
			});
			const result = await controller.topUp({
				giftCardId: card.id,
				customerId: "cust_1",
				amount: -500,
			});
			expect(result).toBeNull();
		});

		it("reactivates a depleted card on top-up", async () => {
			const card = await controller.create({
				initialBalance: 1000,
				customerId: "cust_1",
			});
			await controller.redeem(card.code, 1000);
			const depleted = await controller.get(card.id);
			expect(depleted?.status).toBe("depleted");

			const result = await controller.topUp({
				giftCardId: card.id,
				customerId: "cust_1",
				amount: 500,
			});
			expect(result?.giftCard.status).toBe("active");
			expect(result?.giftCard.currentBalance).toBe(500);
		});

		it("records transaction with correct customerId", async () => {
			const card = await controller.create({
				initialBalance: 2000,
				customerId: "cust_1",
			});
			const result = await controller.topUp({
				giftCardId: card.id,
				customerId: "cust_1",
				amount: 1000,
			});
			expect(result?.transaction.customerId).toBe("cust_1");
			expect(result?.transaction.note).toBe("Balance top-up");
		});
	});

	// ── Send Gift Card ────────────────────────────────────────────

	describe("sendGiftCard", () => {
		it("sends a card to a recipient", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				customerId: "cust_1",
			});
			const result = await controller.sendGiftCard({
				giftCardId: card.id,
				customerId: "cust_1",
				recipientEmail: "friend@example.com",
				recipientName: "Alice",
				senderName: "Bob",
				message: "Enjoy!",
			});
			expect(result).not.toBeNull();
			expect(result?.recipientEmail).toBe("friend@example.com");
			expect(result?.recipientName).toBe("Alice");
			expect(result?.senderName).toBe("Bob");
			expect(result?.message).toBe("Enjoy!");
			expect(result?.delivered).toBe(true);
			expect(result?.deliveredAt).toBeInstanceOf(Date);
			expect(result?.deliveryMethod).toBe("email");
		});

		it("allows the purchaser to send even if not the customerId", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				purchasedByCustomerId: "cust_1",
			});
			const result = await controller.sendGiftCard({
				giftCardId: card.id,
				customerId: "cust_1",
				recipientEmail: "friend@example.com",
			});
			expect(result).not.toBeNull();
			expect(result?.recipientEmail).toBe("friend@example.com");
		});

		it("returns null if customer is not owner or purchaser", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				customerId: "cust_1",
			});
			const result = await controller.sendGiftCard({
				giftCardId: card.id,
				customerId: "cust_2",
				recipientEmail: "friend@example.com",
			});
			expect(result).toBeNull();
		});

		it("returns null for inactive card", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				customerId: "cust_1",
			});
			await controller.update(card.id, { status: "disabled" });
			const result = await controller.sendGiftCard({
				giftCardId: card.id,
				customerId: "cust_1",
				recipientEmail: "friend@example.com",
			});
			expect(result).toBeNull();
		});

		it("returns null if card already delivered to someone", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				customerId: "cust_1",
			});
			// Send once
			await controller.sendGiftCard({
				giftCardId: card.id,
				customerId: "cust_1",
				recipientEmail: "first@example.com",
			});
			// Try to send again
			const result = await controller.sendGiftCard({
				giftCardId: card.id,
				customerId: "cust_1",
				recipientEmail: "second@example.com",
			});
			expect(result).toBeNull();
		});

		it("returns null for non-existent card", async () => {
			const result = await controller.sendGiftCard({
				giftCardId: "nonexistent",
				customerId: "cust_1",
				recipientEmail: "friend@example.com",
			});
			expect(result).toBeNull();
		});
	});

	// ── List by Customer ──────────────────────────────────────────

	describe("listByCustomer", () => {
		it("returns only cards for the specified customer", async () => {
			await controller.create({
				initialBalance: 1000,
				customerId: "cust_1",
			});
			await controller.create({
				initialBalance: 2000,
				customerId: "cust_1",
			});
			await controller.create({
				initialBalance: 3000,
				customerId: "cust_2",
			});

			const cards = await controller.listByCustomer("cust_1");
			expect(cards).toHaveLength(2);
			for (const card of cards) {
				expect(card.customerId).toBe("cust_1");
			}
		});

		it("returns empty array for customer with no cards", async () => {
			const cards = await controller.listByCustomer("nonexistent");
			expect(cards).toHaveLength(0);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create({
					initialBalance: 1000,
					customerId: "cust_1",
				});
			}
			const page = await controller.listByCustomer("cust_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── Bulk Create ───────────────────────────────────────────────

	describe("bulkCreate", () => {
		it("creates the specified number of cards", async () => {
			const cards = await controller.bulkCreate({
				count: 5,
				initialBalance: 2500,
			});
			expect(cards).toHaveLength(5);
			for (const card of cards) {
				expect(card.initialBalance).toBe(2500);
				expect(card.currentBalance).toBe(2500);
				expect(card.status).toBe("active");
			}
		});

		it("all bulk-created cards have unique codes", async () => {
			const cards = await controller.bulkCreate({
				count: 20,
				initialBalance: 1000,
			});
			const codes = new Set(cards.map((c) => c.code));
			expect(codes.size).toBe(20);
		});

		it("applies currency and expiration to all cards", async () => {
			const cards = await controller.bulkCreate({
				count: 3,
				initialBalance: 5000,
				currency: "EUR",
				expiresAt: "2028-12-31",
				note: "Holiday promotion",
			});
			for (const card of cards) {
				expect(card.currency).toBe("EUR");
				expect(card.expiresAt).toBe("2028-12-31");
				expect(card.note).toBe("Holiday promotion");
			}
		});

		it("creates a single card when count is 1", async () => {
			const cards = await controller.bulkCreate({
				count: 1,
				initialBalance: 10000,
			});
			expect(cards).toHaveLength(1);
		});

		it("countAll reflects bulk-created cards", async () => {
			await controller.bulkCreate({ count: 10, initialBalance: 1000 });
			expect(await controller.countAll()).toBe(10);
		});
	});

	// ── Stats ─────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns zeros when no cards exist", async () => {
			const stats = await controller.getStats();
			expect(stats.totalIssued).toBe(0);
			expect(stats.totalActive).toBe(0);
			expect(stats.totalDepleted).toBe(0);
			expect(stats.totalDisabled).toBe(0);
			expect(stats.totalExpired).toBe(0);
			expect(stats.totalIssuedValue).toBe(0);
			expect(stats.totalRedeemedValue).toBe(0);
			expect(stats.totalOutstandingBalance).toBe(0);
		});

		it("counts cards by status correctly", async () => {
			const c1 = await controller.create({ initialBalance: 5000 });
			await controller.create({ initialBalance: 3000 });
			const c3 = await controller.create({ initialBalance: 1000 });
			await controller.update(c1.id, { status: "disabled" });
			await controller.redeem(c3.code, 1000); // depletes c3

			const stats = await controller.getStats();
			expect(stats.totalIssued).toBe(3);
			expect(stats.totalActive).toBe(1);
			expect(stats.totalDisabled).toBe(1);
			expect(stats.totalDepleted).toBe(1);
		});

		it("counts expired cards based on expiresAt date", async () => {
			await controller.create({
				initialBalance: 5000,
				expiresAt: "2020-01-01",
			});
			await controller.create({ initialBalance: 3000 });

			const stats = await controller.getStats();
			expect(stats.totalExpired).toBe(1);
			expect(stats.totalActive).toBe(1);
		});

		it("calculates values correctly", async () => {
			const c1 = await controller.create({ initialBalance: 5000 });
			await controller.create({ initialBalance: 3000 });
			await controller.redeem(c1.code, 2000);

			const stats = await controller.getStats();
			expect(stats.totalIssuedValue).toBe(8000);
			expect(stats.totalRedeemedValue).toBe(2000);
			expect(stats.totalOutstandingBalance).toBe(6000);
		});

		it("redeemed value only counts debit transactions", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			await controller.redeem(card.code, 2000);
			await controller.credit(card.id, 500, "Refund");

			const stats = await controller.getStats();
			// Only the 2000 debit counts as redeemed
			expect(stats.totalRedeemedValue).toBe(2000);
			// Outstanding: 5000 - 2000 + 500 = 3500
			expect(stats.totalOutstandingBalance).toBe(3500);
		});
	});

	// ── Disable Expired ───────────────────────────────────────────

	describe("disableExpired", () => {
		it("disables active cards with past expiration date", async () => {
			const c1 = await controller.create({
				initialBalance: 5000,
				expiresAt: "2020-01-01",
			});
			await controller.create({
				initialBalance: 3000,
				expiresAt: "2099-12-31",
			});
			await controller.create({ initialBalance: 2000 });

			const count = await controller.disableExpired();
			expect(count).toBe(1);

			const updated = await controller.get(c1.id);
			expect(updated?.status).toBe("expired");
		});

		it("does not disable already-disabled cards", async () => {
			const c1 = await controller.create({
				initialBalance: 5000,
				expiresAt: "2020-01-01",
			});
			await controller.update(c1.id, { status: "disabled" });

			const count = await controller.disableExpired();
			expect(count).toBe(0);
		});

		it("does not disable depleted cards even if expired", async () => {
			const card = await controller.create({
				initialBalance: 1000,
				expiresAt: "2020-01-01",
			});
			// Manually set depleted status (bypass expiration check)
			await controller.update(card.id, { status: "depleted" });

			const count = await controller.disableExpired();
			// Already depleted, status is not "active", so not counted
			expect(count).toBe(0);
		});

		it("returns 0 when no cards are expired", async () => {
			await controller.create({ initialBalance: 5000 });
			await controller.create({
				initialBalance: 3000,
				expiresAt: "2099-12-31",
			});

			const count = await controller.disableExpired();
			expect(count).toBe(0);
		});

		it("disables multiple expired cards at once", async () => {
			await controller.create({
				initialBalance: 1000,
				expiresAt: "2020-01-01",
			});
			await controller.create({
				initialBalance: 2000,
				expiresAt: "2021-06-15",
			});
			await controller.create({
				initialBalance: 3000,
				expiresAt: "2019-03-01",
			});

			const count = await controller.disableExpired();
			expect(count).toBe(3);
		});
	});

	// ── New schema fields ─────────────────────────────────────────

	describe("new schema fields", () => {
		it("create stores all new fields", async () => {
			const card = await controller.create({
				initialBalance: 5000,
				recipientName: "Alice",
				senderName: "Bob",
				senderEmail: "bob@example.com",
				message: "Happy birthday!",
				deliveryMethod: "email",
				scheduledDeliveryAt: "2027-12-25",
				purchasedByCustomerId: "cust_1",
			});
			expect(card.recipientName).toBe("Alice");
			expect(card.senderName).toBe("Bob");
			expect(card.senderEmail).toBe("bob@example.com");
			expect(card.message).toBe("Happy birthday!");
			expect(card.deliveryMethod).toBe("email");
			expect(card.scheduledDeliveryAt).toBe("2027-12-25");
			expect(card.purchasedByCustomerId).toBe("cust_1");
			expect(card.delivered).toBe(false);
		});

		it("update supports recipientName and delivered fields", async () => {
			const card = await controller.create({ initialBalance: 5000 });
			const updated = await controller.update(card.id, {
				recipientName: "Carol",
				delivered: true,
				deliveredAt: new Date("2027-01-15"),
			});
			expect(updated?.recipientName).toBe("Carol");
			expect(updated?.delivered).toBe(true);
			expect(updated?.deliveredAt).toEqual(new Date("2027-01-15"));
		});
	});

	// ── Full lifecycle: purchase → send → redeem ──────────────────

	describe("full lifecycle: purchase → send → redeem", () => {
		it("complete gift card gifting flow", async () => {
			// 1. Customer purchases a gift card for someone
			const card = await controller.purchase({
				amount: 5000,
				customerId: "buyer_1",
				customerEmail: "buyer@example.com",
				recipientEmail: "friend@example.com",
				recipientName: "Alice",
				senderName: "Bob",
				message: "Happy Birthday!",
				deliveryMethod: "email",
			});
			expect(card.currentBalance).toBe(5000);

			// 2. Verify purchase transaction was recorded
			const txns = await controller.listTransactions(card.id);
			expect(txns).toHaveLength(1);
			expect(txns[0].type).toBe("purchase");

			// 3. Recipient checks balance
			const balance = await controller.checkBalance(card.code);
			expect(balance?.balance).toBe(5000);

			// 4. Recipient redeems part of the card
			const redeem1 = await controller.redeem(card.code, 2000, "order_1");
			expect(redeem1?.giftCard.currentBalance).toBe(3000);

			// 5. Recipient redeems the rest
			const redeem2 = await controller.redeem(card.code, 3000, "order_2");
			expect(redeem2?.giftCard.currentBalance).toBe(0);
			expect(redeem2?.giftCard.status).toBe("depleted");

			// 6. All transactions are recorded
			const allTxns = await controller.listTransactions(card.id);
			expect(allTxns).toHaveLength(3); // purchase + 2 debits
		});

		it("purchase → top-up → redeem flow", async () => {
			// 1. Purchase for self
			const card = await controller.purchase({
				amount: 2000,
				customerId: "cust_1",
				customerEmail: "me@example.com",
			});
			expect(card.customerId).toBe("cust_1");

			// 2. Top up the card
			const topUp = await controller.topUp({
				giftCardId: card.id,
				customerId: "cust_1",
				amount: 3000,
			});
			expect(topUp?.giftCard.currentBalance).toBe(5000);

			// 3. Redeem
			const redeem = await controller.redeem(card.code, 5000, "order_1");
			expect(redeem?.giftCard.currentBalance).toBe(0);
			expect(redeem?.giftCard.status).toBe("depleted");

			// 4. All transactions
			const txns = await controller.listTransactions(card.id);
			expect(txns).toHaveLength(3); // purchase + topup + debit
			const types = txns.map((t) => t.type);
			expect(types).toContain("purchase");
			expect(types).toContain("topup");
			expect(types).toContain("debit");
		});
	});
});
