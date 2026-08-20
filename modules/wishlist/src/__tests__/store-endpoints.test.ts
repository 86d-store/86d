import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { WishlistItem, WishlistShare } from "../service";
import { createWishlistController } from "../service-impl";

/**
 * Store endpoint integration tests for the wishlist module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. add-to-wishlist: auth guard, wishlist limit error handling
 * 2. remove-from-wishlist: auth + ownership check before removal
 * 3. check-wishlist: returns false for unauthenticated, direct data query
 * 4. list-wishlist: auth guard, parallel fetch of items + count
 * 5. create-share: auth guard, expiry calculation
 * 6. get-shared-wishlist: public access, expired token handling
 * 7. revoke-share: auth + ownership
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate store endpoint logic ─────────────────────────────────────

async function simulateAddToWishlist(
	data: DataService,
	body: {
		productId: string;
		productName: string;
		productImage?: string;
		note?: string;
	},
	customerId?: string,
	opts?: { maxItems?: number },
) {
	if (!customerId) return { error: "Unauthorized", status: 401 };

	const controller = createWishlistController(data, opts);
	try {
		const item = await controller.addItem({
			customerId,
			productId: body.productId,
			productName: body.productName,
			productImage: body.productImage,
			note: body.note,
		});
		return { item };
	} catch (err) {
		if (
			err instanceof Error &&
			err.message.includes("Wishlist limit reached")
		) {
			return { error: err.message, status: 422 };
		}
		return { error: "Internal server error", status: 500 };
	}
}

async function simulateRemoveFromWishlist(
	data: DataService,
	itemId: string,
	customerId?: string,
) {
	if (!customerId) return { error: "Unauthorized", status: 401 };

	const controller = createWishlistController(data);
	const item = await controller.getItem(itemId);
	if (!item || item.customerId !== customerId) {
		return { error: "Wishlist item not found", status: 404 };
	}
	const removed = await controller.removeItem(itemId);
	if (!removed) return { error: "Wishlist item not found", status: 404 };
	return { removed };
}

async function simulateCheckWishlist(
	data: DataService,
	productId: string,
	customerId?: string,
) {
	if (!customerId) {
		return { inWishlist: false, itemId: null };
	}
	const items = (await data.findMany("wishlistItem", {
		where: { customerId, productId },
		take: 1,
	})) as Array<{ id: string }>;
	const match = items[0] ?? null;
	return { inWishlist: !!match, itemId: match?.id ?? null };
}

async function simulateListWishlist(
	data: DataService,
	customerId?: string,
	query: { take?: number; skip?: number } = {},
) {
	if (!customerId) return { error: "Unauthorized", status: 401 };

	const controller = createWishlistController(data);
	const [items, count] = await Promise.all([
		controller.listByCustomer(customerId, {
			take: query.take ?? 50,
			skip: query.skip ?? 0,
		}),
		controller.countByCustomer(customerId),
	]);
	return { items, total: count };
}

async function simulateGetSharedWishlist(data: DataService, token: string) {
	const controller = createWishlistController(data);
	const items = await controller.getSharedWishlist(token);
	if (items === null) {
		return { error: "Shared wishlist not found or expired", status: 404 };
	}
	return { items };
}

async function simulateCreateShare(
	data: DataService,
	customerId?: string,
	expiresInDays?: number,
) {
	if (!customerId) return { error: "Unauthorized", status: 401 };

	const controller = createWishlistController(data);

	let expiresAt: Date | undefined;
	if (expiresInDays) {
		expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
	}

	const share = await controller.createShareToken(customerId, expiresAt);
	return { share };
}

async function simulateRevokeShare(
	data: DataService,
	shareId: string,
	customerId?: string,
) {
	if (!customerId) return { error: "Unauthorized", status: 401 };

	const controller = createWishlistController(data);
	const revoked = await controller.revokeShareToken(customerId, shareId);
	if (!revoked) {
		return { error: "Share token not found", status: 404 };
	}
	return { revoked };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("wishlist store endpoints", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	// ── add-to-wishlist ──────────────────────────────────────────────

	describe("add-to-wishlist", () => {
		it("requires authentication", async () => {
			const result = await simulateAddToWishlist(data, {
				productId: "prod-1",
				productName: "Widget",
			});
			expect(result).toEqual({ error: "Unauthorized", status: 401 });
		});

		it("adds item to wishlist", async () => {
			const result = await simulateAddToWishlist(
				data,
				{
					productId: "prod-1",
					productName: "Cool Widget",
					note: "Birthday gift idea",
				},
				"cust-1",
			);

			const res = result as { item: WishlistItem };
			expect(res.item.productId).toBe("prod-1");
			expect(res.item.productName).toBe("Cool Widget");
			expect(res.item.customerId).toBe("cust-1");
			expect(res.item.note).toBe("Birthday gift idea");
		});

		it("returns existing item on duplicate add (idempotent)", async () => {
			const first = await simulateAddToWishlist(
				data,
				{ productId: "prod-1", productName: "Widget" },
				"cust-1",
			);
			const second = await simulateAddToWishlist(
				data,
				{ productId: "prod-1", productName: "Widget" },
				"cust-1",
			);

			const firstItem = (first as { item: WishlistItem }).item;
			const secondItem = (second as { item: WishlistItem }).item;
			expect(secondItem.id).toBe(firstItem.id);
		});

		it("catches wishlist limit error", async () => {
			// Add one item first to fill the limit
			await simulateAddToWishlist(
				data,
				{ productId: "prod-1", productName: "Widget A" },
				"cust-1",
				{ maxItems: 1 },
			);
			// Second add should hit the limit
			const result = await simulateAddToWishlist(
				data,
				{ productId: "prod-2", productName: "Widget B" },
				"cust-1",
				{ maxItems: 1 },
			);

			expect(result).toMatchObject({ status: 422 });
			expect((result as { error: string }).error).toContain(
				"Wishlist limit reached",
			);
		});
	});

	// ── remove-from-wishlist ─────────────────────────────────────────

	describe("remove-from-wishlist", () => {
		it("requires authentication", async () => {
			const result = await simulateRemoveFromWishlist(data, "item-1");
			expect(result).toEqual({ error: "Unauthorized", status: 401 });
		});

		it("removes own wishlist item", async () => {
			const controller = createWishlistController(data);
			const item = await controller.addItem({
				customerId: "cust-1",
				productId: "prod-1",
				productName: "Widget",
			});

			const result = await simulateRemoveFromWishlist(data, item.id, "cust-1");
			expect(result).toEqual({ removed: true });
		});

		it("blocks removal of another customer's item", async () => {
			const controller = createWishlistController(data);
			const item = await controller.addItem({
				customerId: "cust-owner",
				productId: "prod-1",
				productName: "Widget",
			});

			const result = await simulateRemoveFromWishlist(
				data,
				item.id,
				"cust-intruder",
			);
			expect(result).toEqual({
				error: "Wishlist item not found",
				status: 404,
			});
		});

		it("returns 404 for nonexistent item", async () => {
			const result = await simulateRemoveFromWishlist(
				data,
				"no-such-item",
				"cust-1",
			);
			expect(result).toEqual({
				error: "Wishlist item not found",
				status: 404,
			});
		});
	});

	// ── check-wishlist ───────────────────────────────────────────────

	describe("check-wishlist", () => {
		it("returns false for unauthenticated users", async () => {
			const result = await simulateCheckWishlist(data, "prod-1");
			expect(result).toEqual({ inWishlist: false, itemId: null });
		});

		it("returns false when product not in wishlist", async () => {
			const result = await simulateCheckWishlist(data, "prod-1", "cust-1");
			expect(result).toEqual({ inWishlist: false, itemId: null });
		});

		it("returns true with itemId when product is in wishlist", async () => {
			const controller = createWishlistController(data);
			const item = await controller.addItem({
				customerId: "cust-1",
				productId: "prod-1",
				productName: "Widget",
			});

			const result = await simulateCheckWishlist(data, "prod-1", "cust-1");
			expect(result).toEqual({ inWishlist: true, itemId: item.id });
		});

		it("does not return another customer's wishlist status", async () => {
			const controller = createWishlistController(data);
			await controller.addItem({
				customerId: "cust-other",
				productId: "prod-1",
				productName: "Widget",
			});

			const result = await simulateCheckWishlist(data, "prod-1", "cust-1");
			expect(result).toEqual({ inWishlist: false, itemId: null });
		});
	});

	// ── list-wishlist ────────────────────────────────────────────────

	describe("list-wishlist", () => {
		it("requires authentication", async () => {
			const result = await simulateListWishlist(data);
			expect(result).toEqual({ error: "Unauthorized", status: 401 });
		});

		it("returns items with total count", async () => {
			const controller = createWishlistController(data);
			await controller.addItem({
				customerId: "cust-1",
				productId: "prod-1",
				productName: "Widget A",
			});
			await controller.addItem({
				customerId: "cust-1",
				productId: "prod-2",
				productName: "Widget B",
			});

			const result = await simulateListWishlist(data, "cust-1");
			const res = result as { items: WishlistItem[]; total: number };
			expect(res.items).toHaveLength(2);
			expect(res.total).toBe(2);
		});

		it("does not include another customer's items", async () => {
			const controller = createWishlistController(data);
			await controller.addItem({
				customerId: "cust-other",
				productId: "prod-1",
				productName: "Widget",
			});

			const result = await simulateListWishlist(data, "cust-1");
			const res = result as { items: WishlistItem[]; total: number };
			expect(res.items).toHaveLength(0);
			expect(res.total).toBe(0);
		});
	});

	// ── share lifecycle ──────────────────────────────────────────────

	describe("share lifecycle", () => {
		it("creates share token requiring auth", async () => {
			const result = await simulateCreateShare(data);
			expect(result).toEqual({ error: "Unauthorized", status: 401 });
		});

		it("creates share token with expiry", async () => {
			const result = await simulateCreateShare(data, "cust-1", 7);
			const res = result as { share: WishlistShare };
			expect(res.share.customerId).toBe("cust-1");
			expect(res.share.token).toBeTruthy();
			expect(res.share.active).toBe(true);
		});

		it("creates share token without expiry", async () => {
			const result = await simulateCreateShare(data, "cust-1");
			const res = result as { share: WishlistShare };
			expect(res.share.expiresAt).toBeUndefined();
		});

		it("shared wishlist returns items publicly (no auth needed)", async () => {
			const controller = createWishlistController(data);
			await controller.addItem({
				customerId: "cust-1",
				productId: "prod-1",
				productName: "Widget",
			});
			const share = await controller.createShareToken("cust-1");

			const result = await simulateGetSharedWishlist(data, share.token);
			const res = result as { items: WishlistItem[] };
			expect(res.items).toHaveLength(1);
			expect(res.items[0].productName).toBe("Widget");
		});

		it("returns 404 for invalid share token", async () => {
			const result = await simulateGetSharedWishlist(data, "bad-token");
			expect(result).toEqual({
				error: "Shared wishlist not found or expired",
				status: 404,
			});
		});

		it("revoke-share requires auth", async () => {
			const result = await simulateRevokeShare(data, "share-1");
			expect(result).toEqual({ error: "Unauthorized", status: 401 });
		});

		it("revokes own share token", async () => {
			const controller = createWishlistController(data);
			const share = await controller.createShareToken("cust-1");

			const result = await simulateRevokeShare(data, share.id, "cust-1");
			expect(result).toEqual({ revoked: true });
		});

		it("returns 404 when revoking another customer's share", async () => {
			const controller = createWishlistController(data);
			const share = await controller.createShareToken("cust-owner");

			const result = await simulateRevokeShare(data, share.id, "cust-intruder");
			expect(result).toEqual({
				error: "Share token not found",
				status: 404,
			});
		});
	});
});
