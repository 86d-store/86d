import { describe, expect, it, vi } from "vitest";
import { activateAutomation } from "../admin/endpoints/activate-automation";
import { createAutomation } from "../admin/endpoints/create-automation";
import { deleteAutomation } from "../admin/endpoints/delete-automation";
import { duplicateAutomation } from "../admin/endpoints/duplicate-automation";
import { executeAutomation } from "../admin/endpoints/execute-automation";
import { getAutomation } from "../admin/endpoints/get-automation";
import { getExecution } from "../admin/endpoints/get-execution";
import { listAutomations } from "../admin/endpoints/list-automations";
import { listExecutions } from "../admin/endpoints/list-executions";
import { pauseAutomation } from "../admin/endpoints/pause-automation";
import { purgeExecutions } from "../admin/endpoints/purge-executions";
import { automationStats } from "../admin/endpoints/stats";
import { updateAutomation } from "../admin/endpoints/update-automation";
import type {
	Automation,
	AutomationExecution,
	AutomationStats,
	AutomationsController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeAutomation(overrides: Partial<Automation> = {}): Automation {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Welcome Email",
		status: "active",
		triggerEvent: "customer.created",
		conditions: [],
		actions: [],
		priority: 0,
		runCount: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeExecution(
	overrides: Partial<AutomationExecution> = {},
): AutomationExecution {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		automationId: "auto_1",
		triggerEvent: "customer.created",
		triggerPayload: {},
		status: "completed",
		results: [],
		startedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<AutomationsController> = {},
): AutomationsController {
	return {
		create: vi.fn().mockResolvedValue(makeAutomation()),
		getById: vi.fn().mockResolvedValue(null),
		list: vi.fn().mockResolvedValue({ automations: [], total: 0 }),
		update: vi.fn().mockResolvedValue(makeAutomation()),
		delete: vi.fn().mockResolvedValue(undefined),
		activate: vi.fn().mockResolvedValue(makeAutomation()),
		pause: vi.fn().mockResolvedValue(makeAutomation()),
		duplicate: vi.fn().mockResolvedValue(makeAutomation()),
		execute: vi.fn().mockResolvedValue(makeExecution()),
		evaluateEvent: vi.fn().mockResolvedValue([]),
		getExecution: vi.fn().mockResolvedValue(null),
		listExecutions: vi.fn().mockResolvedValue({ executions: [], total: 0 }),
		getStats: vi.fn().mockResolvedValue({
			totalAutomations: 0,
			activeAutomations: 0,
			totalExecutions: 0,
			executionsByStatus: {},
			topAutomations: [],
		} satisfies AutomationStats),
		purgeExecutions: vi.fn().mockResolvedValue(0),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: AutomationsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { automations: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listAutomations);
const createHandler = extractHandler(createAutomation);
const getHandler = extractHandler(getAutomation);
const updateHandler = extractHandler(updateAutomation);
const deleteHandler = extractHandler(deleteAutomation);
const activateHandler = extractHandler(activateAutomation);
const pauseHandler = extractHandler(pauseAutomation);
const duplicateHandler = extractHandler(duplicateAutomation);
const executeHandler = extractHandler(executeAutomation);
const listExecutionsHandler = extractHandler(listExecutions);
const getExecutionHandler = extractHandler(getExecution);
const purgeHandler = extractHandler(purgeExecutions);
const statsHandler = extractHandler(automationStats);

describe("admin GET /automations", () => {
	it("returns empty list", async () => {
		const result = (await call(listHandler)) as {
			automations: Automation[];
			total: number;
		};
		expect(result.automations).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { status: "active" }, controller: ctrl });
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});
});

describe("admin POST /automations/create", () => {
	it("creates automation and returns it", async () => {
		const auto = makeAutomation({ name: "Cart Abandon" });
		const ctrl = makeController({ create: vi.fn().mockResolvedValue(auto) });
		const result = (await call(createHandler, {
			body: {
				name: "Cart Abandon",
				triggerEvent: "cart.abandoned",
				conditions: [],
				actions: [{ type: "send_notification", config: {} }],
			},
			controller: ctrl,
		})) as { automation: Automation };
		expect(result.automation.name).toBe("Cart Abandon");
	});
});

describe("admin GET /automations/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns automation when found", async () => {
		const auto = makeAutomation({ id: "auto_1" });
		const ctrl = makeController({ getById: vi.fn().mockResolvedValue(auto) });
		const result = (await call(getHandler, {
			params: { id: "auto_1" },
			controller: ctrl,
		})) as { automation: Automation };
		expect(result.automation.id).toBe("auto_1");
	});
});

