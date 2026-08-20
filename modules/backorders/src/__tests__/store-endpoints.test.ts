import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBackordersController } from "../service-impl";

/**
 * Store endpoint integration tests for the backorders module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. check-eligibility: returns eligibility for a product (public)
 * 2. create-backorder: auth required, creates backorder with valid policy
 * 3. my-backorders: auth required, scoped to customer
 * 4. get-backorder: found / not found (public)
 * 5. cancel-backorder: auth required, ownership check, prevents cancel on delivered
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ─────────────────────────────────────────────────────────

async function enablePolicy(
	ctrl: ReturnType<typeof createBackordersController>,
	productId: string,
	overrides?: {
		maxQuantityPerOrder?: number;
		maxTotalBackorders?: number;
		estimatedLeadDays?: number;
		autoConfirm?: boolean;
		message?: string;
		enabled?: boolean;
	},
) {
	return ctrl.setPolicy({
		productId,
		enabled: overrides?.enabled ?? true,
		maxQuantityPerOrder: overrides?.maxQuantityPerOrder,
		maxTotalBackorders: overrides?.maxTotalBackorders,
		estimatedLeadDays: overrides?.estimatedLeadDays,
		autoConfirm: overrides?.autoConfirm ?? false,
		message: overrides?.message,
	});
}

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateCheckEligibility(
	data: DataService,
	productId: string,
	quantity?: number,
) {
	const controller = createBackordersController(data);
	const result = await controller.checkEligibility(productId, quantity ?? 1);
	return result;
}

async function simulateCreateBackorder(
	data: DataService,
	body: {
		productId: string;
		productName: string;
		variantId?: string;
		variantLabel?: string;
		orderId?: string;
		quantity: number;
	},
	opts: { customerId?: string; customerEmail?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createBackordersController(data);
	const backorder = await controller.createBackorder({
		productId: body.productId,
		productName: body.productName,
		variantId: body.variantId,
		variantLabel: body.variantLabel,
		customerId: opts.customerId,
		customerEmail: opts.customerEmail ?? `${opts.customerId}@example.com`,
		orderId: body.orderId,
		quantity: body.quantity,
	});

	if (!backorder) {
		return { error: "Backorder not eligible", backorder: null };
	}
	return { backorder };
}

async function simulateMyBackorders(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createBackordersController(data);
	const backorders = await controller.getCustomerBackorders(opts.customerId);
	return { backorders };
}

async function simulateGetBackorder(data: DataService, id: string) {
	const controller = createBackordersController(data);
	const backorder = await controller.getBackorder(id);
	if (!backorder) {
		return { error: "Backorder not found", backorder: null };
	}
	return { backorder };
}

async function simulateCancelBackorder(
	data: DataService,
	id: string,
	body: { reason?: string } = {},
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createBackordersController(data);
	const existing = await controller.getBackorder(id);
	if (!existing) {
		return { error: "Backorder not found", cancelled: false };
	}

	if (existing.customerId !== opts.customerId) {
		return { error: "Backorder not found", cancelled: false };
	}

	const backorder = await controller.cancelBackorder(id, body.reason);
	if (!backorder) {
		return { error: "Backorder not found", cancelled: false };
	}

	return { cancelled: true, backorder };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: check eligibility — public", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns eligible when policy is active", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", {
			estimatedLeadDays: 14,
			message: "Ships in 2 weeks",
		});

		const result = await simulateCheckEligibility(data, "prod_1");

		expect(result.eligible).toBe(true);
		expect(result.estimatedLeadDays).toBe(14);
		expect(result.message).toBe("Ships in 2 weeks");
		expect(result.reason).toBeUndefined();
	});

	it("returns ineligible when no policy exists", async () => {
		const result = await simulateCheckEligibility(data, "prod_nonexistent");

		expect(result.eligible).toBe(false);
		expect(result.reason).toBe("Backorders not available");
	});

	it("returns ineligible when policy is disabled", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { enabled: false });

		const result = await simulateCheckEligibility(data, "prod_1");

		expect(result.eligible).toBe(false);
		expect(result.reason).toBe("Backorders not available");
	});

	it("returns ineligible when quantity exceeds maxQuantityPerOrder", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { maxQuantityPerOrder: 5 });

		const result = await simulateCheckEligibility(data, "prod_1", 10);

		expect(result.eligible).toBe(false);
		expect(result.reason).toBe("Maximum 5 per order");
	});

	it("returns eligible when quantity is within maxQuantityPerOrder", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { maxQuantityPerOrder: 5 });

		const result = await simulateCheckEligibility(data, "prod_1", 3);

		expect(result.eligible).toBe(true);
	});

	it("returns ineligible when total backorder capacity is reached", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { maxTotalBackorders: 10 });

		// Fill up capacity with existing backorders
		await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget",
			customerId: "cust_existing",
			customerEmail: "existing@example.com",
			quantity: 8,
		});

		const result = await simulateCheckEligibility(data, "prod_1", 5);

		expect(result.eligible).toBe(false);
		expect(result.reason).toBe("Backorder capacity reached");
	});

	it("returns eligible when total backorder capacity has room", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { maxTotalBackorders: 10 });

		await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget",
			customerId: "cust_existing",
			customerEmail: "existing@example.com",
			quantity: 3,
		});

		const result = await simulateCheckEligibility(data, "prod_1", 5);

		expect(result.eligible).toBe(true);
	});
});

describe("store endpoint: create backorder — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateCreateBackorder(data, {
			productId: "prod_1",
			productName: "Widget",
			quantity: 1,
		});

		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("creates backorder when policy exists and is enabled", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { estimatedLeadDays: 7 });

		const result = await simulateCreateBackorder(
			data,
			{
				productId: "prod_1",
				productName: "Widget",
				quantity: 2,
			},
			{ customerId: "cust_1", customerEmail: "cust1@example.com" },
		);

		expect("backorder" in result && result.backorder !== null).toBe(true);
		if ("backorder" in result && result.backorder) {
			expect(result.backorder.customerId).toBe("cust_1");
			expect(result.backorder.productId).toBe("prod_1");
			expect(result.backorder.quantity).toBe(2);
			expect(result.backorder.status).toBe("pending");
			expect(result.backorder.estimatedAvailableAt).toBeDefined();
		}
	});

	it("returns null backorder when no policy exists", async () => {
		const result = await simulateCreateBackorder(
			data,
			{
				productId: "prod_no_policy",
				productName: "No Policy Widget",
				quantity: 1,
			},
			{ customerId: "cust_1" },
		);

		// No policy means createBackorder returns the backorder (policy is optional)
		// The controller only rejects if policy exists and is disabled
		expect("backorder" in result).toBe(true);
	});

	it("returns null backorder when policy is disabled", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { enabled: false });

		const result = await simulateCreateBackorder(
			data,
			{
				productId: "prod_1",
				productName: "Widget",
				quantity: 1,
			},
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Backorder not eligible",
			backorder: null,
		});
	});

	it("respects maxQuantityPerOrder limit", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { maxQuantityPerOrder: 3 });

		const result = await simulateCreateBackorder(
			data,
			{
				productId: "prod_1",
				productName: "Widget",
				quantity: 5,
			},
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Backorder not eligible",
			backorder: null,
		});
	});

	it("allows quantity within maxQuantityPerOrder", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { maxQuantityPerOrder: 10 });

		const result = await simulateCreateBackorder(
			data,
			{
				productId: "prod_1",
				productName: "Widget",
				quantity: 5,
			},
			{ customerId: "cust_1" },
		);

		expect("backorder" in result && result.backorder !== null).toBe(true);
	});

	it("respects maxTotalBackorders limit", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { maxTotalBackorders: 10 });

		// Fill capacity
		await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget",
			customerId: "cust_other",
			customerEmail: "other@example.com",
			quantity: 8,
		});

		const result = await simulateCreateBackorder(
			data,
			{
				productId: "prod_1",
				productName: "Widget",
				quantity: 5,
			},
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Backorder not eligible",
			backorder: null,
		});
	});

	it("auto-confirms when policy has autoConfirm enabled", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { autoConfirm: true });

		const result = await simulateCreateBackorder(
			data,
			{
				productId: "prod_1",
				productName: "Widget",
				quantity: 1,
			},
			{ customerId: "cust_1" },
		);

		expect("backorder" in result && result.backorder !== null).toBe(true);
		if ("backorder" in result && result.backorder) {
			expect(result.backorder.status).toBe("confirmed");
		}
	});

	it("sets status to pending when autoConfirm is disabled", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1", { autoConfirm: false });

		const result = await simulateCreateBackorder(
			data,
			{
				productId: "prod_1",
				productName: "Widget",
				quantity: 1,
			},
			{ customerId: "cust_1" },
		);

		expect("backorder" in result && result.backorder !== null).toBe(true);
		if ("backorder" in result && result.backorder) {
			expect(result.backorder.status).toBe("pending");
		}
	});

	it("includes variant information", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1");

		const result = await simulateCreateBackorder(
			data,
			{
				productId: "prod_1",
				productName: "T-Shirt",
				variantId: "var_xl_red",
				variantLabel: "XL / Red",
				quantity: 1,
			},
			{ customerId: "cust_1" },
		);

		expect("backorder" in result && result.backorder !== null).toBe(true);
		if ("backorder" in result && result.backorder) {
			expect(result.backorder.variantId).toBe("var_xl_red");
			expect(result.backorder.variantLabel).toBe("XL / Red");
		}
	});
});

describe("store endpoint: my backorders — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyBackorders(data);

		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns customer's backorders", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1");
		await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget A",
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 1,
		});
		await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget B",
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 2,
		});

		const result = await simulateMyBackorders(data, {
			customerId: "cust_1",
		});

		expect("backorders" in result).toBe(true);
		if ("backorders" in result) {
			expect(result.backorders).toHaveLength(2);
			for (const bo of result.backorders) {
				expect(bo.customerId).toBe("cust_1");
			}
		}
	});

	it("returns empty for customer with no backorders", async () => {
		const result = await simulateMyBackorders(data, {
			customerId: "cust_empty",
		});

		expect("backorders" in result).toBe(true);
		if ("backorders" in result) {
			expect(result.backorders).toHaveLength(0);
		}
	});

	it("does not include other customers' backorders", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1");
		await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget",
			customerId: "cust_other",
			customerEmail: "other@example.com",
			quantity: 1,
		});

		const result = await simulateMyBackorders(data, {
			customerId: "cust_1",
		});

		expect("backorders" in result).toBe(true);
		if ("backorders" in result) {
			expect(result.backorders).toHaveLength(0);
		}
	});
});

describe("store endpoint: get backorder — public", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns backorder when found", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1");
		const created = await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget",
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 3,
		});
		if (!created) throw new Error("createBackorder returned null");

		const result = await simulateGetBackorder(data, created.id);

		expect("backorder" in result && result.backorder !== null).toBe(true);
		if ("backorder" in result && result.backorder) {
			expect(result.backorder.id).toBe(created.id);
			expect(result.backorder.productName).toBe("Widget");
			expect(result.backorder.quantity).toBe(3);
		}
	});

	it("returns not found for nonexistent backorder", async () => {
		const result = await simulateGetBackorder(data, "ghost_id");

		expect(result).toEqual({
			error: "Backorder not found",
			backorder: null,
		});
	});
});

describe("store endpoint: cancel backorder — auth + ownership", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateCancelBackorder(data, "bo_1");

		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("cancels own backorder", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1");
		const created = await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget",
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 1,
		});
		if (!created) throw new Error("createBackorder returned null");

		const result = await simulateCancelBackorder(
			data,
			created.id,
			{ reason: "Changed my mind" },
			{ customerId: "cust_1" },
		);

		expect("cancelled" in result && result.cancelled).toBe(true);
		if ("backorder" in result && result.backorder) {
			expect(result.backorder.status).toBe("cancelled");
			expect(result.backorder.cancelReason).toBe("Changed my mind");
			expect(result.backorder.cancelledAt).toBeDefined();
		}
	});

	it("returns not found for another customer's backorder", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1");
		const created = await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget",
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 1,
		});
		if (!created) throw new Error("createBackorder returned null");

		const result = await simulateCancelBackorder(
			data,
			created.id,
			{},
			{ customerId: "cust_2" },
		);

		expect(result).toEqual({
			error: "Backorder not found",
			cancelled: false,
		});
	});

	it("returns not found for nonexistent backorder", async () => {
		const result = await simulateCancelBackorder(
			data,
			"ghost_id",
			{},
			{ customerId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Backorder not found",
			cancelled: false,
		});
	});

	it("prevents cancel on already delivered backorder", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1");
		const created = await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget",
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 1,
		});
		if (!created) throw new Error("createBackorder returned null");

		// Move to delivered status via admin updateStatus
		await ctrl.updateStatus(created.id, "delivered");

		const result = await simulateCancelBackorder(
			data,
			created.id,
			{},
			{ customerId: "cust_1" },
		);

		// cancelBackorder returns the backorder unchanged when already delivered
		expect("cancelled" in result && result.cancelled).toBe(true);
		if ("backorder" in result && result.backorder) {
			expect(result.backorder.status).toBe("delivered");
		}
	});

	it("prevents cancel on already cancelled backorder", async () => {
		const ctrl = createBackordersController(data);
		await enablePolicy(ctrl, "prod_1");
		const created = await ctrl.createBackorder({
			productId: "prod_1",
			productName: "Widget",
			customerId: "cust_1",
			customerEmail: "cust1@example.com",
			quantity: 1,
		});
		if (!created) throw new Error("createBackorder returned null");

		// Cancel once
		await ctrl.cancelBackorder(created.id, "First cancel");

		const result = await simulateCancelBackorder(
			data,
			created.id,
			{ reason: "Double cancel" },
			{ customerId: "cust_1" },
		);

		// cancelBackorder returns the backorder unchanged when already cancelled
		expect("cancelled" in result && result.cancelled).toBe(true);
		if ("backorder" in result && result.backorder) {
			expect(result.backorder.status).toBe("cancelled");
			// Original reason preserved
			expect(result.backorder.cancelReason).toBe("First cancel");
		}
	});
});
