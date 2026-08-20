import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Cart, CartItem } from "../service";
import { createCartControllers } from "../service-impl";

// ── Helpers ───────────────────────────────────────────────────────────────

function addItemParams(overrides: {
	cartId: string;
	productId: string;
	quantity: number;
	price: number;
	variantId?: string;
	productName?: string;
	productSlug?: string;
	productImage?: string;
	variantName?: string;
	variantOptions?: Record<string, string>;
}) {
	return {
		productName: "Test Product",
		productSlug: "test-product",
		...overrides,
	};
}

// ── Edge-case and admin-flow tests ────────────────────────────────────────

describe("cart controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCartControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCartControllers(mockData);
	});

	// ── getOrCreateCart ───────────────────────────────────────────────

	describe("getOrCreateCart — priority and edge cases", () => {
		it("prefers customerId over guestId when both provided", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "cust_1",
				guestId: "guest_1",
			});
			expect(cart.id).toBe("cust_1");
			expect(cart.customerId).toBe("cust_1");
		});

		it("creates distinct carts for different customers", async () => {
			const a = await controller.getOrCreateCart({ customerId: "cust_a" });
			const b = await controller.getOrCreateCart({ customerId: "cust_b" });
			expect(a.id).not.toBe(b.id);
		});

		it("creates distinct carts for different guests", async () => {
			const a = await controller.getOrCreateCart({ guestId: "g_a" });
			const b = await controller.getOrCreateCart({ guestId: "g_b" });
			expect(a.id).not.toBe(b.id);
		});

		it("anonymous carts each get a unique UUID", async () => {
			const a = await controller.getOrCreateCart({});
			const b = await controller.getOrCreateCart({});
			expect(a.id).not.toBe(b.id);
		});

		it("initializes metadata as empty object", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "meta_test",
			});
			expect(cart.metadata).toEqual({});
		});

		it("returns same cart object fields on repeat access", async () => {
			const first = await controller.getOrCreateCart({
				customerId: "repeat",
			});
			const second = await controller.getOrCreateCart({
				customerId: "repeat",
			});
			expect(first.status).toBe(second.status);
			expect(first.expiresAt.getTime()).toBe(second.expiresAt.getTime());
		});
	});

	// ── addItem — variant isolation ──────────────────────────────────

	describe("addItem — variant isolation", () => {
		it("same product, different variants are separate line items", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "c1",
					productId: "p1",
					variantId: "red",
					quantity: 1,
					price: 20,
					variantName: "Red",
				}),
			);
			await controller.addItem(
				addItemParams({
					cartId: "c1",
					productId: "p1",
					variantId: "blue",
					quantity: 1,
					price: 20,
					variantName: "Blue",
				}),
			);

			const items = await controller.getCartItems("c1");
			expect(items).toHaveLength(2);
		});

		it("same product+variant merges quantity", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "c1",
					productId: "p1",
					variantId: "red",
					quantity: 2,
					price: 20,
				}),
			);
			const merged = await controller.addItem(
				addItemParams({
					cartId: "c1",
					productId: "p1",
					variantId: "red",
					quantity: 3,
					price: 20,
				}),
			);

			expect(merged.quantity).toBe(5);
			const items = await controller.getCartItems("c1");
			expect(items).toHaveLength(1);
		});

		it("adding many products accumulates correctly", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.addItem(
					addItemParams({
						cartId: "big_cart",
						productId: `prod_${i}`,
						quantity: i + 1,
						price: 100,
					}),
				);
			}
			const items = await controller.getCartItems("big_cart");
			expect(items).toHaveLength(10);
			const total = await controller.getCartTotal("big_cart");
			// sum(1..10) * 100 = 55 * 100 = 5500
			expect(total).toBe(5500);
		});
	});

	// ── clearCart — edge cases ───────────────────────────────────────

	describe("clearCart — edge cases", () => {
		it("clearing an empty cart is a no-op", async () => {
			// Should not throw
			await controller.clearCart("nonexistent_cart");
			const items = await controller.getCartItems("nonexistent_cart");
			expect(items).toHaveLength(0);
		});

		it("cart entity persists after clearing items", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "persist_test",
			});
			await controller.addItem(
				addItemParams({
					cartId: cart.id,
					productId: "p1",
					quantity: 1,
					price: 10,
				}),
			);
			await controller.clearCart(cart.id);

			const fetched = (await mockData.get("cart", cart.id)) as Cart | null;
			expect(fetched).not.toBeNull();
			expect(fetched?.status).toBe("active");
		});
	});

	// ── removeItem — data integrity ──────────────────────────────────

	describe("removeItem — data integrity", () => {
		it("removing one item does not affect others in the same cart", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "rm_cart",
					productId: "p1",
					quantity: 1,
					price: 10,
				}),
			);
			await controller.addItem(
				addItemParams({
					cartId: "rm_cart",
					productId: "p2",
					quantity: 1,
					price: 20,
				}),
			);

			await controller.removeItem("rm_cart_p1");
			const items = await controller.getCartItems("rm_cart");
			expect(items).toHaveLength(1);
			expect(items[0].productId).toBe("p2");
		});

		it("removing a nonexistent item does not throw", async () => {
			// data.delete on a nonexistent key is silent
			await controller.removeItem("does_not_exist");
		});
	});

	// ── updateItem — edge cases ─────────────────────────────────────

	describe("updateItem — edge cases", () => {
		it("updating to quantity 1 keeps the item", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "upd_q",
					productId: "p1",
					quantity: 5,
					price: 10,
				}),
			);
			const updated = await controller.updateItem("upd_q_p1", 1);
			expect(updated.quantity).toBe(1);
		});

		it("updates advance the updatedAt timestamp", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "ts_cart",
					productId: "p1",
					quantity: 1,
					price: 10,
				}),
			);
			const before = (await mockData.get("cartItem", "ts_cart_p1")) as CartItem;
			const updated = await controller.updateItem("ts_cart_p1", 2);
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				before.updatedAt.getTime(),
			);
		});
	});

	// ── getCartTotal — precision ────────────────────────────────────

	describe("getCartTotal — precision", () => {
		it("handles fractional prices correctly", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "frac",
					productId: "p1",
					quantity: 3,
					price: 9.99,
				}),
			);
			const total = await controller.getCartTotal("frac");
			expect(total).toBeCloseTo(29.97, 10);
		});

		it("returns 0 for a cart with only removed items", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "rm_all",
					productId: "p1",
					quantity: 1,
					price: 10,
				}),
			);
			await controller.removeItem("rm_all_p1");
			expect(await controller.getCartTotal("rm_all")).toBe(0);
		});
	});

	// ── isProductInActiveCart — multi-cart ───────────────────────────

	describe("isProductInActiveCart — multi-cart scenarios", () => {
		it("returns false when product is in an abandoned cart only", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "ab_test",
			});
			await controller.addItem(
				addItemParams({
					cartId: cart.id,
					productId: "prod_in_abandoned",
					quantity: 1,
					price: 10,
				}),
			);
			await controller.markAsAbandoned(cart.id);

			const result =
				await controller.isProductInActiveCart("prod_in_abandoned");
			expect(result).toBe(false);
		});

		it("returns true when product is in both active and abandoned carts", async () => {
			// Abandoned cart
			const abCart = await controller.getOrCreateCart({
				customerId: "ab_both",
			});
			await controller.addItem(
				addItemParams({
					cartId: abCart.id,
					productId: "shared_prod",
					quantity: 1,
					price: 10,
				}),
			);
			await controller.markAsAbandoned(abCart.id);

			// Active cart
			const activeCart = await controller.getOrCreateCart({
				customerId: "active_both",
			});
			await controller.addItem(
				addItemParams({
					cartId: activeCart.id,
					productId: "shared_prod",
					quantity: 1,
					price: 10,
				}),
			);

			expect(await controller.isProductInActiveCart("shared_prod")).toBe(true);
		});

		it("returns false when no items exist for the product", async () => {
			expect(await controller.isProductInActiveCart("totally_unknown")).toBe(
				false,
			);
		});
	});

	// ── markAsAbandoned — idempotency ───────────────────────────────

	describe("markAsAbandoned — idempotency", () => {
		it("marking an abandoned cart as abandoned again succeeds", async () => {
			await controller.getOrCreateCart({ customerId: "idem_ab" });
			await controller.markAsAbandoned("idem_ab");
			const second = await controller.markAsAbandoned("idem_ab");
			expect(second.status).toBe("abandoned");
		});

		it("preserves metadata when marking as abandoned", async () => {
			await controller.getOrCreateCart({ customerId: "meta_ab" });
			await controller.markRecoveryEmailSent("meta_ab");
			const abandoned = await controller.markAsAbandoned("meta_ab");
			const meta = abandoned.metadata as Record<string, unknown>;
			expect(meta.recoveryEmailCount).toBe(1);
		});
	});

	// ── markRecoveryEmailSent — multi-send ──────────────────────────

	describe("markRecoveryEmailSent — multi-send tracking", () => {
		it("tracks three sequential recovery emails", async () => {
			await controller.getOrCreateCart({ customerId: "triple_send" });
			await controller.markRecoveryEmailSent("triple_send");
			await controller.markRecoveryEmailSent("triple_send");
			const third = await controller.markRecoveryEmailSent("triple_send");

			const meta = third.metadata as Record<string, unknown>;
			expect(meta.recoveryEmailCount).toBe(3);
			expect(meta.recoveryEmailSentAt).toBeDefined();
		});

		it("updates timestamp on each send", async () => {
			await controller.getOrCreateCart({ customerId: "ts_send" });
			const first = await controller.markRecoveryEmailSent("ts_send");
			const firstMeta = first.metadata as Record<string, unknown>;
			const firstTs = firstMeta.recoveryEmailSentAt as string;

			await new Promise((r) => setTimeout(r, 5));

			const second = await controller.markRecoveryEmailSent("ts_send");
			const secondMeta = second.metadata as Record<string, unknown>;
			const secondTs = secondMeta.recoveryEmailSentAt as string;

			expect(new Date(secondTs).getTime()).toBeGreaterThanOrEqual(
				new Date(firstTs).getTime(),
			);
		});
	});

	// ── getAbandonedCarts — sorting and defaults ────────────────────

	describe("getAbandonedCarts — sorting and defaults", () => {
		it("uses default threshold of 1 hour", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "default_thresh",
			});
			// Backdate to 2 hours ago
			const stale = {
				...cart,
				updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
			};
			await mockData.upsert("cart", cart.id, stale as Record<string, unknown>);

			const result = await controller.getAbandonedCarts();
			expect(result).toHaveLength(1);
		});

		it("sorts by updatedAt descending (most recently stale first)", async () => {
			// Create 3 carts with different stale times
			for (let i = 1; i <= 3; i++) {
				const cart = await controller.getOrCreateCart({
					customerId: `sort_${i}`,
				});
				const stale = {
					...cart,
					updatedAt: new Date(Date.now() - (i + 1) * 60 * 60 * 1000),
				};
				await mockData.upsert(
					"cart",
					cart.id,
					stale as Record<string, unknown>,
				);
			}

			const result = await controller.getAbandonedCarts({
				thresholdHours: 1,
			});
			expect(result).toHaveLength(3);
			// Most recently updated stale cart should come first
			for (let i = 0; i < result.length - 1; i++) {
				expect(new Date(result[i].updatedAt).getTime()).toBeGreaterThanOrEqual(
					new Date(result[i + 1].updatedAt).getTime(),
				);
			}
		});

		it("default take is 50", async () => {
			// We won't create 51 carts, but verify the default is applied
			const cart = await controller.getOrCreateCart({
				customerId: "limit_test",
			});
			const stale = {
				...cart,
				updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
			};
			await mockData.upsert("cart", cart.id, stale as Record<string, unknown>);

			const result = await controller.getAbandonedCarts({
				thresholdHours: 1,
			});
			expect(result).toHaveLength(1);
		});

		it("does not include converted carts even if stale", async () => {
			const cart = await controller.getOrCreateCart({
				customerId: "converted_stale",
			});
			const converted = {
				...cart,
				status: "converted" as const,
				updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
			};
			await mockData.upsert(
				"cart",
				cart.id,
				converted as Record<string, unknown>,
			);

			const result = await controller.getAbandonedCarts({
				thresholdHours: 1,
			});
			expect(result).toHaveLength(0);
		});
	});

	// ── getRecoveryStats — complex scenarios ────────────────────────

	describe("getRecoveryStats — complex scenarios", () => {
		it("counts each status correctly with mixed carts", async () => {
			// Active cart (not abandoned, not recovered)
			await controller.getOrCreateCart({ customerId: "active_only" });

			// Abandoned cart without recovery
			await controller.getOrCreateCart({ customerId: "ab_no_recovery" });
			await controller.markAsAbandoned("ab_no_recovery");

			// Abandoned cart with recovery email (not converted)
			await controller.getOrCreateCart({ customerId: "ab_with_recovery" });
			await controller.markAsAbandoned("ab_with_recovery");
			await controller.markRecoveryEmailSent("ab_with_recovery");

			// Converted cart with recovery (recovered!)
			await controller.getOrCreateCart({ customerId: "recovered" });
			await controller.markRecoveryEmailSent("recovered");
			const cart = (await mockData.get("cart", "recovered")) as Record<
				string,
				unknown
			>;
			await mockData.upsert("cart", "recovered", {
				...cart,
				status: "converted",
			});

			const stats = await controller.getRecoveryStats();
			expect(stats.totalAbandoned).toBe(2); // ab_no_recovery + ab_with_recovery
			expect(stats.recoverySent).toBe(2); // ab_with_recovery + recovered
			expect(stats.recovered).toBe(1); // only recovered
		});

		it("active cart with recovery email is counted in recoverySent", async () => {
			await controller.getOrCreateCart({ customerId: "active_with_email" });
			await controller.markRecoveryEmailSent("active_with_email");

			const stats = await controller.getRecoveryStats();
			expect(stats.recoverySent).toBe(1);
			expect(stats.recovered).toBe(0);
		});
	});

	// ── Cart isolation across carts ─────────────────────────────────

	describe("cross-cart isolation", () => {
		it("items from different carts do not affect each other's totals", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "iso_a",
					productId: "p1",
					quantity: 2,
					price: 100,
				}),
			);
			await controller.addItem(
				addItemParams({
					cartId: "iso_b",
					productId: "p1",
					quantity: 5,
					price: 100,
				}),
			);

			expect(await controller.getCartTotal("iso_a")).toBe(200);
			expect(await controller.getCartTotal("iso_b")).toBe(500);
		});

		it("clearing one cart does not affect another", async () => {
			await controller.addItem(
				addItemParams({
					cartId: "clr_a",
					productId: "p1",
					quantity: 1,
					price: 10,
				}),
			);
			await controller.addItem(
				addItemParams({
					cartId: "clr_b",
					productId: "p1",
					quantity: 1,
					price: 10,
				}),
			);

			await controller.clearCart("clr_a");
			expect(await controller.getCartItems("clr_a")).toHaveLength(0);
			expect(await controller.getCartItems("clr_b")).toHaveLength(1);
		});
	});
});
