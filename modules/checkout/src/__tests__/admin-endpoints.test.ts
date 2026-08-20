import { describe, expect, it, vi } from "vitest";
import { adminExpireStale } from "../admin/endpoints/expire-stale";
import { adminGetSession } from "../admin/endpoints/get-session";
import { adminGetStats } from "../admin/endpoints/get-stats";
import { adminListSessions } from "../admin/endpoints/list-sessions";
import type { CheckoutController, CheckoutSession } from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeSession(
	overrides: Partial<CheckoutSession> = {},
): CheckoutSession {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		status: "pending",
		subtotal: 5000,
		taxAmount: 400,
		shippingAmount: 800,
		discountAmount: 0,
		giftCardAmount: 0,
		storeCreditAmount: 0,
		total: 6200,
		currency: "USD",
		expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<CheckoutController> = {},
): CheckoutController {
	return {
		create: vi.fn().mockResolvedValue(makeSession()),
		getById: vi.fn().mockResolvedValue(null),
		update: vi.fn().mockResolvedValue(makeSession()),
		applyDiscount: vi.fn().mockResolvedValue(makeSession()),
		removeDiscount: vi.fn().mockResolvedValue(makeSession()),
		applyGiftCard: vi.fn().mockResolvedValue(makeSession()),
		removeGiftCard: vi.fn().mockResolvedValue(makeSession()),
		applyStoreCredit: vi.fn().mockResolvedValue(makeSession()),
		removeStoreCredit: vi.fn().mockResolvedValue(makeSession()),
		confirm: vi.fn().mockResolvedValue(makeSession()),
		setPaymentIntent: vi.fn().mockResolvedValue(makeSession()),
		complete: vi.fn().mockResolvedValue(makeSession()),
		abandon: vi.fn().mockResolvedValue(makeSession()),
		expireStale: vi
			.fn()
			.mockResolvedValue({ expired: 0, processingSessions: [] }),
		getLineItems: vi.fn().mockResolvedValue([]),
		listSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
		getStats: vi.fn().mockResolvedValue({
			total: 0,
			pending: 0,
			processing: 0,
			completed: 0,
			abandoned: 0,
			expired: 0,
			conversionRate: 0,
			totalRevenue: 0,
			averageOrderValue: 0,
		}),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, unknown>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: CheckoutController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { checkout: opts.controller ?? makeController() } },
	});
}

const listHandler = extractHandler(adminListSessions);
const getHandler = extractHandler(adminGetSession);
const statsHandler = extractHandler(adminGetStats);
const expireHandler = extractHandler(adminExpireStale);

// ── admin GET /checkout/sessions ──────────────────────────────────────────────

describe("admin GET /checkout/sessions", () => {
	it("returns empty sessions with pagination defaults", async () => {
		const result = (await call(listHandler)) as {
			sessions: CheckoutSession[];
			total: number;
			page: number;
			limit: number;
		};
		expect(result.sessions).toHaveLength(0);
		expect(result.total).toBe(0);
		expect(result.page).toBe(1);
		expect(result.limit).toBe(20);
	});

	it("returns sessions from controller", async () => {
		const sessions = [makeSession(), makeSession({ status: "completed" })];
		const ctrl = makeController({
			listSessions: vi.fn().mockResolvedValue({ sessions, total: 2 }),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			sessions: CheckoutSession[];
			total: number;
		};
		expect(result.sessions).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "completed" },
			controller: ctrl,
		});
		expect(ctrl.listSessions).toHaveBeenCalledWith(
			expect.objectContaining({ status: "completed" }),
		);
	});

	it("calculates total pages", async () => {
		const ctrl = makeController({
			listSessions: vi.fn().mockResolvedValue({ sessions: [], total: 45 }),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			total: number;
			pages: number;
		};
		expect(result.total).toBe(45);
		expect(result.pages).toBe(3);
	});
});

// ── admin GET /checkout/sessions/:id ─────────────────────────────────────────

describe("admin GET /checkout/sessions/:id", () => {
	it("returns 404 when session not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Checkout session not found");
	});

	it("returns session with line items when found", async () => {
		const session = makeSession({ id: "cs_1" });
		const lineItems = [
			{ productId: "prod_1", name: "Widget", price: 2500, quantity: 2 },
		];
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(session),
			getLineItems: vi.fn().mockResolvedValue(lineItems),
		});
		const result = (await call(getHandler, {
			params: { id: "cs_1" },
			controller: ctrl,
		})) as { session: CheckoutSession; lineItems: typeof lineItems };
		expect(result.session.id).toBe("cs_1");
		expect(result.lineItems).toHaveLength(1);
		expect(ctrl.getById).toHaveBeenCalledWith("cs_1");
		expect(ctrl.getLineItems).toHaveBeenCalledWith("cs_1");
	});
});

// ── admin GET /checkout/stats ─────────────────────────────────────────────────

describe("admin GET /checkout/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as {
			total: number;
			conversionRate: number;
			totalRevenue: number;
		};
		expect(result.total).toBe(0);
		expect(result.conversionRate).toBe(0);
		expect(result.totalRevenue).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				total: 1000,
				pending: 50,
				processing: 20,
				completed: 800,
				abandoned: 100,
				expired: 30,
				conversionRate: 0.8,
				totalRevenue: 4800000,
				averageOrderValue: 6000,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			total: number;
			completed: number;
			conversionRate: number;
			totalRevenue: number;
		};
		expect(result.total).toBe(1000);
		expect(result.completed).toBe(800);
		expect(result.conversionRate).toBe(0.8);
		expect(result.totalRevenue).toBe(4800000);
	});
});

// ── admin POST /checkout/expire-stale ─────────────────────────────────────────

describe("admin POST /checkout/expire-stale", () => {
	it("requires the durable expiry workflow without owner-local effects", async () => {
		const ctrl = makeController();
		const result = await call(expireHandler, { controller: ctrl });

		expect(result).toEqual({
			code: "CHECKOUT_EXPIRY_WORKFLOW_REQUIRED",
			error:
				"Checkout expiry is unavailable until reservation release and payment reconciliation run as a durable workflow.",
			status: 503,
		});
		expect(ctrl.expireStale).not.toHaveBeenCalled();
	});
});
