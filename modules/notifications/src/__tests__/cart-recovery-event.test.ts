import type { CapabilityInvoker } from "@86d-app/core/capabilities";
import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import notifications from "../index";

const recoveryPayload = {
	cartId: "cart-001",
	channel: "email",
	recipient: "shopper@example.com",
	attemptId: "attempt-001",
};

const mockCart = {
	id: "cart-001",
	cartId: "original-cart-001",
	items: [
		{ name: "Classic Burger", quantity: 2, price: 1299, imageUrl: undefined },
		{ name: "Fries", quantity: 1, price: 499, imageUrl: undefined },
	],
	cartTotal: 3097,
	currency: "usd",
	recoveryToken: "tok_recovery_abc123",
	status: "active" as const,
	attemptCount: 1,
	lastActivityAt: new Date(),
	abandonedAt: new Date(),
	createdAt: new Date(),
	updatedAt: new Date(),
};

type RecoveryResolver = {
	get: (cartId: string) => Promise<typeof mockCart | null>;
};

function recoveryCapabilities(resolver: RecoveryResolver): CapabilityInvoker {
	return {
		invoke: vi.fn(async (definition: { name: string }, request: unknown) => {
			if (definition.name !== "abandoned-carts.recovery.resolve") {
				return { ok: false, failure: { code: "CAPABILITY_NOT_ACCEPTED" } };
			}
			try {
				const cart = await resolver.get((request as { cartId: string }).cartId);
				if (!cart) {
					return { ok: false, failure: { code: "cart_not_found" } };
				}
				return {
					ok: true,
					decision: {
						items: cart.items,
						cartTotal: cart.cartTotal,
						currency: cart.currency,
						recoveryToken: cart.recoveryToken,
					},
				};
			} catch {
				return { ok: false, failure: { code: "CAPABILITY_PROVIDER_FAILED" } };
			}
		}) as CapabilityInvoker["invoke"],
	};
}

async function initModule(
	mod: ReturnType<typeof notifications>,
	data: ReturnType<typeof createMockDataService>,
	events?: ReturnType<typeof createScopedEmitter>,
	resolver?: RecoveryResolver,
) {
	const init = mod.init;
	expect(init).toBeDefined();
	if (init) {
		const ctx = createMockModuleContext({
			data,
			...(resolver ? { capabilities: recoveryCapabilities(resolver) } : {}),
		});
		await init({ ...ctx, events });
	}
}

