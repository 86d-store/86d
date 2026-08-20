import { describe, expect, it, vi } from "vitest";
import { bulkExpire } from "../admin/endpoints/bulk-expire";
import { deleteAbandoned } from "../admin/endpoints/delete-abandoned";
import { dismissCart } from "../admin/endpoints/dismiss-cart";
import { getAbandoned } from "../admin/endpoints/get-abandoned";
import { getStats } from "../admin/endpoints/get-stats";
import { listAbandoned } from "../admin/endpoints/list-abandoned";
import { sendRecovery } from "../admin/endpoints/send-recovery";
import type {
	AbandonedCart,
	AbandonedCartController,
	AbandonedCartStats,
	RecoveryAttempt,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeCart(overrides: Partial<AbandonedCart> = {}): AbandonedCart {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		cartId: "cart_1",
		items: [{ productId: "prod_1", name: "Widget", quantity: 1, price: 1000 }],
		cartTotal: 1000,
		currency: "USD",
		status: "active",
		recoveryToken: crypto.randomUUID(),
		attemptCount: 0,
		lastActivityAt: now,
		abandonedAt: now,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeAttempt(
	overrides: Partial<RecoveryAttempt> = {},
): RecoveryAttempt {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		abandonedCartId: "cart_1",
		channel: "email",
		recipient: "customer@example.com",
		status: "sent",
		sentAt: now,
		createdAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<AbandonedCartController> = {},
): AbandonedCartController {
	return {
		create: vi.fn().mockResolvedValue(makeCart()),
		get: vi.fn().mockResolvedValue(null),
		getByToken: vi.fn().mockResolvedValue(null),
		getByCartId: vi.fn().mockResolvedValue(null),
		list: vi.fn().mockResolvedValue([]),
		markRecovered: vi.fn().mockResolvedValue(null),
		markExpired: vi.fn().mockResolvedValue(null),
		dismiss: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(false),
		recordAttempt: vi.fn().mockResolvedValue(makeAttempt()),
		updateAttemptStatus: vi.fn().mockResolvedValue(null),
		listAttempts: vi.fn().mockResolvedValue([]),
		getWithAttempts: vi.fn().mockResolvedValue(null),
		getStats: vi.fn().mockResolvedValue({
			totalAbandoned: 0,
			totalRecovered: 0,
			totalExpired: 0,
			totalDismissed: 0,
			recoveryRate: 0,
			totalRecoveredValue: 0,
		} satisfies AbandonedCartStats),
		countAll: vi.fn().mockResolvedValue(0),
		bulkExpire: vi.fn().mockResolvedValue(0),
		getOptions: vi.fn().mockResolvedValue({}),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: AbandonedCartController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { abandonedCarts: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const bulkExpireHandler = extractHandler(bulkExpire);
const deleteAbandonedHandler = extractHandler(deleteAbandoned);
const dismissCartHandler = extractHandler(dismissCart);
const getAbandonedHandler = extractHandler(getAbandoned);
const getStatsHandler = extractHandler(getStats);
const listAbandonedHandler = extractHandler(listAbandoned);
const sendRecoveryHandler = extractHandler(sendRecovery);

// ── admin POST /abandoned-carts/bulk-expire ───────────────────────────────────

describe("admin POST /abandoned-carts/bulk-expire", () => {
	it("expires old carts and returns count", async () => {
		const ctrl = makeController({
			bulkExpire: vi.fn().mockResolvedValue(5),
		});
		const result = (await call(bulkExpireHandler, {
			body: { olderThanDays: 30 },
			controller: ctrl,
		})) as { expired: number };
		expect(result.expired).toBe(5);
		expect(ctrl.bulkExpire).toHaveBeenCalledWith(30);
	});

	it("expires all eligible carts when olderThanDays is omitted", async () => {
		const ctrl = makeController({
			bulkExpire: vi.fn().mockResolvedValue(12),
		});
		const result = (await call(bulkExpireHandler, {
			body: {},
			controller: ctrl,
		})) as { expired: number };
		expect(result.expired).toBe(12);
	});

	it("returns 0 when no carts are eligible", async () => {
		const ctrl = makeController({
			bulkExpire: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(bulkExpireHandler, {
			body: { olderThanDays: 7 },
			controller: ctrl,
		})) as { expired: number };
		expect(result.expired).toBe(0);
	});
});

// ── admin POST /abandoned-carts/:id/delete ────────────────────────────────────

describe("admin POST /abandoned-carts/:id/delete", () => {
	it("returns 404 when cart not found", async () => {
		const result = (await call(deleteAbandonedHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes cart and returns deleted: true", async () => {
		const cart = makeCart({ id: "ac_1" });
		const ctrl = makeController({
			get: vi.fn().mockResolvedValue(cart),
			delete: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteAbandonedHandler, {
			params: { id: "ac_1" },
			controller: ctrl,
		})) as { deleted: true };
		expect(result.deleted).toBe(true);
		expect(ctrl.delete).toHaveBeenCalledWith("ac_1");
	});
});

// ── admin POST /abandoned-carts/:id/dismiss ───────────────────────────────────

describe("admin POST /abandoned-carts/:id/dismiss", () => {
	it("returns 404 when cart not found", async () => {
		const result = (await call(dismissCartHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("dismisses cart and returns updated cart", async () => {
		const cart = makeCart({ id: "ac_2", status: "dismissed" });
		const ctrl = makeController({
			dismiss: vi.fn().mockResolvedValue(cart),
		});
		const result = (await call(dismissCartHandler, {
			params: { id: "ac_2" },
			controller: ctrl,
		})) as { cart: AbandonedCart };
		expect(result.cart.id).toBe("ac_2");
		expect(result.cart.status).toBe("dismissed");
		expect(ctrl.dismiss).toHaveBeenCalledWith("ac_2");
	});
});

// ── admin GET /abandoned-carts/:id ───────────────────────────────────────────

describe("admin GET /abandoned-carts/:id", () => {
	it("returns 404 when cart not found", async () => {
		const result = (await call(getAbandonedHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns cart when found", async () => {
		const cart = makeCart({ id: "ac_3" });
		const ctrl = makeController({
			getWithAttempts: vi.fn().mockResolvedValue(cart),
		});
		const result = (await call(getAbandonedHandler, {
			params: { id: "ac_3" },
			controller: ctrl,
		})) as { cart: AbandonedCart };
		expect(result.cart.id).toBe("ac_3");
		expect(ctrl.getWithAttempts).toHaveBeenCalledWith("ac_3");
	});
});

// ── admin GET /abandoned-carts/stats ─────────────────────────────────────────

describe("admin GET /abandoned-carts/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(getStatsHandler)) as {
			stats: AbandonedCartStats;
		};
		expect(result.stats.totalAbandoned).toBe(0);
		expect(result.stats.totalRecovered).toBe(0);
		expect(result.stats.recoveryRate).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalAbandoned: 200,
				totalRecovered: 40,
				totalExpired: 100,
				totalDismissed: 20,
				recoveryRate: 0.2,
				totalRecoveredValue: 48000,
			}),
		});
		const result = (await call(getStatsHandler, {
			controller: ctrl,
		})) as { stats: AbandonedCartStats };
		expect(result.stats.totalAbandoned).toBe(200);
		expect(result.stats.totalRecovered).toBe(40);
		expect(result.stats.recoveryRate).toBe(0.2);
		expect(result.stats.totalRecoveredValue).toBe(48000);
	});
});

// ── admin GET /abandoned-carts ────────────────────────────────────────────────

describe("admin GET /abandoned-carts", () => {
	it("returns empty list when no carts exist", async () => {
		const result = (await call(listAbandonedHandler)) as {
			carts: AbandonedCart[];
			total: number;
		};
		expect(result.carts).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns carts from controller", async () => {
		const carts = [makeCart(), makeCart({ cartId: "cart_2" })];
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue(carts),
			countAll: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listAbandonedHandler, {
			controller: ctrl,
		})) as { carts: AbandonedCart[]; total: number };
		expect(result.carts).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue([]),
			countAll: vi.fn().mockResolvedValue(0),
		});
		await call(listAbandonedHandler, {
			query: { status: "abandoned" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ status: "abandoned" }),
		);
	});
});

// ── admin POST /abandoned-carts/:id/send-recovery ────────────────────────────

describe("admin POST /abandoned-carts/:id/send-recovery", () => {
	it("returns 404 when cart not found", async () => {
		const result = (await call(sendRecoveryHandler, {
			params: { id: "missing" },
			body: { channel: "email", recipient: "buyer@example.com" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("sends recovery and returns attempt", async () => {
		const cart = makeCart({ id: "ac_4" });
		const attempt = makeAttempt({
			abandonedCartId: "ac_4",
			channel: "email",
			status: "sent",
		});
		const ctrl = makeController({
			get: vi.fn().mockResolvedValue(cart),
			getOptions: vi.fn().mockReturnValue({ maxRecoveryAttempts: 3 }),
			recordAttempt: vi.fn().mockResolvedValue(attempt),
		});
		const result = (await call(sendRecoveryHandler, {
			params: { id: "ac_4" },
			body: { channel: "email", recipient: "buyer@example.com" },
			controller: ctrl,
		})) as { attempt: RecoveryAttempt };
		expect(result.attempt.abandonedCartId).toBe("ac_4");
		expect(result.attempt.status).toBe("sent");
		expect(ctrl.recordAttempt).toHaveBeenCalledWith(
			expect.objectContaining({ abandonedCartId: "ac_4" }),
		);
	});
});
