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

describe("gift-wrapping controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: GiftWrappingController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftWrappingController(mockData);
	});

	// ── createOption edge cases ────────────────────────────────────────

	describe("createOption edge cases", () => {
		it("each created option gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const option = await controller.createOption(
					makeOption({ name: `Option ${i}` }),
				);
				ids.add(option.id);
			}
			expect(ids.size).toBe(20);
		});

		it("createdAt and updatedAt are set to approximately current time", async () => {
			const before = new Date();
			const option = await controller.createOption(makeOption());
			const after = new Date();
			expect(option.createdAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(option.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("handles special characters in name and description", async () => {
			const option = await controller.createOption(
				makeOption({
					name: 'Gift Wrap "Deluxe" <br> & Co.',
					description: "Special chars: @#$%^&*()\n\tNewlines too!",
				}),
			);
			expect(option.name).toBe('Gift Wrap "Deluxe" <br> & Co.');
			expect(option.description).toBe(
				"Special chars: @#$%^&*()\n\tNewlines too!",
			);
		});

		it("handles very long name and description strings", async () => {
			const longName = "A".repeat(10000);
			const longDesc = "B".repeat(10000);
			const option = await controller.createOption(
				makeOption({ name: longName, description: longDesc }),
			);
			expect(option.name).toBe(longName);
			expect(option.description).toBe(longDesc);
		});

		it("handles unicode and emoji characters", async () => {
			const option = await controller.createOption(
				makeOption({ name: "Cadeau", description: "Beautiful wrap!" }),
			);
			expect(option.name).toBe("Cadeau");
			expect(option.description).toBe("Beautiful wrap!");
		});

		it("trims name with mixed whitespace characters", async () => {
			const option = await controller.createOption(
				makeOption({ name: " \t Gold Foil \t " }),
			);
			expect(option.name).toBe("Gold Foil");
		});

		it("handles very large price value", async () => {
			const option = await controller.createOption(
				makeOption({ priceInCents: 99999999 }),
			);
			expect(option.priceInCents).toBe(99999999);
		});

		it("throws for price of exactly -1", async () => {
			await expect(
				controller.createOption(makeOption({ priceInCents: -1 })),
			).rejects.toThrow("Price cannot be negative");
		});

		it("omits optional fields when not provided", async () => {
			const option = await controller.createOption(makeOption());
			expect(option.description).toBeUndefined();
			expect(option.imageUrl).toBeUndefined();
		});

		it("persists option in data store", async () => {
			await controller.createOption(makeOption());
			expect(mockData.size("wrapOption")).toBe(1);
		});
	});

	// ── updateOption edge cases ────────────────────────────────────────

	describe("updateOption edge cases", () => {
		it("updates multiple fields simultaneously", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				name: "New Name",
				priceInCents: 999,
				active: false,
				sortOrder: 5,
				description: "New desc",
				imageUrl: "https://example.com/new.jpg",
			});
			expect(updated?.name).toBe("New Name");
			expect(updated?.priceInCents).toBe(999);
			expect(updated?.active).toBe(false);
			expect(updated?.sortOrder).toBe(5);
			expect(updated?.description).toBe("New desc");
			expect(updated?.imageUrl).toBe("https://example.com/new.jpg");
		});

		it("preserves unchanged fields when updating one field", async () => {
			const option = await controller.createOption(
				makeOption({ description: "Original desc", sortOrder: 3 }),
			);
			const updated = await controller.updateOption(option.id, {
				name: "New Name",
			});
			expect(updated?.priceInCents).toBe(499);
			expect(updated?.description).toBe("Original desc");
			expect(updated?.sortOrder).toBe(3);
			expect(updated?.active).toBe(true);
		});

		it("trims whitespace from updated name", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {
				name: "  Trimmed Name  ",
			});
			expect(updated?.name).toBe("Trimmed Name");
		});

		it("allows updating with empty params object (no changes)", async () => {
			const option = await controller.createOption(makeOption());
			const updated = await controller.updateOption(option.id, {});
			expect(updated?.name).toBe("Classic Red Ribbon");
			expect(updated?.priceInCents).toBe(499);
		});

		it("allows toggling active state back and forth", async () => {
			const option = await controller.createOption(makeOption());
			const deactivated = await controller.updateOption(option.id, {
				active: false,
			});
			expect(deactivated?.active).toBe(false);
			const reactivated = await controller.updateOption(option.id, {
				active: true,
			});
			expect(reactivated?.active).toBe(true);
		});

		it("returns null when updating non-existent option with valid params", async () => {
			const result = await controller.updateOption("does_not_exist", {
				name: "New",
				priceInCents: 100,
			});
			expect(result).toBeNull();
		});
	});

	// ── deleteOption edge cases ────────────────────────────────────────

	describe("deleteOption edge cases", () => {
		it("double delete returns false on second attempt", async () => {
			const option = await controller.createOption(makeOption());
			expect(await controller.deleteOption(option.id)).toBe(true);
			expect(await controller.deleteOption(option.id)).toBe(false);
		});

		it("deleting one option does not affect other options", async () => {
			const opt1 = await controller.createOption(
				makeOption({ name: "Option A" }),
			);
			const opt2 = await controller.createOption(
				makeOption({ name: "Option B" }),
			);
			await controller.deleteOption(opt1.id);
			const remaining = await controller.getOption(opt2.id);
			expect(remaining).not.toBeNull();
			expect(remaining?.name).toBe("Option B");
		});

		it("returns false for empty string id", async () => {
			expect(await controller.deleteOption("")).toBe(false);
		});

		it("cleans up data store after delete", async () => {
			const option = await controller.createOption(makeOption());
			expect(mockData.size("wrapOption")).toBe(1);
			await controller.deleteOption(option.id);
			expect(mockData.size("wrapOption")).toBe(0);
		});
	});

	// ── getOption edge cases ───────────────────────────────────────────

	describe("getOption edge cases", () => {
		it("returns correct option when many exist", async () => {
			const options: Awaited<ReturnType<typeof controller.createOption>>[] = [];
			for (let i = 0; i < 10; i++) {
				options.push(
					await controller.createOption(
						makeOption({ name: `Option ${i}`, sortOrder: i }),
					),
				);
			}
			const fetched = await controller.getOption(options[5].id);
			expect(fetched?.name).toBe("Option 5");
		});

		it("returns null for empty string id", async () => {
			expect(await controller.getOption("")).toBeNull();
		});

		it("returns null after option has been deleted", async () => {
			const option = await controller.createOption(makeOption());
			await controller.deleteOption(option.id);
			expect(await controller.getOption(option.id)).toBeNull();
		});
	});

	// ── listOptions edge cases ─────────────────────────────────────────

	describe("listOptions edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.createOption(makeOption());
			expect(await controller.listOptions({ take: 0 })).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total options", async () => {
			await controller.createOption(makeOption());
			expect(await controller.listOptions({ skip: 100 })).toHaveLength(0);
		});

		it("handles take larger than total options", async () => {
			await controller.createOption(makeOption());
			expect(await controller.listOptions({ take: 100 })).toHaveLength(1);
		});

		it("paginates correctly through all options", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createOption(
					makeOption({ name: `Option ${i}`, sortOrder: i }),
				);
			}
			const page1 = await controller.listOptions({ take: 2, skip: 0 });
			const page2 = await controller.listOptions({ take: 2, skip: 2 });
			const page3 = await controller.listOptions({ take: 2, skip: 4 });
			expect(page1).toHaveLength(2);
			expect(page2).toHaveLength(2);
			expect(page3).toHaveLength(1);
			const allIds = [
				...page1.map((o) => o.id),
				...page2.map((o) => o.id),
				...page3.map((o) => o.id),
			];
			expect(new Set(allIds).size).toBe(5);
		});

		it("combines active filter with pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createOption(
					makeOption({ name: `Active ${i}`, sortOrder: i }),
				);
			}
			await controller.createOption(
				makeOption({ name: "Inactive", active: false }),
			);
			const result = await controller.listOptions({
				active: true,
				take: 2,
				skip: 1,
			});
			expect(result).toHaveLength(2);
			for (const opt of result) {
				expect(opt.active).toBe(true);
			}
		});

		it("reflects deletions in subsequent list calls", async () => {
			const opt = await controller.createOption(
				makeOption({ name: "To Delete" }),
			);
			await controller.createOption(makeOption({ name: "To Keep" }));
			expect(await controller.listOptions()).toHaveLength(2);
			await controller.deleteOption(opt.id);
			const list = await controller.listOptions();
			expect(list).toHaveLength(1);
			expect(list[0].name).toBe("To Keep");
		});
	});

	// ── selectWrapping edge cases ──────────────────────────────────────

	describe("selectWrapping edge cases", () => {
		it("snapshots option name at selection time", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			await controller.updateOption(option.id, { name: "Renamed" });
			const fetched = await controller.getSelection(selection.id);
			expect(fetched?.wrapOptionName).toBe("Classic Red Ribbon");
		});

		it("handles special characters in recipientName and giftMessage", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id, {
					recipientName: 'Jane "The Great" O\'Brien',
					giftMessage: "Happy Birthday!\n\nWith <love> & best wishes\t@home",
				}),
			);
			expect(selection.recipientName).toBe('Jane "The Great" O\'Brien');
			expect(selection.giftMessage).toBe(
				"Happy Birthday!\n\nWith <love> & best wishes\t@home",
			);
		});

		it("handles very long gift message", async () => {
			const option = await controller.createOption(makeOption());
			const longMessage = "M".repeat(10000);
			const selection = await controller.selectWrapping(
				makeSelection(option.id, { giftMessage: longMessage }),
			);
			expect(selection.giftMessage).toBe(longMessage);
		});

		it("different items in same order can use different wrap options", async () => {
			const opt1 = await controller.createOption(
				makeOption({ name: "Red", priceInCents: 299 }),
			);
			const opt2 = await controller.createOption(
				makeOption({ name: "Gold", priceInCents: 599 }),
			);
			const s1 = await controller.selectWrapping(
				makeSelection(opt1.id, { orderItemId: "item_1" }),
			);
			const s2 = await controller.selectWrapping(
				makeSelection(opt2.id, { orderItemId: "item_2" }),
			);
			expect(s1.wrapOptionName).toBe("Red");
			expect(s1.priceInCents).toBe(299);
			expect(s2.wrapOptionName).toBe("Gold");
			expect(s2.priceInCents).toBe(599);
		});

		it("throws when wrap option was deactivated after creation", async () => {
			const option = await controller.createOption(makeOption());
			await controller.updateOption(option.id, { active: false });
			await expect(
				controller.selectWrapping(makeSelection(option.id)),
			).rejects.toThrow("Wrap option is not available");
		});

		it("throws when wrap option was deleted", async () => {
			const option = await controller.createOption(makeOption());
			await controller.deleteOption(option.id);
			await expect(
				controller.selectWrapping(makeSelection(option.id)),
			).rejects.toThrow("Wrap option not found");
		});

		it("each selection gets a unique id", async () => {
			const option = await controller.createOption(makeOption());
			const ids = new Set<string>();
			for (let i = 0; i < 10; i++) {
				const selection = await controller.selectWrapping(
					makeSelection(option.id, { orderItemId: `item_${i}` }),
				);
				ids.add(selection.id);
			}
			expect(ids.size).toBe(10);
		});

		it("omits optional fields when not provided", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			expect(selection.recipientName).toBeUndefined();
			expect(selection.giftMessage).toBeUndefined();
			expect(selection.customerId).toBeUndefined();
		});
	});

	// ── removeSelection edge cases ─────────────────────────────────────

	describe("removeSelection edge cases", () => {
		it("double remove returns false on second attempt", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			expect(await controller.removeSelection(selection.id)).toBe(true);
			expect(await controller.removeSelection(selection.id)).toBe(false);
		});

		it("removing one selection does not affect other selections", async () => {
			const option = await controller.createOption(makeOption());
			const s1 = await controller.selectWrapping(
				makeSelection(option.id, { orderItemId: "item_1" }),
			);
			const s2 = await controller.selectWrapping(
				makeSelection(option.id, { orderItemId: "item_2" }),
			);
			await controller.removeSelection(s1.id);
			const remaining = await controller.getSelection(s2.id);
			expect(remaining).not.toBeNull();
			expect(remaining?.orderItemId).toBe("item_2");
		});

		it("returns false for empty string id", async () => {
			expect(await controller.removeSelection("")).toBe(false);
		});

		it("allows re-selecting wrapping after removal", async () => {
			const option = await controller.createOption(makeOption());
			const s1 = await controller.selectWrapping(makeSelection(option.id));
			await controller.removeSelection(s1.id);
			const s2 = await controller.selectWrapping(makeSelection(option.id));
			expect(s2.id).not.toBe(s1.id);
			expect(s2.orderItemId).toBe("item_1");
		});
	});

	// ── getItemSelection edge cases ────────────────────────────────────

	describe("getItemSelection edge cases", () => {
		it("returns null after selection has been removed", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			await controller.removeSelection(selection.id);
			expect(await controller.getItemSelection("item_1")).toBeNull();
		});

		it("returns correct selection among many", async () => {
			const option = await controller.createOption(makeOption());
			for (let i = 0; i < 5; i++) {
				await controller.selectWrapping(
					makeSelection(option.id, { orderItemId: `item_${i}` }),
				);
			}
			const result = await controller.getItemSelection("item_3");
			expect(result).not.toBeNull();
			expect(result?.orderItemId).toBe("item_3");
		});
	});

	// ── getOrderSelections edge cases ──────────────────────────────────

	describe("getOrderSelections edge cases", () => {
		it("returns only selections for specified order when multiple orders exist", async () => {
			const option = await controller.createOption(makeOption());
			await controller.selectWrapping(
				makeSelection(option.id, {
					orderId: "order_1",
					orderItemId: "item_1",
				}),
			);
			await controller.selectWrapping(
				makeSelection(option.id, {
					orderId: "order_1",
					orderItemId: "item_2",
				}),
			);
			await controller.selectWrapping(
				makeSelection(option.id, {
					orderId: "order_2",
					orderItemId: "item_3",
				}),
			);

			const order1 = await controller.getOrderSelections("order_1");
			expect(order1).toHaveLength(2);
			for (const sel of order1) {
				expect(sel.orderId).toBe("order_1");
			}
			expect(await controller.getOrderSelections("order_2")).toHaveLength(1);
		});

		it("reflects removals in subsequent calls", async () => {
			const option = await controller.createOption(makeOption());
			const s1 = await controller.selectWrapping(
				makeSelection(option.id, { orderItemId: "item_1" }),
			);
			await controller.selectWrapping(
				makeSelection(option.id, { orderItemId: "item_2" }),
			);
			await controller.removeSelection(s1.id);
			const after = await controller.getOrderSelections("order_1");
			expect(after).toHaveLength(1);
			expect(after[0].orderItemId).toBe("item_2");
		});
	});

	// ── getOrderWrappingTotal edge cases ───────────────────────────────

	describe("getOrderWrappingTotal edge cases", () => {
		it("calculates total with many selections of varying prices", async () => {
			const prices = [100, 200, 300, 400, 500];
			for (let i = 0; i < prices.length; i++) {
				const opt = await controller.createOption(
					makeOption({
						name: `Option ${i}`,
						priceInCents: prices[i],
					}),
				);
				await controller.selectWrapping(
					makeSelection(opt.id, { orderItemId: `item_${i}` }),
				);
			}
			const result = await controller.getOrderWrappingTotal("order_1");
			expect(result.selections).toHaveLength(5);
			expect(result.totalInCents).toBe(1500);
		});

		it("total is unaffected by selections on other orders", async () => {
			const option = await controller.createOption(makeOption());
			await controller.selectWrapping(
				makeSelection(option.id, {
					orderId: "order_1",
					orderItemId: "item_1",
				}),
			);
			await controller.selectWrapping(
				makeSelection(option.id, {
					orderId: "order_2",
					orderItemId: "item_2",
				}),
			);
			const result = await controller.getOrderWrappingTotal("order_1");
			expect(result.totalInCents).toBe(499);
			expect(result.selections).toHaveLength(1);
		});

		it("total reflects removal of a selection", async () => {
			const opt1 = await controller.createOption(
				makeOption({ name: "Red", priceInCents: 300 }),
			);
			const opt2 = await controller.createOption(
				makeOption({ name: "Gold", priceInCents: 700 }),
			);
			const s1 = await controller.selectWrapping(
				makeSelection(opt1.id, { orderItemId: "item_1" }),
			);
			await controller.selectWrapping(
				makeSelection(opt2.id, { orderItemId: "item_2" }),
			);
			expect(
				(await controller.getOrderWrappingTotal("order_1")).totalInCents,
			).toBe(1000);
			await controller.removeSelection(s1.id);
			const afterRemove = await controller.getOrderWrappingTotal("order_1");
			expect(afterRemove.totalInCents).toBe(700);
			expect(afterRemove.selections).toHaveLength(1);
		});

		it("total with all free wrapping is zero", async () => {
			const free1 = await controller.createOption(
				makeOption({ name: "Free A", priceInCents: 0 }),
			);
			const free2 = await controller.createOption(
				makeOption({ name: "Free B", priceInCents: 0 }),
			);
			await controller.selectWrapping(
				makeSelection(free1.id, { orderItemId: "item_1" }),
			);
			await controller.selectWrapping(
				makeSelection(free2.id, { orderItemId: "item_2" }),
			);
			const result = await controller.getOrderWrappingTotal("order_1");
			expect(result.totalInCents).toBe(0);
			expect(result.selections).toHaveLength(2);
		});
	});

	// ── getWrapSummary edge cases ──────────────────────────────────────

	describe("getWrapSummary edge cases", () => {
		it("summary updates after option deletion", async () => {
			await controller.createOption(makeOption({ name: "A" }));
			const opt2 = await controller.createOption(makeOption({ name: "B" }));
			await controller.deleteOption(opt2.id);
			expect((await controller.getWrapSummary()).totalOptions).toBe(1);
		});

		it("summary updates after selection removal", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			await controller.removeSelection(selection.id);
			const summary = await controller.getWrapSummary();
			expect(summary.totalSelections).toBe(0);
			expect(summary.totalRevenue).toBe(0);
		});

		it("activeOptions reflects deactivation", async () => {
			const opt = await controller.createOption(makeOption());
			await controller.updateOption(opt.id, { active: false });
			expect((await controller.getWrapSummary()).activeOptions).toBe(0);
		});

		it("handles many options and selections with correct revenue", async () => {
			const options: Awaited<ReturnType<typeof controller.createOption>>[] = [];
			for (let i = 0; i < 20; i++) {
				options.push(
					await controller.createOption(
						makeOption({
							name: `Option ${i}`,
							priceInCents: (i + 1) * 100,
							active: i < 15,
						}),
					),
				);
			}
			for (let i = 0; i < 10; i++) {
				await controller.selectWrapping(
					makeSelection(options[i].id, {
						orderId: `order_${i}`,
						orderItemId: `item_${i}`,
					}),
				);
			}
			const summary = await controller.getWrapSummary();
			expect(summary.totalOptions).toBe(20);
			expect(summary.activeOptions).toBe(15);
			expect(summary.totalSelections).toBe(10);
			expect(summary.totalRevenue).toBe(5500);
		});
	});

	// ── data store consistency ──────────────────────────────────────────

	describe("data store consistency", () => {
		it("option store count matches after creates and deletes", async () => {
			const opt1 = await controller.createOption(makeOption({ name: "A" }));
			await controller.createOption(makeOption({ name: "B" }));
			await controller.createOption(makeOption({ name: "C" }));
			expect(mockData.size("wrapOption")).toBe(3);
			await controller.deleteOption(opt1.id);
			expect(mockData.size("wrapOption")).toBe(2);
		});

		it("selection store count matches after creates and removes", async () => {
			const option = await controller.createOption(makeOption());
			const s1 = await controller.selectWrapping(
				makeSelection(option.id, { orderItemId: "item_1" }),
			);
			await controller.selectWrapping(
				makeSelection(option.id, { orderItemId: "item_2" }),
			);
			expect(mockData.size("wrapSelection")).toBe(2);
			await controller.removeSelection(s1.id);
			expect(mockData.size("wrapSelection")).toBe(1);
		});

		it("options and selections use separate store namespaces", async () => {
			const option = await controller.createOption(makeOption());
			await controller.selectWrapping(makeSelection(option.id));
			expect(mockData.size("wrapOption")).toBe(1);
			expect(mockData.size("wrapSelection")).toBe(1);
		});
	});

	// ── complex lifecycle scenarios ────────────────────────────────────

	describe("complex lifecycle scenarios", () => {
		it("full lifecycle: create, select, update, remove, verify totals", async () => {
			const ribbon = await controller.createOption(
				makeOption({ name: "Ribbon", priceInCents: 300 }),
			);
			const foil = await controller.createOption(
				makeOption({ name: "Foil", priceInCents: 600 }),
			);

			await controller.selectWrapping(
				makeSelection(ribbon.id, {
					orderId: "order_A",
					orderItemId: "item_A1",
					recipientName: "Alice",
				}),
			);
			const s2 = await controller.selectWrapping(
				makeSelection(foil.id, {
					orderId: "order_A",
					orderItemId: "item_A2",
					giftMessage: "Happy Birthday!",
				}),
			);
			await controller.selectWrapping(
				makeSelection(ribbon.id, {
					orderId: "order_B",
					orderItemId: "item_B1",
				}),
			);

			expect(
				(await controller.getOrderWrappingTotal("order_A")).totalInCents,
			).toBe(900);

			// Update ribbon price (should not affect existing selections)
			await controller.updateOption(ribbon.id, { priceInCents: 999 });
			expect(
				(await controller.getOrderWrappingTotal("order_A")).totalInCents,
			).toBe(900);

			await controller.removeSelection(s2.id);
			expect(
				(await controller.getOrderWrappingTotal("order_A")).totalInCents,
			).toBe(300);

			const summary = await controller.getWrapSummary();
			expect(summary.totalSelections).toBe(2);
			expect(summary.totalRevenue).toBe(600);
		});

		it("deactivating an option prevents new selections but preserves existing ones", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id, { orderItemId: "item_1" }),
			);
			await controller.updateOption(option.id, { active: false });

			await expect(
				controller.selectWrapping(
					makeSelection(option.id, { orderItemId: "item_2" }),
				),
			).rejects.toThrow("Wrap option is not available");

			const fetched = await controller.getSelection(selection.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.wrapOptionName).toBe("Classic Red Ribbon");
		});

		it("deleting an option does not remove existing selections", async () => {
			const option = await controller.createOption(makeOption());
			const selection = await controller.selectWrapping(
				makeSelection(option.id),
			);
			await controller.deleteOption(option.id);

			const fetched = await controller.getSelection(selection.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.wrapOptionName).toBe("Classic Red Ribbon");
			expect(fetched?.priceInCents).toBe(499);
		});

		it("multiple orders with multiple items and different wrap options", async () => {
			const basic = await controller.createOption(
				makeOption({ name: "Basic", priceInCents: 100 }),
			);
			const premium = await controller.createOption(
				makeOption({ name: "Premium", priceInCents: 500 }),
			);
			const deluxe = await controller.createOption(
				makeOption({ name: "Deluxe", priceInCents: 1000 }),
			);

			await controller.selectWrapping(
				makeSelection(basic.id, {
					orderId: "ord_1",
					orderItemId: "ord1_item1",
				}),
			);
			await controller.selectWrapping(
				makeSelection(premium.id, {
					orderId: "ord_1",
					orderItemId: "ord1_item2",
				}),
			);
			await controller.selectWrapping(
				makeSelection(deluxe.id, {
					orderId: "ord_1",
					orderItemId: "ord1_item3",
				}),
			);
			await controller.selectWrapping(
				makeSelection(basic.id, {
					orderId: "ord_2",
					orderItemId: "ord2_item1",
				}),
			);
			await controller.selectWrapping(
				makeSelection(basic.id, {
					orderId: "ord_2",
					orderItemId: "ord2_item2",
				}),
			);

			expect(
				(await controller.getOrderWrappingTotal("ord_1")).totalInCents,
			).toBe(1600);
			expect(
				(await controller.getOrderWrappingTotal("ord_2")).totalInCents,
			).toBe(200);
			expect(
				(await controller.getOrderWrappingTotal("ord_3")).totalInCents,
			).toBe(0);

			const summary = await controller.getWrapSummary();
			expect(summary.totalSelections).toBe(5);
			expect(summary.totalRevenue).toBe(1800);
		});
	});
});