describe("admin POST /automations/:id/update", () => {
	it("updates automation and returns it", async () => {
		const auto = makeAutomation({ name: "Updated" });
		const ctrl = makeController({ update: vi.fn().mockResolvedValue(auto) });
		const result = (await call(updateHandler, {
			params: { id: auto.id },
			body: { name: "Updated" },
			controller: ctrl,
		})) as { automation: Automation };
		expect(result.automation.name).toBe("Updated");
	});
});

describe("admin DELETE /automations/:id", () => {
	it("deletes automation and returns success", async () => {
		const ctrl = makeController({
			delete: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deleteHandler, {
			params: { id: "auto_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin POST /automations/:id/activate", () => {
	it("returns 404 when not found", async () => {
		const ctrl = makeController({
			activate: vi.fn().mockRejectedValue(new Error("not found")),
		});
		const result = (await call(activateHandler, {
			params: { id: "missing" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("activates automation", async () => {
		const auto = makeAutomation({ status: "active" });
		const ctrl = makeController({ activate: vi.fn().mockResolvedValue(auto) });
		const result = (await call(activateHandler, {
			params: { id: auto.id },
			controller: ctrl,
		})) as { automation: Automation };
		expect(result.automation.status).toBe("active");
	});
});

describe("admin POST /automations/:id/pause", () => {
	it("pauses automation", async () => {
		const auto = makeAutomation({ status: "paused" });
		const ctrl = makeController({ pause: vi.fn().mockResolvedValue(auto) });
		const result = (await call(pauseHandler, {
			params: { id: auto.id },
			controller: ctrl,
		})) as { automation: Automation };
		expect(result.automation.status).toBe("paused");
	});
});

describe("admin POST /automations/:id/duplicate", () => {
	it("duplicates automation", async () => {
		const auto = makeAutomation({ name: "Welcome Email (copy)" });
		const ctrl = makeController({ duplicate: vi.fn().mockResolvedValue(auto) });
		const result = (await call(duplicateHandler, {
			params: { id: "auto_1" },
			controller: ctrl,
		})) as { automation: Automation };
		expect(result.automation.name).toBe("Welcome Email (copy)");
	});
});

describe("admin POST /automations/:id/execute", () => {
	it("returns 404 when not found", async () => {
		const ctrl = makeController({
			execute: vi.fn().mockRejectedValue(new Error("not found")),
		});
		const result = (await call(executeHandler, {
			params: { id: "missing" },
			body: { payload: {} },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("executes automation and returns execution", async () => {
		const exec = makeExecution({ automationId: "auto_1" });
		const ctrl = makeController({ execute: vi.fn().mockResolvedValue(exec) });
		const result = (await call(executeHandler, {
			params: { id: "auto_1" },
			body: { payload: { customerId: "c1" } },
			controller: ctrl,
		})) as { execution: AutomationExecution };
		expect(result.execution.automationId).toBe("auto_1");
	});
});

describe("admin GET /automations/executions", () => {
	it("returns empty list", async () => {
		const result = (await call(listExecutionsHandler)) as {
			executions: AutomationExecution[];
		};
		expect(result.executions).toHaveLength(0);
	});
});

describe("admin GET /automations/executions/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getExecutionHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns execution when found", async () => {
		const exec = makeExecution({ id: "exec_1" });
		const ctrl = makeController({
			getExecution: vi.fn().mockResolvedValue(exec),
		});
		const result = (await call(getExecutionHandler, {
			params: { id: "exec_1" },
			controller: ctrl,
		})) as { execution: AutomationExecution };
		expect(result.execution.id).toBe("exec_1");
	});
});

describe("admin POST /automations/executions/purge", () => {
	it("purges old executions and returns count", async () => {
		const ctrl = makeController({
			purgeExecutions: vi.fn().mockResolvedValue(15),
		});
		const result = (await call(purgeHandler, {
			body: { olderThanDays: 30 },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(15);
	});
});

describe("admin GET /automations/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as AutomationStats;
		expect(result.totalAutomations).toBe(0);
	});

	it("returns real stats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalAutomations: 12,
				activeAutomations: 8,
				totalExecutions: 450,
				executionsByStatus: { success: 420, failed: 30 },
				topAutomations: [{ id: "a1", name: "Welcome", runCount: 150 }],
			}),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as AutomationStats;
		expect(result.totalAutomations).toBe(12);
	});
});