describe("cart.recoveryAttempted event listener", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sends recovery email when the recovery capability is available", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "notifications");
		const cartEmitter = createScopedEmitter(bus, "abandoned-carts");

		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ id: "msg-recovery-001" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const mockAbandonedCartsController = {
			get: vi.fn().mockResolvedValue(mockCart),
		};

		await initModule(
			notifications({
				resendApiKey: "re_test_key",
				resendFromAddress: "Store <noreply@store.com>",
			}),
			mockData,
			emitter,
			mockAbandonedCartsController,
		);

		await cartEmitter.emit("cart.recoveryAttempted", recoveryPayload);
		await new Promise((r) => setTimeout(r, 50));

		expect(mockAbandonedCartsController.get).toHaveBeenCalledWith("cart-001");

		const fetchCall = fetchSpy.mock.calls.find(
			(c) => typeof c[0] === "string" && c[0].includes("resend.com/emails"),
		);
		expect(fetchCall).toBeDefined();

		const body = JSON.parse(
			(fetchCall?.[1] as RequestInit | undefined)?.body as string,
		);
		expect(body.to).toBe("shopper@example.com");
		expect(body.subject).toBe("You left something behind!");
		expect(body.html).toContain("Classic Burger");
		expect(body.html).toContain("Fries");
		expect(body.html).toContain("Complete Your Purchase");
		expect(body.html).toContain("/abandoned-carts/recover/tok_recovery_abc123");

		fetchSpy.mockRestore();
	});

	it("includes cart_recovery and attempt_id tags", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "notifications");
		const cartEmitter = createScopedEmitter(bus, "abandoned-carts");

		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ id: "msg-recovery-002" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		await initModule(
			notifications({
				resendApiKey: "re_test_key",
				resendFromAddress: "Store <noreply@store.com>",
			}),
			mockData,
			emitter,
			{ get: vi.fn().mockResolvedValue(mockCart) },
		);

		await cartEmitter.emit("cart.recoveryAttempted", recoveryPayload);
		await new Promise((r) => setTimeout(r, 50));

		const fetchCall = fetchSpy.mock.calls.find(
			(c) => typeof c[0] === "string" && c[0].includes("resend.com/emails"),
		);
		const body = JSON.parse(
			(fetchCall?.[1] as RequestInit | undefined)?.body as string,
		);
		expect(body.tags).toEqual(
			expect.arrayContaining([
				{ name: "type", value: "cart_recovery" },
				{ name: "cart_id", value: "cart-001" },
				{ name: "attempt_id", value: "attempt-001" },
			]),
		);

		fetchSpy.mockRestore();
	});

	it("skips sending when channel is not email", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "notifications");
		const cartEmitter = createScopedEmitter(bus, "abandoned-carts");

		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const mockCtrl = { get: vi.fn() };

		await initModule(
			notifications({
				resendApiKey: "re_test_key",
				resendFromAddress: "Store <noreply@store.com>",
			}),
			mockData,
			emitter,
			mockCtrl,
		);

		await cartEmitter.emit("cart.recoveryAttempted", {
			...recoveryPayload,
			channel: "sms",
		});
		await new Promise((r) => setTimeout(r, 50));

		expect(mockCtrl.get).not.toHaveBeenCalled();

		const resendCall = fetchSpy.mock.calls.find(
			(c) => typeof c[0] === "string" && c[0].includes("resend.com/emails"),
		);
		expect(resendCall).toBeUndefined();

		fetchSpy.mockRestore();
	});

	it("skips sending when email provider is not configured", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "notifications");
		const cartEmitter = createScopedEmitter(bus, "abandoned-carts");

		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const mockCtrl = { get: vi.fn() };

		await initModule(notifications(), mockData, emitter, mockCtrl);

		await cartEmitter.emit("cart.recoveryAttempted", recoveryPayload);
		await new Promise((r) => setTimeout(r, 50));

		expect(mockCtrl.get).not.toHaveBeenCalled();

		fetchSpy.mockRestore();
	});

	it("skips sending when the recovery capability is unavailable", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "notifications");
		const cartEmitter = createScopedEmitter(bus, "abandoned-carts");

		const fetchSpy = vi.spyOn(globalThis, "fetch");

		await initModule(
			notifications({
				resendApiKey: "re_test_key",
				resendFromAddress: "Store <noreply@store.com>",
			}),
			mockData,
			emitter,
		);

		await cartEmitter.emit("cart.recoveryAttempted", recoveryPayload);
		await new Promise((r) => setTimeout(r, 50));

		const resendCall = fetchSpy.mock.calls.find(
			(c) => typeof c[0] === "string" && c[0].includes("resend.com/emails"),
		);
		expect(resendCall).toBeUndefined();

		fetchSpy.mockRestore();
	});

	it("skips sending when cart is not found", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "notifications");
		const cartEmitter = createScopedEmitter(bus, "abandoned-carts");

		const fetchSpy = vi.spyOn(globalThis, "fetch");

		await initModule(
			notifications({
				resendApiKey: "re_test_key",
				resendFromAddress: "Store <noreply@store.com>",
			}),
			mockData,
			emitter,
			{ get: vi.fn().mockResolvedValue(null) },
		);

		await cartEmitter.emit("cart.recoveryAttempted", recoveryPayload);
		await new Promise((r) => setTimeout(r, 50));

		const resendCall = fetchSpy.mock.calls.find(
			(c) => typeof c[0] === "string" && c[0].includes("resend.com/emails"),
		);
		expect(resendCall).toBeUndefined();

		fetchSpy.mockRestore();
	});

	it("handles email delivery failure gracefully", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "notifications");
		const cartEmitter = createScopedEmitter(bus, "abandoned-carts");

		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockRejectedValue(new Error("Network error"));

		await initModule(
			notifications({
				resendApiKey: "re_test_key",
				resendFromAddress: "Store <noreply@store.com>",
			}),
			mockData,
			emitter,
			{ get: vi.fn().mockResolvedValue(mockCart) },
		);

		// Should not throw
		await cartEmitter.emit("cart.recoveryAttempted", recoveryPayload);
		await new Promise((r) => setTimeout(r, 50));

		fetchSpy.mockRestore();
	});

	it("handles cart fetch failure gracefully", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "notifications");
		const cartEmitter = createScopedEmitter(bus, "abandoned-carts");

		const fetchSpy = vi.spyOn(globalThis, "fetch");

		await initModule(
			notifications({
				resendApiKey: "re_test_key",
				resendFromAddress: "Store <noreply@store.com>",
			}),
			mockData,
			emitter,
			{ get: vi.fn().mockRejectedValue(new Error("DB error")) },
		);

		// Should not throw
		await cartEmitter.emit("cart.recoveryAttempted", recoveryPayload);
		await new Promise((r) => setTimeout(r, 50));

		const resendCall = fetchSpy.mock.calls.find(
			(c) => typeof c[0] === "string" && c[0].includes("resend.com/emails"),
		);
		expect(resendCall).toBeUndefined();

		fetchSpy.mockRestore();
	});

	it("registers cart.recoveryAttempted handler via init", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "notifications");

		await initModule(notifications(), mockData, emitter);

		expect(bus.listenerCount("cart.recoveryAttempted")).toBe(1);
	});
});
