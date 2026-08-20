import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { PaymentMethod } from "../service";
import { createPaymentController } from "../service-impl";

/**
 * Store endpoint integration tests for the payments module.
 *
 * These tests verify the business logic in store-facing endpoints that
 * goes beyond simple controller delegation:
 *
 * 1. create-intent: authenticated users must use session email (never body);
 *    guests fall back to body email; amount must be positive
 * 2. get-intent: basic retrieval by ID
 * 3. confirm-intent: auth required, ownership check, state machine guards
 * 4. cancel-intent: auth required, ownership check via pre-fetch, state guards
 * 5. list-methods: auth required, scoped to session user
 * 6. delete-method: auth required, ownership check before deletion
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ─────────────────────────────────────────────────────────

function makeSession(userId: string, email = "user@example.com") {
	return { user: { id: userId, email } };
}

// ── Simulate endpoint logic ─────────────────────────────────────────

/**
 * Simulates create-intent endpoint: authenticated users must use session
 * email; guests may pass email in body; delegates to controller.
 */
async function simulateCreateIntent(
	data: DataService,
	body: {
		amount: number;
		currency?: string;
		email?: string;
		orderId?: string;
		checkoutSessionId?: string;
		metadata?: Record<string, unknown>;
	},
	opts: { session?: { user: { id: string; email: string } } } = {},
) {
	const controller = createPaymentController(data, undefined, {
		allowOfflineForDevelopment: true,
	});
	const email = opts.session ? opts.session.user.email : body.email;
	const intent = await controller.createIntent({
		amount: body.amount,
		currency: body.currency,
		email,
		orderId: body.orderId,
		checkoutSessionId: body.checkoutSessionId,
		metadata: body.metadata,
	});
	return { intent };
}

/**
 * Simulates get-intent endpoint: retrieves intent by ID, returns 404 if missing.
 */
async function simulateGetIntent(data: DataService, id: string) {
	const controller = createPaymentController(data, undefined, {
		allowOfflineForDevelopment: true,
	});
	const intent = await controller.getIntent(id);
	if (!intent) return { error: "Payment intent not found", status: 404 };
	return { intent };
}

/**
 * Simulates confirm-intent endpoint: requires auth, verifies ownership,
 * delegates to controller which enforces state machine.
 */
async function simulateConfirmIntent(
	data: DataService,
	id: string,
	opts: { session?: { user: { id: string; email: string } } } = {},
) {
	if (!opts.session) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createPaymentController(data, undefined, {
		allowOfflineForDevelopment: true,
	});
	try {
		const intent = await controller.confirmIntent(id);
		if (!intent) return { error: "Payment intent not found", status: 404 };

		if (intent.customerId && intent.customerId !== opts.session.user.id) {
			return { error: "Payment intent not found", status: 404 };
		}

		return { intent };
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Cannot confirm payment";
		return { error: message, status: 400 };
	}
}

/**
 * Simulates cancel-intent endpoint: requires auth, pre-fetches to verify
 * ownership, then delegates cancel to controller.
 */
async function simulateCancelIntent(
	data: DataService,
	id: string,
	opts: { session?: { user: { id: string; email: string } } } = {},
) {
	if (!opts.session) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createPaymentController(data, undefined, {
		allowOfflineForDevelopment: true,
	});
	const existing = await controller.getIntent(id);
	if (!existing) return { error: "Payment intent not found", status: 404 };

	if (existing.customerId && existing.customerId !== opts.session.user.id) {
		return { error: "Payment intent not found", status: 404 };
	}

	try {
		const intent = await controller.cancelIntent(id);
		if (!intent) return { error: "Payment intent not found", status: 404 };
		return { intent };
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Cannot cancel payment";
		return { error: message, status: 400 };
	}
}

/**
 * Simulates list-methods endpoint: requires auth, returns methods for
 * the authenticated user only.
 */
