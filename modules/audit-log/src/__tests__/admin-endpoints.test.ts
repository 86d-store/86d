import { describe, expect, it, vi } from "vitest";
import { actorHistory } from "../admin/endpoints/actor-history";
import { getEntry } from "../admin/endpoints/get-entry";
import { listEntries } from "../admin/endpoints/list-entries";
import { purge } from "../admin/endpoints/purge";
import { resourceHistory } from "../admin/endpoints/resource-history";
import { summary } from "../admin/endpoints/summary";
import type { AuditEntry, AuditLogController, AuditSummary } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
	return {
		id: crypto.randomUUID(),
		action: "create",
		resource: "products",
		actorType: "admin",
		description: "Created product",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<AuditLogController> = {},
): AuditLogController {
	return {
		log: vi.fn().mockResolvedValue(makeEntry()),
		getById: vi.fn().mockResolvedValue(null),
		list: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
		listForResource: vi.fn().mockResolvedValue([]),
		listForActor: vi.fn().mockResolvedValue([]),
		getSummary: vi.fn().mockResolvedValue({
			totalEntries: 0,
			entriesByAction: {},
			entriesByResource: {},
			recentActors: [],
		} satisfies AuditSummary),
		purge: vi.fn().mockResolvedValue(0),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: AuditLogController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { "audit-log": opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listEntriesHandler = extractHandler(listEntries);
const getEntryHandler = extractHandler(getEntry);
const resourceHistoryHandler = extractHandler(resourceHistory);
const actorHistoryHandler = extractHandler(actorHistory);
const summaryHandler = extractHandler(summary);
const purgeHandler = extractHandler(purge);

// ── listEntries ───────────────────────────────────────────────────────────────

describe("admin GET /audit-log/entries", () => {
	it("returns empty list when no entries exist", async () => {
		const result = (await call(listEntriesHandler)) as {
			entries: AuditEntry[];
			total: number;
		};
		expect(result.entries).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns entries from controller", async () => {
		const entries = [
			makeEntry({ action: "create" }),
			makeEntry({ action: "update" }),
		];
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue({ entries, total: 2 }),
		});
		const result = (await call(listEntriesHandler, { controller: ctrl })) as {
			entries: AuditEntry[];
			total: number;
		};
		expect(result.entries).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

// ── getEntry ──────────────────────────────────────────────────────────────────

describe("admin GET /audit-log/entries/:id", () => {
	it("returns 404 when entry not found", async () => {
		const result = (await call(getEntryHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns entry when found", async () => {
		const entry = makeEntry({ id: "entry_1", action: "delete" });
		const ctrl = makeController({ getById: vi.fn().mockResolvedValue(entry) });
		const result = (await call(getEntryHandler, {
			params: { id: "entry_1" },
			controller: ctrl,
		})) as { entry: AuditEntry };
		expect(result.entry.id).toBe("entry_1");
		expect(result.entry.action).toBe("delete");
	});
});

// ── resourceHistory ───────────────────────────────────────────────────────────

describe("admin GET /audit-log/resource/:resource/:resourceId", () => {
	it("returns empty entries when no history for resource", async () => {
		const result = (await call(resourceHistoryHandler, {
			params: { resource: "products", resourceId: "prod_1" },
		})) as { entries: AuditEntry[] };
		expect(result.entries).toHaveLength(0);
	});

	it("returns entries for resource", async () => {
		const entries = [makeEntry({ resource: "products", resourceId: "prod_1" })];
		const ctrl = makeController({
			listForResource: vi.fn().mockResolvedValue(entries),
		});
		const result = (await call(resourceHistoryHandler, {
			params: { resource: "products", resourceId: "prod_1" },
			controller: ctrl,
		})) as { entries: AuditEntry[] };
		expect(result.entries).toHaveLength(1);
		expect(ctrl.listForResource).toHaveBeenCalledWith(
			"products",
			"prod_1",
			expect.anything(),
		);
	});
});

// ── actorHistory ──────────────────────────────────────────────────────────────

describe("admin GET /audit-log/actor/:actorId", () => {
	it("returns empty entries when actor has no history", async () => {
		const result = (await call(actorHistoryHandler, {
			params: { actorId: "user_1" },
		})) as { entries: AuditEntry[] };
		expect(result.entries).toHaveLength(0);
	});

	it("returns entries for actor", async () => {
		const entries = [
			makeEntry({ actorId: "user_1" }),
			makeEntry({ actorId: "user_1" }),
		];
		const ctrl = makeController({
			listForActor: vi.fn().mockResolvedValue(entries),
		});
		const result = (await call(actorHistoryHandler, {
			params: { actorId: "user_1" },
			controller: ctrl,
		})) as { entries: AuditEntry[] };
		expect(result.entries).toHaveLength(2);
		expect(ctrl.listForActor).toHaveBeenCalledWith("user_1", expect.anything());
	});
});

// ── summary ───────────────────────────────────────────────────────────────────

describe("admin GET /audit-log/summary", () => {
	it("returns zero-state summary", async () => {
		const result = (await call(summaryHandler)) as AuditSummary;
		expect(result.totalEntries).toBe(0);
		expect(result.recentActors).toHaveLength(0);
	});

	it("returns real summary from controller", async () => {
		const auditSummary: AuditSummary = {
			totalEntries: 500,
			entriesByAction: { create: 200, update: 200, delete: 100 },
			entriesByResource: { products: 300, orders: 200 },
			recentActors: [
				{ actorId: "user_1", actorEmail: "admin@test.com", count: 50 },
			],
		};
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue(auditSummary),
		});
		const result = (await call(summaryHandler, {
			controller: ctrl,
		})) as AuditSummary;
		expect(result.totalEntries).toBe(500);
		expect(result.recentActors).toHaveLength(1);
	});
});

// ── purge ─────────────────────────────────────────────────────────────────────

describe("admin POST /audit-log/purge", () => {
	it("purges entries and returns deleted count and cutoff date", async () => {
		const ctrl = makeController({ purge: vi.fn().mockResolvedValue(42) });
		const result = (await call(purgeHandler, {
			body: { olderThanDays: 90 },
			controller: ctrl,
		})) as { deleted: number; cutoffDate: string };
		expect(result.deleted).toBe(42);
		expect(result.cutoffDate).toBeDefined();
	});
});
