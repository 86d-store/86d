import { describe, expect, it, vi } from "vitest";
import { createRefund } from "../admin/endpoints/create-refund";
import { getIntentAdmin } from "../admin/endpoints/get-intent";
import { listIntents } from "../admin/endpoints/list-intents";
import { listRefunds } from "../admin/endpoints/list-refunds";
import type { PaymentController, PaymentIntent, Refund } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		amount: 2500,
		currency: "usd",
		status: "pending",
		metadata: {},
		providerMetadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeRefund(intentId: string, overrides: Partial<Refund> = {}): Refund {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		paymentIntentId: intentId,
		providerRefundId: `re_${Date.now()}`,
		amount: 1000,
		status: "succeeded",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<PaymentController> = {},
): PaymentController {
	return {
		createIntent: vi.fn().mockResolvedValue(makeIntent()),
		getIntent: vi.fn().mockResolvedValue(null),
		confirmIntent: vi.fn().mockResolvedValue(null),
		cancelIntent: vi.fn().mockResolvedValue(null),
		listIntents: vi.fn().mockResolvedValue([]),
		savePaymentMethod: vi.fn().mockResolvedValue(null),
		getPaymentMethod: vi.fn().mockResolvedValue(null),
		listPaymentMethods: vi.fn().mockResolvedValue([]),
		deletePaymentMethod: vi.fn().mockResolvedValue(false),
		createRefund: vi.fn().mockResolvedValue(makeRefund("intent-1")),
		getRefund: vi.fn().mockResolvedValue(null),
		listRefunds: vi.fn().mockResolvedValue([]),
		handleWebhookEvent: vi.fn().mockResolvedValue(null),
		handleWebhookRefund: vi.fn().mockResolvedValue(null),
		...overrides,
	} as PaymentController;
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: PaymentController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { payments: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listIntentsHandler = extractHandler(listIntents);
const getIntentHandler = extractHandler(getIntentAdmin);
const listRefundsHandler = extractHandler(listRefunds);
const createRefundHandler = extractHandler(createRefund);

// ── listIntents ───────────────────────────────────────────────────────────────

describe("admin GET /payments", () => {
	it("returns empty list when no intents exist", async () => {
		const result = (await call(listIntentsHandler)) as {
			intents: PaymentIntent[];
			total: number;
		};
		expect(result.intents).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns intents from controller with pagination", async () => {
		const intents = [makeIntent({ status: "succeeded" })];
		const ctrl = makeController({
			listIntents: vi.fn().mockResolvedValue(intents),
		});
		const result = (await call(listIntentsHandler, {
			controller: ctrl,
		})) as { intents: PaymentIntent[]; total: number };
		expect(result.intents).toHaveLength(1);
		expect(result.total).toBe(1);
		// Endpoint fetches all (no take/skip) then slices for accurate total
		expect(ctrl.listIntents).toHaveBeenCalledWith(
			expect.not.objectContaining({ take: expect.anything() }),
		);
	});
});

// ── getIntentAdmin ────────────────────────────────────────────────────────────

describe("admin GET /payments/:id", () => {
	it("returns 404 when intent not found", async () => {
		const result = (await call(getIntentHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Payment intent not found");
	});

	it("returns intent when found", async () => {
		const intent = makeIntent({ id: "pi_1", status: "succeeded" });
		const ctrl = makeController({
			getIntent: vi.fn().mockResolvedValue(intent),
		});
		const result = (await call(getIntentHandler, {
			params: { id: "pi_1" },
			controller: ctrl,
		})) as { intent: PaymentIntent };
		expect(result.intent.id).toBe("pi_1");
		expect(result.intent.status).toBe("succeeded");
		expect(ctrl.getIntent).toHaveBeenCalledWith("pi_1");
	});
});

// ── listRefunds ───────────────────────────────────────────────────────────────

describe("admin GET /payments/:id/refunds", () => {
	it("returns empty list when no refunds exist", async () => {
		const result = (await call(listRefundsHandler, {
			params: { id: "pi_1" },
		})) as { refunds: Refund[] };
		expect(result.refunds).toHaveLength(0);
	});

	it("returns refunds for given intent id", async () => {
		const refunds = [
			makeRefund("pi_2", { amount: 500 }),
			makeRefund("pi_2", { amount: 1500 }),
		];
		const ctrl = makeController({
			listRefunds: vi.fn().mockResolvedValue(refunds),
		});
		const result = (await call(listRefundsHandler, {
			params: { id: "pi_2" },
			controller: ctrl,
		})) as { refunds: Refund[] };
		expect(result.refunds).toHaveLength(2);
		expect(ctrl.listRefunds).toHaveBeenCalledWith("pi_2");
	});
});

// ── createRefund ──────────────────────────────────────────────────────────────

describe("admin POST /payments/:id/refund", () => {
	it("returns 404 when intent not found", async () => {
		const result = (await call(createRefundHandler, {
			params: { id: "missing" },
			body: { amount: 1000 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Payment intent not found");
	});

	it("creates refund for existing intent and returns it", async () => {
		const intent = makeIntent({ id: "pi_3", status: "succeeded" });
		const refund = makeRefund("pi_3", { amount: 1200 });
		const ctrl = makeController({
			getIntent: vi.fn().mockResolvedValue(intent),
			createRefund: vi.fn().mockResolvedValue(refund),
		});
		const result = (await call(createRefundHandler, {
			params: { id: "pi_3" },
			body: { amount: 1200, reason: "Customer request" },
			controller: ctrl,
		})) as { refund: Refund };
		expect(result.refund.amount).toBe(1200);
		expect(ctrl.createRefund).toHaveBeenCalledWith(
			expect.objectContaining({
				intentId: "pi_3",
				amount: 1200,
				reason: "Customer request",
			}),
		);
	});
});
