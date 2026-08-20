import { cartSnapshotCapability } from "@86d-app/core/commerce-capabilities";
import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cartSnapshotProvider } from "../capabilities";

const NOW = new Date("2026-08-13T12:00:00.000Z");

async function seedCart(options?: {
	status?: "active" | "abandoned" | "converted";
	expiresAt?: Date;
	customerId?: string;
	guestId?: string;
}) {
	const data = createMockDataService();
	await data.upsert("cart", "cart-1", {
		id: "cart-1",
		...(options?.guestId ? { guestId: options.guestId } : {}),
		...(options?.customerId ? { customerId: options.customerId } : {}),
		status: options?.status ?? "active",
		expiresAt: options?.expiresAt ?? new Date("2026-08-13T12:30:00.000Z"),
		metadata: {},
		createdAt: new Date("2026-08-13T11:00:00.000Z"),
		updatedAt: new Date("2026-08-13T11:30:00.000Z"),
	});
	return data;
}

async function snapshot(
	data: ReturnType<typeof createMockDataService>,
	owner: { customerId: string } | { guestId: string },
) {
	return cartSnapshotProvider.handle(
		{ data, storeId: "store-1", options: {} },
		{ cartId: "cart-1", ...owner },
	);
}

afterEach(() => {
	vi.useRealTimers();
});

describe("authoritative Cart snapshot capability", () => {
	it("returns only product choices and a version derived from the newest owner row", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const data = await seedCart({ guestId: "guest-1" });
		await data.upsert("cartItem", "item-1", {
			id: "item-1",
			cartId: "cart-1",
			productId: "product-1",
			variantId: "variant-1",
			quantity: 2,
			price: 1,
			productName: "Caller-controlled snapshot name",
			productSlug: "caller-controlled",
			metadata: {},
			createdAt: new Date("2026-08-13T11:45:00.000Z"),
			updatedAt: new Date("2026-08-13T11:59:00.000Z"),
		});

		const result = await snapshot(data, { guestId: "guest-1" });

		expect(result).toEqual({
			ok: true,
			decision: {
				cartId: "cart-1",
				revision: "2026-08-13T11:59:00.000Z",
				items: [
					{ productId: "product-1", variantId: "variant-1", quantity: 2 },
				],
			},
		});
		expect(result).not.toHaveProperty("decision.items.0.price");
		expect(result).not.toHaveProperty("decision.items.0.productName");
	});

	it.each([
		["missing", undefined, "CART_NOT_FOUND"],
		[
			"abandoned",
			{ guestId: "guest-1", status: "abandoned" as const },
			"CART_NOT_ACTIVE",
		],
		[
			"converted",
			{ guestId: "guest-1", status: "converted" as const },
			"CART_NOT_ACTIVE",
		],
		[
			"expired",
			{
				guestId: "guest-1",
				expiresAt: new Date("2026-08-13T11:59:59.000Z"),
			},
			"CART_NOT_ACTIVE",
		],
	] as const)("fails explicitly for a %s Cart", async (_label, cart, code) => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const data = cart ? await seedCart(cart) : createMockDataService();

		expect(await snapshot(data, { guestId: "guest-1" })).toMatchObject({
			ok: false,
			failure: { code },
		});
	});

	it("does not authorize a Cart by UUID, email, or another shopper identity", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const customerCart = await seedCart({ customerId: "customer-1" });
		const guestCart = await seedCart({ guestId: "guest-proof-1" });

		expect(
			await snapshot(customerCart, { customerId: "customer-2" }),
		).toMatchObject({ ok: false, failure: { code: "CART_NOT_OWNED" } });
		expect(
			await snapshot(customerCart, { customerId: "shopper@example.com" }),
		).toMatchObject({ ok: false, failure: { code: "CART_NOT_OWNED" } });
		expect(await snapshot(guestCart, { guestId: "cart-1" })).toMatchObject({
			ok: false,
			failure: { code: "CART_NOT_OWNED" },
		});
	});

	it("requires exactly one owner identity at the versioned boundary", () => {
		expect(
			cartSnapshotCapability.request.safeParse({ cartId: "cart-1" }),
		).toMatchObject({ success: false });
		expect(
			cartSnapshotCapability.request.safeParse({
				cartId: "cart-1",
				customerId: "customer-1",
				guestId: "guest-1",
			}),
		).toMatchObject({ success: false });
	});
});
