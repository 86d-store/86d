import { describe, expect, it, vi } from "vitest";
import { createAnnouncement } from "../admin/endpoints/create-announcement";
import { deleteAnnouncement } from "../admin/endpoints/delete-announcement";
import { getAnnouncement } from "../admin/endpoints/get-announcement";
import { listAnnouncements } from "../admin/endpoints/list-announcements";
import { reorder } from "../admin/endpoints/reorder";
import { stats } from "../admin/endpoints/stats";
import { updateAnnouncement } from "../admin/endpoints/update-announcement";
import type { Announcement, AnnouncementsController } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		title: "Free Shipping Today",
		content: "<b>Get free shipping on all orders!</b>",
		type: "bar",
		position: "top",
		priority: 0,
		isActive: true,
		isDismissible: true,
		targetAudience: "all",
		impressions: 0,
		clicks: 0,
		dismissals: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<AnnouncementsController> = {},
): AnnouncementsController {
	return {
		createAnnouncement: vi.fn().mockResolvedValue(makeAnnouncement()),
		getAnnouncement: vi.fn().mockResolvedValue(null),
		listAnnouncements: vi.fn().mockResolvedValue([]),
		getActiveAnnouncements: vi.fn().mockResolvedValue([]),
		updateAnnouncement: vi.fn().mockResolvedValue(null),
		deleteAnnouncement: vi.fn().mockResolvedValue(undefined),
		reorderAnnouncements: vi.fn().mockResolvedValue(undefined),
		recordImpression: vi.fn().mockResolvedValue(undefined),
		recordClick: vi.fn().mockResolvedValue(undefined),
		recordDismissal: vi.fn().mockResolvedValue(undefined),
		getStats: vi.fn().mockResolvedValue({
			totalAnnouncements: 0,
			activeAnnouncements: 0,
			scheduledAnnouncements: 0,
			expiredAnnouncements: 0,
			totalImpressions: 0,
			totalClicks: 0,
			totalDismissals: 0,
			clickRate: 0,
			dismissRate: 0,
		}),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: AnnouncementsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { announcements: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listAnnouncements);
const createHandler = extractHandler(createAnnouncement);
const reorderHandler = extractHandler(reorder);
const statsHandler = extractHandler(stats);
const getHandler = extractHandler(getAnnouncement);
const updateHandler = extractHandler(updateAnnouncement);
const deleteHandler = extractHandler(deleteAnnouncement);

// ── admin GET /announcements ──────────────────────────────────────────────────

describe("admin GET /announcements", () => {
	it("returns empty list when no announcements exist", async () => {
		const result = (await call(listHandler)) as {
			announcements: Announcement[];
		};
		expect(result.announcements).toHaveLength(0);
	});

	it("forwards active filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { active: "true" }, controller: ctrl });
		expect(ctrl.listAnnouncements).toHaveBeenCalledWith(
			expect.objectContaining({ activeOnly: true }),
		);
	});
});

// ── admin POST /announcements/create ─────────────────────────────────────────

describe("admin POST /announcements/create", () => {
	it("creates an announcement and returns it", async () => {
		const announcement = makeAnnouncement({ title: "New Sale" });
		const ctrl = makeController({
			createAnnouncement: vi.fn().mockResolvedValue(announcement),
		});
		const result = (await call(createHandler, {
			body: { title: "New Sale", content: "Big sale today" },
			controller: ctrl,
		})) as { announcement: Announcement };
		expect(result.announcement.title).toBe("New Sale");
	});

	it("calls controller with body fields", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: {
				title: "Flash Sale",
				content: "Limited time offer",
				type: "banner",
				priority: 5,
			},
			controller: ctrl,
		});
		expect(ctrl.createAnnouncement).toHaveBeenCalledWith(
			expect.objectContaining({ type: "banner" }),
		);
	});
});

// ── admin POST /announcements/reorder ─────────────────────────────────────────

describe("admin POST /announcements/reorder", () => {
	it("returns success true after reordering", async () => {
		const ctrl = makeController();
		const result = (await call(reorderHandler, {
			body: { ids: ["a1", "a2", "a3"] },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.reorderAnnouncements).toHaveBeenCalledWith(["a1", "a2", "a3"]);
	});

	it("passes ids array to controller unchanged", async () => {
		const ctrl = makeController();
		await call(reorderHandler, {
			body: { ids: ["z9", "z8"] },
			controller: ctrl,
		});
		expect(ctrl.reorderAnnouncements).toHaveBeenCalledWith(["z9", "z8"]);
	});
});

// ── admin GET /announcements/stats ────────────────────────────────────────────

describe("admin GET /announcements/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as {
			stats: { totalAnnouncements: number };
		};
		expect(result.stats.totalAnnouncements).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalAnnouncements: 10,
				activeAnnouncements: 4,
				scheduledAnnouncements: 2,
				expiredAnnouncements: 1,
				totalImpressions: 5000,
				totalClicks: 250,
				totalDismissals: 100,
				clickRate: 5,
				dismissRate: 2,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: { totalAnnouncements: number; totalImpressions: number };
		};
		expect(result.stats.totalAnnouncements).toBe(10);
		expect(result.stats.totalImpressions).toBe(5000);
	});
});

// ── admin GET /announcements/:id ──────────────────────────────────────────────

describe("admin GET /announcements/:id", () => {
	it("returns 404 when announcement not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Announcement not found");
	});

	it("returns announcement when found", async () => {
		const ann = makeAnnouncement({ id: "a1", title: "Spring Sale" });
		const ctrl = makeController({
			getAnnouncement: vi.fn().mockResolvedValue(ann),
		});
		const result = (await call(getHandler, {
			params: { id: "a1" },
			controller: ctrl,
		})) as { announcement: Announcement };
		expect(result.announcement.id).toBe("a1");
		expect(result.announcement.title).toBe("Spring Sale");
	});
});

// ── admin PUT /announcements/:id/update ───────────────────────────────────────

describe("admin PUT /announcements/:id/update", () => {
	it("returns updated announcement on success", async () => {
		const ann = makeAnnouncement({ title: "Updated Title" });
		const ctrl = makeController({
			updateAnnouncement: vi.fn().mockResolvedValue(ann),
		});
		const result = (await call(updateHandler, {
			params: { id: ann.id },
			body: { title: "Updated Title" },
			controller: ctrl,
		})) as { announcement: Announcement };
		expect(result.announcement.title).toBe("Updated Title");
	});

	it("passes id and body to controller", async () => {
		const ctrl = makeController({
			updateAnnouncement: vi.fn().mockResolvedValue(makeAnnouncement()),
		});
		await call(updateHandler, {
			params: { id: "a99" },
			body: { isActive: false },
			controller: ctrl,
		});
		expect(ctrl.updateAnnouncement).toHaveBeenCalledWith(
			"a99",
			expect.objectContaining({ isActive: false }),
		);
	});
});

// ── admin DELETE /announcements/:id/delete ────────────────────────────────────

describe("admin DELETE /announcements/:id/delete", () => {
	it("returns success true after deletion", async () => {
		const ctrl = makeController();
		const result = (await call(deleteHandler, {
			params: { id: "a1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteAnnouncement).toHaveBeenCalledWith("a1");
	});

	it("calls deleteAnnouncement with correct id", async () => {
		const ctrl = makeController();
		await call(deleteHandler, { params: { id: "ann-xyz" }, controller: ctrl });
		expect(ctrl.deleteAnnouncement).toHaveBeenCalledWith("ann-xyz");
	});
});
