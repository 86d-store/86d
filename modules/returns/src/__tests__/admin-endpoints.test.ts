import { describe, expect, it, vi } from "vitest";
import { approveReturn } from "../admin/endpoints/approve-return";
import { cancelReturn } from "../admin/endpoints/cancel-return";
import { completeReturn } from "../admin/endpoints/complete-return";
import { getReturn } from "../admin/endpoints/get-return";
import { listReturns } from "../admin/endpoints/list-returns";
import { markReceived } from "../admin/endpoints/mark-received";
import { rejectReturn } from "../admin/endpoints/reject-return";
import { returnSummary } from "../admin/endpoints/return-summary";
import { updateTracking } from "../admin/endpoints/update-tracking";
import type {
	RefundMethod,
	ReturnController,
	ReturnItem,
	ReturnRequest,
	ReturnRequestWithItems,
	ReturnStatus,
	ReturnSummary,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeReturnRequest(
	overrides: Partial<ReturnRequest> = {},
): ReturnRequest {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		orderId: "order-1",
		customerId: "cust-1",
		status: "requested" as ReturnStatus,
		refundMethod: "original_payment" as RefundMethod,
		refundAmount: 2500,
		currency: "USD",
		reason: "Item arrived damaged",
		requestedAt: now,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeReturnItem(overrides: Partial<ReturnItem> = {}): ReturnItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		returnRequestId: "ret-1",
		orderItemId: "item-1",
		productName: "Blue T-Shirt",
		quantity: 1,
		unitPrice: 2500,
		reason: "damaged",
		condition: "damaged",
		createdAt: now,
		...overrides,
	};
}

function makeReturnWithItems(
	overrides: Partial<ReturnRequestWithItems> = {},
): ReturnRequestWithItems {
	return {
		...makeReturnRequest(),
		items: [makeReturnItem()],
		...overrides,
	};
}

function makeController(
	overrides: Partial<ReturnController> = {},
): ReturnController {
	return {
		create: vi.fn().mockResolvedValue(makeReturnWithItems()),
		getById: vi.fn().mockResolvedValue(null),
		getByOrderId: vi.fn().mockResolvedValue([]),
		getByCustomerId: vi.fn().mockResolvedValue([]),
		approve: vi.fn().mockResolvedValue(null),
		reject: vi.fn().mockResolvedValue(null),
		markReceived: vi.fn().mockResolvedValue(null),
		complete: vi.fn().mockResolvedValue(null),
		cancel: vi.fn().mockResolvedValue(null),
		updateTracking: vi.fn().mockResolvedValue(null),
		list: vi.fn().mockResolvedValue([]),
		getSummary: vi.fn().mockResolvedValue({
			totalRequests: 0,
			requested: 0,
			approved: 0,
			completed: 0,
			rejected: 0,
			totalRefundAmount: 0,
		} satisfies ReturnSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ReturnController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { returns: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listReturns);
const summaryHandler = extractHandler(returnSummary);
const getHandler = extractHandler(getReturn);
const approveHandler = extractHandler(approveReturn);
const rejectHandler = extractHandler(rejectReturn);
const receivedHandler = extractHandler(markReceived);
const completeHandler = extractHandler(completeReturn);
const cancelHandler = extractHandler(cancelReturn);
const trackingHandler = extractHandler(updateTracking);

// ── admin GET /returns ────────────────────────────────────────────────────────

describe("admin GET /returns", () => {
	it("returns empty list when no returns exist", async () => {
		const result = (await call(listHandler)) as {
			returns: ReturnRequest[];
		};
		expect(result.returns).toHaveLength(0);
	});

	it("returns returns from controller", async () => {
		const returns = [makeReturnRequest(), makeReturnRequest()];
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue(returns),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			returns: ReturnRequest[];
		};
		expect(result.returns).toHaveLength(2);
	});

	it("passes status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "approved" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ status: "approved" }),
		);
	});

	it("passes pagination params to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { take: "10", skip: "20" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ take: 10, skip: 20 }),
		);
	});
});

