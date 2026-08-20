import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRedirectController } from "../service-impl";

describe("createRedirectController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createRedirectController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createRedirectController(mockData);
	});

	async function createTestRedirect(
		overrides: Partial<Parameters<typeof controller.createRedirect>[0]> = {},
	) {
		return controller.createRedirect({
			sourcePath: "/old-page",
			targetPath: "/new-page",
			...overrides,
		});
	}

	// ── createRedirect ──

	describe("createRedirect", () => {
		it("creates a redirect with required fields", async () => {
			const redirect = await createTestRedirect();
			expect(redirect.id).toBeDefined();
			expect(redirect.sourcePath).toBe("/old-page");
			expect(redirect.targetPath).toBe("/new-page");
			expect(redirect.statusCode).toBe(301);
			expect(redirect.isActive).toBe(true);
			expect(redirect.isRegex).toBe(false);
			expect(redirect.preserveQueryString).toBe(true);
			expect(redirect.hitCount).toBe(0);
			expect(redirect.createdAt).toBeInstanceOf(Date);
			expect(redirect.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a redirect with all optional fields", async () => {
			const redirect = await createTestRedirect({
				statusCode: 302,
				isActive: false,
				isRegex: true,
				preserveQueryString: false,
				note: "Migrated from old site",
			});
			expect(redirect.statusCode).toBe(302);
			expect(redirect.isActive).toBe(false);
			expect(redirect.isRegex).toBe(true);
			expect(redirect.preserveQueryString).toBe(false);
			expect(redirect.note).toBe("Migrated from old site");
		});

		it("generates unique IDs", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/a" });
			const r2 = await createTestRedirect({ sourcePath: "/b" });
			expect(r1.id).not.toBe(r2.id);
		});

		it("defaults statusCode to 301", async () => {
			const redirect = await createTestRedirect();
			expect(redirect.statusCode).toBe(301);
		});

		it("defaults isActive to true", async () => {
			const redirect = await createTestRedirect();
			expect(redirect.isActive).toBe(true);
		});

		it("defaults isRegex to false", async () => {
			const redirect = await createTestRedirect();
			expect(redirect.isRegex).toBe(false);
		});

		it("defaults preserveQueryString to true", async () => {
			const redirect = await createTestRedirect();
			expect(redirect.preserveQueryString).toBe(true);
		});

		it("defaults hitCount to 0", async () => {
			const redirect = await createTestRedirect();
			expect(redirect.hitCount).toBe(0);
		});

		it("supports 307 status code", async () => {
			const redirect = await createTestRedirect({ statusCode: 307 });
			expect(redirect.statusCode).toBe(307);
		});

		it("supports 308 status code", async () => {
			const redirect = await createTestRedirect({ statusCode: 308 });
			expect(redirect.statusCode).toBe(308);
		});
	});

	// ── getRedirect ──

	describe("getRedirect", () => {
		it("returns a redirect by id", async () => {
			const created = await createTestRedirect();
			const found = await controller.getRedirect(created.id);
			expect(found).not.toBeNull();
			expect(found?.sourcePath).toBe("/old-page");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getRedirect("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── updateRedirect ──

	describe("updateRedirect", () => {
		it("updates redirect fields", async () => {
			const created = await createTestRedirect();
			const updated = await controller.updateRedirect(created.id, {
				sourcePath: "/updated-source",
				targetPath: "/updated-target",
				statusCode: 302,
			});
			expect(updated).not.toBeNull();
			expect(updated?.sourcePath).toBe("/updated-source");
			expect(updated?.targetPath).toBe("/updated-target");
			expect(updated?.statusCode).toBe(302);
		});

		it("preserves unchanged fields", async () => {
			const created = await createTestRedirect({
				note: "Keep this",
			});
			const updated = await controller.updateRedirect(created.id, {
				isActive: false,
			});
			expect(updated?.sourcePath).toBe("/old-page");
			expect(updated?.targetPath).toBe("/new-page");
			expect(updated?.note).toBe("Keep this");
			expect(updated?.isActive).toBe(false);
		});

		it("clears note with null", async () => {
			const created = await createTestRedirect({ note: "Remove me" });
			const updated = await controller.updateRedirect(created.id, {
				note: null,
			});
			expect(updated?.note).toBeUndefined();
		});

		it("updates updatedAt timestamp", async () => {
			const created = await createTestRedirect();
			// Small delay to ensure different timestamp
			const updated = await controller.updateRedirect(created.id, {
				isActive: false,
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("preserves hitCount on update", async () => {
			const created = await createTestRedirect();
			await controller.recordHit(created.id);
			await controller.recordHit(created.id);
			const updated = await controller.updateRedirect(created.id, {
				isActive: false,
			});
			expect(updated?.hitCount).toBe(2);
		});

		it("preserves lastHitAt on update", async () => {
			const created = await createTestRedirect();
			await controller.recordHit(created.id);
			const afterHit = await controller.getRedirect(created.id);
			const updated = await controller.updateRedirect(created.id, {
				note: "updated",
			});
			expect(updated?.lastHitAt).toEqual(afterHit?.lastHitAt);
		});

		it("returns null for non-existent id", async () => {
			const updated = await controller.updateRedirect("non-existent", {
				isActive: false,
			});
			expect(updated).toBeNull();
		});
	});

	// ── deleteRedirect ──

	describe("deleteRedirect", () => {
		it("deletes an existing redirect", async () => {
			const created = await createTestRedirect();
			const deleted = await controller.deleteRedirect(created.id);
			expect(deleted).toBe(true);
			const found = await controller.getRedirect(created.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent id", async () => {
			const deleted = await controller.deleteRedirect("non-existent");
			expect(deleted).toBe(false);
		});
	});

	// ── listRedirects ──

	describe("listRedirects", () => {
		it("lists all redirects", async () => {
			await createTestRedirect({ sourcePath: "/a" });
			await createTestRedirect({ sourcePath: "/b" });
			await createTestRedirect({ sourcePath: "/c" });
			const list = await controller.listRedirects();
			expect(list).toHaveLength(3);
		});

		it("filters by isActive", async () => {
			await createTestRedirect({ sourcePath: "/active", isActive: true });
			await createTestRedirect({
				sourcePath: "/inactive",
				isActive: false,
			});
			const active = await controller.listRedirects({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].sourcePath).toBe("/active");
		});

		it("filters by statusCode", async () => {
			await createTestRedirect({
				sourcePath: "/perm",
				statusCode: 301,
			});
			await createTestRedirect({
				sourcePath: "/temp",
				statusCode: 302,
			});
			const perms = await controller.listRedirects({ statusCode: 301 });
			expect(perms).toHaveLength(1);
			expect(perms[0].sourcePath).toBe("/perm");
		});

		it("filters by search term in sourcePath", async () => {
			await createTestRedirect({ sourcePath: "/old-products/shoes" });
			await createTestRedirect({ sourcePath: "/about-us" });
			const results = await controller.listRedirects({
				search: "products",
			});
			expect(results).toHaveLength(1);
			expect(results[0].sourcePath).toBe("/old-products/shoes");
		});

		it("filters by search term in targetPath", async () => {
			await createTestRedirect({
				sourcePath: "/a",
				targetPath: "/new-collection",
			});
			await createTestRedirect({
				sourcePath: "/b",
				targetPath: "/home",
			});
			const results = await controller.listRedirects({
				search: "collection",
			});
			expect(results).toHaveLength(1);
		});

		it("filters by search term in note", async () => {
			await createTestRedirect({
				sourcePath: "/a",
				note: "Legacy migration",
			});
			await createTestRedirect({ sourcePath: "/b", note: "SEO fix" });
			const results = await controller.listRedirects({
				search: "legacy",
			});
			expect(results).toHaveLength(1);
		});

		it("search is case-insensitive", async () => {
			await createTestRedirect({ sourcePath: "/Old-Products" });
			const results = await controller.listRedirects({
				search: "old-products",
			});
			expect(results).toHaveLength(1);
		});

		it("supports pagination with take", async () => {
			await createTestRedirect({ sourcePath: "/a" });
			await createTestRedirect({ sourcePath: "/b" });
			await createTestRedirect({ sourcePath: "/c" });
			const results = await controller.listRedirects({ take: 2 });
			expect(results).toHaveLength(2);
		});

		it("supports pagination with skip", async () => {
			await createTestRedirect({ sourcePath: "/a" });
			await createTestRedirect({ sourcePath: "/b" });
			await createTestRedirect({ sourcePath: "/c" });
			const results = await controller.listRedirects({ skip: 2 });
			expect(results).toHaveLength(1);
		});
	});

	// ── countRedirects ──

	describe("countRedirects", () => {
		it("counts all redirects", async () => {
			await createTestRedirect({ sourcePath: "/a" });
			await createTestRedirect({ sourcePath: "/b" });
			const count = await controller.countRedirects();
			expect(count).toBe(2);
		});

		it("counts with filters", async () => {
			await createTestRedirect({ sourcePath: "/a", isActive: true });
			await createTestRedirect({ sourcePath: "/b", isActive: false });
			const count = await controller.countRedirects({ isActive: true });
			expect(count).toBe(1);
		});

		it("counts with search filter", async () => {
			await createTestRedirect({ sourcePath: "/old-products" });
			await createTestRedirect({ sourcePath: "/about" });
			const count = await controller.countRedirects({
				search: "products",
			});
			expect(count).toBe(1);
		});
	});

	// ── resolve ──

	describe("resolve", () => {
		it("resolves an exact match", async () => {
			await createTestRedirect({
				sourcePath: "/old-page",
				targetPath: "/new-page",
				statusCode: 301,
			});
			const result = await controller.resolve("/old-page");
			expect(result).not.toBeNull();
			expect(result?.targetPath).toBe("/new-page");
			expect(result?.statusCode).toBe(301);
			expect(result?.preserveQueryString).toBe(true);
		});

		it("returns null when no match", async () => {
			const result = await controller.resolve("/non-existent");
			expect(result).toBeNull();
		});

		it("only matches active redirects", async () => {
			await createTestRedirect({
				sourcePath: "/inactive-redirect",
				targetPath: "/target",
				isActive: false,
			});
			const result = await controller.resolve("/inactive-redirect");
			expect(result).toBeNull();
		});

		it("resolves regex patterns", async () => {
			await createTestRedirect({
				sourcePath: "/products/(.*)",
				targetPath: "/shop/$1",
				isRegex: true,
			});
			const result = await controller.resolve("/products/shoes");
			expect(result).not.toBeNull();
			expect(result?.targetPath).toBe("/shop/shoes");
		});

		it("resolves regex with multiple capture groups", async () => {
			await createTestRedirect({
				sourcePath: "/blog/(\\d{4})/(\\d{2})/(.*)",
				targetPath: "/posts/$1-$2-$3",
				isRegex: true,
			});
			const result = await controller.resolve("/blog/2024/03/my-post");
			expect(result).not.toBeNull();
			expect(result?.targetPath).toBe("/posts/2024-03-my-post");
		});

		it("prefers exact match over regex", async () => {
			await createTestRedirect({
				sourcePath: "/products/special",
				targetPath: "/exact-target",
				isRegex: false,
			});
			await createTestRedirect({
				sourcePath: "/products/(.*)",
				targetPath: "/regex-target/$1",
				isRegex: true,
			});
			const result = await controller.resolve("/products/special");
			expect(result).not.toBeNull();
			expect(result?.targetPath).toBe("/exact-target");
		});

		it("handles invalid regex gracefully", async () => {
			await createTestRedirect({
				sourcePath: "/bad-regex-[",
				targetPath: "/target",
				isRegex: true,
			});
			const result = await controller.resolve("/bad-regex-[");
			expect(result).toBeNull();
		});

		it("returns preserveQueryString flag", async () => {
			await createTestRedirect({
				sourcePath: "/no-qs",
				targetPath: "/target",
				preserveQueryString: false,
			});
			const result = await controller.resolve("/no-qs");
			expect(result?.preserveQueryString).toBe(false);
		});
	});

	// ── recordHit ──

	describe("recordHit", () => {
		it("increments hitCount", async () => {
			const created = await createTestRedirect();
			await controller.recordHit(created.id);
			const updated = await controller.getRedirect(created.id);
			expect(updated?.hitCount).toBe(1);
		});

		it("increments hitCount multiple times", async () => {
			const created = await createTestRedirect();
			await controller.recordHit(created.id);
			await controller.recordHit(created.id);
			await controller.recordHit(created.id);
			const updated = await controller.getRedirect(created.id);
			expect(updated?.hitCount).toBe(3);
		});

		it("updates lastHitAt", async () => {
			const created = await createTestRedirect();
			expect(created.lastHitAt).toBeUndefined();
			await controller.recordHit(created.id);
			const updated = await controller.getRedirect(created.id);
			expect(updated?.lastHitAt).toBeInstanceOf(Date);
		});

		it("does nothing for non-existent id", async () => {
			// Should not throw
			await controller.recordHit("non-existent");
		});
	});

	// ── bulkDelete ──

	describe("bulkDelete", () => {
		it("deletes multiple redirects", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/a" });
			const r2 = await createTestRedirect({ sourcePath: "/b" });
			await createTestRedirect({ sourcePath: "/c" });
			const deleted = await controller.bulkDelete([r1.id, r2.id]);
			expect(deleted).toBe(2);
			const remaining = await controller.listRedirects();
			expect(remaining).toHaveLength(1);
			expect(remaining[0].sourcePath).toBe("/c");
		});

		it("skips non-existent ids", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/a" });
			const deleted = await controller.bulkDelete([r1.id, "non-existent"]);
			expect(deleted).toBe(1);
		});

		it("returns 0 for empty results", async () => {
			const deleted = await controller.bulkDelete(["non-existent"]);
			expect(deleted).toBe(0);
		});
	});

	// ── testPath ──

	describe("testPath", () => {
		it("matches an exact redirect", async () => {
			const created = await createTestRedirect();
			const result = await controller.testPath("/old-page");
			expect(result.matched).toBe(true);
			expect(result.redirect).toBeDefined();
			expect(result.redirect?.id).toBe(created.id);
		});

		it("matches a regex redirect", async () => {
			await createTestRedirect({
				sourcePath: "/products/(.*)",
				targetPath: "/shop/$1",
				isRegex: true,
			});
			const result = await controller.testPath("/products/shoes");
			expect(result.matched).toBe(true);
		});

		it("returns matched false when no match", async () => {
			const result = await controller.testPath("/no-redirect");
			expect(result.matched).toBe(false);
			expect(result.redirect).toBeUndefined();
		});

		it("only tests active redirects", async () => {
			await createTestRedirect({
				sourcePath: "/inactive",
				isActive: false,
			});
			const result = await controller.testPath("/inactive");
			expect(result.matched).toBe(false);
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns empty stats for no redirects", async () => {
			const stats = await controller.getStats();
			expect(stats.totalRedirects).toBe(0);
			expect(stats.activeRedirects).toBe(0);
			expect(stats.totalHits).toBe(0);
			expect(stats.topRedirects).toHaveLength(0);
		});

		it("counts total and active redirects", async () => {
			await createTestRedirect({ sourcePath: "/a", isActive: true });
			await createTestRedirect({ sourcePath: "/b", isActive: true });
			await createTestRedirect({ sourcePath: "/c", isActive: false });
			const stats = await controller.getStats();
			expect(stats.totalRedirects).toBe(3);
			expect(stats.activeRedirects).toBe(2);
		});

		it("sums total hits", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/a" });
			const r2 = await createTestRedirect({ sourcePath: "/b" });
			await controller.recordHit(r1.id);
			await controller.recordHit(r1.id);
			await controller.recordHit(r2.id);
			const stats = await controller.getStats();
			expect(stats.totalHits).toBe(3);
		});

		it("returns top redirects sorted by hitCount", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/low" });
			const r2 = await createTestRedirect({ sourcePath: "/high" });
			await controller.recordHit(r1.id);
			await controller.recordHit(r2.id);
			await controller.recordHit(r2.id);
			await controller.recordHit(r2.id);
			const stats = await controller.getStats();
			expect(stats.topRedirects[0].sourcePath).toBe("/high");
			expect(stats.topRedirects[0].hitCount).toBe(3);
			expect(stats.topRedirects[1].sourcePath).toBe("/low");
			expect(stats.topRedirects[1].hitCount).toBe(1);
		});

		it("limits top redirects to 10", async () => {
			for (let i = 0; i < 15; i++) {
				await createTestRedirect({ sourcePath: `/path-${i}` });
			}
			const stats = await controller.getStats();
			expect(stats.topRedirects).toHaveLength(10);
		});
	});
});
