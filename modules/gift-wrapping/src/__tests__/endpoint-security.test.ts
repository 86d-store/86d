import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { GiftWrappingController } from "../service";
import { createGiftWrappingController } from "../service-impl";

/**
 * Security regression tests for gift-wrapping endpoints.
 *
 * Gift wrapping involves price-sensitive operations attached to orders.
 * These tests verify:
 * - Price validation: negative prices rejected on create and update
 * - Active/inactive filtering: inactive options cannot be selected
 * - Order-scoped isolation: selections for order A never leak into order B
 * - Item uniqueness: each order item may only have one wrapping selection
 * - Price snapshot integrity: selection price is locked at creation time
 * - Input sanitization: empty names and missing IDs are rejected
 * - Non-existent resource handling: fabricated IDs return null/false
 * - Summary accuracy: analytics reflect only real data
 */
describe("gift-wrapping endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: GiftWrappingController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGiftWrappingController(mockData);
	});

	// ── Price Validation ──────────────────────────────────────────

	describe("price validation — no negative prices", () => {
		it("rejects negative price on createOption", async () => {
			await expect(
				controller.createOption({
					name: "Malicious Wrap",
					priceInCents: -500,
				}),
			).rejects.toThrow("Price cannot be negative");
		});

		it("rejects negative price of -1 on createOption", async () => {
			await expect(
				controller.createOption({
					name: "Edge Wrap",
					priceInCents: -1,
				}),
			).rejects.toThrow("Price cannot be negative");
		});

		it("allows zero price on createOption (free wrapping)", async () => {
			const option = await controller.createOption({
				name: "Complimentary Wrap",
				priceInCents: 0,
			});
			expect(option.priceInCents).toBe(0);
		});

		it("rejects negative price on updateOption", async () => {
			const option = await controller.createOption({
				name: "Standard Wrap",
				priceInCents: 300,
			});
			await expect(
				controller.updateOption(option.id, { priceInCents: -100 }),
			).rejects.toThrow("Price cannot be negative");
		});

		it("preserves original price after failed negative update", async () => {
			const option = await controller.createOption({
				name: "Standard Wrap",
				priceInCents: 300,
			});
			await expect(
				controller.updateOption(option.id, { priceInCents: -1 }),
			).rejects.toThrow("Price cannot be negative");
			const fetched = await controller.getOption(option.id);
			expect(fetched?.priceInCents).toBe(300);
		});
	});

	// ── Active/Inactive Filtering ─────────────────────────────────

	describe("active/inactive option filtering", () => {
		it("rejects selection of an inactive option", async () => {
			const option = await controller.createOption({
				name: "Disabled Wrap",
				priceInCents: 500,
				active: false,
			});
			await expect(
				controller.selectWrapping({
					orderId: "order_1",
					orderItemId: "item_1",
					wrapOptionId: option.id,
				}),
			).rejects.toThrow("Wrap option is not available");
		});

		it("rejects selection after option is deactivated", async () => {
			const option = await controller.createOption({
				name: "Was Active",
				priceInCents: 400,
			});
			await controller.updateOption(option.id, { active: false });
			await expect(
				controller.selectWrapping({
					orderId: "order_1",
					orderItemId: "item_1",
					wrapOptionId: option.id,
				}),
			).rejects.toThrow("Wrap option is not available");
		});

		it("allows selection after option is reactivated", async () => {
			const option = await controller.createOption({
				name: "Toggle Wrap",
				priceInCents: 250,
				active: false,
			});
			await controller.updateOption(option.id, { active: true });
			const selection = await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_1",
				wrapOptionId: option.id,
			});
			expect(selection.wrapOptionId).toBe(option.id);
		});

		it("listOptions active filter excludes inactive options", async () => {
			await controller.createOption({
				name: "Active Wrap",
				priceInCents: 300,
			});
			await controller.createOption({
				name: "Hidden Wrap",
				priceInCents: 600,
				active: false,
			});
			const active = await controller.listOptions({ active: true });
			expect(active).toHaveLength(1);
			expect(active[0]?.name).toBe("Active Wrap");
		});
	});

	// ── Order-Scoped Selection Isolation ───────────────────────────

	describe("order-scoped wrapping isolation", () => {
		it("selections for order A do not appear in order B", async () => {
			const option = await controller.createOption({
				name: "Ribbon",
				priceInCents: 300,
			});
			await controller.selectWrapping({
				orderId: "order_A",
				orderItemId: "item_A1",
				wrapOptionId: option.id,
			});
			await controller.selectWrapping({
				orderId: "order_A",
				orderItemId: "item_A2",
				wrapOptionId: option.id,
			});
			await controller.selectWrapping({
				orderId: "order_B",
				orderItemId: "item_B1",
				wrapOptionId: option.id,
			});

			const orderA = await controller.getOrderSelections("order_A");
			const orderB = await controller.getOrderSelections("order_B");

			expect(orderA).toHaveLength(2);
			expect(orderB).toHaveLength(1);
			for (const sel of orderA) {
				expect(sel.orderId).toBe("order_A");
			}
			for (const sel of orderB) {
				expect(sel.orderId).toBe("order_B");
			}
		});

		it("wrapping total for order A excludes order B amounts", async () => {
			const cheap = await controller.createOption({
				name: "Basic",
				priceInCents: 100,
			});
			const expensive = await controller.createOption({
				name: "Premium",
				priceInCents: 2000,
			});
			await controller.selectWrapping({
				orderId: "order_A",
				orderItemId: "item_A1",
				wrapOptionId: cheap.id,
			});
			await controller.selectWrapping({
				orderId: "order_B",
				orderItemId: "item_B1",
				wrapOptionId: expensive.id,
			});

			const totalA = await controller.getOrderWrappingTotal("order_A");
			expect(totalA.totalInCents).toBe(100);
			expect(totalA.selections).toHaveLength(1);
		});

		it("empty order returns zero total and no selections", async () => {
			const total = await controller.getOrderWrappingTotal("nonexistent_order");
			expect(total.totalInCents).toBe(0);
			expect(total.selections).toHaveLength(0);
		});
	});

	// ── Item Uniqueness ───────────────────────────────────────────

	describe("order item uniqueness — one wrap per item", () => {
		it("rejects duplicate wrapping on the same order item", async () => {
			const option = await controller.createOption({
				name: "Foil",
				priceInCents: 500,
			});
			await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_1",
				wrapOptionId: option.id,
			});
			await expect(
				controller.selectWrapping({
					orderId: "order_1",
					orderItemId: "item_1",
					wrapOptionId: option.id,
				}),
			).rejects.toThrow("Order item already has gift wrapping selected");
		});

		it("allows wrapping after previous selection is removed", async () => {
			const option = await controller.createOption({
				name: "Foil",
				priceInCents: 500,
			});
			const first = await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_1",
				wrapOptionId: option.id,
			});
			await controller.removeSelection(first.id);
			const second = await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_1",
				wrapOptionId: option.id,
			});
			expect(second.id).not.toBe(first.id);
			expect(second.orderItemId).toBe("item_1");
		});

		it("different order items can be wrapped independently", async () => {
			const option = await controller.createOption({
				name: "Tissue",
				priceInCents: 200,
			});
			const s1 = await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_1",
				wrapOptionId: option.id,
			});
			const s2 = await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_2",
				wrapOptionId: option.id,
			});
			expect(s1.id).not.toBe(s2.id);
		});
	});

	// ── Price Snapshot Integrity ──────────────────────────────────

	describe("price snapshot — locked at selection time", () => {
		it("selection price does not change when option price is updated", async () => {
			const option = await controller.createOption({
				name: "Velvet",
				priceInCents: 800,
			});
			const selection = await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_1",
				wrapOptionId: option.id,
			});
			await controller.updateOption(option.id, {
				priceInCents: 1500,
			});
			const fetched = await controller.getSelection(selection.id);
			expect(fetched?.priceInCents).toBe(800);
		});

		it("order total reflects snapshot prices, not current prices", async () => {
			const option = await controller.createOption({
				name: "Satin",
				priceInCents: 400,
			});
			await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_1",
				wrapOptionId: option.id,
			});
			await controller.updateOption(option.id, {
				priceInCents: 9999,
			});
			const total = await controller.getOrderWrappingTotal("order_1");
			expect(total.totalInCents).toBe(400);
		});
	});

	// ── Input Sanitization ────────────────────────────────────────

	describe("input sanitization", () => {
		it("rejects empty name on createOption", async () => {
			await expect(
				controller.createOption({ name: "", priceInCents: 100 }),
			).rejects.toThrow("Option name is required");
		});

		it("rejects whitespace-only name on createOption", async () => {
			await expect(
				controller.createOption({ name: "   ", priceInCents: 100 }),
			).rejects.toThrow("Option name is required");
		});

		it("rejects empty name on updateOption", async () => {
			const option = await controller.createOption({
				name: "Valid Name",
				priceInCents: 100,
			});
			await expect(
				controller.updateOption(option.id, { name: "" }),
			).rejects.toThrow("Option name cannot be empty");
		});

		it("rejects empty orderId on selectWrapping", async () => {
			const option = await controller.createOption({
				name: "Wrap",
				priceInCents: 100,
			});
			await expect(
				controller.selectWrapping({
					orderId: "",
					orderItemId: "item_1",
					wrapOptionId: option.id,
				}),
			).rejects.toThrow("Order ID is required");
		});

		it("rejects empty orderItemId on selectWrapping", async () => {
			const option = await controller.createOption({
				name: "Wrap",
				priceInCents: 100,
			});
			await expect(
				controller.selectWrapping({
					orderId: "order_1",
					orderItemId: "",
					wrapOptionId: option.id,
				}),
			).rejects.toThrow("Order item ID is required");
		});
	});

	// ── Non-Existent Resource Handling ─────────────────────────────

	describe("non-existent resource handling", () => {
		it("getOption returns null for fabricated id", async () => {
			const result = await controller.getOption("fabricated_id");
			expect(result).toBeNull();
		});

		it("updateOption returns null for fabricated id", async () => {
			const result = await controller.updateOption("fabricated_id", {
				name: "Attack",
			});
			expect(result).toBeNull();
		});

		it("deleteOption returns false for fabricated id", async () => {
			const result = await controller.deleteOption("fabricated_id");
			expect(result).toBe(false);
		});

		it("selectWrapping rejects fabricated wrapOptionId", async () => {
			await expect(
				controller.selectWrapping({
					orderId: "order_1",
					orderItemId: "item_1",
					wrapOptionId: "fabricated_option_id",
				}),
			).rejects.toThrow("Wrap option not found");
		});

		it("removeSelection returns false for fabricated id", async () => {
			const result = await controller.removeSelection("fabricated_id");
			expect(result).toBe(false);
		});

		it("getSelection returns null for fabricated id", async () => {
			const result = await controller.getSelection("fabricated_id");
			expect(result).toBeNull();
		});
	});

	// ── Summary Accuracy ──────────────────────────────────────────

	describe("summary accuracy reflects real state", () => {
		it("summary revenue only counts existing selections", async () => {
			const option = await controller.createOption({
				name: "Wrap",
				priceInCents: 500,
			});
			const s1 = await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_1",
				wrapOptionId: option.id,
			});
			await controller.selectWrapping({
				orderId: "order_1",
				orderItemId: "item_2",
				wrapOptionId: option.id,
			});
			await controller.removeSelection(s1.id);

			const summary = await controller.getWrapSummary();
			expect(summary.totalSelections).toBe(1);
			expect(summary.totalRevenue).toBe(500);
		});

		it("activeOptions count reflects deactivation", async () => {
			const opt1 = await controller.createOption({
				name: "Active",
				priceInCents: 200,
			});
			await controller.createOption({
				name: "Also Active",
				priceInCents: 300,
			});
			await controller.updateOption(opt1.id, { active: false });

			const summary = await controller.getWrapSummary();
			expect(summary.totalOptions).toBe(2);
			expect(summary.activeOptions).toBe(1);
		});

		it("empty store returns all-zero summary", async () => {
			const summary = await controller.getWrapSummary();
			expect(summary.totalOptions).toBe(0);
			expect(summary.activeOptions).toBe(0);
			expect(summary.totalSelections).toBe(0);
			expect(summary.totalRevenue).toBe(0);
		});
	});
});