// ── admin GET /returns/summary ────────────────────────────────────────────────

describe("admin GET /returns/summary", () => {
	it("returns summary from controller", async () => {
		const summary: ReturnSummary = {
			totalRequests: 42,
			requested: 10,
			approved: 15,
			completed: 12,
			rejected: 5,
			totalRefundAmount: 75000,
		};
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue(summary),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: ReturnSummary;
		};
		expect(result.summary.totalRequests).toBe(42);
		expect(result.summary.approved).toBe(15);
		expect(result.summary.totalRefundAmount).toBe(75000);
		expect(ctrl.getSummary).toHaveBeenCalled();
	});

	it("returns zero-state summary", async () => {
		const result = (await call(summaryHandler)) as { summary: ReturnSummary };
		expect(result.summary.totalRequests).toBe(0);
		expect(result.summary.totalRefundAmount).toBe(0);
	});
});

// ── admin GET /returns/:id ────────────────────────────────────────────────────

describe("admin GET /returns/:id", () => {
	it("returns 404 with status when return not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "nonexistent" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Return request not found");
		expect(result.status).toBe(404);
	});

	it("returns return with items when found", async () => {
		const returnWithItems = makeReturnWithItems({ id: "ret-1" });
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(returnWithItems),
		});
		const result = (await call(getHandler, {
			params: { id: "ret-1" },
			controller: ctrl,
		})) as { return: ReturnRequestWithItems };
		expect(result.return.id).toBe("ret-1");
		expect(result.return.items).toHaveLength(1);
		expect(ctrl.getById).toHaveBeenCalledWith("ret-1");
	});
});

// ── admin POST /returns/:id/approve ──────────────────────────────────────────

