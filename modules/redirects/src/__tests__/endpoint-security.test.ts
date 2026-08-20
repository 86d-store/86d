import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRedirectController } from "../service-impl";

/**
 * Security tests for redirects module endpoints.
 *
 * These tests verify:
 * - Inactive redirects are not resolved
 * - Exact path matching takes precedence over regex
 * - Regex redirects with capture group substitution ($1, $2)
 * - Hit counting safety for non-existent IDs (no-op)
 * - Bulk delete counts only existing records
 * - testPath is a read-only dry-run with no side effects on hitCount
 */

describe("redirects endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createRedirectController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createRedirectController(mockData);
	});

	// ── Inactive Redirect Enforcement ───────────────────────────────

	describe("inactive redirect enforcement", () => {
		it("inactive redirect is not resolved", async () => {
			await controller.createRedirect({
				sourcePath: "/old-path",
				targetPath: "/new-path",
				isActive: false,
			});

			const result = await controller.resolve("/old-path");
			expect(result).toBeNull();
		});

		it("active redirect is resolved", async () => {
			await controller.createRedirect({
				sourcePath: "/old-path",
				targetPath: "/new-path",
				isActive: true,
			});

			const result = await controller.resolve("/old-path");
			expect(result).not.toBeNull();
			expect(result?.targetPath).toBe("/new-path");
		});

		it("listRedirects filter by isActive=false returns only inactive", async () => {
			await controller.createRedirect({
				sourcePath: "/active",
				targetPath: "/active-target",
				isActive: true,
			});
			await controller.createRedirect({
				sourcePath: "/inactive",
				targetPath: "/inactive-target",
				isActive: false,
			});

			const inactive = await controller.listRedirects({ isActive: false });
			expect(inactive.every((r) => !r.isActive)).toBe(true);
		});

		it("testPath does not match inactive redirects", async () => {
			await controller.createRedirect({
				sourcePath: "/disabled",
				targetPath: "/somewhere",
				isActive: false,
			});

			const result = await controller.testPath("/disabled");
			expect(result.matched).toBe(false);
		});
	});

	// ── Exact Path Matching ──────────────────────────────────────────

	describe("exact path matching", () => {
		it("resolves exact path correctly", async () => {
			await controller.createRedirect({
				sourcePath: "/exact/path",
				targetPath: "/destination",
			});

			const result = await controller.resolve("/exact/path");
			expect(result?.targetPath).toBe("/destination");
		});

		it("does not resolve partial path matches", async () => {
			await controller.createRedirect({
				sourcePath: "/exact/path",
				targetPath: "/destination",
			});

			// Sub-path should not match
			const result = await controller.resolve("/exact/path/extra");
			expect(result).toBeNull();
		});

		it("exact match takes priority over regex match for the same path", async () => {
			// Regex redirect that would also match
			await controller.createRedirect({
				sourcePath: "/products/(.+)",
				targetPath: "/items/$1",
				isRegex: true,
			});

			// Exact redirect for a specific product path
			await controller.createRedirect({
				sourcePath: "/products/special",
				targetPath: "/special-page",
				isRegex: false,
			});

			const result = await controller.resolve("/products/special");
			expect(result?.targetPath).toBe("/special-page");
		});

		it("returns correct statusCode in resolved redirect", async () => {
			await controller.createRedirect({
				sourcePath: "/temporary",
				targetPath: "/elsewhere",
				statusCode: 302,
			});

			const result = await controller.resolve("/temporary");
			expect(result?.statusCode).toBe(302);
		});

		it("preserveQueryString is included in resolution result", async () => {
			await controller.createRedirect({
				sourcePath: "/no-qs",
				targetPath: "/target",
				preserveQueryString: false,
			});

			const result = await controller.resolve("/no-qs");
			expect(result?.preserveQueryString).toBe(false);
		});
	});

	// ── Regex Redirects ──────────────────────────────────────────────

	describe("regex redirects", () => {
		it("performs capture group substitution with $1", async () => {
			await controller.createRedirect({
				sourcePath: "/old/(.+)",
				targetPath: "/new/$1",
				isRegex: true,
			});

			const result = await controller.resolve("/old/some-product");
			expect(result?.targetPath).toBe("/new/some-product");
		});

		it("performs capture group substitution with $1 and $2", async () => {
			await controller.createRedirect({
				sourcePath: "/blog/(\\d{4})/(\\d{2})",
				targetPath: "/articles/$1/$2",
				isRegex: true,
			});

			const result = await controller.resolve("/blog/2024/03");
			expect(result?.targetPath).toBe("/articles/2024/03");
		});

		it("non-matching regex returns null", async () => {
			await controller.createRedirect({
				sourcePath: "/products/([a-z]+)",
				targetPath: "/items/$1",
				isRegex: true,
			});

			const result = await controller.resolve("/categories/electronics");
			expect(result).toBeNull();
		});

		it("invalid regex does not throw - returns null gracefully", async () => {
			await controller.createRedirect({
				sourcePath: "[invalid-regex",
				targetPath: "/somewhere",
				isRegex: true,
			});

			const result = await controller.resolve("[invalid-regex");
			// Should not throw, gracefully return null for invalid regex
			expect(result).toBeNull();
		});

		it("testPath returns matched redirect for regex match", async () => {
			await controller.createRedirect({
				sourcePath: "/shop/(.*)",
				targetPath: "/store/$1",
				isRegex: true,
			});

			const result = await controller.testPath("/shop/hats");
			expect(result.matched).toBe(true);
			expect(result.redirect).toBeDefined();
		});
	});

	// ── Hit Counting Safety ──────────────────────────────────────────

	describe("hit counting safety", () => {
		it("recordHit on non-existent ID is a no-op (does not throw)", async () => {
			await expect(
				controller.recordHit("nonexistent-id"),
			).resolves.toBeUndefined();
		});

		it("recordHit increments hitCount on an existing redirect", async () => {
			const redirect = await controller.createRedirect({
				sourcePath: "/tracked",
				targetPath: "/destination",
			});

			await controller.recordHit(redirect.id);
			await controller.recordHit(redirect.id);

			const updated = await controller.getRedirect(redirect.id);
			expect(updated?.hitCount).toBe(2);
		});

		it("recordHit sets lastHitAt timestamp", async () => {
			const redirect = await controller.createRedirect({
				sourcePath: "/hit-me",
				targetPath: "/landing",
			});

			await controller.recordHit(redirect.id);

			const updated = await controller.getRedirect(redirect.id);
			expect(updated?.lastHitAt).toBeInstanceOf(Date);
		});
	});

	// ── Bulk Delete Safety ───────────────────────────────────────────

	describe("bulk delete safety", () => {
		it("bulk delete with all non-existent IDs returns 0", async () => {
			const count = await controller.bulkDelete(["fake-1", "fake-2", "fake-3"]);
			expect(count).toBe(0);
		});

		it("bulk delete counts only successfully deleted records", async () => {
			const r1 = await controller.createRedirect({
				sourcePath: "/a",
				targetPath: "/a-target",
			});
			const r2 = await controller.createRedirect({
				sourcePath: "/b",
				targetPath: "/b-target",
			});

			const count = await controller.bulkDelete([r1.id, r2.id, "nonexistent"]);
			expect(count).toBe(2);
		});

		it("bulk delete removes the specified redirects", async () => {
			const r1 = await controller.createRedirect({
				sourcePath: "/remove-me-1",
				targetPath: "/target",
			});
			const r2 = await controller.createRedirect({
				sourcePath: "/remove-me-2",
				targetPath: "/target",
			});
			const r3 = await controller.createRedirect({
				sourcePath: "/keep-me",
				targetPath: "/target",
			});

			await controller.bulkDelete([r1.id, r2.id]);

			expect(await controller.getRedirect(r1.id)).toBeNull();
			expect(await controller.getRedirect(r2.id)).toBeNull();
			expect(await controller.getRedirect(r3.id)).not.toBeNull();
		});

		it("deleteRedirect on non-existent ID returns false", async () => {
			const result = await controller.deleteRedirect("nonexistent");
			expect(result).toBe(false);
		});

		it("deleteRedirect on existing ID returns true", async () => {
			const redirect = await controller.createRedirect({
				sourcePath: "/deletable",
				targetPath: "/gone",
			});

			const result = await controller.deleteRedirect(redirect.id);
			expect(result).toBe(true);
		});
	});

	// ── testPath Dry-run ─────────────────────────────────────────────

	describe("testPath is a dry-run", () => {
		it("testPath does not increment hitCount", async () => {
			const redirect = await controller.createRedirect({
				sourcePath: "/spy-on-me",
				targetPath: "/watched",
			});

			// Call testPath multiple times
			await controller.testPath("/spy-on-me");
			await controller.testPath("/spy-on-me");
			await controller.testPath("/spy-on-me");

			const current = await controller.getRedirect(redirect.id);
			expect(current?.hitCount).toBe(0);
		});

		it("testPath returns matched=false for unmatched path", async () => {
			const result = await controller.testPath("/no-redirect-for-this");
			expect(result.matched).toBe(false);
			expect(result.redirect).toBeUndefined();
		});

		it("testPath matched result includes redirect object", async () => {
			const redirect = await controller.createRedirect({
				sourcePath: "/test-me",
				targetPath: "/over-here",
			});

			const result = await controller.testPath("/test-me");
			expect(result.matched).toBe(true);
			expect(result.redirect?.id).toBe(redirect.id);
			expect(result.redirect?.sourcePath).toBe("/test-me");
			expect(result.redirect?.targetPath).toBe("/over-here");
		});
	});

	// ── Non-existent Resources ───────────────────────────────────────

	describe("non-existent resources", () => {
		it("getRedirect returns null for non-existent ID", async () => {
			const result = await controller.getRedirect("nonexistent");
			expect(result).toBeNull();
		});

		it("updateRedirect returns null for non-existent ID", async () => {
			const result = await controller.updateRedirect("nonexistent", {
				targetPath: "/updated",
			});
			expect(result).toBeNull();
		});

		it("resolve returns null when no redirects exist", async () => {
			const result = await controller.resolve("/anything");
			expect(result).toBeNull();
		});
	});
});
