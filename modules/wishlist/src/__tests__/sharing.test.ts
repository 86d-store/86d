import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWishlistController } from "../service-impl";

describe("wishlist sharing", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWishlistController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWishlistController(mockData);
	});

	// ── createShareToken ────────────────────────────────────────────────

	describe("createShareToken", () => {
		it("creates a share token for a customer", async () => {
			const share = await controller.createShareToken("cust_1");
			expect(share.id).toBeDefined();
			expect(share.customerId).toBe("cust_1");
			expect(share.token).toBeDefined();
			expect(share.token.length).toBe(32); // UUID without dashes
			expect(share.active).toBe(true);
			expect(share.createdAt).toBeInstanceOf(Date);
			expect(share.expiresAt).toBeUndefined();
		});

		it("creates token with expiry", async () => {
			const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
			const share = await controller.createShareToken("cust_1", expiresAt);
			expect(share.expiresAt).toEqual(expiresAt);
		});

		it("creates multiple tokens for same customer", async () => {
			const share1 = await controller.createShareToken("cust_1");
			const share2 = await controller.createShareToken("cust_1");
			expect(share1.id).not.toBe(share2.id);
			expect(share1.token).not.toBe(share2.token);
		});

		it("creates tokens for different customers independently", async () => {
			const share1 = await controller.createShareToken("cust_1");
			const share2 = await controller.createShareToken("cust_2");
			expect(share1.customerId).toBe("cust_1");
			expect(share2.customerId).toBe("cust_2");
		});
	});

	// ── revokeShareToken ────────────────────────────────────────────────

	describe("revokeShareToken", () => {
		it("revokes an active share token", async () => {
			const share = await controller.createShareToken("cust_1");
			const result = await controller.revokeShareToken("cust_1", share.id);
			expect(result).toBe(true);
		});

		it("returns false for non-existent token", async () => {
			const result = await controller.revokeShareToken(
				"cust_1",
				"non_existent",
			);
			expect(result).toBe(false);
		});

		it("returns false when customer does not own the token", async () => {
			const share = await controller.createShareToken("cust_1");
			const result = await controller.revokeShareToken("cust_2", share.id);
			expect(result).toBe(false);
		});

		it("revoked token no longer appears in getShareTokens", async () => {
			const share = await controller.createShareToken("cust_1");
			await controller.revokeShareToken("cust_1", share.id);
			const tokens = await controller.getShareTokens("cust_1");
			expect(tokens).toHaveLength(0);
		});
	});

	// ── getShareTokens ──────────────────────────────────────────────────

	describe("getShareTokens", () => {
		it("returns active tokens for a customer", async () => {
			await controller.createShareToken("cust_1");
			await controller.createShareToken("cust_1");
			const tokens = await controller.getShareTokens("cust_1");
			expect(tokens).toHaveLength(2);
		});

		it("excludes revoked tokens", async () => {
			const share1 = await controller.createShareToken("cust_1");
			await controller.createShareToken("cust_1");
			await controller.revokeShareToken("cust_1", share1.id);
			const tokens = await controller.getShareTokens("cust_1");
			expect(tokens).toHaveLength(1);
		});

		it("excludes expired tokens", async () => {
			const pastDate = new Date(Date.now() - 1000);
			await controller.createShareToken("cust_1", pastDate);
			const tokens = await controller.getShareTokens("cust_1");
			expect(tokens).toHaveLength(0);
		});

		it("includes non-expired tokens", async () => {
			const futureDate = new Date(Date.now() + 60 * 60 * 1000);
			await controller.createShareToken("cust_1", futureDate);
			const tokens = await controller.getShareTokens("cust_1");
			expect(tokens).toHaveLength(1);
		});

		it("returns empty for customer with no tokens", async () => {
			const tokens = await controller.getShareTokens("cust_unknown");
			expect(tokens).toHaveLength(0);
		});

		it("does not return tokens from other customers", async () => {
			await controller.createShareToken("cust_1");
			await controller.createShareToken("cust_2");
			const tokens = await controller.getShareTokens("cust_1");
			expect(tokens).toHaveLength(1);
			expect(tokens[0].customerId).toBe("cust_1");
		});
	});

	// ── getSharedWishlist ────────────────────────────────────────────────

	describe("getSharedWishlist", () => {
		it("returns wishlist items for a valid share token", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "Gadget",
			});
			const share = await controller.createShareToken("cust_1");
			const items = await controller.getSharedWishlist(share.token);
			expect(items).not.toBeNull();
			expect(items).toHaveLength(2);
		});

		it("returns null for invalid token", async () => {
			const items = await controller.getSharedWishlist("invalid_token");
			expect(items).toBeNull();
		});

		it("returns null for revoked token", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const share = await controller.createShareToken("cust_1");
			await controller.revokeShareToken("cust_1", share.id);
			const items = await controller.getSharedWishlist(share.token);
			expect(items).toBeNull();
		});

		it("returns null for expired token", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const pastDate = new Date(Date.now() - 1000);
			const share = await controller.createShareToken("cust_1", pastDate);
			const items = await controller.getSharedWishlist(share.token);
			expect(items).toBeNull();
		});

		it("returns items for non-expired token", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const futureDate = new Date(Date.now() + 60 * 60 * 1000);
			const share = await controller.createShareToken("cust_1", futureDate);
			const items = await controller.getSharedWishlist(share.token);
			expect(items).not.toBeNull();
			expect(items).toHaveLength(1);
		});

		it("returns empty array for customer with no items", async () => {
			const share = await controller.createShareToken("cust_1");
			const items = await controller.getSharedWishlist(share.token);
			expect(items).not.toBeNull();
			expect(items).toHaveLength(0);
		});

		it("reflects current wishlist state (items added after share)", async () => {
			const share = await controller.createShareToken("cust_1");
			// Add items after creating the share token
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "New Item",
			});
			const items = await controller.getSharedWishlist(share.token);
			expect(items).toHaveLength(1);
		});

		it("reflects current wishlist state (items removed after share)", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const share = await controller.createShareToken("cust_1");
			await controller.removeItem(item.id);
			const items = await controller.getSharedWishlist(share.token);
			expect(items).toHaveLength(0);
		});

		it("only shows the owner's items, not other customers", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "My Widget",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_2",
				productName: "Their Widget",
			});
			const share = await controller.createShareToken("cust_1");
			const items = await controller.getSharedWishlist(share.token);
			expect(items).toHaveLength(1);
			expect(items?.[0].customerId).toBe("cust_1");
		});
	});

	// ── sharing lifecycle ───────────────────────────────────────────────

	describe("sharing lifecycle", () => {
		it("create → share → view → revoke → view fails", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});

			const share = await controller.createShareToken("cust_1");
			const itemsBefore = await controller.getSharedWishlist(share.token);
			expect(itemsBefore).toHaveLength(1);

			await controller.revokeShareToken("cust_1", share.id);
			const itemsAfter = await controller.getSharedWishlist(share.token);
			expect(itemsAfter).toBeNull();
		});

		it("multiple active shares for same customer all work", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});

			const share1 = await controller.createShareToken("cust_1");
			const share2 = await controller.createShareToken("cust_1");

			const items1 = await controller.getSharedWishlist(share1.token);
			const items2 = await controller.getSharedWishlist(share2.token);

			expect(items1).toHaveLength(1);
			expect(items2).toHaveLength(1);

			// Revoke one, other still works
			await controller.revokeShareToken("cust_1", share1.id);
			expect(await controller.getSharedWishlist(share1.token)).toBeNull();
			expect(await controller.getSharedWishlist(share2.token)).toHaveLength(1);
		});
	});
});