describe("admin POST /returns/:id/approve", () => {
	it("returns 404 with status when return not found", async () => {
		const result = (await call(approveHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string; status: number };
		expect(result.error).toBe("Return request not found");
		expect(result.status).toBe(404);
	});

	it("approves the return and returns it", async () => {
		const approved = makeReturnRequest({ id: "ret-2", status: "approved" });
		const ctrl = makeController({
			approve: vi.fn().mockResolvedValue(approved),
		});
		const result = (await call(approveHandler, {
			params: { id: "ret-2" },
			body: {},
			controller: ctrl,
		})) as { return: ReturnRequest };
		expect(result.return.status).toBe("approved");
		expect(ctrl.approve).toHaveBeenCalledWith("ret-2", undefined);
	});

	it("forwards adminNotes to controller", async () => {
		const ctrl = makeController({
			approve: vi.fn().mockResolvedValue(makeReturnRequest()),
		});
		await call(approveHandler, {
			params: { id: "ret-3" },
			body: { adminNotes: "Looks good" },
			controller: ctrl,
		});
		expect(ctrl.approve).toHaveBeenCalledWith("ret-3", "Looks good");
	});
});

// ── admin POST /returns/:id/reject ───────────────────────────────────────────

describe("admin POST /returns/:id/reject", () => {
	it("returns 404 with status when return not found", async () => {
		const result = (await call(rejectHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string; status: number };
		expect(result.error).toBe("Return request not found");
		expect(result.status).toBe(404);
	});

	it("rejects the return and returns it", async () => {
		const rejected = makeReturnRequest({ id: "ret-4", status: "rejected" });
		const ctrl = makeController({
			reject: vi.fn().mockResolvedValue(rejected),
		});
		const result = (await call(rejectHandler, {
			params: { id: "ret-4" },
			body: {},
			controller: ctrl,
		})) as { return: ReturnRequest };
		expect(result.return.status).toBe("rejected");
		expect(ctrl.reject).toHaveBeenCalledWith("ret-4", undefined);
	});

	it("forwards adminNotes to controller", async () => {
		const ctrl = makeController({
			reject: vi.fn().mockResolvedValue(makeReturnRequest()),
		});
		await call(rejectHandler, {
			params: { id: "ret-5" },
			body: { adminNotes: "Outside return window" },
			controller: ctrl,
		});
		expect(ctrl.reject).toHaveBeenCalledWith("ret-5", "Outside return window");
	});
});

// ── admin POST /returns/:id/received ─────────────────────────────────────────

describe("admin POST /returns/:id/received", () => {
	it("keeps receipt and restock effects contained across retries", async () => {
		const controller = makeController();
		const request = () =>
			call(receivedHandler, {
				params: { id: "ret-6" },
				controller,
			});

		await expect(request()).resolves.toMatchObject({
			code: "RETURN_RECEIPT_WORKFLOW_REQUIRED",
			status: 503,
		});
		await expect(request()).resolves.toMatchObject({
			code: "RETURN_RECEIPT_WORKFLOW_REQUIRED",
			status: 503,
		});
		expect(controller.markReceived).not.toHaveBeenCalled();
	});
});

// ── admin POST /returns/:id/complete ─────────────────────────────────────────

describe("admin POST /returns/:id/complete", () => {
	it("keeps refund and downstream adjustments contained across retries", async () => {
		const controller = makeController();
		const request = () =>
			call(completeHandler, {
				params: { id: "ret-7" },
				body: { refundAmount: 3_000 },
				controller,
			});

		await expect(request()).resolves.toMatchObject({
			code: "RETURN_COMPLETION_WORKFLOW_REQUIRED",
			status: 503,
		});
		await expect(request()).resolves.toMatchObject({
			code: "RETURN_COMPLETION_WORKFLOW_REQUIRED",
			status: 503,
		});
		expect(controller.complete).not.toHaveBeenCalled();
	});
});

// ── admin POST /returns/:id/cancel ───────────────────────────────────────────

describe("admin POST /returns/:id/cancel", () => {
	it("returns 404 with status when return not found", async () => {
		const result = (await call(cancelHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Return request not found");
		expect(result.status).toBe(404);
	});

	it("cancels the return and returns it", async () => {
		const cancelled = makeReturnRequest({ id: "ret-8", status: "cancelled" });
		const ctrl = makeController({
			cancel: vi.fn().mockResolvedValue(cancelled),
		});
		const result = (await call(cancelHandler, {
			params: { id: "ret-8" },
			controller: ctrl,
		})) as { return: ReturnRequest };
		expect(result.return.status).toBe("cancelled");
		expect(ctrl.cancel).toHaveBeenCalledWith("ret-8");
	});
});

// ── admin POST /returns/:id/tracking ─────────────────────────────────────────

describe("admin POST /returns/:id/tracking", () => {
	it("returns 404 with status when return not found", async () => {
		const result = (await call(trackingHandler, {
			params: { id: "missing" },
			body: { trackingNumber: "1Z999AA1" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Return request not found");
		expect(result.status).toBe(404);
	});

	it("updates tracking number and returns the return", async () => {
		const updated = makeReturnRequest({
			id: "ret-9",
			trackingNumber: "1Z999AA1",
			trackingCarrier: "UPS",
		});
		const ctrl = makeController({
			updateTracking: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(trackingHandler, {
			params: { id: "ret-9" },
			body: { trackingNumber: "1Z999AA1", carrier: "UPS" },
			controller: ctrl,
		})) as { return: ReturnRequest };
		expect(result.return.trackingNumber).toBe("1Z999AA1");
		expect(result.return.trackingCarrier).toBe("UPS");
		expect(ctrl.updateTracking).toHaveBeenCalledWith(
			"ret-9",
			"1Z999AA1",
			"UPS",
		);
	});

	it("updates tracking without carrier", async () => {
		const ctrl = makeController({
			updateTracking: vi.fn().mockResolvedValue(makeReturnRequest()),
		});
		await call(trackingHandler, {
			params: { id: "ret-10" },
			body: { trackingNumber: "TRACK123" },
			controller: ctrl,
		});
		expect(ctrl.updateTracking).toHaveBeenCalledWith(
			"ret-10",
			"TRACK123",
			undefined,
		);
	});
});
