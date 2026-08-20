import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createOrderController } from "../service-impl";
import {
	digestGuestProof,
	GUEST_PROOF_METADATA_KEY,
} from "../store/endpoints/guest-proof";

async function seedGuestOrder(
	controller: ReturnType<typeof createOrderController>,
	proof: string,
) {
	const digest = await digestGuestProof(proof);
	return controller.create({
		id: "order-guest-1",
		guestEmail: "guest@example.com",
		checkoutId: "checkout-1",
		subtotal: 1000,
		total: 1000,
		items: [{ productId: "p1", name: "Widget", price: 1000, quantity: 1 }],
		metadata: { [GUEST_PROOF_METADATA_KEY]: digest },
	});
}

describe("Orders customer attribution", () => {
	it("rewrites a legacy auth-subject customerId onto the Store Customer once", async () => {
		const controller = createOrderController(createMockDataService());
		await controller.create({
			id: "order-legacy-1",
			customerId: "auth-subject-1",
			subtotal: 1000,
			total: 1000,
			items: [{ productId: "p1", name: "Widget", price: 1000, quantity: 1 }],
		});

		const first = await controller.adoptLegacySubjectOrders(
			"auth-subject-1",
			"store-customer-1",
		);
		const replay = await controller.adoptLegacySubjectOrders(
			"auth-subject-1",
			"store-customer-1",
		);
		const listed = await controller.listForCustomer("store-customer-1");

		expect(first).toBe(1);
		expect(replay).toBe(0);
		expect(listed.total).toBe(1);
		expect(listed.orders[0]?.customerId).toBe("store-customer-1");
	});

	it("claims a guest order with proof and refuses a second customer", async () => {
		const controller = createOrderController(createMockDataService());
		const proof = `${"a".repeat(16)}${"b".repeat(16)}`;
		await seedGuestOrder(controller, proof);

		const claimed = await controller.claimGuestOrder({
			orderId: "order-guest-1",
			storeCustomerId: "store-customer-1",
			proofs: [proof],
		});
		const replay = await controller.claimGuestOrder({
			orderId: "order-guest-1",
			storeCustomerId: "store-customer-1",
			proofs: [proof],
		});
		const other = await controller.claimGuestOrder({
			orderId: "order-guest-1",
			storeCustomerId: "store-customer-2",
			proofs: [proof],
		});

		expect(claimed).toMatchObject({ ok: true, claimed: true });
		expect(replay).toMatchObject({ ok: true, claimed: false });
		expect(other).toMatchObject({ ok: false, code: "proof_invalid" });
	});

	it("rejects a guest claim without matching proof", async () => {
		const controller = createOrderController(createMockDataService());
		const proof = `${"a".repeat(16)}${"b".repeat(16)}`;
		await seedGuestOrder(controller, proof);

		await expect(
			controller.claimGuestOrder({
				orderId: "order-guest-1",
				storeCustomerId: "store-customer-1",
				proofs: [`${"c".repeat(32)}`],
			}),
		).resolves.toMatchObject({ ok: false, code: "proof_invalid" });
	});
});
