import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { WrapOption } from "../service";
import { createGiftWrappingController } from "../service-impl";

/**
 * Store endpoint integration tests for the gift-wrapping module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-options: active wrapping options only, sorted by sortOrder
 * 2. select-wrapping: adds gift wrap to an order item
 * 3. remove-wrapping: removes wrap selection from an order item
 * 4. get-order-wrapping: returns all wrapping selections and total for an order
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListOptions(data: DataService) {
	const controller = createGiftWrappingController(data);
	const options = await controller.listOptions({ active: true });
	return { options };
}

async function simulateSelectWrapping(
	data: DataService,
	body: {
		orderId: string;
		orderItemId: string;
		wrapOptionId: string;
		recipientName?: string;
		giftMessage?: string;
		customerId?: string;
	},
) {
	const controller = createGiftWrappingController(data);
	const option = await controller.getOption(body.wrapOptionId);
	if (!option?.active) {
		return { error: "Wrapping option not found", status: 404 };
	}
	const selection = await controller.selectWrapping(body);
	return { selection };
}

async function simulateRemoveWrapping(data: DataService, selectionId: string) {
	const controller = createGiftWrappingController(data);
	const selection = await controller.getSelection(selectionId);
	if (!selection) {
		return { error: "Selection not found", status: 404 };
	}
	await controller.removeSelection(selectionId);
	return { success: true };
}

async function simulateGetOrderWrapping(data: DataService, orderId: string) {
	const controller = createGiftWrappingController(data);
	const result = await controller.getOrderWrappingTotal(orderId);
	return result;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list options — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active wrapping options", async () => {
		const ctrl = createGiftWrappingController(data);
		await ctrl.createOption({
			name: "Classic Wrap",
			priceInCents: 500,
			active: true,
		});
		await ctrl.createOption({
			name: "Discontinued",
			priceInCents: 300,
			active: false,
		});

		const result = await simulateListOptions(data);

		expect(result.options).toHaveLength(1);
		expect((result.options[0] as WrapOption).name).toBe("Classic Wrap");
	});

	it("returns empty when no active options exist", async () => {
		const ctrl = createGiftWrappingController(data);
		await ctrl.createOption({
			name: "Inactive",
			priceInCents: 500,
			active: false,
		});

		const result = await simulateListOptions(data);

		expect(result.options).toHaveLength(0);
	});

	it("returns multiple active options", async () => {
		const ctrl = createGiftWrappingController(data);
		await ctrl.createOption({
			name: "Basic",
			priceInCents: 300,
			sortOrder: 1,
		});
		await ctrl.createOption({
			name: "Premium",
			priceInCents: 800,
			sortOrder: 2,
		});
		await ctrl.createOption({
			name: "Luxury",
			priceInCents: 1500,
			sortOrder: 3,
		});

		const result = await simulateListOptions(data);

		expect(result.options).toHaveLength(3);
	});
});

describe("store endpoint: select wrapping — add to order item", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("adds gift wrapping to an order item", async () => {
		const ctrl = createGiftWrappingController(data);
		const option = await ctrl.createOption({
			name: "Holiday Wrap",
			priceInCents: 500,
		});

		const result = await simulateSelectWrapping(data, {
			orderId: "order_1",
			orderItemId: "item_1",
			wrapOptionId: option.id,
			recipientName: "John",
			giftMessage: "Happy Holidays!",
		});

		expect("selection" in result).toBe(true);
		if ("selection" in result) {
			expect(result.selection.recipientName).toBe("John");
			expect(result.selection.giftMessage).toBe("Happy Holidays!");
			expect(result.selection.priceInCents).toBe(500);
		}
	});

	it("returns 404 for inactive wrapping option", async () => {
		const ctrl = createGiftWrappingController(data);
		const option = await ctrl.createOption({
			name: "Removed",
			priceInCents: 300,
			active: false,
		});

		const result = await simulateSelectWrapping(data, {
			orderId: "order_1",
			orderItemId: "item_1",
			wrapOptionId: option.id,
		});

		expect(result).toEqual({
			error: "Wrapping option not found",
			status: 404,
		});
	});

	it("returns 404 for nonexistent option", async () => {
		const result = await simulateSelectWrapping(data, {
			orderId: "order_1",
			orderItemId: "item_1",
			wrapOptionId: "ghost_option",
		});

		expect(result).toEqual({
			error: "Wrapping option not found",
			status: 404,
		});
	});
});

describe("store endpoint: remove wrapping", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("removes a wrapping selection", async () => {
		const ctrl = createGiftWrappingController(data);
		const option = await ctrl.createOption({
			name: "Wrap",
			priceInCents: 500,
		});
		const selection = await ctrl.selectWrapping({
			orderId: "order_1",
			orderItemId: "item_1",
			wrapOptionId: option.id,
		});

		const result = await simulateRemoveWrapping(data, selection.id);

		expect(result).toEqual({ success: true });
	});

	it("returns 404 for nonexistent selection", async () => {
		const result = await simulateRemoveWrapping(data, "ghost_selection");

		expect(result).toEqual({ error: "Selection not found", status: 404 });
	});
});

describe("store endpoint: get order wrapping — total calculation", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns selections and total for an order", async () => {
		const ctrl = createGiftWrappingController(data);
		const option = await ctrl.createOption({
			name: "Classic",
			priceInCents: 500,
		});
		await ctrl.selectWrapping({
			orderId: "order_1",
			orderItemId: "item_1",
			wrapOptionId: option.id,
		});
		await ctrl.selectWrapping({
			orderId: "order_1",
			orderItemId: "item_2",
			wrapOptionId: option.id,
		});

		const result = await simulateGetOrderWrapping(data, "order_1");

		expect(result.selections).toHaveLength(2);
		expect(result.totalInCents).toBe(1000);
	});

	it("returns zero total for order with no wrapping", async () => {
		const result = await simulateGetOrderWrapping(data, "order_empty");

		expect(result.selections).toHaveLength(0);
		expect(result.totalInCents).toBe(0);
	});

	it("sums different wrap option prices correctly", async () => {
		const ctrl = createGiftWrappingController(data);
		const basic = await ctrl.createOption({
			name: "Basic",
			priceInCents: 300,
		});
		const premium = await ctrl.createOption({
			name: "Premium",
			priceInCents: 800,
		});
		await ctrl.selectWrapping({
			orderId: "order_1",
			orderItemId: "item_1",
			wrapOptionId: basic.id,
		});
		await ctrl.selectWrapping({
			orderId: "order_1",
			orderItemId: "item_2",
			wrapOptionId: premium.id,
		});

		const result = await simulateGetOrderWrapping(data, "order_1");

		expect(result.selections).toHaveLength(2);
		expect(result.totalInCents).toBe(1100);
	});
});
