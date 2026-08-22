import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import referrals from "../index";

async function initModule(
	mod: ReturnType<typeof referrals>,
	data: ReturnType<typeof createMockDataService>,
	events?: ReturnType<typeof createScopedEmitter>,
) {
	const init = mod.init;
	expect(init).toBeDefined();
	if (init) {
		const ctx = createMockModuleContext({ data });
		await init({ ...ctx, events });
	}
}

const checkoutPayload = {
	sessionId: "sess-001",
	orderId: "order-001",
	customerId: "cust-referee-001",
	email: "referee@example.com",
	items: [{ name: "Widget", quantity: 1, price: 2500 }],
	total: 2500,
	currency: "usd",
};

async function seedPendingReferral(
	mockData: ReturnType<typeof createMockDataService>,
) {
	await mockData.upsert("referralCode", "code-1", {
		id: "code-1",
		customerId: "cust-referrer-001",
		code: "SAVE10",
		active: true,
		usageCount: 1,
		maxUses: 100,
	});
	await mockData.upsert("referral", "ref-1", {
		id: "ref-1",
		referrerCodeId: "code-1",
		referrerCustomerId: "cust-referrer-001",
		refereeCustomerId: "cust-referee-001",
		refereeEmail: "referee@example.com",
		status: "pending",
		referrerRewarded: false,
		refereeRewarded: false,
	});
}

describe("checkout.completed event listener — referrals auto-completion", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers a checkout.completed listener on init", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "referrals");

		await initModule(referrals(), mockData, emitter);

		expect(bus.listenerCount("checkout.completed")).toBe(1);
	});

	it("auto-completes a pending referral when the referee checks out", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "referrals");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		await initModule(referrals(), mockData, emitter);
		await seedPendingReferral(mockData);

		await checkoutEmitter.emit("checkout.completed", checkoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		const allReferrals = mockData.all("referral");
		expect(allReferrals).toHaveLength(1);
		expect(allReferrals[0].status).toBe("completed");
		expect(allReferrals[0].completedAt).toBeDefined();
	});

	it("does nothing when checkout has no customerId (guest checkout)", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "referrals");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		await initModule(referrals(), mockData, emitter);
		await seedPendingReferral(mockData);

		const guestPayload = { ...checkoutPayload, customerId: undefined };
		await checkoutEmitter.emit("checkout.completed", guestPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		// Referral should remain pending — no customerId to match
		const allReferrals = mockData.all("referral");
		expect(allReferrals[0].status).toBe("pending");
	});

	it("does nothing when there are no pending referrals for the customer", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "referrals");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		await initModule(referrals(), mockData, emitter);
		// No referrals seeded

		await checkoutEmitter.emit("checkout.completed", checkoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		expect(mockData.all("referral")).toHaveLength(0);
	});

	it("emits referrals.referral_completed with reward rule details", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "referrals");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		const emittedEvents: unknown[] = [];
		bus.on("referrals.referral_completed", (e) => {
			emittedEvents.push(e);
		});

		await initModule(referrals(), mockData, emitter);
		await seedPendingReferral(mockData);

		// Seed a reward rule
		await mockData.upsert("rewardRule", "rule-1", {
			id: "rule-1",
			name: "Standard Referral Reward",
			referrerRewardType: "store_credit",
			referrerRewardValue: 1000,
			refereeRewardType: "fixed_discount",
			refereeRewardValue: 500,
			minOrderAmount: 0,
			active: true,
		});

		await checkoutEmitter.emit("checkout.completed", checkoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		// Should emit two events: one for referrer, one for referee
		expect(emittedEvents).toHaveLength(2);
		const payloads = emittedEvents.map(
			(e: unknown) =>
				(e as { payload: { customerId: string; rewardType: string } }).payload,
		);
		const referrerEvent = payloads.find(
			(p) => p.customerId === "cust-referrer-001",
		);
		const refereeEvent = payloads.find(
			(p) => p.customerId === "cust-referee-001",
		);

		expect(referrerEvent).toBeDefined();
		expect(referrerEvent?.rewardType).toBe("store_credit");
		expect(refereeEvent).toBeDefined();
		expect(refereeEvent?.rewardType).toBe("fixed_discount");
	});

	it("completes referral without emitting reward events when no reward rules exist", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "referrals");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		const emittedEvents: unknown[] = [];
		bus.on("referrals.referral_completed", (e) => {
			emittedEvents.push(e);
		});

		await initModule(referrals(), mockData, emitter);
		await seedPendingReferral(mockData);
		// No reward rules seeded

		await checkoutEmitter.emit("checkout.completed", checkoutPayload);
		await new Promise<void>((r) => {
			setTimeout(r, 50);
		});

		// Referral is completed but no reward events (no active rules)
		const allReferrals = mockData.all("referral");
		expect(allReferrals[0].status).toBe("completed");
		expect(emittedEvents).toHaveLength(0);
	});

	it("is resilient when no events bus is provided (no init crash)", async () => {
		const mod = referrals();
		const data = createMockDataService();
		const init = mod.init;
		expect(init).toBeTruthy();
		if (!init) {
			throw new Error("expected init");
		}
		const ctx = createMockModuleContext({ data });
		await expect(init({ ...ctx, events: undefined })).resolves.not.toThrow();
	});
});
