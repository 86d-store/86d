import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRedirectController } from "../service-impl";

describe("redirect controllers — edge cases", () => {
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

	// ── createRedirect — edge cases ──────────────────────────────────

	describe("createRedirect — edge cases", () => {
		it("does not include note when not provided", async () => {
			const redirect = await createTestRedirect();
			expect(redirect.note).toBeUndefined();
		});

		it("stores empty string note", async () => {
			const redirect = await createTestRedirect({ note: "" });
			// Empty string is falsy but not null/undefined, so it won't pass the != null check
			// in the implementation: params.note != null → false for ""? No, "" != null is true
			expect(redirect.note).toBe("");
		});

		it("persists redirect via data service (round-trip)", async () => {
			const created = await createTestRedirect({
				sourcePath: "/round-trip",
				targetPath: "/destination",
				statusCode: 302,
				isActive: false,
				isRegex: true,
				preserveQueryString: false,
				note: "round trip test",
			});

			const fetched = await controller.getRedirect(created.id);
			expect(fetched?.sourcePath).toBe("/round-trip");
			expect(fetched?.targetPath).toBe("/destination");
			expect(fetched?.statusCode).toBe(302);
			expect(fetched?.isActive).toBe(false);
			expect(fetched?.isRegex).toBe(true);
			expect(fetched?.preserveQueryString).toBe(false);
			expect(fetched?.note).toBe("round trip test");
			expect(fetched?.hitCount).toBe(0);
		});

		it("creates redirect with sourcePath containing special characters", async () => {
			const redirect = await createTestRedirect({
				sourcePath: "/path?query=value&foo=bar",
				targetPath: "/clean-path",
			});
			expect(redirect.sourcePath).toBe("/path?query=value&foo=bar");
		});

		it("creates redirect with unicode in paths", async () => {
			const redirect = await createTestRedirect({
				sourcePath: "/produkte/schuhe",
				targetPath: "/products/shoes",
			});
			expect(redirect.sourcePath).toBe("/produkte/schuhe");
			expect(redirect.targetPath).toBe("/products/shoes");
		});
	});

	// ── updateRedirect — edge cases ──────────────────────────────────

	describe("updateRedirect — edge cases", () => {
		it("updates note from a value to a different value", async () => {
			const created = await createTestRedirect({ note: "original" });
			const updated = await controller.updateRedirect(created.id, {
				note: "modified",
			});
			expect(updated?.note).toBe("modified");
		});

		it("setting note to null clears it even after multiple updates", async () => {
			const created = await createTestRedirect({ note: "first" });
			await controller.updateRedirect(created.id, { note: "second" });
			const cleared = await controller.updateRedirect(created.id, {
				note: null,
			});
			expect(cleared?.note).toBeUndefined();
		});

		it("setting note to null then back to a value restores it", async () => {
			const created = await createTestRedirect({ note: "initial" });
			await controller.updateRedirect(created.id, { note: null });
			const restored = await controller.updateRedirect(created.id, {
				note: "restored",
			});
			expect(restored?.note).toBe("restored");
		});

		it("updating only isActive preserves all other fields", async () => {
			const created = await createTestRedirect({
				sourcePath: "/keep-source",
				targetPath: "/keep-target",
				statusCode: 307,
				isRegex: true,
				preserveQueryString: false,
				note: "keep note",
			});

			const updated = await controller.updateRedirect(created.id, {
				isActive: false,
			});

			expect(updated?.sourcePath).toBe("/keep-source");
			expect(updated?.targetPath).toBe("/keep-target");
			expect(updated?.statusCode).toBe(307);
			expect(updated?.isRegex).toBe(true);
			expect(updated?.preserveQueryString).toBe(false);
			expect(updated?.note).toBe("keep note");
			expect(updated?.isActive).toBe(false);
		});

		it("preserves createdAt on update", async () => {
			const created = await createTestRedirect();
			const updated = await controller.updateRedirect(created.id, {
				sourcePath: "/changed",
			});
			expect(updated?.createdAt).toEqual(created.createdAt);
		});

		it("consecutive updates accumulate correctly", async () => {
			const created = await createTestRedirect();
			await controller.updateRedirect(created.id, { sourcePath: "/step-1" });
			await controller.updateRedirect(created.id, { targetPath: "/step-2" });
			await controller.updateRedirect(created.id, { statusCode: 308 });

			const final = await controller.getRedirect(created.id);
			expect(final?.sourcePath).toBe("/step-1");
			expect(final?.targetPath).toBe("/step-2");
			expect(final?.statusCode).toBe(308);
		});
	});

	// ── resolve — regex edge cases ───────────────────────────────────

	describe("resolve — regex edge cases", () => {
		it("regex sourcePath is anchored with ^ and $", async () => {
			await createTestRedirect({
				sourcePath: "/products/(.*)",
				targetPath: "/shop/$1",
				isRegex: true,
			});

			// Should not match a path that has a prefix before /products/
			const result = await controller.resolve("/prefix/products/shoes");
			expect(result).toBeNull();
		});

		it("regex with no capture groups leaves target unchanged", async () => {
			await createTestRedirect({
				sourcePath: "/old-blog/.*",
				targetPath: "/blog",
				isRegex: true,
			});

			const result = await controller.resolve("/old-blog/any-post");
			expect(result).not.toBeNull();
			expect(result?.targetPath).toBe("/blog");
		});

		it("regex with empty capture group replaces $1 with empty string", async () => {
			await createTestRedirect({
				sourcePath: "/path()(.*)",
				targetPath: "/new$1$2",
				isRegex: true,
			});

			const result = await controller.resolve("/path/something");
			expect(result).not.toBeNull();
			expect(result?.targetPath).toBe("/new/something");
		});

		it("multiple regex redirects — first match wins", async () => {
			await createTestRedirect({
				sourcePath: "/category/(.*)",
				targetPath: "/cat-first/$1",
				isRegex: true,
			});
			await createTestRedirect({
				sourcePath: "/category/(.*)",
				targetPath: "/cat-second/$1",
				isRegex: true,
			});

			const result = await controller.resolve("/category/shoes");
			expect(result).not.toBeNull();
			// The first regex in the array should match
			expect(result?.targetPath).toBe("/cat-first/shoes");
		});

		it("regex does not match inactive redirects", async () => {
			await createTestRedirect({
				sourcePath: "/old/(.*)",
				targetPath: "/new/$1",
				isRegex: true,
				isActive: false,
			});

			const result = await controller.resolve("/old/something");
			expect(result).toBeNull();
		});

		it("exact match non-regex does not do substring matching", async () => {
			await createTestRedirect({
				sourcePath: "/about",
				targetPath: "/about-us",
			});

			const shorter = await controller.resolve("/abou");
			expect(shorter).toBeNull();

			const longer = await controller.resolve("/about/team");
			expect(longer).toBeNull();
		});

		it("regex with complex pattern — digit ranges", async () => {
			await createTestRedirect({
				sourcePath: "/archive/(\\d{4})/(\\d{2})/(\\d{2})",
				targetPath: "/posts/$1/$2/$3",
				isRegex: true,
			});

			const match = await controller.resolve("/archive/2025/01/15");
			expect(match?.targetPath).toBe("/posts/2025/01/15");

			const noMatch = await controller.resolve("/archive/abcd/ef/gh");
			expect(noMatch).toBeNull();
		});

		it("regex captures are replaced with replaceAll so repeated $1 works", async () => {
			await createTestRedirect({
				sourcePath: "/dup/(.*)",
				targetPath: "/$1/$1",
				isRegex: true,
			});

			const result = await controller.resolve("/dup/value");
			expect(result?.targetPath).toBe("/value/value");
		});
	});

	// ── listRedirects — combined filters ─────────────────────────────

	describe("listRedirects — combined filters", () => {
		it("combines isActive and statusCode filters", async () => {
			await createTestRedirect({
				sourcePath: "/a",
				isActive: true,
				statusCode: 301,
			});
			await createTestRedirect({
				sourcePath: "/b",
				isActive: true,
				statusCode: 302,
			});
			await createTestRedirect({
				sourcePath: "/c",
				isActive: false,
				statusCode: 301,
			});

			const results = await controller.listRedirects({
				isActive: true,
				statusCode: 301,
			});
			expect(results).toHaveLength(1);
			expect(results[0].sourcePath).toBe("/a");
		});

		it("combines isActive filter with search", async () => {
			await createTestRedirect({
				sourcePath: "/products/shoes",
				isActive: true,
			});
			await createTestRedirect({
				sourcePath: "/products/hats",
				isActive: false,
			});

			const results = await controller.listRedirects({
				isActive: true,
				search: "products",
			});
			expect(results).toHaveLength(1);
			expect(results[0].sourcePath).toBe("/products/shoes");
		});

		it("search matches partial strings", async () => {
			await createTestRedirect({
				sourcePath: "/long-path-with-keywords",
				targetPath: "/short",
			});

			const results = await controller.listRedirects({
				search: "keywords",
			});
			expect(results).toHaveLength(1);
		});

		it("search returns empty array when nothing matches", async () => {
			await createTestRedirect({ sourcePath: "/a" });
			await createTestRedirect({ sourcePath: "/b" });

			const results = await controller.listRedirects({
				search: "xyz-no-match",
			});
			expect(results).toHaveLength(0);
		});

		it("returns empty array when no redirects exist", async () => {
			const results = await controller.listRedirects();
			expect(results).toHaveLength(0);
		});

		it("take and skip with filters", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestRedirect({
					sourcePath: `/active-${i}`,
					isActive: true,
				});
			}
			await createTestRedirect({
				sourcePath: "/inactive",
				isActive: false,
			});

			const page = await controller.listRedirects({
				isActive: true,
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countRedirects — combined filters ────────────────────────────

	describe("countRedirects — combined filters", () => {
		it("counts with isActive and statusCode", async () => {
			await createTestRedirect({
				sourcePath: "/a",
				isActive: true,
				statusCode: 301,
			});
			await createTestRedirect({
				sourcePath: "/b",
				isActive: true,
				statusCode: 302,
			});
			await createTestRedirect({
				sourcePath: "/c",
				isActive: false,
				statusCode: 301,
			});

			const count = await controller.countRedirects({
				isActive: true,
				statusCode: 301,
			});
			expect(count).toBe(1);
		});

		it("count with search and statusCode", async () => {
			await createTestRedirect({
				sourcePath: "/products/a",
				statusCode: 301,
			});
			await createTestRedirect({
				sourcePath: "/products/b",
				statusCode: 302,
			});
			await createTestRedirect({
				sourcePath: "/about",
				statusCode: 301,
			});

			const count = await controller.countRedirects({
				statusCode: 301,
				search: "products",
			});
			expect(count).toBe(1);
		});

		it("count returns 0 when no redirects exist", async () => {
			const count = await controller.countRedirects();
			expect(count).toBe(0);
		});

		it("count with search that matches note only", async () => {
			await createTestRedirect({
				sourcePath: "/a",
				targetPath: "/b",
				note: "SEO migration from WordPress",
			});
			await createTestRedirect({
				sourcePath: "/c",
				targetPath: "/d",
				note: "Manual fix",
			});

			const count = await controller.countRedirects({
				search: "wordpress",
			});
			expect(count).toBe(1);
		});
	});

	// ── recordHit — interaction with update ──────────────────────────

	describe("recordHit — interaction with update", () => {
		it("hitCount preserved across multiple updates and hits", async () => {
			const created = await createTestRedirect();
			await controller.recordHit(created.id);
			await controller.recordHit(created.id);
			await controller.updateRedirect(created.id, { sourcePath: "/updated" });
			await controller.recordHit(created.id);

			const final = await controller.getRedirect(created.id);
			expect(final?.hitCount).toBe(3);
			expect(final?.sourcePath).toBe("/updated");
		});

		it("lastHitAt is preserved through update", async () => {
			const created = await createTestRedirect();
			await controller.recordHit(created.id);

			const afterHit = await controller.getRedirect(created.id);
			const hitTime = afterHit?.lastHitAt;

			await controller.updateRedirect(created.id, { note: "updated note" });

			const afterUpdate = await controller.getRedirect(created.id);
			expect(afterUpdate?.lastHitAt).toEqual(hitTime);
		});

		it("recordHit on deleted redirect is a no-op", async () => {
			const created = await createTestRedirect();
			await controller.deleteRedirect(created.id);
			// Should not throw
			await controller.recordHit(created.id);
		});
	});

	// ── bulkDelete — edge cases ──────────────────────────────────────

	describe("bulkDelete — edge cases", () => {
		it("handles empty array", async () => {
			const deleted = await controller.bulkDelete([]);
			expect(deleted).toBe(0);
		});

		it("handles duplicate ids in the array", async () => {
			const r = await createTestRedirect({ sourcePath: "/dup" });
			// First delete succeeds, second finds nothing
			const deleted = await controller.bulkDelete([r.id, r.id, r.id]);
			expect(deleted).toBe(1);
		});

		it("deleted redirects no longer appear in listRedirects", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/del-1" });
			const r2 = await createTestRedirect({ sourcePath: "/del-2" });
			await createTestRedirect({ sourcePath: "/keep" });

			await controller.bulkDelete([r1.id, r2.id]);

			const list = await controller.listRedirects();
			expect(list).toHaveLength(1);
			expect(list[0].sourcePath).toBe("/keep");
		});

		it("deleted redirects no longer resolve", async () => {
			const r = await createTestRedirect({
				sourcePath: "/will-delete",
				targetPath: "/target",
			});

			await controller.bulkDelete([r.id]);

			const result = await controller.resolve("/will-delete");
			expect(result).toBeNull();
		});

		it("stats reflect bulk deletions", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/s1" });
			const r2 = await createTestRedirect({ sourcePath: "/s2" });
			await createTestRedirect({ sourcePath: "/s3" });

			await controller.recordHit(r1.id);
			await controller.recordHit(r1.id);
			await controller.recordHit(r2.id);

			await controller.bulkDelete([r1.id, r2.id]);

			const stats = await controller.getStats();
			expect(stats.totalRedirects).toBe(1);
			expect(stats.totalHits).toBe(0);
		});
	});

	// ── testPath — edge cases ────────────────────────────────────────

	describe("testPath — edge cases", () => {
		it("exact match takes priority over regex in testPath", async () => {
			const exact = await createTestRedirect({
				sourcePath: "/priority-test",
				targetPath: "/exact-target",
				isRegex: false,
			});
			await createTestRedirect({
				sourcePath: "/priority-(.*)",
				targetPath: "/regex-target/$1",
				isRegex: true,
			});

			const result = await controller.testPath("/priority-test");
			expect(result.matched).toBe(true);
			expect(result.redirect?.id).toBe(exact.id);
		});

		it("testPath returns the regex redirect object when matched", async () => {
			const regex = await createTestRedirect({
				sourcePath: "/api/v(\\d+)/(.*)",
				targetPath: "/api-v$1/$2",
				isRegex: true,
			});

			const result = await controller.testPath("/api/v2/users");
			expect(result.matched).toBe(true);
			expect(result.redirect?.id).toBe(regex.id);
			expect(result.redirect?.isRegex).toBe(true);
		});

		it("testPath does not modify the redirect data", async () => {
			const created = await createTestRedirect();

			await controller.testPath("/old-page");

			const after = await controller.getRedirect(created.id);
			expect(after?.hitCount).toBe(0);
			expect(after?.lastHitAt).toBeUndefined();
		});

		it("testPath with empty path", async () => {
			await createTestRedirect({
				sourcePath: "",
				targetPath: "/home",
			});

			const result = await controller.testPath("");
			expect(result.matched).toBe(true);
		});
	});

	// ── getStats — complex scenarios ─────────────────────────────────

	describe("getStats — complex scenarios", () => {
		it("stats after create, hit, update cycle", async () => {
			const r = await createTestRedirect({
				sourcePath: "/tracked",
				isActive: true,
			});

			await controller.recordHit(r.id);
			await controller.recordHit(r.id);
			await controller.updateRedirect(r.id, { isActive: false });

			const stats = await controller.getStats();
			expect(stats.totalRedirects).toBe(1);
			expect(stats.activeRedirects).toBe(0);
			expect(stats.totalHits).toBe(2);
		});

		it("topRedirects includes id, sourcePath, targetPath, hitCount", async () => {
			const r = await createTestRedirect({
				sourcePath: "/popular",
				targetPath: "/destination",
			});
			await controller.recordHit(r.id);

			const stats = await controller.getStats();
			expect(stats.topRedirects).toHaveLength(1);
			expect(stats.topRedirects[0].id).toBe(r.id);
			expect(stats.topRedirects[0].sourcePath).toBe("/popular");
			expect(stats.topRedirects[0].targetPath).toBe("/destination");
			expect(stats.topRedirects[0].hitCount).toBe(1);
		});

		it("topRedirects sorted descending by hitCount", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/low-hits" });
			const r2 = await createTestRedirect({ sourcePath: "/mid-hits" });
			const r3 = await createTestRedirect({ sourcePath: "/high-hits" });

			await controller.recordHit(r1.id);
			for (let i = 0; i < 5; i++) {
				await controller.recordHit(r2.id);
			}
			for (let i = 0; i < 10; i++) {
				await controller.recordHit(r3.id);
			}

			const stats = await controller.getStats();
			expect(stats.topRedirects[0].sourcePath).toBe("/high-hits");
			expect(stats.topRedirects[0].hitCount).toBe(10);
			expect(stats.topRedirects[1].sourcePath).toBe("/mid-hits");
			expect(stats.topRedirects[1].hitCount).toBe(5);
			expect(stats.topRedirects[2].sourcePath).toBe("/low-hits");
			expect(stats.topRedirects[2].hitCount).toBe(1);
		});

		it("topRedirects limited to 10 even with many redirects", async () => {
			for (let i = 0; i < 20; i++) {
				const r = await createTestRedirect({ sourcePath: `/p-${i}` });
				for (let j = 0; j <= i; j++) {
					await controller.recordHit(r.id);
				}
			}

			const stats = await controller.getStats();
			expect(stats.topRedirects).toHaveLength(10);
			// Highest hitCount should be 20 (index 19, hits = 20)
			expect(stats.topRedirects[0].hitCount).toBe(20);
		});

		it("stats totalHits sums across all redirects", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/a" });
			const r2 = await createTestRedirect({ sourcePath: "/b" });
			const r3 = await createTestRedirect({ sourcePath: "/c" });

			await controller.recordHit(r1.id);
			await controller.recordHit(r2.id);
			await controller.recordHit(r2.id);
			await controller.recordHit(r3.id);
			await controller.recordHit(r3.id);
			await controller.recordHit(r3.id);

			const stats = await controller.getStats();
			expect(stats.totalHits).toBe(6);
		});

		it("stats include inactive redirects in totalRedirects", async () => {
			await createTestRedirect({ sourcePath: "/a", isActive: true });
			await createTestRedirect({ sourcePath: "/b", isActive: false });
			await createTestRedirect({ sourcePath: "/c", isActive: false });

			const stats = await controller.getStats();
			expect(stats.totalRedirects).toBe(3);
			expect(stats.activeRedirects).toBe(1);
		});
	});

	// ── Cross-method interaction edge cases ──────────────────────────

	describe("cross-method interactions", () => {
		it("deactivating a redirect removes it from resolve", async () => {
			const r = await createTestRedirect({
				sourcePath: "/will-deactivate",
				targetPath: "/target",
				isActive: true,
			});

			const before = await controller.resolve("/will-deactivate");
			expect(before).not.toBeNull();

			await controller.updateRedirect(r.id, { isActive: false });

			const after = await controller.resolve("/will-deactivate");
			expect(after).toBeNull();
		});

		it("reactivating a redirect makes it resolvable again", async () => {
			const r = await createTestRedirect({
				sourcePath: "/toggle",
				targetPath: "/target",
				isActive: false,
			});

			expect(await controller.resolve("/toggle")).toBeNull();

			await controller.updateRedirect(r.id, { isActive: true });

			const result = await controller.resolve("/toggle");
			expect(result?.targetPath).toBe("/target");
		});

		it("changing sourcePath updates what resolve matches", async () => {
			const r = await createTestRedirect({
				sourcePath: "/old-source",
				targetPath: "/target",
			});

			expect(await controller.resolve("/old-source")).not.toBeNull();

			await controller.updateRedirect(r.id, {
				sourcePath: "/new-source",
			});

			expect(await controller.resolve("/old-source")).toBeNull();
			expect((await controller.resolve("/new-source"))?.targetPath).toBe(
				"/target",
			);
		});

		it("changing targetPath updates the resolved target", async () => {
			const r = await createTestRedirect({
				sourcePath: "/source",
				targetPath: "/old-target",
			});

			await controller.updateRedirect(r.id, {
				targetPath: "/new-target",
			});

			const result = await controller.resolve("/source");
			expect(result?.targetPath).toBe("/new-target");
		});

		it("converting non-regex to regex changes matching behavior", async () => {
			const r = await createTestRedirect({
				sourcePath: "/products/(.*)",
				targetPath: "/shop/$1",
				isRegex: false,
			});

			// With isRegex false, only exact string match works
			expect(await controller.resolve("/products/shoes")).toBeNull();
			// The literal string "/products/(.*)" would match
			expect(await controller.resolve("/products/(.*)")).not.toBeNull();

			await controller.updateRedirect(r.id, { isRegex: true });

			// Now regex matching works
			const result = await controller.resolve("/products/shoes");
			expect(result?.targetPath).toBe("/shop/shoes");
		});

		it("delete then create with same path works", async () => {
			const r1 = await createTestRedirect({
				sourcePath: "/recycled",
				targetPath: "/target-1",
			});
			await controller.deleteRedirect(r1.id);

			const r2 = await createTestRedirect({
				sourcePath: "/recycled",
				targetPath: "/target-2",
			});

			const result = await controller.resolve("/recycled");
			expect(result?.targetPath).toBe("/target-2");

			// Old id should still be gone
			expect(await controller.getRedirect(r1.id)).toBeNull();
			expect(await controller.getRedirect(r2.id)).not.toBeNull();
		});

		it("countRedirects reflects deletions", async () => {
			const r1 = await createTestRedirect({ sourcePath: "/a" });
			await createTestRedirect({ sourcePath: "/b" });
			await createTestRedirect({ sourcePath: "/c" });

			expect(await controller.countRedirects()).toBe(3);

			await controller.deleteRedirect(r1.id);

			expect(await controller.countRedirects()).toBe(2);
		});

		it("statusCode update reflected in resolve result", async () => {
			const r = await createTestRedirect({
				sourcePath: "/status-change",
				targetPath: "/target",
				statusCode: 301,
			});

			await controller.updateRedirect(r.id, { statusCode: 308 });

			const result = await controller.resolve("/status-change");
			expect(result?.statusCode).toBe(308);
		});

		it("preserveQueryString update reflected in resolve result", async () => {
			const r = await createTestRedirect({
				sourcePath: "/qs-change",
				targetPath: "/target",
				preserveQueryString: true,
			});

			await controller.updateRedirect(r.id, {
				preserveQueryString: false,
			});

			const result = await controller.resolve("/qs-change");
			expect(result?.preserveQueryString).toBe(false);
		});
	});

	// ── Search edge cases ────────────────────────────────────────────

	describe("search edge cases", () => {
		it("search matches across sourcePath, targetPath, and note simultaneously", async () => {
			await createTestRedirect({
				sourcePath: "/source-keyword",
				targetPath: "/target-a",
			});
			await createTestRedirect({
				sourcePath: "/a",
				targetPath: "/target-keyword",
			});
			await createTestRedirect({
				sourcePath: "/b",
				targetPath: "/c",
				note: "note with keyword",
			});
			await createTestRedirect({
				sourcePath: "/no-match",
				targetPath: "/no-match-target",
				note: "nothing here",
			});

			const results = await controller.listRedirects({
				search: "keyword",
			});
			expect(results).toHaveLength(3);
		});

		it("search is case-insensitive for note field", async () => {
			await createTestRedirect({
				sourcePath: "/a",
				note: "UPPERCASE NOTE",
			});

			const results = await controller.listRedirects({
				search: "uppercase note",
			});
			expect(results).toHaveLength(1);
		});

		it("search with no note field still works on sourcePath/targetPath", async () => {
			await createTestRedirect({
				sourcePath: "/find-me",
				targetPath: "/found",
			});

			const results = await controller.listRedirects({
				search: "find-me",
			});
			expect(results).toHaveLength(1);
		});

		it("count with search is consistent with list with search", async () => {
			await createTestRedirect({
				sourcePath: "/products/shoes",
				note: "footwear migration",
			});
			await createTestRedirect({
				sourcePath: "/products/hats",
				note: "accessories",
			});
			await createTestRedirect({
				sourcePath: "/about",
				note: "info page",
			});

			const list = await controller.listRedirects({
				search: "products",
			});
			const count = await controller.countRedirects({
				search: "products",
			});
			expect(count).toBe(list.length);
			expect(count).toBe(2);
		});
	});

	// ── Multiple redirects with same source ──────────────────────────

	describe("multiple redirects with same source path", () => {
		it("resolve returns first active exact match found", async () => {
			await createTestRedirect({
				sourcePath: "/duplicate",
				targetPath: "/first-target",
			});
			await createTestRedirect({
				sourcePath: "/duplicate",
				targetPath: "/second-target",
			});

			const result = await controller.resolve("/duplicate");
			expect(result).not.toBeNull();
			// Should match one of them (the first one found in the data)
			expect(["/first-target", "/second-target"]).toContain(result?.targetPath);
		});
	});
});
