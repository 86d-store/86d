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

describe("createGiftRegistryController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: GiftRegistryController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftRegistryController(mockData);
	});

	// ── Registry CRUD ────────────────────────────────────────────

	describe("createRegistry", () => {
		it("creates a registry with defaults", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			expect(registry.id).toBeDefined();
			expect(registry.title).toBe("Jane & John's Wedding");
			expect(registry.type).toBe("wedding");
			expect(registry.visibility).toBe("unlisted");
			expect(registry.status).toBe("active");
			expect(registry.itemCount).toBe(0);
			expect(registry.purchasedCount).toBe(0);
			expect(registry.slug).toBeDefined();
		});

		it("creates a registry with custom slug", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ slug: "jane-and-john-2026" }),
			);
			expect(registry.slug).toBe("jane-and-john-2026");
		});

		it("creates a registry with public visibility", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ visibility: "public" }),
			);
			expect(registry.visibility).toBe("public");
		});

		it("creates a registry with private visibility", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ visibility: "private" }),
			);
			expect(registry.visibility).toBe("private");
		});

		it("creates a baby registry", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ type: "baby", title: "Baby Shower" }),
			);
			expect(registry.type).toBe("baby");
			expect(registry.title).toBe("Baby Shower");
		});

		it("creates a birthday registry", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ type: "birthday", title: "30th Birthday" }),
			);
			expect(registry.type).toBe("birthday");
		});

		it("creates a housewarming registry", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ type: "housewarming" }),
			);
			expect(registry.type).toBe("housewarming");
		});

		it("creates a holiday registry", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ type: "holiday" }),
			);
			expect(registry.type).toBe("holiday");
		});

		it("stores event date", async () => {
			const eventDate = new Date("2026-06-15");
			const registry = await controller.createRegistry(
				makeRegistry({ eventDate }),
			);
			expect(registry.eventDate).toEqual(eventDate);
		});

		it("stores cover image URL", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ coverImageUrl: "https://example.com/photo.jpg" }),
			);
			expect(registry.coverImageUrl).toBe("https://example.com/photo.jpg");
		});

		it("stores thank-you message", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ thankYouMessage: "Thank you for your generosity!" }),
			);
			expect(registry.thankYouMessage).toBe("Thank you for your generosity!");
		});

		it("stores shipping address ID", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ shippingAddressId: "addr_123" }),
			);
			expect(registry.shippingAddressId).toBe("addr_123");
		});

		it("throws for empty title", async () => {
			await expect(
				controller.createRegistry(makeRegistry({ title: "" })),
			).rejects.toThrow("Registry title is required");
		});

		it("throws for whitespace-only title", async () => {
			await expect(
				controller.createRegistry(makeRegistry({ title: "   " })),
			).rejects.toThrow("Registry title is required");
		});

		it("throws for missing customer ID", async () => {
			await expect(
				controller.createRegistry(makeRegistry({ customerId: "" })),
			).rejects.toThrow("Customer ID is required");
		});

		it("throws for duplicate slug", async () => {
			await controller.createRegistry(makeRegistry({ slug: "unique-slug" }));
			await expect(
				controller.createRegistry(
					makeRegistry({
						slug: "unique-slug",
						customerId: "cust_2",
					}),
				),
			).rejects.toThrow("Registry slug already in use");
		});

		it("auto-generates unique slugs", async () => {
			const r1 = await controller.createRegistry(
				makeRegistry({ title: "Wedding" }),
			);
			const r2 = await controller.createRegistry(
				makeRegistry({
					title: "Wedding",
					customerId: "cust_2",
					customerName: "Other",
				}),
			);
			expect(r1.slug).not.toBe(r2.slug);
		});
	});

	describe("updateRegistry", () => {
		it("updates title", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const updated = await controller.updateRegistry(registry.id, {
				title: "Updated Title",
			});
			expect(updated?.title).toBe("Updated Title");
		});

		it("updates description", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const updated = await controller.updateRegistry(registry.id, {
				description: "A beautiful wedding registry",
			});
			expect(updated?.description).toBe("A beautiful wedding registry");
		});

		it("updates visibility", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const updated = await controller.updateRegistry(registry.id, {
				visibility: "public",
			});
			expect(updated?.visibility).toBe("public");
		});

		it("updates type", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const updated = await controller.updateRegistry(registry.id, {
				type: "baby",
			});
			expect(updated?.type).toBe("baby");
		});

		it("updates event date", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const newDate = new Date("2026-12-25");
			const updated = await controller.updateRegistry(registry.id, {
				eventDate: newDate,
			});
			expect(updated?.eventDate).toEqual(newDate);
		});

		it("updates thank-you message", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const updated = await controller.updateRegistry(registry.id, {
				thankYouMessage: "Thanks!",
			});
			expect(updated?.thankYouMessage).toBe("Thanks!");
		});

		it("returns null for non-existent registry", async () => {
			const result = await controller.updateRegistry("nonexistent", {
				title: "Test",
			});
			expect(result).toBeNull();
		});

		it("throws for empty title", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await expect(
				controller.updateRegistry(registry.id, { title: "" }),
			).rejects.toThrow("Registry title cannot be empty");
		});

		it("updates updatedAt timestamp", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const updated = await controller.updateRegistry(registry.id, {
				title: "New",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				registry.updatedAt.getTime(),
			);
		});
	});

	describe("getRegistry", () => {
		it("returns a registry by ID", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const fetched = await controller.getRegistry(registry.id);
			expect(fetched?.id).toBe(registry.id);
			expect(fetched?.title).toBe(registry.title);
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getRegistry("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("getRegistryBySlug", () => {
		it("returns a registry by slug", async () => {
			const registry = await controller.createRegistry(
				makeRegistry({ slug: "my-registry" }),
			);
			const fetched = await controller.getRegistryBySlug("my-registry");
			expect(fetched?.id).toBe(registry.id);
		});

		it("returns null for non-existent slug", async () => {
			const result = await controller.getRegistryBySlug("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("listRegistries", () => {
		it("lists all registries", async () => {
			await controller.createRegistry(makeRegistry());
			await controller.createRegistry(
				makeRegistry({
					title: "Baby Shower",
					type: "baby",
					customerId: "cust_2",
				}),
			);
			const list = await controller.listRegistries();
			expect(list).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.createRegistry(makeRegistry());
			const r2 = await controller.createRegistry(
				makeRegistry({ customerId: "cust_2" }),
			);
			await controller.archiveRegistry(r2.id);

			const active = await controller.listRegistries({ status: "active" });
			expect(active).toHaveLength(1);
		});

		it("filters by type", async () => {
			await controller.createRegistry(makeRegistry());
			await controller.createRegistry(
				makeRegistry({ type: "baby", customerId: "cust_2" }),
			);
			const weddings = await controller.listRegistries({ type: "wedding" });
			expect(weddings).toHaveLength(1);
		});

		it("filters by visibility", async () => {
			await controller.createRegistry(makeRegistry({ visibility: "public" }));
			await controller.createRegistry(
				makeRegistry({
					visibility: "private",
					customerId: "cust_2",
				}),
			);
			const pub = await controller.listRegistries({ visibility: "public" });
			expect(pub).toHaveLength(1);
		});

		it("filters by customer", async () => {
			await controller.createRegistry(makeRegistry());
			await controller.createRegistry(makeRegistry({ customerId: "cust_2" }));
			const mine = await controller.listRegistries({
				customerId: "cust_1",
			});
			expect(mine).toHaveLength(1);
		});

		it("supports take/skip pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createRegistry(
					makeRegistry({
						title: `Registry ${i}`,
						customerId: `cust_${i}`,
					}),
				);
			}
			const page = await controller.listRegistries({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	describe("deleteRegistry", () => {
		it("deletes an existing registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const result = await controller.deleteRegistry(registry.id);
			expect(result).toBe(true);
			const fetched = await controller.getRegistry(registry.id);
			expect(fetched).toBeNull();
		});

		it("returns false for non-existent registry", async () => {
			const result = await controller.deleteRegistry("nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("archiveRegistry", () => {
		it("archives an active registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const archived = await controller.archiveRegistry(registry.id);
			expect(archived?.status).toBe("archived");
		});

		it("returns null for non-existent registry", async () => {
			const result = await controller.archiveRegistry("nonexistent");
			expect(result).toBeNull();
		});

		it("throws when already archived", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await controller.archiveRegistry(registry.id);
			await expect(controller.archiveRegistry(registry.id)).rejects.toThrow(
				"Registry is already archived",
			);
		});
	});

	// ── Registry Items ───────────────────────────────────────────

	describe("addItem", () => {
		it("adds an item to a registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			expect(item.id).toBeDefined();
			expect(item.productName).toBe("Le Creuset Dutch Oven");
			expect(item.priceInCents).toBe(35000);
			expect(item.quantityDesired).toBe(1);
			expect(item.quantityReceived).toBe(0);
			expect(item.priority).toBe("nice_to_have");
		});

		it("adds item with custom quantity", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { quantityDesired: 3 }),
			);
			expect(item.quantityDesired).toBe(3);
		});

		it("adds item with must_have priority", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { priority: "must_have" }),
			);
			expect(item.priority).toBe("must_have");
		});

		it("adds item with dream priority", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { priority: "dream" }),
			);
			expect(item.priority).toBe("dream");
		});

		it("adds item with variant info", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, {
					variantId: "var_1",
					variantName: "Red, Large",
				}),
			);
			expect(item.variantId).toBe("var_1");
			expect(item.variantName).toBe("Red, Large");
		});

		it("adds item with note", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { note: "Preferably in blue" }),
			);
			expect(item.note).toBe("Preferably in blue");
		});

		it("adds item with image URL", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, {
					imageUrl: "https://example.com/img.jpg",
				}),
			);
			expect(item.imageUrl).toBe("https://example.com/img.jpg");
		});

		it("updates registry itemCount", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await controller.addItem(makeItem(registry.id));
			await controller.addItem(
				makeItem(registry.id, { productId: "prod_2", productName: "Towels" }),
			);
			const updated = await controller.getRegistry(registry.id);
			expect(updated?.itemCount).toBe(2);
		});

		it("throws for non-existent registry", async () => {
			await expect(controller.addItem(makeItem("nonexistent"))).rejects.toThrow(
				"Registry not found",
			);
		});

		it("throws for inactive registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await controller.archiveRegistry(registry.id);
			await expect(controller.addItem(makeItem(registry.id))).rejects.toThrow(
				"Cannot add items to an inactive registry",
			);
		});

		it("throws for zero price", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await expect(
				controller.addItem(makeItem(registry.id, { priceInCents: 0 })),
			).rejects.toThrow("Price must be greater than zero");
		});

		it("throws for negative price", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await expect(
				controller.addItem(makeItem(registry.id, { priceInCents: -100 })),
			).rejects.toThrow("Price must be greater than zero");
		});

		it("throws for zero quantity desired", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await expect(
				controller.addItem(makeItem(registry.id, { quantityDesired: 0 })),
			).rejects.toThrow("Quantity desired must be at least 1");
		});

		it("throws for negative quantity desired", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await expect(
				controller.addItem(makeItem(registry.id, { quantityDesired: -1 })),
			).rejects.toThrow("Quantity desired must be at least 1");
		});
	});

	describe("updateItem", () => {
		it("updates quantity desired", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const updated = await controller.updateItem(item.id, {
				quantityDesired: 5,
			});
			expect(updated?.quantityDesired).toBe(5);
		});

		it("updates priority", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const updated = await controller.updateItem(item.id, {
				priority: "must_have",
			});
			expect(updated?.priority).toBe("must_have");
		});

		it("updates note", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const updated = await controller.updateItem(item.id, {
				note: "In cherry red",
			});
			expect(updated?.note).toBe("In cherry red");
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.updateItem("nonexistent", {
				note: "test",
			});
			expect(result).toBeNull();
		});

		it("throws for zero quantity desired", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			await expect(
				controller.updateItem(item.id, { quantityDesired: 0 }),
			).rejects.toThrow("Quantity desired must be at least 1");
		});
	});

	describe("removeItem", () => {
		it("removes an item", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const result = await controller.removeItem(item.id);
			expect(result).toBe(true);
			const fetched = await controller.getItem(item.id);
			expect(fetched).toBeNull();
		});

		it("updates registry itemCount after removal", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			await controller.addItem(
				makeItem(registry.id, { productId: "prod_2", productName: "Towels" }),
			);
			await controller.removeItem(item.id);
			const updated = await controller.getRegistry(registry.id);
			expect(updated?.itemCount).toBe(1);
		});

		it("returns false for non-existent item", async () => {
			const result = await controller.removeItem("nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("listItems", () => {
		it("lists items for a registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			await controller.addItem(makeItem(registry.id));
			await controller.addItem(
				makeItem(registry.id, {
					productId: "prod_2",
					productName: "KitchenAid",
				}),
			);
			const items = await controller.listItems(registry.id);
			expect(items).toHaveLength(2);
		});

		it("returns empty for registry with no items", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const items = await controller.listItems(registry.id);
			expect(items).toHaveLength(0);
		});

		it("supports pagination", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			for (let i = 0; i < 5; i++) {
				await controller.addItem(
					makeItem(registry.id, {
						productId: `prod_${i}`,
						productName: `Product ${i}`,
					}),
				);
			}
			const page = await controller.listItems(registry.id, {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	describe("getItem", () => {
		it("returns an item by ID", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const fetched = await controller.getItem(item.id);
			expect(fetched?.id).toBe(item.id);
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.getItem("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── Purchases ────────────────────────────────────────────────

	describe("purchaseItem", () => {
		it("purchases an item from a registry", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const purchase = await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});
			expect(purchase.id).toBeDefined();
			expect(purchase.purchaserName).toBe("Alice");
			expect(purchase.quantity).toBe(1);
			expect(purchase.amountInCents).toBe(35000);
			expect(purchase.isAnonymous).toBe(false);
		});

		it("tracks purchaser ID when logged in", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const purchase = await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserId: "buyer_1",
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});
			expect(purchase.purchaserId).toBe("buyer_1");
		});

		it("stores gift message", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const purchase = await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
				giftMessage: "Congratulations on your wedding!",
			});
			expect(purchase.giftMessage).toBe("Congratulations on your wedding!");
		});

		it("supports anonymous purchases", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const purchase = await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
				isAnonymous: true,
			});
			expect(purchase.isAnonymous).toBe(true);
		});

		it("stores order ID", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			const purchase = await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
				orderId: "order_123",
			});
			expect(purchase.orderId).toBe("order_123");
		});

		it("updates item quantityReceived", async () => {
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
			const updated = await controller.getItem(item.id);
			expect(updated?.quantityReceived).toBe(2);
		});

		it("updates registry purchasedCount when item fully received", async () => {
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
			expect(updated?.purchasedCount).toBe(1);
		});

		it("auto-completes registry when all items fulfilled", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item1 = await controller.addItem(makeItem(registry.id));
			const item2 = await controller.addItem(
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

			// Not complete yet
			let updated = await controller.getRegistry(registry.id);
			expect(updated?.status).toBe("active");

			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item2.id,
				purchaserName: "Bob",
				quantity: 1,
				amountInCents: 5000,
			});

			// Now complete
			updated = await controller.getRegistry(registry.id);
			expect(updated?.status).toBe("completed");
		});

		it("allows partial purchase of multi-quantity items", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(
				makeItem(registry.id, { quantityDesired: 4 }),
			);

			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 2,
				amountInCents: 70000,
			});
			let updated = await controller.getItem(item.id);
			expect(updated?.quantityReceived).toBe(2);

			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Bob",
				quantity: 2,
				amountInCents: 70000,
			});
			updated = await controller.getItem(item.id);
			expect(updated?.quantityReceived).toBe(4);
		});

		it("throws for non-existent registry", async () => {
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

		it("throws for inactive registry", async () => {
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

		it("throws for non-existent item", async () => {
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

		it("throws when item belongs to different registry", async () => {
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

		it("throws for zero quantity", async () => {
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

		it("throws for negative quantity", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item = await controller.addItem(makeItem(registry.id));
			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: item.id,
					purchaserName: "Alice",
					quantity: -1,
					amountInCents: 100,
				}),
			).rejects.toThrow("Purchase quantity must be at least 1");
		});

		it("throws when purchasing more than remaining", async () => {
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
	});

	describe("listPurchases", () => {
		it("lists purchases for a registry", async () => {
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
			});
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Bob",
				quantity: 1,
				amountInCents: 35000,
			});
			const purchases = await controller.listPurchases(registry.id);
			expect(purchases).toHaveLength(2);
		});

		it("returns empty when no purchases", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const purchases = await controller.listPurchases(registry.id);
			expect(purchases).toHaveLength(0);
		});
	});

	describe("getPurchasesByItem", () => {
		it("returns purchases for a specific item", async () => {
			const registry = await controller.createRegistry(makeRegistry());
			const item1 = await controller.addItem(
				makeItem(registry.id, { quantityDesired: 2 }),
			);
			const item2 = await controller.addItem(
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
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item2.id,
				purchaserName: "Bob",
				quantity: 1,
				amountInCents: 5000,
			});

			const item1Purchases = await controller.getPurchasesByItem(item1.id);
			expect(item1Purchases).toHaveLength(1);
			expect(item1Purchases[0].purchaserName).toBe("Alice");
		});
	});

	// ── Customer queries ─────────────────────────────────────────

	describe("getCustomerRegistries", () => {
		it("returns registries for a customer", async () => {
			await controller.createRegistry(makeRegistry());
			await controller.createRegistry(
				makeRegistry({
					title: "Baby Shower",
					type: "baby",
				}),
			);
			await controller.createRegistry(
				makeRegistry({
					customerId: "cust_2",
					customerName: "Other",
				}),
			);

			const mine = await controller.getCustomerRegistries("cust_1");
			expect(mine).toHaveLength(2);
		});

		it("returns empty for customer with no registries", async () => {
			const result = await controller.getCustomerRegistries("nobody");
			expect(result).toHaveLength(0);
		});
	});

	// ── Analytics ────────────────────────────────────────────────

	describe("getRegistrySummary", () => {
		it("returns summary with zero values when empty", async () => {
			const summary = await controller.getRegistrySummary();
			expect(summary.totalRegistries).toBe(0);
			expect(summary.active).toBe(0);
			expect(summary.completed).toBe(0);
			expect(summary.archived).toBe(0);
			expect(summary.totalItems).toBe(0);
			expect(summary.totalPurchased).toBe(0);
			expect(summary.totalRevenue).toBe(0);
		});

		it("returns accurate counts", async () => {
			const r1 = await controller.createRegistry(makeRegistry());
			await controller.createRegistry(makeRegistry({ customerId: "cust_2" }));
			const r3 = await controller.createRegistry(
				makeRegistry({ customerId: "cust_3" }),
			);
			await controller.archiveRegistry(r3.id);

			const item = await controller.addItem(makeItem(r1.id));
			await controller.addItem(
				makeItem(r1.id, {
					productId: "prod_2",
					productName: "Towels",
					priceInCents: 5000,
				}),
			);

			await controller.purchaseItem({
				registryId: r1.id,
				registryItemId: item.id,
				purchaserName: "Alice",
				quantity: 1,
				amountInCents: 35000,
			});

			const summary = await controller.getRegistrySummary();
			expect(summary.totalRegistries).toBe(3);
			expect(summary.active).toBe(2);
			expect(summary.archived).toBe(1);
			expect(summary.totalItems).toBe(2);
			expect(summary.totalPurchased).toBe(1);
			expect(summary.totalRevenue).toBe(35000);
		});
	});
});