async function simulateListMethods(
	data: DataService,
	opts: { session?: { user: { id: string; email: string } } } = {},
) {
	if (!opts.session) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createPaymentController(data, undefined, {
		allowOfflineForDevelopment: true,
	});
	const methods = await controller.listPaymentMethods(opts.session.user.id);
	return { methods };
}

/**
 * Simulates delete-method endpoint: requires auth, verifies ownership,
 * then deletes.
 */
async function simulateDeleteMethod(
	data: DataService,
	id: string,
	opts: { session?: { user: { id: string; email: string } } } = {},
) {
	if (!opts.session) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createPaymentController(data, undefined, {
		allowOfflineForDevelopment: true,
	});
	const method = await controller.getPaymentMethod(id);
	if (!method) return { error: "Payment method not found", status: 404 };

	if (method.customerId && method.customerId !== opts.session.user.id) {
		return { error: "Payment method not found", status: 404 };
	}

	const deleted = await controller.deletePaymentMethod(id);
	return { deleted };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: create intent — email resolution", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("uses session email for authenticated users, ignoring body email", async () => {
		const result = await simulateCreateIntent(
			data,
			{ amount: 5000, email: "attacker@evil.com" },
			{ session: makeSession("cust_1", "real@example.com") },
		);

		expect(result.intent.email).toBe("real@example.com");
	});

	it("uses body email for guest users", async () => {
		const result = await simulateCreateIntent(data, {
			amount: 3000,
			email: "guest@example.com",
		});

		expect(result.intent.email).toBe("guest@example.com");
	});

	it("creates intent with no email when guest omits it", async () => {
		const result = await simulateCreateIntent(data, { amount: 1000 });

		expect(result.intent.email).toBeUndefined();
	});

	it("persists orderId and checkoutSessionId", async () => {
		const result = await simulateCreateIntent(data, {
			amount: 2500,
			orderId: "order_abc",
			checkoutSessionId: "cs_xyz",
		});

		expect(result.intent.orderId).toBe("order_abc");
		expect(result.intent.checkoutSessionId).toBe("cs_xyz");
	});

	it("defaults currency to USD", async () => {
		const result = await simulateCreateIntent(data, { amount: 1000 });

		expect(result.intent.currency).toBe("USD");
	});

	it("respects explicit currency", async () => {
		const result = await simulateCreateIntent(data, {
			amount: 1000,
			currency: "EUR",
		});

		expect(result.intent.currency).toBe("EUR");
	});

	it("stores metadata on the intent", async () => {
		const result = await simulateCreateIntent(data, {
			amount: 1000,
			metadata: { source: "checkout", cartId: "cart_1" },
		});

		expect(result.intent.metadata).toEqual({
			source: "checkout",
			cartId: "cart_1",
		});
	});

	it("rejects non-positive amounts", async () => {
		await expect(simulateCreateIntent(data, { amount: 0 })).rejects.toThrow(
			"Amount must be a positive integer",
		);
	});

	it("rejects negative amounts", async () => {
		await expect(simulateCreateIntent(data, { amount: -500 })).rejects.toThrow(
			"Amount must be a positive integer",
		);
	});

	it("rejects non-integer amounts", async () => {
		await expect(simulateCreateIntent(data, { amount: 19.99 })).rejects.toThrow(
			"Amount must be a positive integer",
		);
	});

	it("creates intent with pending status when no provider is configured", async () => {
		const result = await simulateCreateIntent(data, { amount: 5000 });

		expect(result.intent.status).toBe("pending");
	});
});

describe("store endpoint: get intent — retrieval", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns the intent by ID", async () => {
		const { intent: created } = await simulateCreateIntent(data, {
			amount: 4000,
			email: "test@example.com",
		});

		const result = await simulateGetIntent(data, created.id);

		expect("intent" in result).toBe(true);
		if ("intent" in result) {
			expect(result.intent.id).toBe(created.id);
			expect(result.intent.amount).toBe(4000);
		}
	});

	it("returns 404 for nonexistent intent", async () => {
		const result = await simulateGetIntent(data, "nonexistent_id");

		expect(result).toEqual({
			error: "Payment intent not found",
			status: 404,
		});
	});
});

