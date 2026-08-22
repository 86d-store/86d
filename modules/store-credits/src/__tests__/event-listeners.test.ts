import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import storeCredits from "../index";

async function initModule(
	mod: ReturnType<typeof storeCredits>,
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

describe("store-credits — return.refunded listener", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("credits customer when return is refunded as store_credit", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "store-credits");
		const ordersEmitter = createScopedEmitter(bus, "orders");

		await initModule(storeCredits(), mockData, emitter);

		await ordersEmitter.emit("return.refunded", {
			returnRequestId: "ret-001",
			orderId: "order-001",
			customerId: "cust-001",
			type: "store_credit",
			refundAmount: 2500,
		});
		await new Promise((r) => setTimeout(r, 50));

		const accounts = mockData.all("creditAccount");
		const account = accounts.find((a) => a.customerId === "cust-001");
		expect(account).toBeDefined();
		expect(account?.balance).toBe(2500);

		const transactions = mockData.all("creditTransaction");
		const tx = transactions.find((t) => t.reason === "return_refund");
		expect(tx).toBeDefined();
		expect(tx?.amount).toBe(2500);
		expect(tx?.referenceType).toBe("return");
		expect(tx?.referenceId).toBe("ret-001");
	});

	it("ignores return refund when type is not store_credit", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "store-credits");
		const ordersEmitter = createScopedEmitter(bus, "orders");

		await initModule(storeCredits(), mockData, emitter);

		await ordersEmitter.emit("return.refunded", {
			returnRequestId: "ret-002",
			orderId: "order-002",
			customerId: "cust-002",
			type: "refund",
			refundAmount: 1000,
		});
		await new Promise((r) => setTimeout(r, 50));

		const accounts = mockData.all("creditAccount");
		expect(accounts).toHaveLength(0);
	});

	it("ignores return refund when customerId is missing", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "store-credits");
		const ordersEmitter = createScopedEmitter(bus, "orders");

		await initModule(storeCredits(), mockData, emitter);

		await ordersEmitter.emit("return.refunded", {
			returnRequestId: "ret-003",
			type: "store_credit",
			refundAmount: 500,
		});
		await new Promise((r) => setTimeout(r, 50));

		const accounts = mockData.all("creditAccount");
		expect(accounts).toHaveLength(0);
	});
});

describe("store-credits — referrals.referral_completed listener", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("credits customer when referral reward type is store_credit", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "store-credits");
		const referralsEmitter = createScopedEmitter(bus, "referrals");

		await initModule(storeCredits(), mockData, emitter);

		await referralsEmitter.emit("referrals.referral_completed", {
			referralId: "ref-001",
			customerId: "cust-010",
			rewardType: "store_credit",
			rewardAmount: 1000,
		});
		await new Promise((r) => setTimeout(r, 50));

		const accounts = mockData.all("creditAccount");
		const account = accounts.find((a) => a.customerId === "cust-010");
		expect(account).toBeDefined();
		expect(account?.balance).toBe(1000);

		const transactions = mockData.all("creditTransaction");
		const tx = transactions.find((t) => t.reason === "referral_reward");
		expect(tx).toBeDefined();
		expect(tx?.amount).toBe(1000);
		expect(tx?.referenceType).toBe("referral");
		expect(tx?.referenceId).toBe("ref-001");
	});

	it("ignores referral when reward type is not store_credit", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "store-credits");
		const referralsEmitter = createScopedEmitter(bus, "referrals");

		await initModule(storeCredits(), mockData, emitter);

		await referralsEmitter.emit("referrals.referral_completed", {
			referralId: "ref-002",
			customerId: "cust-011",
			rewardType: "percentage_discount",
			rewardAmount: 10,
		});
		await new Promise((r) => setTimeout(r, 50));

		const accounts = mockData.all("creditAccount");
		expect(accounts).toHaveLength(0);
	});

	it("registers both event listeners via init", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "store-credits");

		await initModule(storeCredits(), mockData, emitter);

		expect(bus.listenerCount("return.refunded")).toBe(1);
		expect(bus.listenerCount("referrals.referral_completed")).toBe(1);
	});

	it("does nothing when events is undefined", async () => {
		await expect(
			initModule(storeCredits(), mockData, undefined),
		).resolves.toBeUndefined();
		// No error thrown — graceful no-op
	});
});
