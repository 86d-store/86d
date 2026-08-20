import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createCustomerController } from "../service-impl";

describe("Customers loyalty quarantine", () => {
	it("refuses earn, redeem, and adjust writes", async () => {
		const controller = createCustomerController(createMockDataService());
		await expect(
			controller.earnPoints({
				customerId: "cust-1",
				points: 10,
				reason: "order",
			}),
		).rejects.toThrow("Loyalty writes belong to the Loyalty module.");
		await expect(
			controller.redeemPoints({
				customerId: "cust-1",
				points: 10,
				reason: "order",
			}),
		).rejects.toThrow("Loyalty writes belong to the Loyalty module.");
		await expect(
			controller.adjustPoints({
				customerId: "cust-1",
				points: 10,
				reason: "manual",
			}),
		).rejects.toThrow("Loyalty writes belong to the Loyalty module.");
		await expect(controller.getLoyaltyBalance("cust-1")).resolves.toMatchObject(
			{
				balance: 0,
				transactionCount: 0,
			},
		);
	});
});