describe("store endpoint: confirm intent — auth and state machine", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateConfirmIntent(data, "any_id");

		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("confirms a pending intent", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 5000,
			customerId: "cust_1",
		});

		const result = await simulateConfirmIntent(data, intent.id, {
			session: makeSession("cust_1"),
		});

		expect("intent" in result).toBe(true);
		if ("intent" in result) {
			expect(result.intent.status).toBe("succeeded");
		}
	});

	it("returns already-succeeded intent without error", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 5000,
			customerId: "cust_1",
		});
		await controller.confirmIntent(intent.id);

		const result = await simulateConfirmIntent(data, intent.id, {
			session: makeSession("cust_1"),
		});

		expect("intent" in result).toBe(true);
		if ("intent" in result) {
			expect(result.intent.status).toBe("succeeded");
		}
	});

	it("returns 404 when intent does not exist", async () => {
		const result = await simulateConfirmIntent(data, "ghost_id", {
			session: makeSession("cust_1"),
		});

		expect(result).toEqual({
			error: "Payment intent not found",
			status: 404,
		});
	});

	it("returns 404 when intent belongs to another customer", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 5000,
			customerId: "cust_owner",
		});

		const result = await simulateConfirmIntent(data, intent.id, {
			session: makeSession("cust_attacker"),
		});

		expect(result).toEqual({
			error: "Payment intent not found",
			status: 404,
		});
	});

	it("returns 400 when trying to confirm a cancelled intent", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 5000,
			customerId: "cust_1",
		});
		await controller.cancelIntent(intent.id);

		const result = await simulateConfirmIntent(data, intent.id, {
			session: makeSession("cust_1"),
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(400);
			expect(result.error).toContain("cancelled");
		}
	});

	it("returns 400 when trying to confirm a failed intent", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 5000,
			customerId: "cust_1",
		});
		// Simulate a failed state via webhook
		await controller.handleWebhookEvent({
			providerIntentId: intent.providerIntentId ?? intent.id,
			status: "failed",
		});

		// Need to look up by providerIntentId — if no provider, use the direct approach
		await data.upsert("paymentIntent", intent.id, {
			...intent,
			status: "failed",
			updatedAt: new Date(),
		} as unknown as Record<string, unknown>);

		const result = await simulateConfirmIntent(data, intent.id, {
			session: makeSession("cust_1"),
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(400);
			expect(result.error).toContain("failed");
		}
	});

	it("allows confirming an intent with no customerId (guest intent)", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 3000,
			email: "guest@example.com",
		});

		const result = await simulateConfirmIntent(data, intent.id, {
			session: makeSession("any_user"),
		});

		expect("intent" in result).toBe(true);
		if ("intent" in result) {
			expect(result.intent.status).toBe("succeeded");
		}
	});
});

describe("store endpoint: cancel intent — auth and ownership", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateCancelIntent(data, "any_id");

		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("cancels a pending intent", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 5000,
			customerId: "cust_1",
		});

		const result = await simulateCancelIntent(data, intent.id, {
			session: makeSession("cust_1"),
		});

		expect("intent" in result).toBe(true);
		if ("intent" in result) {
			expect(result.intent.status).toBe("cancelled");
		}
	});

	it("returns 404 when intent does not exist", async () => {
		const result = await simulateCancelIntent(data, "ghost_id", {
			session: makeSession("cust_1"),
		});

		expect(result).toEqual({
			error: "Payment intent not found",
			status: 404,
		});
	});

	it("returns 404 when intent belongs to another customer", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 5000,
			customerId: "cust_owner",
		});

		const result = await simulateCancelIntent(data, intent.id, {
			session: makeSession("cust_attacker"),
		});

		expect(result).toEqual({
			error: "Payment intent not found",
			status: 404,
		});
	});

	it("returns 400 when trying to cancel a succeeded intent", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 5000,
			customerId: "cust_1",
		});
		await controller.confirmIntent(intent.id);

		const result = await simulateCancelIntent(data, intent.id, {
			session: makeSession("cust_1"),
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(400);
			expect(result.error).toContain("succeeded");
		}
	});

	it("returns already-cancelled intent without error", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 5000,
			customerId: "cust_1",
		});
		await controller.cancelIntent(intent.id);

		const result = await simulateCancelIntent(data, intent.id, {
			session: makeSession("cust_1"),
		});

		expect("intent" in result).toBe(true);
		if ("intent" in result) {
			expect(result.intent.status).toBe("cancelled");
		}
	});

	it("allows cancelling an intent with no customerId", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const intent = await controller.createIntent({
			amount: 3000,
			email: "guest@example.com",
		});

		const result = await simulateCancelIntent(data, intent.id, {
			session: makeSession("any_user"),
		});

		expect("intent" in result).toBe(true);
		if ("intent" in result) {
			expect(result.intent.status).toBe("cancelled");
		}
	});
});

