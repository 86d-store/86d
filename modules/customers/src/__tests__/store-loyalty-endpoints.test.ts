import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCustomerController } from "../service-impl";

/**
 * Store loyalty reads remain on the Customers controller as empty stubs.
 * Writes belong to the Loyalty module.
 */
describe("store loyalty endpoints (controller layer)", () => {
	let controller: ReturnType<typeof createCustomerController>;

	beforeEach(() => {
		controller = createCustomerController(createMockDataService());
	});

	describe("getLoyaltyBalance — customer self-service", () => {
		it("returns zero balance for a customer with no activity", async () => {
			const balance = await controller.getLoyaltyBalance("cust-new");
			expect(balance.customerId).toBe("cust-new");
			expect(balance.balance).toBe(0);
			expect(balance.totalEarned).toBe(0);
			expect(balance.totalRedeemed).toBe(0);
			expect(balance.transactionCount).toBe(0);
		});
	});

	describe("getLoyaltyHistory — customer self-service", () => {
		it("returns empty history while Customers owns no ledger", async () => {
			await expect(
				controller.getLoyaltyHistory("cust-store-1"),
			).resolves.toEqual({
				transactions: [],
				total: 0,
			});
		});
	});

	describe("loyalty write quarantine", () => {
		it("refuses earn/redeem/adjust writes", async () => {
			await expect(
				controller.earnPoints({
					customerId: "cust-store-1",
					points: 120,
					reason: "Order #1001",
				}),
			).rejects.toThrow("Loyalty writes belong to the Loyalty module.");
		});
	});
});
