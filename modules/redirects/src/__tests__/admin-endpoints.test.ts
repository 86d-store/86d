import { describe, expect, it, vi } from "vitest";
import { bulkDeleteRedirects } from "../admin/endpoints/bulk-delete";
import { createRedirect } from "../admin/endpoints/create-redirect";
import { deleteRedirect } from "../admin/endpoints/delete-redirect";
import { getRedirect } from "../admin/endpoints/get-redirect";
import { getStats } from "../admin/endpoints/get-stats";
import { listRedirects } from "../admin/endpoints/list-redirects";
import { testRedirect } from "../admin/endpoints/test-redirect";
import { updateRedirect } from "../admin/endpoints/update-redirect";
import type { Redirect, RedirectController, RedirectStats } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeRedirect(overrides: Partial<Redirect> = {}): Redirect {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		sourcePath: "/old-path",
		targetPath: "/new-path",
		statusCode: 301,
		isActive: true,
		isRegex: false,
		preserveQueryString: false,
		hitCount: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<RedirectController> = {},
): RedirectController {
	return {
		createRedirect: vi.fn().mockResolvedValue(makeRedirect()),
		getRedirect: vi.fn().mockResolvedValue(null),
		updateRedirect: vi.fn().mockResolvedValue(null),
		deleteRedirect: vi.fn().mockResolvedValue(false),
		listRedirects: vi.fn().mockResolvedValue([]),
		countRedirects: vi.fn().mockResolvedValue(0),
		resolve: vi.fn().mockResolvedValue(null),
		recordHit: vi.fn().mockResolvedValue(undefined),
		bulkDelete: vi.fn().mockResolvedValue(0),
		testPath: vi.fn().mockResolvedValue({ matched: false }),
		getStats: vi.fn().mockResolvedValue({
			totalRedirects: 0,
			activeRedirects: 0,
			totalHits: 0,
			topRedirects: [],
		} satisfies RedirectStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: RedirectController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { redirects: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const bulkDeleteHandler = extractHandler(bulkDeleteRedirects);
const createHandler = extractHandler(createRedirect);
const deleteHandler = extractHandler(deleteRedirect);
const getHandler = extractHandler(getRedirect);
const getStatsHandler = extractHandler(getStats);
const listHandler = extractHandler(listRedirects);
const testHandler = extractHandler(testRedirect);
const updateHandler = extractHandler(updateRedirect);

// ── admin POST /redirects/bulk-delete ─────────────────────────────────────────

describe("admin POST /redirects/bulk-delete", () => {
	it("deletes multiple redirects and returns count", async () => {
		const ctrl = makeController({
			bulkDelete: vi.fn().mockResolvedValue(3),
		});
		const result = (await call(bulkDeleteHandler, {
			body: { ids: ["r1", "r2", "r3"] },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(3);
		expect(ctrl.bulkDelete).toHaveBeenCalledWith(["r1", "r2", "r3"]);
	});

	it("returns 0 when no matching ids", async () => {
		const ctrl = makeController({
			bulkDelete: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(bulkDeleteHandler, {
			body: { ids: ["nope"] },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(0);
	});
});

// ── admin POST /redirects ─────────────────────────────────────────────────────

describe("admin POST /redirects", () => {
	it("creates a redirect and returns it", async () => {
		const redirect = makeRedirect({
			sourcePath: "/about-us",
			targetPath: "/about",
		});
		const ctrl = makeController({
			createRedirect: vi.fn().mockResolvedValue(redirect),
		});
		const result = (await call(createHandler, {
			body: { sourcePath: "/about-us", targetPath: "/about" },
			controller: ctrl,
		})) as { redirect: Redirect };
		expect(result.redirect.sourcePath).toBe("/about-us");
		expect(result.redirect.targetPath).toBe("/about");
		expect(ctrl.createRedirect).toHaveBeenCalledWith(
			expect.objectContaining({
				sourcePath: "/about-us",
				targetPath: "/about",
			}),
		);
	});

	it("forwards optional statusCode to controller", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: {
				sourcePath: "/old",
				targetPath: "/new",
				statusCode: 302,
			},
			controller: ctrl,
		});
		expect(ctrl.createRedirect).toHaveBeenCalledWith(
			expect.objectContaining({ statusCode: 302 }),
		);
	});
});

// ── admin POST /redirects/:id/delete ─────────────────────────────────────────

describe("admin POST /redirects/:id/delete", () => {
	it("returns 404 when redirect not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes redirect and returns success: true", async () => {
		const redirect = makeRedirect({ id: "r1" });
		const ctrl = makeController({
			getRedirect: vi.fn().mockResolvedValue(redirect),
			deleteRedirect: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "r1" },
			controller: ctrl,
		})) as { success: true };
		expect(result.success).toBe(true);
		expect(ctrl.deleteRedirect).toHaveBeenCalledWith("r1");
	});
});

// ── admin GET /redirects/:id ──────────────────────────────────────────────────

describe("admin GET /redirects/:id", () => {
	it("returns 404 when redirect not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns redirect when found", async () => {
		const redirect = makeRedirect({ id: "r2", sourcePath: "/legacy" });
		const ctrl = makeController({
			getRedirect: vi.fn().mockResolvedValue(redirect),
		});
		const result = (await call(getHandler, {
			params: { id: "r2" },
			controller: ctrl,
		})) as { redirect: Redirect };
		expect(result.redirect.id).toBe("r2");
		expect(result.redirect.sourcePath).toBe("/legacy");
		expect(ctrl.getRedirect).toHaveBeenCalledWith("r2");
	});
});

// ── admin GET /redirects/stats ────────────────────────────────────────────────

describe("admin GET /redirects/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(getStatsHandler)) as { stats: RedirectStats };
		expect(result.stats.totalRedirects).toBe(0);
		expect(result.stats.activeRedirects).toBe(0);
		expect(result.stats.totalHits).toBe(0);
		expect(result.stats.topRedirects).toHaveLength(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalRedirects: 25,
				activeRedirects: 20,
				totalHits: 1500,
				topRedirects: [
					{
						id: "r1",
						sourcePath: "/old-home",
						targetPath: "/",
						hitCount: 800,
					},
				],
			}),
		});
		const result = (await call(getStatsHandler, {
			controller: ctrl,
		})) as { stats: RedirectStats };
		expect(result.stats.totalRedirects).toBe(25);
		expect(result.stats.totalHits).toBe(1500);
		expect(result.stats.topRedirects).toHaveLength(1);
		expect(result.stats.topRedirects[0].sourcePath).toBe("/old-home");
	});
});