describe("store endpoint: list payment methods — auth scoping", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateListMethods(data);

		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns methods for the authenticated user", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		await controller.savePaymentMethod({
			customerId: "cust_1",
			providerMethodId: "pm_stripe_1",
			type: "card",
			last4: "4242",
			brand: "visa",
		});
		await controller.savePaymentMethod({
			customerId: "cust_1",
			providerMethodId: "pm_stripe_2",
			type: "card",
			last4: "1234",
			brand: "mastercard",
		});

		const result = await simulateListMethods(data, {
			session: makeSession("cust_1"),
		});

		expect("methods" in result).toBe(true);
		if ("methods" in result) {
			expect(result.methods).toHaveLength(2);
		}
	});

	it("does not return methods belonging to other users", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		await controller.savePaymentMethod({
			customerId: "cust_other",
			providerMethodId: "pm_stripe_1",
			type: "card",
			last4: "9999",
			brand: "visa",
		});

		const result = await simulateListMethods(data, {
			session: makeSession("cust_1"),
		});

		expect("methods" in result).toBe(true);
		if ("methods" in result) {
			expect(result.methods).toHaveLength(0);
		}
	});

	it("returns empty array for a user with no saved methods", async () => {
		const result = await simulateListMethods(data, {
			session: makeSession("cust_new"),
		});

		expect("methods" in result).toBe(true);
		if ("methods" in result) {
			expect(result.methods).toHaveLength(0);
		}
	});
});

describe("store endpoint: delete payment method — auth and ownership", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateDeleteMethod(data, "any_id");

		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("deletes a method owned by the authenticated user", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const method = await controller.savePaymentMethod({
			customerId: "cust_1",
			providerMethodId: "pm_stripe_1",
			type: "card",
			last4: "4242",
			brand: "visa",
		});

		const result = await simulateDeleteMethod(data, method.id, {
			session: makeSession("cust_1"),
		});

		expect("deleted" in result).toBe(true);
		if ("deleted" in result) {
			expect(result.deleted).toBe(true);
		}

		// Verify it's actually gone
		const methods = await controller.listPaymentMethods("cust_1");
		expect(methods).toHaveLength(0);
	});

	it("returns 404 when method does not exist", async () => {
		const result = await simulateDeleteMethod(data, "ghost_method", {
			session: makeSession("cust_1"),
		});

		expect(result).toEqual({
			error: "Payment method not found",
			status: 404,
		});
	});

	it("returns 404 when method belongs to another customer", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const method = await controller.savePaymentMethod({
			customerId: "cust_owner",
			providerMethodId: "pm_stripe_1",
			type: "card",
			last4: "4242",
			brand: "visa",
		});

		const result = await simulateDeleteMethod(data, method.id, {
			session: makeSession("cust_attacker"),
		});

		expect(result).toEqual({
			error: "Payment method not found",
			status: 404,
		});

		// Verify the method still exists for the real owner
		const methods = await controller.listPaymentMethods("cust_owner");
		expect(methods).toHaveLength(1);
	});

	it("preserves other methods when one is deleted", async () => {
		const controller = createPaymentController(data, undefined, {
			allowOfflineForDevelopment: true,
		});
		const methodA = await controller.savePaymentMethod({
			customerId: "cust_1",
			providerMethodId: "pm_a",
			type: "card",
			last4: "1111",
			brand: "visa",
		});
		await controller.savePaymentMethod({
			customerId: "cust_1",
			providerMethodId: "pm_b",
			type: "card",
			last4: "2222",
			brand: "mastercard",
		});

		await simulateDeleteMethod(data, methodA.id, {
			session: makeSession("cust_1"),
		});

		const methods = await controller.listPaymentMethods("cust_1");
		expect(methods).toHaveLength(1);
		expect((methods[0] as unknown as PaymentMethod).last4).toBe("2222");
	});
});

