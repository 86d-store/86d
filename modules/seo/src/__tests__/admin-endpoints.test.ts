import { describe, expect, it, vi } from "vitest";
import { createRedirectEndpoint } from "../admin/endpoints/create-redirect";
import { deleteMetaEndpoint } from "../admin/endpoints/delete-meta";
import { deleteRedirectEndpoint } from "../admin/endpoints/delete-redirect";
import { listMetaEndpoint } from "../admin/endpoints/list-meta";
import { listRedirectsEndpoint } from "../admin/endpoints/list-redirects";
import { updateRedirectEndpoint } from "../admin/endpoints/update-redirect";
import { upsertMetaEndpoint } from "../admin/endpoints/upsert-meta";
import type { MetaTag, Redirect, SeoController } from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeMetaTag(overrides: Partial<MetaTag> = {}): MetaTag {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		path: "/products",
		title: "Products",
		description: "Browse our catalog",
		noIndex: false,
		noFollow: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeRedirect(overrides: Partial<Redirect> = {}): Redirect {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		fromPath: "/old-page",
		toPath: "/new-page",
		statusCode: 301,
		active: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(overrides: Partial<SeoController> = {}): SeoController {
	return {
		upsertMetaTag: vi.fn().mockResolvedValue(makeMetaTag()),
		getMetaTagByPath: vi.fn().mockResolvedValue(null),
		getMetaTag: vi.fn().mockResolvedValue(null),
		deleteMetaTag: vi.fn().mockResolvedValue(false),
		listMetaTags: vi.fn().mockResolvedValue([]),
		createRedirect: vi.fn().mockResolvedValue(makeRedirect()),
		updateRedirect: vi.fn().mockResolvedValue(null),
		deleteRedirect: vi.fn().mockResolvedValue(false),
		getRedirect: vi.fn().mockResolvedValue(null),
		getRedirectByPath: vi.fn().mockResolvedValue(null),
		listRedirects: vi.fn().mockResolvedValue([]),
		getSitemapEntries: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: SeoController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { seo: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const upsertMetaHandler = extractHandler(upsertMetaEndpoint);
const listMetaHandler = extractHandler(listMetaEndpoint);
const deleteMetaHandler = extractHandler(deleteMetaEndpoint);
const createRedirectHandler = extractHandler(createRedirectEndpoint);
const updateRedirectHandler = extractHandler(updateRedirectEndpoint);
const listRedirectsHandler = extractHandler(listRedirectsEndpoint);
const deleteRedirectHandler = extractHandler(deleteRedirectEndpoint);

// ── upsertMeta ────────────────────────────────────────────────────────────────

describe("admin POST /seo/meta/upsert", () => {
	it("creates meta tag and returns it", async () => {
		const meta = makeMetaTag({ path: "/about", title: "About Us" });
		const ctrl = makeController({
			upsertMetaTag: vi.fn().mockResolvedValue(meta),
		});
		const result = (await call(upsertMetaHandler, {
			body: { path: "/about", title: "About Us" },
			controller: ctrl,
		})) as { meta: MetaTag };
		expect(result.meta.path).toBe("/about");
		expect(result.meta.title).toBe("About Us");
	});

	it("forwards all optional fields to controller", async () => {
		const ctrl = makeController();
		await call(upsertMetaHandler, {
			body: {
				path: "/shop",
				title: "Shop",
				description: "Our shop",
				noIndex: true,
				noFollow: false,
			},
			controller: ctrl,
		});
		expect(ctrl.upsertMetaTag).toHaveBeenCalledWith(
			expect.objectContaining({
				path: "/shop",
				title: "Shop",
				noIndex: true,
				noFollow: false,
			}),
		);
	});
});

// ── listMeta ──────────────────────────────────────────────────────────────────

describe("admin GET /seo/meta", () => {
	it("returns empty list when no meta tags exist", async () => {
		const result = (await call(listMetaHandler)) as {
			metaTags: MetaTag[];
			total: number;
		};
		expect(result.metaTags).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns meta tags from controller", async () => {
		const tags = [makeMetaTag(), makeMetaTag()];
		const ctrl = makeController({
			listMetaTags: vi.fn().mockResolvedValue(tags),
		});
		const result = (await call(listMetaHandler, { controller: ctrl })) as {
			metaTags: MetaTag[];
			total: number;
		};
		expect(result.metaTags).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

// ── deleteMeta ────────────────────────────────────────────────────────────────

describe("admin DELETE /seo/meta/:id/delete", () => {
	it("returns deleted false when meta tag not found", async () => {
		const result = (await call(deleteMetaHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes meta tag and returns true", async () => {
		const ctrl = makeController({
			deleteMetaTag: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteMetaHandler, {
			params: { id: "meta_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.deleteMetaTag).toHaveBeenCalledWith("meta_1");
	});
});

// ── createRedirect ────────────────────────────────────────────────────────────

describe("admin POST /seo/redirects/create", () => {
	it("creates redirect and returns it", async () => {
		const redirect = makeRedirect({ fromPath: "/legacy", toPath: "/current" });
		const ctrl = makeController({
			createRedirect: vi.fn().mockResolvedValue(redirect),
		});
		const result = (await call(createRedirectHandler, {
			body: { fromPath: "/legacy", toPath: "/current" },
			controller: ctrl,
		})) as { redirect: Redirect };
		expect(result.redirect.fromPath).toBe("/legacy");
		expect(result.redirect.toPath).toBe("/current");
	});

	it("passes optional statusCode to controller", async () => {
		const ctrl = makeController();
		await call(createRedirectHandler, {
			body: { fromPath: "/old", toPath: "/new", statusCode: "302" },
			controller: ctrl,
		});
		expect(ctrl.createRedirect).toHaveBeenCalledWith(
			expect.objectContaining({ fromPath: "/old", toPath: "/new" }),
		);
	});
});

// ── updateRedirect ────────────────────────────────────────────────────────────

describe("admin PUT /seo/redirects/:id/update", () => {
	it("returns null redirect when not found", async () => {
		const result = (await call(updateRedirectHandler, {
			params: { id: "missing" },
			body: { active: false },
		})) as { redirect: Redirect | null };
		expect(result.redirect).toBeNull();
	});

	it("updates redirect and returns it", async () => {
		const redirect = makeRedirect({ toPath: "/updated", active: false });
		const ctrl = makeController({
			updateRedirect: vi.fn().mockResolvedValue(redirect),
		});
		const result = (await call(updateRedirectHandler, {
			params: { id: redirect.id },
			body: { toPath: "/updated", active: false },
			controller: ctrl,
		})) as { redirect: Redirect };
		expect(result.redirect.toPath).toBe("/updated");
		expect(result.redirect.active).toBe(false);
	});
});

// ── listRedirects ─────────────────────────────────────────────────────────────

describe("admin GET /seo/redirects", () => {
	it("returns empty list when no redirects exist", async () => {
		const result = (await call(listRedirectsHandler)) as {
			redirects: Redirect[];
			total: number;
		};
		expect(result.redirects).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns redirects from controller", async () => {
		const redirects = [makeRedirect(), makeRedirect()];
		const ctrl = makeController({
			listRedirects: vi.fn().mockResolvedValue(redirects),
		});
		const result = (await call(listRedirectsHandler, {
			controller: ctrl,
		})) as { redirects: Redirect[]; total: number };
		expect(result.redirects).toHaveLength(2);
		expect(result.total).toBe(2);
	});
});

// ── deleteRedirect ────────────────────────────────────────────────────────────

describe("admin DELETE /seo/redirects/:id/delete", () => {
	it("returns deleted false when redirect not found", async () => {
		const result = (await call(deleteRedirectHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes redirect and returns true", async () => {
		const ctrl = makeController({
			deleteRedirect: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteRedirectHandler, {
			params: { id: "redirect_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.deleteRedirect).toHaveBeenCalledWith("redirect_1");
	});
});
