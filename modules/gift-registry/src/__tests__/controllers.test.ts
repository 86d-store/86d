import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { GiftRegistryController } from "../service";
import { createGiftRegistryController } from "../service-impl";

const makeRegistry = (overrides?: Record<string, unknown>) => ({
	customerId: "cust_1",
	customerName: "Jane Doe",
	title: "Jane & John's Wedding",
	type: "wedding" as const,
	...overrides,
});

const makeItem = (registryId: string, overrides?: Record<string, unknown>) => ({
	registryId,
	productId: "prod_1",
	productName: "Le Creuset Dutch Oven",
	priceInCents: 35000,
	...overrides,
});

describe("gift-registry controllers", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: GiftRegistryController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftRegistryController(mockData);
	});

	// ── Slug generation ─────────────────────────────────────────────

	describe("slug generation", () => {
		it("auto-generates a slug from title when none provided", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ title: "Our Wedding Day" }),
			);
			expect(registry.slug).toMatch(/^our-wedding-day-[a-f0-9]{8}$/);
		});

		it("slugifies titles with special characters", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ title: "Baby's 1st Birthday!!!" }),
			);
			// Should strip non-alphanumeric and lowercase
			expect(registry.slug).toMatch(/^baby-s-1st-birthday-[a-f0-9]{8}$/);
		});

		it("auto-generated slugs are unique for identical titles", async () => {
			const r1 = await controller.createRegistry(
				makeRegistry({ title: "Wishlist" }),
			);
			const r2 = await controller.createRegistry(
				makeRegistry({
					title: "Wishlist",
					customerId: "cust_2",
					customerName: "Other",
				}),
			);
			expect(r1.slug).not.toBe(r2.slug);
			expect(r1.slug).toContain("wishlist");
			expect(r2.slug).toContain("wishlist");
		});

		it("uses custom slug verbatim when provided", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ slug: "my-custom-slug" }),
			);
			expect(registry.slug).toBe("my-custom-slug");
		});

		it("rejects duplicate custom slug", async () => {
			await controller.createRegistry(makeRegistry({ slug: "taken-slug" }));
			await expect(
				controller.createRegistry(
					makeRegistry({
						slug: "taken-slug",
						customerId: "cust_2",
					}),
				),
			).rejects.toThrow("Registry slug already in use");
		});
	});

	// ── Title and customerId validation ─────────────────────────────

	describe("title and customerId validation", () => {
		it("throws on empty title", async () => {
			await expect(
				controller.createRegistry(makeRegistry({ title: "" })),
			).rejects.toThrow("Registry title is required");
		});

		it("throws on whitespace-only title", async () => {
			await expect(
				controller.createRegistry(makeRegistry({ title: "   \t\n" })),
			).rejects.toThrow("Registry title is required");
		});

		it("trims whitespace from title on create", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ title: "  Trimmed Title  " }),
			);
			expect(registry.title).toBe("Trimmed Title");
		});

		it("throws on missing customerId", async () => {
			await expect(
				controller.createRegistry(makeRegistry({ customerId: "" })),
			).rejects.toThrow("Customer ID is required");
		});

		it("throws on empty title in updateRegistry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await expect(
				controller.updateRegistry(registry.id, { title: "" }),
			).rejects.toThrow("Registry title cannot be empty");
		});

		it("trims whitespace from title on update", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const updated = await controller.updateRegistry(registry.id, {
				title: "  Updated  ",
			});
			expect(updated?.title).toBe("Updated");
		});
	});

	// ── Cannot add items to non-active registries ───────────────────

	describe("cannot add items to non-active registries", () => {
		it("throws when adding items to an archived registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await controller.archiveRegistry(registry.id);
			await expect(controller.addItem(makeItem(registry.id))).rejects.toThrow(
				"Cannot add items to an inactive registry",
			);
		});

		it("throws when adding items to a completed registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));

			// Fulfill the single item to auto-complete the registry
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});

			const completed = await controller.getRegistry(registry.id);
			expect(completed?.status).toBe("completed");

			await expect(
				controller.addItem(
					makeItem(registry.id, {
						productId: "prod_2",
						productName: "Blender",
					}),
				),
			).rejects.toThrow("Cannot add items to an inactive registry");
		});
	});

	// ── Purchase quantity validation and remaining check ─────────────

	describe("purchase quantity validation", () => {
		it("throws for zero purchase quantity", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: item.id,
					purchaserName: "Alice",
					quantity: 0,
					amountInCents: 100,
				}),
			).rejects.toThrow("Purchase quantity must be at least 1");
		});

		it("throws for negative purchase quantity", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: item.id,
					purchaserName: "Alice",
					quantity: -3,
					amountInCents: 100,
				}),
			).rejects.toThrow("Purchase quantity must be at least 1");
		});

		it("throws when purchase exceeds remaining quantity", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { quantityDesired: 3 }),
			);

			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 2,
				amountInCents: 70000,
			});

			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: item.id,
					purchaserName: "Bob",
					quantity: 2,
					amountInCents: 70000,
				}),
			).rejects.toThrow("Only 1 remaining for this item");
		});

		it("allows purchasing exactly the remaining quantity", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { quantityDesired: 2 }),
			);

			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});

			const purchase = await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Bob",
				quantity: 1,
				amountInCents: 35000,
			});
			expect(purchase.quantity).toBe(1);

			const updatedItem = await controller.getItem(item.id);
			expect(updatedItem?.quantityReceived).toBe(2);
		});

		it("throws when purchasing from an archived registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			await controller.archiveRegistry(registry.id);

			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: item.id,
					purchaserName: "Alice",
					quantity: 1,
					amountInCents: 35000,
				}),
			).rejects.toThrow("Cannot purchase from an inactive registry");
		});

		it("throws when item does not belong to specified registry", async () => {
			const r1 = await controller.createRegistry(makeRegistry());
			const r2 = await controller.createRegistry(
				makeRegistry({ customerId: "cust_2" }),
			);
			const item = await controller.addItem(makeItem(r1.id));

			await expect(
				controller.purchaseItem({
					registryId: r2.id,
					registryItemId: item.id,
					purchaserName: "Alice",
					quantity: 1,
					amountInCents: 35000,
				}),
			).rejects.toThrow("Item does not belong to this registry");
		});

		it("throws for non-existent registry on purchase", async () => {
			await expect(
				controller.purchaseItem({
					registryId: "nonexistent",
					registryItemId: "item_1",
					purchaserName: "Alice",
					quantity: 1,
					amountInCents: 100,
				}),
			).rejects.toThrow("Registry not found");
		});

		it("throws for non-existent item on purchase", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: "nonexistent",
					purchaserName: "Alice",
					quantity: 1,
					amountInCents: 100,
				}),
			).rejects.toThrow("Registry item not found");
		});
	});

	// ── Auto-complete when all items fully purchased ─────────────────

	describe("auto-complete on full purchase", () => {
		it("auto-completes registry when single item fully purchased", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));

			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});

			const updated = await controller.getRegistry(registry.id);
			expect(updated?.status).toBe("completed");
		});

		it("auto-completes registry when all items fulfilled across multiple purchases", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item1 = await controller.addItem(makeItem(registry.id));
			const item2 = await controller.addItem(
				makeItem(registry.id, {
					productId: "prod_2",
					productName: "Towels",
					priceInCents: 5000,
					quantityDesired: 2,
				}),
			);

			// Purchase item1
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item1.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});

			// Registry should still be active
			let updated = await controller.getRegistry(registry.id);
			expect(updated?.status).toBe("active");

			// Partially purchase item2
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item2.id,
				purchaserName: "Bob",
				quantity: 1,
				amountInCents: 5000,
			});

			// Still active since item2 is not fully fulfilled
			updated = await controller.getRegistry(registry.id);
			expect(updated?.status).toBe("active");

			// Finish purchasing item2
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item2.id,
				purchaserName: "Charlie",
				quantity: 1,
				amountInCents: 5000,
			});

			// Now should be completed
			updated = await controller.getRegistry(registry.id);
			expect(updated?.status).toBe("completed");
		});

		it("does not auto-complete when only some items are fulfilled", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item1 = await controller.addItem(makeItem(registry.id));
			await controller.addItem(
				makeItem(registry.id, {
					productId: "prod_2",
					productName: "Towels",
					priceInCents: 5000,
				}),
			);

			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item1.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});

			const updated = await controller.getRegistry(registry.id);
			expect(updated?.status).toBe("active");
		});
	});

	// ── itemCount / purchasedCount recalculation ────────────────────

	describe("itemCount and purchasedCount recalculation", () => {
		it("increments itemCount when items are added", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			expect(registry.itemCount).toBe(0);

			await controller.addItem(makeItem(registry.id));
			let updated = await controller.getRegistry(registry.id);
			expect(updated?.itemCount).toBe(1);

			await controller.addItem(
				makeItem(registry.id, {
					productId: "prod_2",
					productName: "Plates",
				}),
			);
			updated = await controller.getRegistry(registry.id);
			expect(updated?.itemCount).toBe(2);
		});

		it("decrements itemCount when items are removed", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item1 = await controller.addItem(makeItem(registry.id));
			const item2 = await controller.addItem(
				makeItem(registry.id, {
					productId: "prod_2",
					productName: "Plates",
				}),
			);

			let updated = await controller.getRegistry(registry.id);
			expect(updated?.itemCount).toBe(2);

			await controller.removeItem(item1.id);
			updated = await controller.getRegistry(registry.id);
			expect(updated?.itemCount).toBe(1);

			await controller.removeItem(item2.id);
			updated = await controller.getRegistry(registry.id);
			expect(updated?.itemCount).toBe(0);
		});

		it("purchasedCount reflects fully purchased items only", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { quantityDesired: 3 }),
			);

			// Partial purchase - should not count as purchased
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});

			let updated = await controller.getRegistry(registry.id);
			expect(updated?.purchasedCount).toBe(0);

			// Purchase remaining to fully fulfill
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Bob",
				quantity: 2,
				amountInCents: 70000,
			});

			updated = await controller.getRegistry(registry.id);
			expect(updated?.purchasedCount).toBe(1);
		});

		it("purchasedCount decreases when fully-purchased item is removed", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item1 = await controller.addItem(makeItem(registry.id));
			const item2 = await controller.addItem(
				makeItem(registry.id, {
					productId: "prod_2",
					productName: "Towels",
					priceInCents: 5000,
				}),
			);

			// Fully purchase item1
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item1.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});

			// Fully purchase item2
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item2.id,
				purchaserName: "Bob",
				quantity: 1,
				amountInCents: 5000,
			});

			let updated = await controller.getRegistry(registry.id);
			expect(updated?.purchasedCount).toBe(2);

			// Remove item1 - counts should update
			await controller.removeItem(item1.id);
			updated = await controller.getRegistry(registry.id);
			expect(updated?.itemCount).toBe(1);
			expect(updated?.purchasedCount).toBe(1);
		});
	});

	// ── archiveRegistry idempotency ─────────────────────────────────

	describe("archiveRegistry idempotency", () => {
		it("throws when archiving an already-archived registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await controller.archiveRegistry(registry.id);

			await expect(controller.archiveRegistry(registry.id)).rejects.toThrow(
				"Registry is already archived",
			);
		});

		it("returns null when archiving a non-existent registry", async () => {
			const result = await controller.archiveRegistry("nonexistent");
			expect(result).toBeNull();
		});

		it("successfully archives an active registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const archived = await controller.archiveRegistry(registry.id);
			expect(archived?.status).toBe("archived");

			const fetched = await controller.getRegistry(registry.id);
			expect(fetched?.status).toBe("archived");
		});
	});

	// ── getRegistrySummary accuracy ──────────────────────────────────

	describe("getRegistrySummary accuracy", () => {
		it("returns zeroes for empty store", async () => {
			const summary = await controller.getRegistrySummary();
			expect(summary.totalRegistries).toBe(0);
			expect(summary.active).toBe(0);
			expect(summary.completed).toBe(0);
			expect(summary.archived).toBe(0);
			expect(summary.totalItems).toBe(0);
			expect(summary.totalPurchased).toBe(0);
			expect(summary.totalRevenue).toBe(0);
		});

		it("accurately counts registries by status", async () => {
			// Create 3 active registries
			const r1 = await controller.createRegistry(makeRegistry());
			await controller.createRegistry(makeRegistry({ customerId: "cust_2" }));
			const r3 = await controller.createRegistry(
				makeRegistry({ customerId: "cust_3" }),
			);

			// Archive one
			await controller.archiveRegistry(r3.id);

			// Complete one via full purchase
			const item = await controller.addItem(makeItem(r1.id));
			await controller.purchaseItem({
				registryId: r1.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});

			const summary = await controller.getRegistrySummary();
			expect(summary.totalRegistries).toBe(3);
			expect(summary.active).toBe(1);
			expect(summary.completed).toBe(1);
			expect(summary.archived).toBe(1);
		});

		it("totalItems counts all items across registries", async () => {
			const r1 = await controller.createRegistry(makeRegistry());
			const r2 = await controller.createRegistry(
				makeRegistry({ customerId: "cust_2" }),
			);

			await controller.addItem(makeItem(r1.id));
			await controller.addItem(
				makeItem(r1.id, {
					productId: "prod_2",
					productName: "Plates",
				}),
			);
			await controller.addItem(makeItem(r2.id));

			const summary = await controller.getRegistrySummary();
			expect(summary.totalItems).toBe(3);
		});

		it("totalPurchased counts total quantity across all purchases", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { quantityDesired: 5 }),
			);

			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 2,
				amountInCents: 70000,
			});
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Bob",
				quantity: 1,
				amountInCents: 35000,
			});

			const summary = await controller.getRegistrySummary();
			expect(summary.totalPurchased).toBe(3);
		});

		it("totalRevenue sums amountInCents across all purchases", async () => {
			const r1 = await controller.createRegistry(makeRegistry());
			const r2 = await controller.createRegistry(
				makeRegistry({ customerId: "cust_2" }),
			);

			const item1 = await controller.addItem(
				makeItem(r1.id, { quantityDesired: 2 }),
			);
			const item2 = await controller.addItem(makeItem(r2.id));

			await controller.purchaseItem({
				registryId: r1.id,
				registryItemId: item1.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});
			await controller.purchaseItem({
				registryId: r2.id,
				registryItemId: item2.id,
				purchaserName: "Bob",
				quantity: 1,
				amountInCents: 5000,
			});

			const summary = await controller.getRegistrySummary();
			expect(summary.totalRevenue).toBe(40000);
		});
	});

	// ── Anonymous purchases ─────────────────────────────────────────

	describe("anonymous purchases", () => {
		it("defaults isAnonymous to false", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));

			const purchase = await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});
			expect(purchase.isAnonymous).toBe(false);
		});

		it("sets isAnonymous to true when explicitly requested", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));

			const purchase = await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Secret Santa",
				quantity: 1,
				amountInCents: 35000,
				isAnonymous: true,
			});
			expect(purchase.isAnonymous).toBe(true);
			expect(purchase.purchaserName).toBe("Secret Santa");
		});

		it("anonymous and non-anonymous purchases coexist on same item", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { quantityDesired: 3 }),
			);

			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
				isAnonymous: false,
			});
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Anonymous Giver",
				quantity: 1,
				amountInCents: 35000,
				isAnonymous: true,
			});

			const purchases = await controller.getPurchasesByItem(item.id);
			expect(purchases).toHaveLength(2);

			const anonymous = purchases.filter((p) => p.isAnonymous);
			const visible = purchases.filter((p) => !p.isAnonymous);
			expect(anonymous).toHaveLength(1);
			expect(visible).toHaveLength(1);
		});
	});

	// ── Item price validation ───────────────────────────────────────

	describe("item price validation", () => {
		it("throws for zero price", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await expect(
				controller.addItem(makeItem(registry.id, { priceInCents: 0 })),
			).rejects.toThrow("Price must be greater than zero");
		});

		it("throws for negative price", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await expect(
				controller.addItem(makeItem(registry.id, { priceInCents: -500 })),
			).rejects.toThrow("Price must be greater than zero");
		});
	});

	// ── updateItem validation ───────────────────────────────────────

	describe("updateItem validation", () => {
		it("throws when quantityDesired is set to zero", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));

			await expect(
				controller.updateItem(item.id, { quantityDesired: 0 }),
			).rejects.toThrow("Quantity desired must be at least 1");
		});

		it("throws when quantityDesired is negative", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));

			await expect(
				controller.updateItem(item.id, { quantityDesired: -1 }),
			).rejects.toThrow("Quantity desired must be at least 1");
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.updateItem("nonexistent", {
				note: "test",
			});
			expect(result).toBeNull();
		});
	});

	// ── Customer registries ─────────────────────────────────────────

	describe("getCustomerRegistries", () => {
		it("returns only registries belonging to the customer", async () => {
			await controller.createRegistry(makeRegistry());
			await controller.createRegistry(
				makeRegistry({ title: "Baby Shower", type: "baby" }),
			);
			await controller.createRegistry(
				makeRegistry({
					customerId: "cust_2",
					customerName: "Other Person",
				}),
			);

			const mine = await controller.getCustomerRegistries("cust_1");
			expect(mine).toHaveLength(2);

			const theirs = await controller.getCustomerRegistries("cust_2");
			expect(theirs).toHaveLength(1);
		});

		it("returns empty array for customer with no registries", async () => {
			const result = await controller.getCustomerRegistries("nonexistent");
			expect(result).toHaveLength(0);
		});
	});

	// ── Full lifecycle scenario ─────────────────────────────────────

	describe("full lifecycle", () => {
		it("handles create → add items → purchase → auto-complete", async () => {
			// 1. Create registry
			const registry = await controller.createRegistry(
				makeRegistry({
					title: "Our Wedding 2026",
					slug: "our-wedding-2026",
					visibility: "public",
					thankYouMessage: "Thank you so much!",
				}),
			);
			expect(registry.status).toBe("active");
			expect(registry.visibility).toBe("public");

			// 2. Add items
			const dutch = await controller.addItem(
				makeItem(registry.id, { priority: "must_have" }),
			);
			const towels = await controller.addItem(
				makeItem(registry.id, {
					productId: "prod_2",
					productName: "Luxury Towel Set",
					priceInCents: 8000,
					quantityDesired: 2,
					priority: "nice_to_have",
				}),
			);

			let reg = await controller.getRegistry(registry.id);
			expect(reg?.itemCount).toBe(2);
			expect(reg?.purchasedCount).toBe(0);

			// 3. Partial purchase of towels
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: towels.id,
				purchaserName: "Aunt Carol",
				purchaserId: "buyer_carol",
				quantity: 1,
				amountInCents: 8000,
				giftMessage: "Congrats!",
			});

			reg = await controller.getRegistry(registry.id);
			expect(reg?.status).toBe("active");
			expect(reg?.purchasedCount).toBe(0); // towels not fully purchased yet

			// 4. Anonymous purchase of dutch oven
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: dutch.id,
				purchaserName: "Mystery Buyer",
				quantity: 1,
				amountInCents: 35000,
				isAnonymous: true,
			});

			reg = await controller.getRegistry(registry.id);
			expect(reg?.status).toBe("active");
			expect(reg?.purchasedCount).toBe(1); // dutch oven fully purchased

			// 5. Complete the towels
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: towels.id,
				purchaserName: "Uncle Bob",
				quantity: 1,
				amountInCents: 8000,
			});

			// 6. Registry should auto-complete
			reg = await controller.getRegistry(registry.id);
			expect(reg?.status).toBe("completed");
			expect(reg?.purchasedCount).toBe(2);

			// 7. Verify summary
			const summary = await controller.getRegistrySummary();
			expect(summary.totalRegistries).toBe(1);
			expect(summary.completed).toBe(1);
			expect(summary.totalItems).toBe(2);
			expect(summary.totalPurchased).toBe(3); // 1 + 1 + 1 quantities
			expect(summary.totalRevenue).toBe(51000); // 8000 + 35000 + 8000

			// 8. Verify purchases by item
			const dutchPurchases = await controller.getPurchasesByItem(dutch.id);
			expect(dutchPurchases).toHaveLength(1);
			expect(dutchPurchases[0]?.isAnonymous).toBe(true);

			const towelPurchases = await controller.getPurchasesByItem(towels.id);
			expect(towelPurchases).toHaveLength(2);

			// 9. Cannot add more items to completed registry
			await expect(
				controller.addItem(
					makeItem(registry.id, {
						productId: "prod_3",
						productName: "Blender",
					}),
				),
			).rejects.toThrow("Cannot add items to an inactive registry");
		});
	});
});