describe("store endpoint: intent lifecycle — end-to-end flow", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("create → confirm lifecycle", async () => {
		const { intent: created } = await simulateCreateIntent(
			data,
			{ amount: 9900, email: "buyer@example.com" },
			{ session: makeSession("cust_1", "buyer@example.com") },
		);
		expect(created.status).toBe("pending");

		const confirmed = await simulateConfirmIntent(data, created.id, {
			session: makeSession("cust_1"),
		});
		expect("intent" in confirmed).toBe(true);
		if ("intent" in confirmed) {
			expect(confirmed.intent.status).toBe("succeeded");
		}
	});

	it("create → cancel lifecycle", async () => {
		const { intent: created } = await simulateCreateIntent(
			data,
			{ amount: 5000 },
			{ session: makeSession("cust_1", "buyer@example.com") },
		);
		expect(created.status).toBe("pending");

		const cancelled = await simulateCancelIntent(data, created.id, {
			session: makeSession("cust_1"),
		});
		expect("intent" in cancelled).toBe(true);
		if ("intent" in cancelled) {
			expect(cancelled.intent.status).toBe("cancelled");
		}
	});

	it("cannot confirm after cancel", async () => {
		const { intent: created } = await simulateCreateIntent(
			data,
			{ amount: 5000 },
			{ session: makeSession("cust_1", "buyer@example.com") },
		);
		await simulateCancelIntent(data, created.id, {
			session: makeSession("cust_1"),
		});

		const result = await simulateConfirmIntent(data, created.id, {
			session: makeSession("cust_1"),
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(400);
		}
	});

	it("cannot cancel after confirm", async () => {
		const { intent: created } = await simulateCreateIntent(
			data,
			{ amount: 5000 },
			{ session: makeSession("cust_1", "buyer@example.com") },
		);
		await simulateConfirmIntent(data, created.id, {
			session: makeSession("cust_1"),
		});

		const result = await simulateCancelIntent(data, created.id, {
			session: makeSession("cust_1"),
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(400);
		}
	});

	it("multiple intents are independent", async () => {
		const { intent: a } = await simulateCreateIntent(
			data,
			{ amount: 1000, orderId: "order_1" },
			{ session: makeSession("cust_1", "user@example.com") },
		);
		const { intent: b } = await simulateCreateIntent(
			data,
			{ amount: 2000, orderId: "order_2" },
			{ session: makeSession("cust_1", "user@example.com") },
		);

		await simulateConfirmIntent(data, a.id, {
			session: makeSession("cust_1"),
		});
		await simulateCancelIntent(data, b.id, {
			session: makeSession("cust_1"),
		});

		const resultA = await simulateGetIntent(data, a.id);
		const resultB = await simulateGetIntent(data, b.id);

		expect("intent" in resultA).toBe(true);
		expect("intent" in resultB).toBe(true);
		if ("intent" in resultA && "intent" in resultB) {
			expect(resultA.intent.status).toBe("succeeded");
			expect(resultB.intent.status).toBe("cancelled");
		}
	});
});