// ── admin GET /redirects ──────────────────────────────────────────────────────

describe("admin GET /redirects", () => {
	it("returns empty list when no redirects exist", async () => {
		const result = (await call(listHandler)) as {
			redirects: Redirect[];
			total: number;
		};
		expect(result.redirects).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns redirects from controller", async () => {
		const redirects = [
			makeRedirect({ sourcePath: "/a" }),
			makeRedirect({ sourcePath: "/b" }),
		];
		const ctrl = makeController({
			listRedirects: vi.fn().mockResolvedValue(redirects),
			countRedirects: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listHandler, {
			controller: ctrl,
		})) as { redirects: Redirect[]; total: number };
		expect(result.redirects).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards isActive filter to controller", async () => {
		const ctrl = makeController({
			listRedirects: vi.fn().mockResolvedValue([]),
			countRedirects: vi.fn().mockResolvedValue(0),
		});
		await call(listHandler, {
			query: { active: "true" },
			controller: ctrl,
		});
		expect(ctrl.listRedirects).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});
});

// ── admin POST /redirects/test ────────────────────────────────────────────────

describe("admin POST /redirects/test", () => {
	it("returns matched: false when no redirect found", async () => {
		const result = (await call(testHandler, {
			body: { path: "/no-match" },
		})) as { matched: boolean; redirect?: Redirect };
		expect(result.matched).toBe(false);
		expect(result.redirect).toBeUndefined();
	});

	it("returns matched: true with redirect when found", async () => {
		const redirect = makeRedirect({ sourcePath: "/old", targetPath: "/new" });
		const ctrl = makeController({
			testPath: vi.fn().mockResolvedValue({ matched: true, redirect }),
		});
		const result = (await call(testHandler, {
			body: { path: "/old" },
			controller: ctrl,
		})) as { matched: boolean; redirect: Redirect };
		expect(result.matched).toBe(true);
		expect(result.redirect.sourcePath).toBe("/old");
		expect(result.redirect.targetPath).toBe("/new");
		expect(ctrl.testPath).toHaveBeenCalledWith("/old");
	});
});

// ── admin POST /redirects/:id/update ─────────────────────────────────────────

describe("admin POST /redirects/:id/update", () => {
	it("returns 404 when redirect not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates redirect and returns it", async () => {
		const redirect = makeRedirect({ id: "r3", targetPath: "/updated" });
		const ctrl = makeController({
			getRedirect: vi
				.fn()
				.mockResolvedValue(makeRedirect({ id: "r3", sourcePath: "/old" })),
			updateRedirect: vi.fn().mockResolvedValue(redirect),
		});
		const result = (await call(updateHandler, {
			params: { id: "r3" },
			body: { targetPath: "/updated" },
			controller: ctrl,
		})) as { redirect: Redirect };
		expect(result.redirect.id).toBe("r3");
		expect(result.redirect.targetPath).toBe("/updated");
		expect(ctrl.updateRedirect).toHaveBeenCalledWith("r3", expect.anything());
	});
});
