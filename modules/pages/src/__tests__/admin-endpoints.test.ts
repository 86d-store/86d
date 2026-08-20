import { describe, expect, it, vi } from "vitest";
import { createPageEndpoint } from "../admin/endpoints/create-page";
import { deletePageEndpoint } from "../admin/endpoints/delete-page";
import { adminGetPageEndpoint } from "../admin/endpoints/get-page";
import { adminListPagesEndpoint } from "../admin/endpoints/list-pages";
import { updatePageEndpoint } from "../admin/endpoints/update-page";
import type { Page, PagesController } from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makePage(overrides: Partial<Page> = {}): Page {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		title: "About Us",
		slug: "about-us",
		content: "# About Us\n\nWe are a company.",
		status: "draft",
		position: 0,
		showInNavigation: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<PagesController> = {},
): PagesController {
	return {
		createPage: vi.fn().mockResolvedValue(makePage()),
		updatePage: vi.fn().mockResolvedValue(null),
		deletePage: vi.fn().mockResolvedValue(false),
		getPage: vi.fn().mockResolvedValue(null),
		getPageBySlug: vi.fn().mockResolvedValue(null),
		publishPage: vi.fn().mockResolvedValue(null),
		unpublishPage: vi.fn().mockResolvedValue(null),
		archivePage: vi.fn().mockResolvedValue(null),
		listPages: vi.fn().mockResolvedValue([]),
		getNavigationPages: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, unknown>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: PagesController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { pages: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(adminListPagesEndpoint);
const createHandler = extractHandler(createPageEndpoint);
const getHandler = extractHandler(adminGetPageEndpoint);
const updateHandler = extractHandler(updatePageEndpoint);
const deleteHandler = extractHandler(deletePageEndpoint);

describe("admin GET /pages", () => {
	it("returns empty pages list", async () => {
		const result = (await call(listHandler)) as {
			pages: Page[];
			total: number;
		};
		expect(result.pages).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "published" },
			controller: ctrl,
		});
		expect(ctrl.listPages).toHaveBeenCalledWith(
			expect.objectContaining({ status: "published" }),
		);
	});
});

describe("admin POST /pages/create", () => {
	it("creates page and returns it", async () => {
		const page = makePage({ title: "Contact Us" });
		const ctrl = makeController({
			createPage: vi.fn().mockResolvedValue(page),
		});
		const result = (await call(createHandler, {
			body: { title: "Contact Us", content: "Contact info here" },
			controller: ctrl,
		})) as { page: Page };
		expect(result.page.title).toBe("Contact Us");
	});

	it("calls controller with content and title", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: { title: "FAQ", content: "Frequently asked questions." },
			controller: ctrl,
		});
		expect(ctrl.createPage).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "FAQ",
				content: "Frequently asked questions.",
			}),
		);
	});
});

describe("admin GET /pages/:id", () => {
	it("returns null page when not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { page: Page | null };
		expect(result.page).toBeNull();
	});

	it("returns page when found", async () => {
		const page = makePage({ id: "pg-1" });
		const ctrl = makeController({ getPage: vi.fn().mockResolvedValue(page) });
		const result = (await call(getHandler, {
			params: { id: "pg-1" },
			controller: ctrl,
		})) as { page: Page };
		expect(result.page.id).toBe("pg-1");
	});
});

describe("admin POST /pages/:id/update", () => {
	it("returns null page when not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { title: "Updated" },
		})) as { page: Page | null };
		expect(result.page).toBeNull();
	});

	it("updates page and returns it", async () => {
		const page = makePage({ title: "Updated Title" });
		const ctrl = makeController({
			updatePage: vi.fn().mockResolvedValue(page),
		});
		const result = (await call(updateHandler, {
			params: { id: page.id },
			body: { title: "Updated Title" },
			controller: ctrl,
		})) as { page: Page };
		expect(result.page.title).toBe("Updated Title");
	});
});

describe("admin POST /pages/:id/delete", () => {
	it("returns deleted=false when page not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted=true after deletion", async () => {
		const ctrl = makeController({
			deletePage: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "pg-1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});
