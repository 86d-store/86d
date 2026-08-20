import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWaitlistController } from "../service-impl";

/**
 * Store endpoint integration tests for the waitlist module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. subscribe: joins waitlist for a product (email-based)
 * 2. unsubscribe: removes from waitlist (by email + product)
 * 3. check-status: checks if email is subscribed to a product
 * 4. my-waitlists: lists all waitlist entries for an email (auth optional)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateSubscribe(
	data: DataService,
	body: {
		productId: string;
		productName: string;
		email: string;
		variantId?: string;
		variantLabel?: string;
		customerId?: string;
	},
) {
	const controller = createWaitlistController(data);
	const already = await controller.isSubscribed(body.email, body.productId);
	if (already) {
		return { error: "Already subscribed", status: 409 };
	}
	const entry = await controller.subscribe(body);
	return { entry };
}

async function simulateUnsubscribe(
	data: DataService,
	body: { email: string; productId: string },
) {
	const controller = createWaitlistController(data);
	const cancelled = await controller.cancelByEmail(body.email, body.productId);
	if (!cancelled) {
		return { error: "Not found", status: 404 };
	}
	return { success: true };
}

async function simulateCheckStatus(
	data: DataService,
	query: { email: string; productId: string },
) {
	const controller = createWaitlistController(data);
	const isSubscribed = await controller.isSubscribed(
		query.email,
		query.productId,
	);
	return { isSubscribed };
}

async function simulateMyWaitlists(
	data: DataService,
	opts: { email?: string } = {},
) {
	if (!opts.email) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createWaitlistController(data);
	const entries = await controller.listByEmail(opts.email);
	return { entries };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: subscribe to waitlist", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("subscribes to a product waitlist", async () => {
		const result = await simulateSubscribe(data, {
			productId: "prod_1",
			productName: "Sold Out Widget",
			email: "alice@example.com",
		});

		expect("entry" in result).toBe(true);
		if ("entry" in result) {
			expect(result.entry.productId).toBe("prod_1");
			expect(result.entry.email).toBe("alice@example.com");
			expect(result.entry.status).toBe("waiting");
		}
	});

	it("returns 409 when already subscribed", async () => {
		await simulateSubscribe(data, {
			productId: "prod_1",
			productName: "Widget",
			email: "alice@example.com",
		});

		const result = await simulateSubscribe(data, {
			productId: "prod_1",
			productName: "Widget",
			email: "alice@example.com",
		});

		expect(result).toEqual({ error: "Already subscribed", status: 409 });
	});

	it("allows same email for different products", async () => {
		await simulateSubscribe(data, {
			productId: "prod_1",
			productName: "Widget A",
			email: "alice@example.com",
		});

		const result = await simulateSubscribe(data, {
			productId: "prod_2",
			productName: "Widget B",
			email: "alice@example.com",
		});

		expect("entry" in result).toBe(true);
		if ("entry" in result) {
			expect(result.entry.productId).toBe("prod_2");
		}
	});

	it("includes variant information", async () => {
		const result = await simulateSubscribe(data, {
			productId: "prod_1",
			productName: "T-Shirt",
			email: "alice@example.com",
			variantId: "var_xl_blue",
			variantLabel: "XL / Blue",
		});

		expect("entry" in result).toBe(true);
		if ("entry" in result) {
			expect(result.entry.variantId).toBe("var_xl_blue");
			expect(result.entry.variantLabel).toBe("XL / Blue");
		}
	});

	it("associates with customer when authenticated", async () => {
		const result = await simulateSubscribe(data, {
			productId: "prod_1",
			productName: "Widget",
			email: "alice@example.com",
			customerId: "cust_1",
		});

		expect("entry" in result).toBe(true);
		if ("entry" in result) {
			expect(result.entry.customerId).toBe("cust_1");
		}
	});
});

describe("store endpoint: unsubscribe from waitlist", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("cancels an existing waitlist entry", async () => {
		const ctrl = createWaitlistController(data);
		await ctrl.subscribe({
			productId: "prod_1",
			productName: "Widget",
			email: "alice@example.com",
		});

		const result = await simulateUnsubscribe(data, {
			email: "alice@example.com",
			productId: "prod_1",
		});

		expect(result).toEqual({ success: true });
	});

	it("returns 404 when not subscribed", async () => {
		const result = await simulateUnsubscribe(data, {
			email: "nobody@example.com",
			productId: "prod_1",
		});

		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("store endpoint: check subscription status", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns true when subscribed", async () => {
		const ctrl = createWaitlistController(data);
		await ctrl.subscribe({
			productId: "prod_1",
			productName: "Widget",
			email: "alice@example.com",
		});

		const result = await simulateCheckStatus(data, {
			email: "alice@example.com",
			productId: "prod_1",
		});

		expect(result.isSubscribed).toBe(true);
	});

	it("returns false when not subscribed", async () => {
		const result = await simulateCheckStatus(data, {
			email: "nobody@example.com",
			productId: "prod_1",
		});

		expect(result.isSubscribed).toBe(false);
	});
});

describe("store endpoint: my waitlists — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyWaitlists(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns all waitlist entries for customer email", async () => {
		const ctrl = createWaitlistController(data);
		await ctrl.subscribe({
			productId: "prod_1",
			productName: "Widget A",
			email: "alice@example.com",
		});
		await ctrl.subscribe({
			productId: "prod_2",
			productName: "Widget B",
			email: "alice@example.com",
		});
		await ctrl.subscribe({
			productId: "prod_1",
			productName: "Widget A",
			email: "bob@example.com",
		});

		const result = await simulateMyWaitlists(data, {
			email: "alice@example.com",
		});

		expect("entries" in result).toBe(true);
		if ("entries" in result) {
			expect(result.entries).toHaveLength(2);
		}
	});

	it("returns empty for customer with no waitlists", async () => {
		const result = await simulateMyWaitlists(data, {
			email: "nobody@example.com",
		});

		expect("entries" in result).toBe(true);
		if ("entries" in result) {
			expect(result.entries).toHaveLength(0);
		}
	});
});
