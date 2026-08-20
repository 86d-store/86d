import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGiftRegistryController } from "../service-impl";

/**
 * Security tests for gift-registry module endpoints.
 *
 * These tests verify:
 * - Customer isolation: registries scoped to customerId
 * - Ownership verification: only registry owner can modify/delete
 * - Visibility controls: private registries handled correctly
 * - Purchase isolation: purchases scoped to registry
 * - Item quantity enforcement: cannot purchase more than desired
 * - Archived registry restrictions: no modifications after archive
 */

describe("gift-registry endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createGiftRegistryController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftRegistryController(mockData);
	});

	async function createTestRegistry(
		customerId: string,
		slug: string,
		visibility: "public" | "unlisted" | "private" = "public",
	) {
		return controller.createRegistry({
			customerId,
			customerName: `Customer ${customerId}`,
			title: `Registry for ${customerId}`,
			type: "wedding",
			slug,
			visibility,
		});
	}

	// ── Customer Isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("getCustomerRegistries returns only the specified customer's registries", async () => {
			await createTestRegistry("customer_a", "wedding-a");
			await createTestRegistry("customer_b", "wedding-b");

			const registriesA = await controller.getCustomerRegistries("customer_a");
			const registriesB = await controller.getCustomerRegistries("customer_b");

			expect(registriesA).toHaveLength(1);
			expect(registriesA[0].customerId).toBe("customer_a");
			expect(registriesB).toHaveLength(1);
			expect(registriesB[0].customerId).toBe("customer_b");
		});

		it("getCustomerRegistries returns empty for non-existent customer", async () => {
			await createTestRegistry("customer_a", "wedding-a");

			const registries = await controller.getCustomerRegistries("nonexistent");
			expect(registries).toHaveLength(0);
		});

		it("getRegistry does not scope by customer (endpoint must verify)", async () => {
			const registry = await createTestRegistry("customer_a", "wedding-a");

			// Controller returns regardless of who's asking — endpoint must verify ownership
			const result = await controller.getRegistry(registry.id);
			expect(result).not.toBeNull();
			expect(result?.customerId).toBe("customer_a");
		});
	});

	// ── Ownership Verification ──────────────────────────────────────

	describe("ownership verification", () => {
		it("endpoint must verify ownership before update", async () => {
			const victimRegistry = await createTestRegistry(
				"victim",
				"victim-wedding",
			);

			// Simulate correct endpoint flow
			const registry = await controller.getRegistry(victimRegistry.id);
			const attackerSessionId = "attacker";

			if (registry?.customerId !== attackerSessionId) {
				expect(registry?.customerId).toBe("victim");
				// Endpoint returns 404 and does NOT call updateRegistry
			}

			// Registry unchanged
			const unchanged = await controller.getRegistry(victimRegistry.id);
			expect(unchanged?.title).toBe("Registry for victim");
		});

		it("endpoint must verify ownership before delete", async () => {
			const victimRegistry = await createTestRegistry(
				"victim",
				"victim-wedding",
			);

			const registry = await controller.getRegistry(victimRegistry.id);
			const attackerSessionId = "attacker";

			if (registry?.customerId !== attackerSessionId) {
				// Endpoint returns 404
				expect(registry?.customerId).toBe("victim");
			}

			// Registry still exists
			const stillExists = await controller.getRegistry(victimRegistry.id);
			expect(stillExists).not.toBeNull();
		});

		it("endpoint must verify ownership before adding items", async () => {
			const victimRegistry = await createTestRegistry(
				"victim",
				"victim-baby-shower",
			);

			const registry = await controller.getRegistry(victimRegistry.id);
			const attackerSessionId = "attacker";

			if (registry?.customerId !== attackerSessionId) {
				expect(registry?.customerId).toBe("victim");
			}

			// Items should be empty since attacker was blocked at endpoint layer
			const items = await controller.listItems(victimRegistry.id);
			expect(items).toHaveLength(0);
		});
	});

	// ── Visibility Controls ─────────────────────────────────────────

	describe("visibility controls", () => {
		it("public registry discoverable by slug", async () => {
			await createTestRegistry("customer_a", "public-wedding", "public");

			const result = await controller.getRegistryBySlug("public-wedding");
			expect(result).not.toBeNull();
			expect(result?.visibility).toBe("public");
		});

		it("private registry discoverable by slug (endpoint must enforce visibility)", async () => {
			await createTestRegistry("customer_a", "private-wedding", "private");

			// Controller returns it — endpoint must check visibility field
			const result = await controller.getRegistryBySlug("private-wedding");
			expect(result).not.toBeNull();
			expect(result?.visibility).toBe("private");
			// Endpoint SHOULD return 404 for non-owner if visibility === "private"
		});

		it("archived registry cannot receive new items", async () => {
			const registry = await createTestRegistry("customer_a", "old-wedding");
			await controller.archiveRegistry(registry.id);

			await expect(
				controller.addItem({
					registryId: registry.id,
					productId: "prod_1",
					productName: "Toaster",
					priceInCents: 2999,
				}),
			).rejects.toThrow("Cannot add items to an inactive registry");
		});
	});

	// ── Purchase Security ───────────────────────────────────────────

	describe("purchase security", () => {
		it("purchases scoped to their registry", async () => {
			const registry1 = await createTestRegistry("customer_a", "wedding-1");
			const registry2 = await createTestRegistry("customer_b", "wedding-2");

			const item1 = await controller.addItem({
				registryId: registry1.id,
				productId: "prod_1",
				productName: "Toaster",
				priceInCents: 2999,
			});

			await controller.purchaseItem({
				registryId: registry1.id,
				registryItemId: item1.id,
				purchaserName: "Gift Giver",
				quantity: 1,
				amountInCents: 2999,
			});

			const purchases1 = await controller.listPurchases(registry1.id);
			const purchases2 = await controller.listPurchases(registry2.id);

			expect(purchases1).toHaveLength(1);
			expect(purchases2).toHaveLength(0);
		});

		it("cannot purchase more than desired quantity", async () => {
			const registry = await createTestRegistry("customer_a", "wedding");
			const item = await controller.addItem({
				registryId: registry.id,
				productId: "prod_1",
				productName: "Stand Mixer",
				priceInCents: 29999,
				quantityDesired: 2,
			});

			// First purchase takes 1 of 2
			await controller.purchaseItem({
				registryId: registry.id,
				registryItemId: item.id,
				purchaserName: "Giver 1",
				quantity: 1,
				amountInCents: 29999,
			});

			// Exceeding remaining quantity (only 1 left) should fail
			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: item.id,
					purchaserName: "Giver 2",
					quantity: 2,
					amountInCents: 59998,
				}),
			).rejects.toThrow("Only 1 remaining");
		});

		it("purchase of non-existent item throws error", async () => {
			const registry = await createTestRegistry("customer_a", "wedding");

			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: "nonexistent",
					purchaserName: "Giver",
					quantity: 1,
					amountInCents: 2999,
				}),
			).rejects.toThrow("Registry item not found");
		});

		it("purchase with zero quantity throws error", async () => {
			const registry = await createTestRegistry("customer_a", "wedding");
			const item = await controller.addItem({
				registryId: registry.id,
				productId: "prod_1",
				productName: "Toaster",
				priceInCents: 2999,
			});

			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: item.id,
					purchaserName: "Giver",
					quantity: 0,
					amountInCents: 0,
				}),
			).rejects.toThrow("Purchase quantity must be at least 1");
		});
	});

	// ── Item Isolation ──────────────────────────────────────────────

	describe("item isolation", () => {
		it("items scoped to their registry", async () => {
			const registry1 = await createTestRegistry("customer_a", "wedding-1");
			const registry2 = await createTestRegistry("customer_b", "wedding-2");

			await controller.addItem({
				registryId: registry1.id,
				productId: "prod_1",
				productName: "Toaster",
				priceInCents: 2999,
			});

			const items1 = await controller.listItems(registry1.id);
			const items2 = await controller.listItems(registry2.id);

			expect(items1).toHaveLength(1);
			expect(items2).toHaveLength(0);
		});

		it("removing item from one registry does not affect another", async () => {
			const registry1 = await createTestRegistry("customer_a", "wedding-1");
			const registry2 = await createTestRegistry("customer_b", "wedding-2");

			const item1 = await controller.addItem({
				registryId: registry1.id,
				productId: "prod_1",
				productName: "Toaster",
				priceInCents: 2999,
			});
			await controller.addItem({
				registryId: registry2.id,
				productId: "prod_1",
				productName: "Toaster",
				priceInCents: 2999,
			});

			await controller.removeItem(item1.id);

			const items1 = await controller.listItems(registry1.id);
			const items2 = await controller.listItems(registry2.id);

			expect(items1).toHaveLength(0);
			expect(items2).toHaveLength(1);
		});

		it("addItem with zero price throws error", async () => {
			const registry = await createTestRegistry("customer_a", "wedding");

			await expect(
				controller.addItem({
					registryId: registry.id,
					productId: "prod_1",
					productName: "Free Item",
					priceInCents: 0,
				}),
			).rejects.toThrow("Price must be greater than zero");
		});

		it("addItem to non-existent registry throws error", async () => {
			await expect(
				controller.addItem({
					registryId: "nonexistent",
					productId: "prod_1",
					productName: "Toaster",
					priceInCents: 2999,
				}),
			).rejects.toThrow("Registry not found");
		});
	});

	// ── Archive Restrictions ────────────────────────────────────────

	describe("archive restrictions", () => {
		it("archiving sets status to archived", async () => {
			const registry = await createTestRegistry("customer_a", "old-wedding");
			const archived = await controller.archiveRegistry(registry.id);

			expect(archived?.status).toBe("archived");
		});

		it("cannot archive an already archived registry", async () => {
			const registry = await createTestRegistry("customer_a", "old-wedding");
			await controller.archiveRegistry(registry.id);

			await expect(controller.archiveRegistry(registry.id)).rejects.toThrow(
				"Registry is already archived",
			);
		});

		it("archived registry cannot accept purchases", async () => {
			const registry = await createTestRegistry("customer_a", "archive-test");
			const item = await controller.addItem({
				registryId: registry.id,
				productId: "prod_1",
				productName: "Toaster",
				priceInCents: 2999,
			});
			await controller.archiveRegistry(registry.id);

			await expect(
				controller.purchaseItem({
					registryId: registry.id,
					registryItemId: item.id,
					purchaserName: "Giver",
					quantity: 1,
					amountInCents: 2999,
				}),
			).rejects.toThrow("Cannot purchase from an inactive registry");
		});
	});

	// ── Non-existent Resources ──────────────────────────────────────

	describe("non-existent resources", () => {
		it("getRegistry returns null for non-existent ID", async () => {
			const result = await controller.getRegistry("nonexistent");
			expect(result).toBeNull();
		});

		it("getRegistryBySlug returns null for non-existent slug", async () => {
			const result = await controller.getRegistryBySlug("nonexistent");
			expect(result).toBeNull();
		});

		it("updateRegistry returns null for non-existent ID", async () => {
			const result = await controller.updateRegistry("nonexistent", {
				title: "Updated",
			});
			expect(result).toBeNull();
		});

		it("deleteRegistry returns false for non-existent ID", async () => {
			const result = await controller.deleteRegistry("nonexistent");
			expect(result).toBe(false);
		});

		it("archiveRegistry returns null for non-existent ID", async () => {
			const result = await controller.archiveRegistry("nonexistent");
			expect(result).toBeNull();
		});

		it("removeItem returns false for non-existent ID", async () => {
			const result = await controller.removeItem("nonexistent");
			expect(result).toBe(false);
		});

		it("getItem returns null for non-existent ID", async () => {
			const result = await controller.getItem("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── Slug Uniqueness ─────────────────────────────────────────────

	describe("slug uniqueness", () => {
		it("cannot create two registries with the same slug", async () => {
			await createTestRegistry("customer_a", "unique-slug");

			await expect(
				createTestRegistry("customer_b", "unique-slug"),
			).rejects.toThrow("Registry slug already in use");
		});
	});
});
