import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSeoController } from "../service-impl";

/**
 * Endpoint-security tests for the SEO module.
 *
 * These tests verify security-relevant invariants:
 *
 * 1. Path uniqueness: upsert enforces one meta tag per normalized path
 * 2. Redirect chain detection: self-referencing redirects are stored as-is
 *    (caller must guard against loops)
 * 3. Meta tag length limits: long titles/descriptions are accepted verbatim
 *    (no silent truncation that could hide injected payloads)
 * 4. Canonical URL validation: arbitrary strings accepted (no protocol guard)
 * 5. Robots/sitemap integrity: noIndex pages excluded from sitemap entries
 * 6. noIndex enforcement: toggling noIndex correctly gates sitemap visibility
 * 7. Path traversal normalization: directory traversal sequences are stored as-is
 * 8. XSS payload storage: HTML/script payloads stored without sanitization
 *    (rendering layer must escape)
 */

describe("seo endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSeoController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSeoController(mockData);
	});

	// -- Path Uniqueness (one meta tag per normalized path) --------------------

	describe("path uniqueness", () => {
		it("upsert for same normalized path overwrites rather than duplicates", async () => {
			await controller.upsertMetaTag({ path: "/products", title: "v1" });
			await controller.upsertMetaTag({ path: "/products", title: "v2" });
			await controller.upsertMetaTag({ path: "/products/", title: "v3" });

			expect(mockData.size("metaTag")).toBe(1);
			const tag = await controller.getMetaTagByPath("/products");
			expect(tag?.title).toBe("v3");
		});

		it("trailing slash and no trailing slash resolve to same entry", async () => {
			const first = await controller.upsertMetaTag({
				path: "/about/",
				title: "About v1",
			});
			const second = await controller.upsertMetaTag({
				path: "/about",
				title: "About v2",
			});

			expect(second.id).toBe(first.id);
			expect(mockData.size("metaTag")).toBe(1);
		});

		it("paths differing only by case are treated as distinct entries", async () => {
			await controller.upsertMetaTag({ path: "/About", title: "Upper" });
			await controller.upsertMetaTag({ path: "/about", title: "Lower" });

			expect(mockData.size("metaTag")).toBe(2);
		});
	});

	// -- Redirect Chain / Self-referencing Redirects --------------------------

	describe("redirect chain detection", () => {
		it("allows creating a redirect where fromPath equals toPath (self-redirect)", async () => {
			const r = await controller.createRedirect({
				fromPath: "/loop",
				toPath: "/loop",
			});

			expect(r.fromPath).toBe("/loop");
			expect(r.toPath).toBe("/loop");
			expect(r.active).toBe(true);
		});

		it("allows creating a circular redirect chain (A->B, B->A)", async () => {
			const r1 = await controller.createRedirect({
				fromPath: "/page-a",
				toPath: "/page-b",
			});
			const r2 = await controller.createRedirect({
				fromPath: "/page-b",
				toPath: "/page-a",
			});

			expect(r1.active).toBe(true);
			expect(r2.active).toBe(true);
			expect(mockData.size("redirect")).toBe(2);
		});

		it("allows a three-hop redirect chain (A->B->C->A)", async () => {
			await controller.createRedirect({ fromPath: "/a", toPath: "/b" });
			await controller.createRedirect({ fromPath: "/b", toPath: "/c" });
			await controller.createRedirect({ fromPath: "/c", toPath: "/a" });

			expect(mockData.size("redirect")).toBe(3);
			expect((await controller.getRedirectByPath("/a"))?.toPath).toBe("/b");
			expect((await controller.getRedirectByPath("/b"))?.toPath).toBe("/c");
			expect((await controller.getRedirectByPath("/c"))?.toPath).toBe("/a");
		});

		it("updating a redirect to point back to its fromPath creates self-loop", async () => {
			const r = await controller.createRedirect({
				fromPath: "/source",
				toPath: "/dest",
			});

			const updated = await controller.updateRedirect(r.id, {
				toPath: "/source",
			});

			expect(updated?.fromPath).toBe("/source");
			expect(updated?.toPath).toBe("/source");
		});
	});

	// -- Meta Tag Length / Content Integrity -----------------------------------

	describe("meta tag content integrity", () => {
		it("stores extremely long title without silent truncation", async () => {
			const longTitle = "A".repeat(5000);
			const tag = await controller.upsertMetaTag({
				path: "/long-title",
				title: longTitle,
			});

			expect(tag.title).toBe(longTitle);
			expect(tag.title?.length).toBe(5000);
		});

		it("stores extremely long description without silent truncation", async () => {
			const longDesc = "D".repeat(10000);
			const tag = await controller.upsertMetaTag({
				path: "/long-desc",
				description: longDesc,
			});

			expect(tag.description?.length).toBe(10000);
		});

		it("stores XSS payloads in title verbatim (rendering must escape)", async () => {
			const xssPayload = '<script>document.cookie="stolen"</script>';
			const tag = await controller.upsertMetaTag({
				path: "/xss-title",
				title: xssPayload,
			});

			expect(tag.title).toBe(xssPayload);
			const fetched = await controller.getMetaTagByPath("/xss-title");
			expect(fetched?.title).toBe(xssPayload);
		});

		it("stores XSS payloads in description verbatim", async () => {
			const payload = '"><img src=x onerror=alert(document.domain)>';
			const tag = await controller.upsertMetaTag({
				path: "/xss-desc",
				description: payload,
			});

			expect(tag.description).toBe(payload);
		});

		it("stores script injection in ogTitle and twitterTitle", async () => {
			const script = "<script>alert(1)</script>";
			const tag = await controller.upsertMetaTag({
				path: "/og-xss",
				ogTitle: script,
				twitterTitle: script,
			});

			expect(tag.ogTitle).toBe(script);
			expect(tag.twitterTitle).toBe(script);
		});
	});

	// -- Canonical URL Validation ---------------------------------------------

	describe("canonical URL validation", () => {
		it("accepts a valid HTTPS canonical URL", async () => {
			const tag = await controller.upsertMetaTag({
				path: "/valid-canonical",
				canonicalUrl: "https://example.com/valid-canonical",
			});

			expect(tag.canonicalUrl).toBe("https://example.com/valid-canonical");
		});

		it("accepts a javascript: protocol canonical URL (no protocol guard)", async () => {
			const tag = await controller.upsertMetaTag({
				path: "/js-canonical",
				canonicalUrl: "javascript:alert(1)",
			});

			expect(tag.canonicalUrl).toBe("javascript:alert(1)");
		});

		it("accepts a data: URI as canonical URL", async () => {
			const tag = await controller.upsertMetaTag({
				path: "/data-canonical",
				canonicalUrl: "data:text/html,<h1>pwned</h1>",
			});

			expect(tag.canonicalUrl).toBe("data:text/html,<h1>pwned</h1>");
		});

		it("accepts an empty string as canonical URL", async () => {
			const tag = await controller.upsertMetaTag({
				path: "/empty-canonical",
				canonicalUrl: "",
			});

			// Empty string is falsy, so toMetaTag converts it to undefined
			expect(tag.canonicalUrl).toBe("");
		});
	});

	// -- Sitemap / noIndex Enforcement ----------------------------------------

	describe("noIndex enforcement in sitemap", () => {
		it("noIndex=true pages are excluded from sitemap entries", async () => {
			await controller.upsertMetaTag({
				path: "/public",
				title: "Public",
				noIndex: false,
			});
			await controller.upsertMetaTag({
				path: "/hidden",
				title: "Hidden",
				noIndex: true,
			});

			const entries = await controller.getSitemapEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].path).toBe("/public");
		});

		it("flipping noIndex from false to true removes page from sitemap", async () => {
			await controller.upsertMetaTag({
				path: "/flip",
				title: "Flip",
				noIndex: false,
			});
			expect(await controller.getSitemapEntries()).toHaveLength(1);

			await controller.upsertMetaTag({
				path: "/flip",
				title: "Flip",
				noIndex: true,
			});
			expect(await controller.getSitemapEntries()).toHaveLength(0);
		});

		it("noFollow pages are still included in sitemap (only noIndex excludes)", async () => {
			await controller.upsertMetaTag({
				path: "/nofollow-page",
				title: "NF",
				noFollow: true,
				noIndex: false,
			});

			const entries = await controller.getSitemapEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].path).toBe("/nofollow-page");
		});

		it("deleting a meta tag removes it from sitemap", async () => {
			const tag = await controller.upsertMetaTag({
				path: "/temp-page",
				title: "Temp",
			});

			expect(await controller.getSitemapEntries()).toHaveLength(1);
			await controller.deleteMetaTag(tag.id);
			expect(await controller.getSitemapEntries()).toHaveLength(0);
		});

		it("upsert without noIndex defaults to false (page appears in sitemap)", async () => {
			await controller.upsertMetaTag({ path: "/default-index" });

			const entries = await controller.getSitemapEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].path).toBe("/default-index");
		});
	});

	// -- Path Traversal / Normalization ---------------------------------------

	describe("path traversal normalization", () => {
		it("stores path traversal sequences as-is after normalization", async () => {
			const tag = await controller.upsertMetaTag({
				path: "/../../etc/passwd",
				title: "Traversal",
			});

			// normalizePath trims trailing slashes and ensures leading slash
			expect(tag.path).toBe("/../../etc/passwd");
		});

		it("stores null bytes in path as-is", async () => {
			const tag = await controller.upsertMetaTag({
				path: "/page\x00injected",
				title: "Null byte",
			});

			expect(tag.path).toBe("/page\x00injected");
		});

		it("normalizes path with only whitespace to root with leading slash", async () => {
			const tag = await controller.upsertMetaTag({
				path: "   ",
				title: "Whitespace",
			});

			// trim + replace trailing slashes on empty => add leading slash
			expect(tag.path).toBe("/");
		});
	});

	// -- Redirect Integrity ---------------------------------------------------

	describe("redirect integrity", () => {
		it("deactivated redirects are not returned by getRedirectByPath", async () => {
			const r = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			await controller.updateRedirect(r.id, { active: false });

			expect(await controller.getRedirectByPath("/old")).toBeNull();
		});

		it("multiple redirects from different sources to same target are all stored", async () => {
			await controller.createRedirect({ fromPath: "/old-1", toPath: "/new" });
			await controller.createRedirect({ fromPath: "/old-2", toPath: "/new" });
			await controller.createRedirect({ fromPath: "/old-3", toPath: "/new" });

			expect(mockData.size("redirect")).toBe(3);
			const all = await controller.listRedirects();
			const targets = all.map((r) => r.toPath);
			expect(targets.every((t) => t === "/new")).toBe(true);
		});

		it("redirect status code defaults to 301 (permanent)", async () => {
			const r = await controller.createRedirect({
				fromPath: "/from",
				toPath: "/to",
			});

			expect(r.statusCode).toBe(301);
		});

		it("delete returns false for non-existent redirect id", async () => {
			expect(await controller.deleteRedirect("fake-id-12345")).toBe(false);
		});

		it("update returns null for non-existent redirect id", async () => {
			const result = await controller.updateRedirect("fake-id-12345", {
				toPath: "/somewhere",
			});
			expect(result).toBeNull();
		});
	});

	// -- Cross-entity Isolation -----------------------------------------------

	describe("cross-entity isolation", () => {
		it("meta tag and redirect operations do not interfere with each other", async () => {
			await controller.upsertMetaTag({ path: "/page", title: "Page" });
			const r = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/page",
			});

			await controller.deleteRedirect(r.id);
			expect(mockData.size("metaTag")).toBe(1);
			expect(mockData.size("redirect")).toBe(0);

			const tag = await controller.getMetaTagByPath("/page");
			expect(tag?.title).toBe("Page");
		});

		it("redirects do not appear in sitemap entries", async () => {
			await controller.createRedirect({ fromPath: "/old", toPath: "/new" });
			await controller.upsertMetaTag({ path: "/visible", title: "Vis" });

			const entries = await controller.getSitemapEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].path).toBe("/visible");
		});
	});
});
