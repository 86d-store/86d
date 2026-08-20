import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { GiftWrappingController } from "../service";
import { createGiftWrappingController } from "../service-impl";

const makeOption = (overrides?: Record<string, unknown>) => ({
	name: "Classic Red Ribbon",
	priceInCents: 499,
	...overrides,
});

const makeSelection = (
	wrapOptionId: string,
	overrides?: Record<string, unknown>,
) => ({
	orderId: "order_1",
	orderItemId: "item_1",
	wrapOptionId,
	...overrides,
});

describe("createGiftWrappingController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: GiftWrappingController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftWrappingController(mockData);
	});

	// ── Wrap option CRUD ──────────────────────────────────────────

	describe("createOption", () => {
		it("creates an option with defaults", async () => {
			const option = await controller.createOption(makeOption());
			expect(option.id).toBeDefined();
			expect(option.name).toBe("Classic Red Ribbon");
			expect(option.priceInCents).toBe(499);
			expect(option.active).toBe(true);
			expect(option.sortOrder).toBe(0);
		});

		it("creates an option with custom active state", async () => {
			const option = await controller.createOption(
				makeOption({ active: false }),
			);
			expect(option.active).toBe(false);
		});

		it("creates an option with custom sort order", async () => {
			const option = await controller.createOption(
				makeOption({ sortOrder: 5 }),
			);
			expect(option.sortOrder).toBe(5);
		});

		it("creates an option with description", async () => {
			const option = await controller.createOption(
				makeOption({ description: "Elegant red satin ribbon wrap" }),
			);
			expect(option.description).toBe("Elegant red satin ribbon wrap");
		});

		it("creates an option with image URL", async () => {
			const option = await controller.createOption(
				makeOption({ imageUrl: "https://example.com/ribbon.jpg" }),
			);
			expect(option.imageUrl).toBe("https://example.com/ribbon.jpg");
		});

		it("creates a free wrapping option", async () => {
			const option = await controller.createOption(
				makeOption({ priceInCents: 0 }),
			);
			expect(option.priceInCents).toBe(0);
		});

		it("trims whitespace from name", async () => {
			const option = await controller.createOption(
				makeOption({ name: "  Gold Foil  " }),
			);
			expect(option.name).toBe("Gold Foil");
		});

		it("throws for empty name", async () => {
			await expect(
				controller.createOption(makeOption({ name: "" })),
			).rejects.toThrow("Option name is required");
		});

		it("throws for whitespace-only name", async () => {
			await expect(
				controller.createOption(makeOption({ name: "   " })),
			).rejects.toThrow("Option name is required");
		});

		it("throws for negative price", async () => {
			await expect(
				controller.createOption(makeOption({ priceInCents: -100 })),
			).rejects.toThrow("Price cannot be negative");
		});
	});

	describe("updateOption", () => {
		it("updates name", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				name: "Gold Bow",
			});
			expect(updated?.name).toBe("Gold Bow");
		});

		it("updates description", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				description: "Premium gold bow wrap",
			});
			expect(updated?.description).toBe("Premium gold bow wrap");
		});

		it("updates price", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				priceInCents: 799,
			});
			expect(updated?.priceInCents).toBe(799);
		});

		it("updates to free price", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				priceInCents: 0,
			});
			expect(updated?.priceInCents).toBe(0);
		});

		it("updates image URL", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				imageUrl: "https://example.com/new.jpg",
			});
			expect(updated?.imageUrl).toBe("https://example.com/new.jpg");
		});

		it("updates active state", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				active: false,
			});
			expect(updated?.active).toBe(false);
		});

		it("updates sort order", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				sortOrder: 10,
			});
			expect(updated?.sortOrder).toBe(10);
		});

		it("returns null for non-existent option", async () => {
			const result = await controller.updateOption("nonexistent", {
				name: "Test",
			});
			expect(result).toBeNull();
		});

		it("throws for empty name", async () => {
			const option = await controller.createOption(makeOption());
			await expect(
				controller.updateOption(option.id, { name: "" }),
			).rejects.toThrow("Option name cannot be empty");
		});

		it("throws for whitespace-only name", async () => {
			const option = await controller.createOption(makeOption());
			await expect(
				controller.updateOption(option.id, { name: "   " }),
			).rejects.toThrow("Option name cannot be empty");
		});

		it("throws for negative price", async () => {
			const option = await controller.createOption(makeOption());
			await expect(
				controller.updateOption(option.id, { priceInCents: -1 }),
			).rejects.toThrow("Price cannot be negative");
		});

		it("updates updatedAt timestamp", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				name: "New",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				option.updatedAt.getTime(),
			);
		});
	});

	describe("getOption", () => {
		it("returns an option by ID", async () => {
			const option = await controller.createOption(makeOption());
			const fetched = await controller.getOption(option.id);
			expect(fetched?.id).toBe(option.id);
			expect(fetched?.name).toBe(option.name);
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getOption("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("listOptions", () => {
		it("lists all options", async () => {
			await controller.createOption(makeOption());
			await controller.createOption(
				makeOption({ name: "Silver Bow", priceInCents: 699 }),
			);
			const list = await controller.listOptions();
			expect(list).toHaveLength(2);
		});

		it("filters by active status", async () => {
			await controller.createOption(makeOption());
			await controller.createOption(
				makeOption({ name: "Inactive", active: false }),
			);
			const active = await controller.listOptions({ active: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Classic Red Ribbon");
		});

		it("filters for inactive options", async () => {
			await controller.createOption(makeOption());
			await controller.createOption(
				makeOption({ name: "Inactive", active: false }),
			);
			const inactive = await controller.listOptions({ active: false });
			expect(inactive).toHaveLength(1);
			expect(inactive[0].name).toBe("Inactive");
		});

		it("supports take/skip pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createOption(
					makeOption({ name: `Option ${i}`, sortOrder: i }),
				);
			}
			const page = await controller.listOptions({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty when no options exist", async () => {
			const list = await controller.listOptions();
			expect(list).toHaveLength(0);
		});
	});

	describe("deleteOption", () => {
		it("deletes an existing option", async () => {
			const option = await controller.createOption(makeOption());
			const result = await controller.deleteOption(option.id);
			expect(result).toBe(true);
			const fetched = await controller.getOption(option.id);
			expect(fetched).toBeNull();
		});

		it("returns false for non-existent option", async () => {
			const result = await controller.deleteOption("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── Wrap selections ───────────────────────────────────────────

	describe("selectWrapping", () => {
		it("creates a wrapping selection", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			expect(selection.id).toBeDefined();
			expect(selection.orderId).toBe("order_1");
			expect(selection.orderItemId).toBe("item_1");
			expect(selection.wrapOptionId).toBe(option.id);
			expect(selection.wrapOptionName).toBe("Classic Red Ribbon");
			expect(selection.priceInCents).toBe(499);
		});

		it("stores recipient name", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id, { recipientName: "Jane Doe" }),
			);
			expect(selection.recipientName).toBe("Jane Doe");
		});

		it("stores gift message", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id, { giftMessage: "Happy Birthday!" }),
			);
			expect(selection.giftMessage).toBe("Happy Birthday!");
		});

		it("stores customer ID", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id, { customerId: "cust_1" }),
			);
			expect(selection.customerId).toBe("cust_1");
		});

		it("snapshots the option price at selection time", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			// Update the option price after selection
			await controller.updateOption(option.id, { priceInCents: 999 });
			// The selection should still have the original price
			const fetched = await controller.getSelection(selection.id);
			expect(fetched?.priceInCents).toBe(499);
		});

		it("throws for non-existent wrap option", async () => {
			await expect(
				controller.selectWrapping(makeSelection("nonexistent")),
			).rejects.toThrow("Wrap option not found");
		});

		it("throws for inactive wrap option", async () => {
			const option = await controller.createOption(
				makeOption({ active: false }),
			);
			await expect(
				controller.selectWrapping(makeSelection(option.id)),
			).rejects.toThrow("Wrap option is not available");
		});

		it("throws for empty order ID", async () => {
			const option = await controller.createOption(makeOption());
			await expect(
				controller.selectWrapping(makeSelection(option.id, { orderId: "" })),
			).rejects.toThrow("Order ID is required");
		});

		it("throws for empty order item ID", async () => {
			const option = await controller.createOption(makeOption());
			await expect(
				controller.selectWrapping(
					makeSelection(option.id, { orderItemId: "" }),
				),
			).rejects.toThrow("Order item ID is required");
		});

		it("throws when order item already has wrapping", async () => {
			const option = await controller.createOption(makeOption());
			await controller.selectWrapping(makeSelection(option.id));
			await expect(
				controller.selectWrapping(makeSelection(option.id)),
			).rejects.toThrow("Order item already has gift wrapping selected");
		});

		it("allows different order items to have wrapping", async () => {
			const option = await controller.createOption(makeOption());
			const s1 = await controller.selectWrapping(makeSelection(option.id));
			const s2 = await controller.selectWrapping(
				makeSelection(option.id, { orderItemId: "item_2" }),
			);
			expect(s1.id).not.toBe(s2.id);
		});

		it("allows wrapping with free option", async () => {
			const option = await controller.createOption(
				makeOption({ priceInCents: 0 }),
			);
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			expect(selection.priceInCents).toBe(0);
		});
	});

	describe("removeSelection", () => {
		it("removes an existing selection", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			const result = await controller.removeSelection(selection.id);
			expect(result).toBe(true);
			const fetched = await controller.getSelection(selection.id);
			expect(fetched).toBeNull();
		});

		it("returns false for non-existent selection", async () => {
			const result = await controller.removeSelection("nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("getSelection", () => {
		it("returns a selection by ID", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			const fetched = await controller.getSelection(selection.id);
			expect(fetched?.id).toBe(selection.id);
			expect(fetched?.wrapOptionName).toBe("Classic Red Ribbon");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getSelection("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("getOrderSelections", () => {
		it("returns all selections for an order", async () => {
			const option = await controller.createOption(makeOption());
			await controller.selectWrapping(makeSelection(option.id));
			await controller.selectWrapping(
				makeSelection(option.id, { orderItemId: "item_2" }),
			);
			const selections = await controller.getOrderSelections("order_1");
			expect(selections).toHaveLength(2);
		});

		it("returns only selections for the specified order", async () => {
			const option = await controller.createOption(makeOption());
			await controller.selectWrapping(makeSelection(option.id));
			await controller.selectWrapping(
				makeSelection(option.id, {
					orderId: "order_2",
					orderItemId: "item_2",
				}),
			);
			const selections = await controller.getOrderSelections("order_1");
			expect(selections).toHaveLength(1);
		});

		it("returns empty for order with no wrapping", async () => {
			const selections = await controller.getOrderSelections("order_1");
			expect(selections).toHaveLength(0);
		});
	});

	describe("getOrderWrappingTotal", () => {
		it("calculates total wrapping cost for an order", async () => {
			const opt1 = await controller.createOption(makeOption());
			const opt2 = await controller.createOption(
				makeOption({ name: "Gold Foil", priceInCents: 799 }),
			);
			await controller.selectWrapping(makeSelection(opt1.id));
			await controller.selectWrapping(
				makeSelection(opt2.id, { orderItemId: "item_2" }),
			);

			const result = await controller.getOrderWrappingTotal("order_1");
			expect(result.selections).toHaveLength(2);
			expect(result.totalInCents).toBe(499 + 799);
		});

		it("returns zero total for order with no wrapping", async () => {
			const result = await controller.getOrderWrappingTotal("order_1");
			expect(result.selections).toHaveLength(0);
			expect(result.totalInCents).toBe(0);
		});

		it("calculates total with free options included", async () => {
			const paid = await controller.createOption(makeOption());
			const free = await controller.createOption(
				makeOption({ name: "Basic Tissue", priceInCents: 0 }),
			);
			await controller.selectWrapping(makeSelection(paid.id));
			await controller.selectWrapping(
				makeSelection(free.id, { orderItemId: "item_2" }),
			);

			const result = await controller.getOrderWrappingTotal("order_1");
			expect(result.totalInCents).toBe(499);
		});
	});

	describe("getItemSelection", () => {
		it("returns the selection for an order item", async () => {
			const option = await controller.createOption(makeOption());
			await controller.selectWrapping(makeSelection(option.id));
			const selection = await controller.getItemSelection("item_1");
			expect(selection).not.toBeNull();
			expect(selection?.orderItemId).toBe("item_1");
		});

		it("returns null for item with no wrapping", async () => {
			const result = await controller.getItemSelection("item_1");
			expect(result).toBeNull();
		});
	});

	// ── Analytics ────────────────────────────────────────────────

	describe("getWrapSummary", () => {
		it("returns summary with zero values when empty", async () => {
			const summary = await controller.getWrapSummary();
			expect(summary.totalOptions).toBe(0);
			expect(summary.activeOptions).toBe(0);
			expect(summary.totalSelections).toBe(0);
			expect(summary.totalRevenue).toBe(0);
		});

		it("returns accurate counts", async () => {
			const opt1 = await controller.createOption(makeOption());
			await controller.createOption(
				makeOption({ name: "Gold Foil", priceInCents: 799 }),
			);
			await controller.createOption(
				makeOption({ name: "Inactive", active: false }),
			);

			await controller.selectWrapping(makeSelection(opt1.id));
			await controller.selectWrapping(
				makeSelection(opt1.id, { orderItemId: "item_2" }),
			);

			const summary = await controller.getWrapSummary();
			expect(summary.totalOptions).toBe(3);
			expect(summary.activeOptions).toBe(2);
			expect(summary.totalSelections).toBe(2);
			expect(summary.totalRevenue).toBe(499 * 2);
		});

		it("counts revenue from different priced options", async () => {
			const opt1 = await controller.createOption(makeOption());
			const opt2 = await controller.createOption(
				makeOption({ name: "Gold Foil", priceInCents: 799 }),
			);

			await controller.selectWrapping(makeSelection(opt1.id));
			await controller.selectWrapping(
				makeSelection(opt2.id, { orderItemId: "item_2" }),
			);

			const summary = await controller.getWrapSummary();
			expect(summary.totalRevenue).toBe(499 + 799);
		});
	});
});
