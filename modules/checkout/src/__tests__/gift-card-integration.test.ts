import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import type { CheckoutLineItem } from "../service";
import { createCheckoutController } from "../service-impl";
import { seedLegacyStoredGiftCard } from "./legacy-gift-card-test-utils";

const sampleLineItems: CheckoutLineItem[] = [
	{ productId: "p1", name: "Widget", price: 1000, quantity: 2 },
	{ productId: "p2", name: "Gadget", price: 2000, quantity: 1 },
];

function makeSession() {
	return {
		subtotal: 4000,
		taxAmount: 400,
		shippingAmount: 500,
		total: 4900,
		lineItems: sampleLineItems,
	};
}

describe("gift-card application containment", () => {
	it("does not expose a gift-card application controller method", () => {
		const controller = createCheckoutController(createMockDataService());

		expect("applyGiftCard" in controller).toBe(false);
	});

	it("always initializes new sessions without a gift-card amount", async () => {
		const controller = createCheckoutController(createMockDataService());
		const runtimeShapedInput = {
			...makeSession(),
			giftCardAmount: 500,
		};
		const session = await controller.create(runtimeShapedInput);

		expect(session.giftCardAmount).toBe(0);
		expect(session.giftCardCode).toBeUndefined();
	});
});

describe("legacy stored gift-card compatibility", () => {
	it("continues to read persisted gift-card fields", async () => {
		const data = createMockDataService();
		const controller = createCheckoutController(data);
		const session = await controller.create(makeSession());
		await seedLegacyStoredGiftCard(data, session.id, {
			code: "GIFT-LEGACY",
			amount: 1500,
		});

		const stored = await controller.getById(session.id);

		expect(stored?.giftCardCode).toBe("GIFT-LEGACY");
		expect(stored?.giftCardAmount).toBe(1500);
		expect(stored?.total).toBe(3400);
	});

	it("removes a persisted gift card and restores the total", async () => {
		const data = createMockDataService();
		const controller = createCheckoutController(data);
		const session = await controller.create(makeSession());
		await seedLegacyStoredGiftCard(data, session.id, {
			code: "GIFT-LEGACY",
			amount: 1500,
		});

		const restored = await controller.removeGiftCard(session.id);

		expect(restored?.giftCardCode).toBeUndefined();
		expect(restored?.giftCardAmount).toBe(0);
		expect(restored?.total).toBe(4900);
	});

	it("preserves an existing discount when removing a persisted gift card", async () => {
		const data = createMockDataService();
		const controller = createCheckoutController(data);
		const session = await controller.create(makeSession());
		await controller.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});
		await seedLegacyStoredGiftCard(data, session.id, {
			code: "GIFT-LEGACY",
			amount: 1000,
		});

		const restored = await controller.removeGiftCard(session.id);

		expect(restored?.discountCode).toBe("SAVE500");
		expect(restored?.discountAmount).toBe(500);
		expect(restored?.giftCardCode).toBeUndefined();
		expect(restored?.giftCardAmount).toBe(0);
		expect(restored?.total).toBe(4400);
	});

	it("keeps persisted gift-card deductions in later total recalculations", async () => {
		const data = createMockDataService();
		const controller = createCheckoutController(data);
		const session = await controller.create(makeSession());
		await seedLegacyStoredGiftCard(data, session.id, {
			code: "GIFT-LEGACY",
			amount: 1000,
		});

		const updated = await controller.update(session.id, {
			shippingAmount: 1000,
		});

		expect(updated?.giftCardCode).toBe("GIFT-LEGACY");
		expect(updated?.giftCardAmount).toBe(1000);
		expect(updated?.total).toBe(4400);
	});

	it("does not remove a persisted gift card from a completed session", async () => {
		const data = createMockDataService();
		const controller = createCheckoutController(data);
		const session = await controller.create(makeSession());
		await seedLegacyStoredGiftCard(data, session.id, {
			code: "GIFT-LEGACY",
			amount: 500,
		});
		await controller.complete(session.id, "order-1");

		expect(await controller.removeGiftCard(session.id)).toBeNull();
		await expect(controller.getById(session.id)).resolves.toMatchObject({
			giftCardCode: "GIFT-LEGACY",
			giftCardAmount: 500,
		});
	});
});
