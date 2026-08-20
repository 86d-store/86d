import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { handleTaxQuote } from "../capabilities";
import { createTaxController } from "../service-impl";

describe("tax quote capability", () => {
	it("returns the owner calculation through a bounded decision", async () => {
		const data = createMockDataService();
		const controller = createTaxController(data);
		await controller.createRate({
			name: "Illinois Sales Tax",
			country: "US",
			state: "IL",
			rate: 0.0625,
		});

		const result = await handleTaxQuote(controller, {
			address: { country: "US", state: "IL" },
			lineItems: [{ productId: "product-1", amount: 1000, quantity: 1 }],
		});

		expect(result).toMatchObject({
			ok: true,
			decision: { totalTax: 62.5 },
		});
	});

	it("refuses to quote when no rate is configured for the address", async () => {
		// Previously this answered ok with zero tax, which a Checkout would have
		// sold on. An unconfigured jurisdiction is an absent decision, not a
		// decision to collect nothing, so the quote becomes review instead.
		const result = await handleTaxQuote(
			createTaxController(createMockDataService()),
			{
				address: { country: "US", state: "IL" },
				lineItems: [{ productId: "product-1", amount: 1000, quantity: 1 }],
			},
		);

		expect(result).toMatchObject({
			ok: false,
			failure: { code: "TAX_REVIEW_REQUIRED" },
		});
	});

	it("still quotes zero where the merchant declared no nexus", async () => {
		const data = createMockDataService();
		const controller = createTaxController(data);
		// An explicit nexus list that excludes this address is a real decision, and
		// it must stay sellable at zero.
		await controller.createNexus({ country: "US", state: "NY" });

		const result = await handleTaxQuote(controller, {
			address: { country: "US", state: "IL" },
			lineItems: [{ productId: "product-1", amount: 1000, quantity: 1 }],
		});

		expect(result).toMatchObject({
			ok: true,
			decision: { totalTax: 0, shippingTax: 0 },
		});
	});

	it("still quotes zero for a fully exempt customer", async () => {
		const data = createMockDataService();
		const controller = createTaxController(data);
		await controller.createRate({
			name: "Illinois Sales Tax",
			country: "US",
			state: "IL",
			rate: 0.0625,
		});
		await controller.createExemption({
			customerId: "customer-1",
			reason: "Reseller certificate",
		});

		const result = await handleTaxQuote(controller, {
			address: { country: "US", state: "IL" },
			lineItems: [{ productId: "product-1", amount: 1000, quantity: 1 }],
			customerId: "customer-1",
		});

		expect(result).toMatchObject({
			ok: true,
			decision: { totalTax: 0 },
		});
	});
});
