import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSeoController } from "../service-impl";

describe("seo controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSeoController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSeoController(mockData);
	});

	// ── upsertMetaTag edge cases ─────────────────────────────────────────

	describe("upsertMetaTag edge cases", () => {
		it("normalizes path with multiple trailing slashes", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/products///",
				title: "Products",
			});
			expect(meta.path).toBe("/products");
		});

		it("normalizes path that is only slashes to root", async () => {
			const meta = await controller.upsertMetaTag({
				path: "///",
				title: "Root",
			});
			expect(meta.path).toBe("/");
		});

		it("handles path with leading and trailing whitespace", async () => {
			const meta = await controller.upsertMetaTag({
				path: "  /products/  ",
				title: "Products",
			});
			expect(meta.path).toBe("/products");
		});

		it("handles special characters in path", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/products/café-latte",
				title: "Café Latte",
			});
			expect(meta.path).toBe("/products/café-latte");
		});

		it("handles URL-encoded characters in path", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/products/%E4%B8%AD%E6%96%87",
				title: "Chinese Products",
			});
			expect(meta.path).toBe("/products/%E4%B8%AD%E6%96%87");
		});

		it("handles very long title and description", async () => {
			const longTitle = "T".repeat(10000);
			const longDesc = "D".repeat(10000);
			const meta = await controller.upsertMetaTag({
				path: "/long",
				title: longTitle,
				description: longDesc,
			});
			expect(meta.title).toBe(longTitle);
			expect(meta.description).toBe(longDesc);
		});

		it("handles HTML entities in title and description", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/xss",
				title: '<script>alert("xss")</script>',
				description: '"><img src=x onerror=alert(1)>',
			});
			expect(meta.title).toBe('<script>alert("xss")</script>');
			expect(meta.description).toBe('"><img src=x onerror=alert(1)>');
		});

		it("stores empty string title as-is", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/empty-title",
				title: "",
			});
			expect(meta.title).toBe("");
		});

		it("upsert overwrites noIndex from true to false", async () => {
			await controller.upsertMetaTag({ path: "/page", noIndex: true });
			const updated = await controller.upsertMetaTag({
				path: "/page",
				noIndex: false,
			});
			expect(updated.noIndex).toBe(false);
		});

		it("upsert defaults noIndex/noFollow to false when not provided on update", async () => {
			await controller.upsertMetaTag({
				path: "/page",
				noIndex: true,
				noFollow: true,
			});
			const updated = await controller.upsertMetaTag({
				path: "/page",
				title: "Updated",
			});
			expect(updated.noIndex).toBe(false);
			expect(updated.noFollow).toBe(false);
		});

		it("preserves complex nested jsonLd structure", async () => {
			const jsonLd = {
				"@context": "https://schema.org",
				"@type": "Product",
				name: "Widget",
				offers: {
					"@type": "Offer",
					price: "19.99",
					priceCurrency: "USD",
				},
				review: [
					{
						"@type": "Review",
						author: "Alice",
						reviewRating: { ratingValue: 5 },
					},
				],
			};
			const meta = await controller.upsertMetaTag({
				path: "/product/widget",
				jsonLd,
			});
			expect(meta.jsonLd).toEqual(jsonLd);
		});

		it("each upsert for different paths generates unique ids", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const meta = await controller.upsertMetaTag({
					path: `/page-${i}`,
					title: `Page ${i}`,
				});
				ids.add(meta.id);
			}
			expect(ids.size).toBe(20);
		});

		it("upsert for same path preserves the original id", async () => {
			const first = await controller.upsertMetaTag({
				path: "/stable",
				title: "v1",
			});
			const second = await controller.upsertMetaTag({
				path: "/stable",
				title: "v2",
			});
			expect(second.id).toBe(first.id);
		});

		it("concurrent upserts for different paths succeed", async () => {
			const results = await Promise.all(
				Array.from({ length: 10 }, (_, i) =>
					controller.upsertMetaTag({
						path: `/concurrent-${i}`,
						title: `Concurrent ${i}`,
					}),
				),
			);
			const ids = new Set(results.map((r) => r.id));
			expect(ids.size).toBe(10);
			expect(mockData.size("metaTag")).toBe(10);
		});
	});

	// ── getMetaTagByPath edge cases ──────────────────────────────────────

	describe("getMetaTagByPath edge cases", () => {
		it("normalizes lookup path that has no leading slash", async () => {
			await controller.upsertMetaTag({ path: "/about", title: "About" });
			const found = await controller.getMetaTagByPath("about");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("About");
		});

		it("normalizes lookup path with whitespace", async () => {
			await controller.upsertMetaTag({ path: "/about", title: "About" });
			const found = await controller.getMetaTagByPath("  /about  ");
			expect(found).not.toBeNull();
		});

		it("distinguishes between similar paths", async () => {
			await controller.upsertMetaTag({ path: "/products", title: "Products" });
			await controller.upsertMetaTag({
				path: "/products/new",
				title: "New Products",
			});
			expect((await controller.getMetaTagByPath("/products"))?.title).toBe(
				"Products",
			);
			expect((await controller.getMetaTagByPath("/products/new"))?.title).toBe(
				"New Products",
			);
		});

		it("is case-sensitive for paths", async () => {
			await controller.upsertMetaTag({ path: "/About", title: "About" });
			const found = await controller.getMetaTagByPath("/about");
			expect(found).toBeNull();
		});

		it("returns fully populated meta tag from lookup", async () => {
			await controller.upsertMetaTag({
				path: "/full",
				title: "Full",
				description: "Desc",
				canonicalUrl: "https://example.com/full",
				ogTitle: "OG Full",
				ogDescription: "OG Desc",
				ogImage: "https://example.com/og.jpg",
				ogType: "website",
				twitterCard: "summary_large_image",
				twitterTitle: "Twitter Full",
				twitterDescription: "Twitter Desc",
				twitterImage: "https://example.com/tw.jpg",
				noIndex: true,
				noFollow: true,
				jsonLd: { "@type": "WebPage" },
			});

			const found = await controller.getMetaTagByPath("/full");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Full");
			expect(found?.canonicalUrl).toBe("https://example.com/full");
			expect(found?.ogTitle).toBe("OG Full");
			expect(found?.twitterCard).toBe("summary_large_image");
			expect(found?.noIndex).toBe(true);
			expect(found?.noFollow).toBe(true);
			expect(found?.jsonLd).toEqual({ "@type": "WebPage" });
		});
	});

	// ── getMetaTag edge cases ────────────────────────────────────────────

	describe("getMetaTag edge cases", () => {
		it("returns null for empty string id", async () => {
			expect(await controller.getMetaTag("")).toBeNull();
		});

		it("returns correct tag when many exist", async () => {
			const tags: Awaited<ReturnType<typeof controller.upsertMetaTag>>[] = [];
			for (let i = 0; i < 10; i++) {
				tags.push(
					await controller.upsertMetaTag({
						path: `/p-${i}`,
						title: `Title ${i}`,
					}),
				);
			}
			const middle = await controller.getMetaTag(tags[5].id);
			expect(middle?.path).toBe("/p-5");
			expect(middle?.title).toBe("Title 5");
		});

		it("returns null after meta tag is deleted", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/temp",
				title: "Temp",
			});
			await controller.deleteMetaTag(meta.id);
			expect(await controller.getMetaTag(meta.id)).toBeNull();
		});
	});

	// ── deleteMetaTag edge cases ─────────────────────────────────────────

	describe("deleteMetaTag edge cases", () => {
		it("double deletion returns false on second attempt", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/del",
				title: "Del",
			});
			expect(await controller.deleteMetaTag(meta.id)).toBe(true);
			expect(await controller.deleteMetaTag(meta.id)).toBe(false);
		});

		it("returns false for empty string id", async () => {
			expect(await controller.deleteMetaTag("")).toBe(false);
		});

		it("deleting one meta tag does not affect others", async () => {
			const a = await controller.upsertMetaTag({ path: "/a", title: "A" });
			await controller.upsertMetaTag({ path: "/b", title: "B" });
			await controller.deleteMetaTag(a.id);
			expect(mockData.size("metaTag")).toBe(1);
			expect((await controller.getMetaTagByPath("/b"))?.title).toBe("B");
		});

		it("deleted tag no longer appears in listMetaTags or getMetaTagByPath", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/gone",
				title: "Gone",
			});
			await controller.upsertMetaTag({ path: "/stay", title: "Stay" });
			await controller.deleteMetaTag(meta.id);
			expect(await controller.getMetaTagByPath("/gone")).toBeNull();
			const list = await controller.listMetaTags();
			expect(list).toHaveLength(1);
			expect(list[0].path).toBe("/stay");
		});
	});

	// ── listMetaTags edge cases ──────────────────────────────────────────

	describe("listMetaTags edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.upsertMetaTag({ path: "/page", title: "Page" });
			expect(await controller.listMetaTags({ take: 0 })).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total", async () => {
			await controller.upsertMetaTag({ path: "/page", title: "Page" });
			expect(await controller.listMetaTags({ skip: 100 })).toHaveLength(0);
		});

		it("handles take larger than total items", async () => {
			await controller.upsertMetaTag({ path: "/only", title: "Only" });
			expect(await controller.listMetaTags({ take: 100 })).toHaveLength(1);
		});

		it("paginates correctly through all items", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.upsertMetaTag({
					path: `/page-${i}`,
					title: `Page ${i}`,
				});
			}
			const page1 = await controller.listMetaTags({ take: 3, skip: 0 });
			const page2 = await controller.listMetaTags({ take: 3, skip: 3 });
			const page3 = await controller.listMetaTags({ take: 3, skip: 6 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			expect(page3).toHaveLength(1);
			const allPaths = [
				...page1.map((t) => t.path),
				...page2.map((t) => t.path),
				...page3.map((t) => t.path),
			];
			expect(new Set(allPaths).size).toBe(7);
		});

		it("returns all items with empty params object", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.upsertMetaTag({ path: `/p-${i}`, title: `P ${i}` });
			}
			expect(await controller.listMetaTags({})).toHaveLength(3);
		});
	});

	// ── createRedirect edge cases ────────────────────────────────────────

	describe("createRedirect edge cases", () => {
		it("supports all valid status codes (301, 302, 307, 308)", async () => {
			for (const code of [301, 302, 307, 308] as const) {
				const r = await controller.createRedirect({
					fromPath: `/from-${code}`,
					toPath: `/to-${code}`,
					statusCode: code,
				});
				expect(r.statusCode).toBe(code);
			}
		});

		it("normalizes paths with whitespace and missing slash", async () => {
			const redirect = await controller.createRedirect({
				fromPath: "  old-page  ",
				toPath: "  new-page  ",
			});
			expect(redirect.fromPath).toBe("/old-page");
			expect(redirect.toPath).toBe("/new-page");
		});

		it("handles special characters in redirect paths", async () => {
			const redirect = await controller.createRedirect({
				fromPath: "/blog/hello-world!@#",
				toPath: "/blog/hello-world",
			});
			expect(redirect.fromPath).toBe("/blog/hello-world!@#");
		});

		it("allows multiple redirects pointing to same target", async () => {
			await controller.createRedirect({ fromPath: "/a", toPath: "/target" });
			await controller.createRedirect({ fromPath: "/b", toPath: "/target" });
			await controller.createRedirect({ fromPath: "/c", toPath: "/target" });
			expect(mockData.size("redirect")).toBe(3);
		});

		it("createdAt and updatedAt are equal on creation", async () => {
			const r = await controller.createRedirect({
				fromPath: "/f",
				toPath: "/t",
			});
			expect(r.createdAt.getTime()).toBe(r.updatedAt.getTime());
		});

		it("concurrent redirect creation produces unique ids", async () => {
			const results = await Promise.all(
				Array.from({ length: 10 }, (_, i) =>
					controller.createRedirect({
						fromPath: `/old-${i}`,
						toPath: `/new-${i}`,
					}),
				),
			);
			expect(new Set(results.map((r) => r.id)).size).toBe(10);
		});
	});

	// ── updateRedirect edge cases ────────────────────────────────────────

	describe("updateRedirect edge cases", () => {
		it("updates only fromPath without affecting other fields", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
				statusCode: 302,
			});
			const updated = await controller.updateRedirect(created.id, {
				fromPath: "/changed",
			});
			expect(updated?.fromPath).toBe("/changed");
			expect(updated?.toPath).toBe("/new");
			expect(updated?.statusCode).toBe(302);
			expect(updated?.active).toBe(true);
		});

		it("normalizes paths on update", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			const updated = await controller.updateRedirect(created.id, {
				fromPath: "updated-path/",
				toPath: "updated-dest/",
			});
			expect(updated?.fromPath).toBe("/updated-path");
			expect(updated?.toPath).toBe("/updated-dest");
		});

		it("updates all fields simultaneously", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			const updated = await controller.updateRedirect(created.id, {
				fromPath: "/changed-from",
				toPath: "/changed-to",
				statusCode: 308,
				active: false,
			});
			expect(updated?.fromPath).toBe("/changed-from");
			expect(updated?.toPath).toBe("/changed-to");
			expect(updated?.statusCode).toBe(308);
			expect(updated?.active).toBe(false);
		});

		it("preserves createdAt on update", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			const updated = await controller.updateRedirect(created.id, {
				toPath: "/newer",
			});
			expect(updated?.createdAt.getTime()).toBe(created.createdAt.getTime());
		});

		it("returns null for empty string id", async () => {
			expect(
				await controller.updateRedirect("", { toPath: "/new" }),
			).toBeNull();
		});

		it("reactivating a deactivated redirect makes it findable by path again", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			await controller.updateRedirect(created.id, { active: false });
			expect(await controller.getRedirectByPath("/old")).toBeNull();
			await controller.updateRedirect(created.id, { active: true });
			expect(await controller.getRedirectByPath("/old")).not.toBeNull();
		});

		it("multiple sequential updates accumulate correctly", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			await controller.updateRedirect(created.id, { statusCode: 302 });
			await controller.updateRedirect(created.id, { toPath: "/newer" });
			await controller.updateRedirect(created.id, { active: false });

			const final = await controller.getRedirect(created.id);
			expect(final?.statusCode).toBe(302);
			expect(final?.toPath).toBe("/newer");
			expect(final?.active).toBe(false);
			expect(final?.fromPath).toBe("/old");
		});
	});

	// ── deleteRedirect edge cases ────────────────────────────────────────

	describe("deleteRedirect edge cases", () => {
		it("double deletion returns false on second attempt", async () => {
			const r = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			expect(await controller.deleteRedirect(r.id)).toBe(true);
			expect(await controller.deleteRedirect(r.id)).toBe(false);
		});

		it("returns false for empty string id", async () => {
			expect(await controller.deleteRedirect("")).toBe(false);
		});

		it("deleting one redirect does not affect others", async () => {
			const a = await controller.createRedirect({
				fromPath: "/a",
				toPath: "/b",
			});
			await controller.createRedirect({ fromPath: "/c", toPath: "/d" });
			await controller.deleteRedirect(a.id);
			expect(mockData.size("redirect")).toBe(1);
			expect((await controller.getRedirectByPath("/c"))?.toPath).toBe("/d");
		});

		it("deleted redirect no longer appears in getRedirectByPath or listRedirects", async () => {
			const r = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			await controller.createRedirect({ fromPath: "/stay", toPath: "/here" });
			await controller.deleteRedirect(r.id);
			expect(await controller.getRedirectByPath("/old")).toBeNull();
			const list = await controller.listRedirects();
			expect(list).toHaveLength(1);
			expect(list[0].fromPath).toBe("/stay");
		});
	});

	// ── getRedirectByPath edge cases ─────────────────────────────────────

	describe("getRedirectByPath edge cases", () => {
		it("normalizes lookup path without leading slash", async () => {
			await controller.createRedirect({ fromPath: "/old", toPath: "/new" });
			const found = await controller.getRedirectByPath("old");
			expect(found).not.toBeNull();
			expect(found?.toPath).toBe("/new");
		});

		it("normalizes lookup path with whitespace", async () => {
			await controller.createRedirect({ fromPath: "/old", toPath: "/new" });
			expect(await controller.getRedirectByPath("  /old  ")).not.toBeNull();
		});

		it("returns reactivated redirect after deactivation", async () => {
			const r = await controller.createRedirect({
				fromPath: "/toggled",
				toPath: "/target",
			});
			await controller.updateRedirect(r.id, { active: false });
			await controller.updateRedirect(r.id, { active: true });
			const found = await controller.getRedirectByPath("/toggled");
			expect(found).not.toBeNull();
			expect(found?.toPath).toBe("/target");
		});

		it("distinguishes between similar fromPaths", async () => {
			await controller.createRedirect({
				fromPath: "/blog",
				toPath: "/articles",
			});
			await controller.createRedirect({
				fromPath: "/blog/old",
				toPath: "/articles/old",
			});
			expect((await controller.getRedirectByPath("/blog"))?.toPath).toBe(
				"/articles",
			);
			expect((await controller.getRedirectByPath("/blog/old"))?.toPath).toBe(
				"/articles/old",
			);
		});
	});

	// ── listRedirects edge cases ─────────────────────────────────────────

	describe("listRedirects edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.createRedirect({ fromPath: "/a", toPath: "/b" });
			expect(await controller.listRedirects({ take: 0 })).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total", async () => {
			await controller.createRedirect({ fromPath: "/a", toPath: "/b" });
			expect(await controller.listRedirects({ skip: 100 })).toHaveLength(0);
		});

		it("filters by active=true excludes inactive", async () => {
			const r1 = await controller.createRedirect({
				fromPath: "/a",
				toPath: "/b",
			});
			await controller.createRedirect({ fromPath: "/c", toPath: "/d" });
			await controller.updateRedirect(r1.id, { active: false });
			const active = await controller.listRedirects({ active: true });
			expect(active).toHaveLength(1);
			expect(active[0].fromPath).toBe("/c");
		});

		it("filters by active=false excludes active", async () => {
			const r1 = await controller.createRedirect({
				fromPath: "/a",
				toPath: "/b",
			});
			await controller.createRedirect({ fromPath: "/c", toPath: "/d" });
			await controller.updateRedirect(r1.id, { active: false });
			const inactive = await controller.listRedirects({ active: false });
			expect(inactive).toHaveLength(1);
			expect(inactive[0].fromPath).toBe("/a");
		});

		it("combines active filter with pagination", async () => {
			for (let i = 0; i < 6; i++) {
				const r = await controller.createRedirect({
					fromPath: `/old-${i}`,
					toPath: `/new-${i}`,
				});
				if (i % 2 === 0) {
					await controller.updateRedirect(r.id, { active: false });
				}
			}
			expect(await controller.listRedirects({ active: true })).toHaveLength(3);
			expect(
				await controller.listRedirects({ active: true, take: 2, skip: 0 }),
			).toHaveLength(2);
			expect(
				await controller.listRedirects({ active: true, take: 2, skip: 2 }),
			).toHaveLength(1);
		});
	});

	// ── getSitemapEntries edge cases ──────────────────────────────────────

	describe("getSitemapEntries edge cases", () => {
		it("excludes all noIndex pages leaving empty sitemap", async () => {
			await controller.upsertMetaTag({
				path: "/s1",
				title: "S1",
				noIndex: true,
			});
			await controller.upsertMetaTag({
				path: "/s2",
				title: "S2",
				noIndex: true,
			});
			expect(await controller.getSitemapEntries()).toHaveLength(0);
		});

		it("includes noFollow pages in sitemap (only noIndex excludes)", async () => {
			await controller.upsertMetaTag({
				path: "/nofollow",
				title: "NF",
				noFollow: true,
				noIndex: false,
			});
			const entries = await controller.getSitemapEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].path).toBe("/nofollow");
		});

		it("previously indexable page becomes excluded when noIndex set", async () => {
			await controller.upsertMetaTag({
				path: "/evolving",
				title: "V",
				noIndex: false,
			});
			expect(await controller.getSitemapEntries()).toHaveLength(1);
			await controller.upsertMetaTag({
				path: "/evolving",
				title: "H",
				noIndex: true,
			});
			expect(await controller.getSitemapEntries()).toHaveLength(0);
		});

		it("page becomes visible in sitemap when noIndex is toggled off", async () => {
			await controller.upsertMetaTag({
				path: "/toggle",
				title: "H",
				noIndex: true,
			});
			expect(await controller.getSitemapEntries()).toHaveLength(0);
			await controller.upsertMetaTag({
				path: "/toggle",
				title: "V",
				noIndex: false,
			});
			expect(await controller.getSitemapEntries()).toHaveLength(1);
		});

		it("handles large number of meta tags with mixed noIndex", async () => {
			for (let i = 0; i < 100; i++) {
				await controller.upsertMetaTag({
					path: `/page-${i}`,
					title: `Page ${i}`,
					noIndex: i % 10 === 0,
				});
			}
			expect(await controller.getSitemapEntries()).toHaveLength(90);
		});

		it("deleted meta tags do not appear in sitemap", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/del",
				title: "Del",
			});
			await controller.upsertMetaTag({ path: "/kept", title: "Kept" });
			await controller.deleteMetaTag(meta.id);
			const entries = await controller.getSitemapEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].path).toBe("/kept");
		});
	});

	// ── cross-entity isolation ───────────────────────────────────────────

	describe("cross-entity isolation", () => {
		it("meta tag operations do not affect redirects", async () => {
			await controller.createRedirect({ fromPath: "/old", toPath: "/new" });
			const meta = await controller.upsertMetaTag({
				path: "/page",
				title: "Page",
			});
			await controller.deleteMetaTag(meta.id);
			expect(mockData.size("redirect")).toBe(1);
		});

		it("redirect operations do not affect meta tags", async () => {
			await controller.upsertMetaTag({ path: "/page", title: "Page" });
			const r = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			await controller.deleteRedirect(r.id);
			expect(mockData.size("metaTag")).toBe(1);
		});

		it("redirects do not appear in sitemap entries", async () => {
			await controller.createRedirect({ fromPath: "/old", toPath: "/new" });
			await controller.upsertMetaTag({ path: "/page", title: "Page" });
			const entries = await controller.getSitemapEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].path).toBe("/page");
		});
	});

	// ── data store consistency ────────────────────────────────────────────

	describe("data store consistency", () => {
		it("upsert for same path does not create duplicate store entries", async () => {
			await controller.upsertMetaTag({ path: "/dup", title: "v1" });
			await controller.upsertMetaTag({ path: "/dup", title: "v2" });
			await controller.upsertMetaTag({ path: "/dup", title: "v3" });
			expect(mockData.size("metaTag")).toBe(1);
		});

		it("store is empty after removing all meta tags", async () => {
			const tags: Awaited<ReturnType<typeof controller.upsertMetaTag>>[] = [];
			for (let i = 0; i < 3; i++) {
				tags.push(
					await controller.upsertMetaTag({ path: `/p-${i}`, title: `T ${i}` }),
				);
			}
			for (const tag of tags) await controller.deleteMetaTag(tag.id);
			expect(mockData.size("metaTag")).toBe(0);
		});

		it("store is empty after removing all redirects", async () => {
			const redirects: Awaited<ReturnType<typeof controller.createRedirect>>[] =
				[];
			for (let i = 0; i < 3; i++) {
				redirects.push(
					await controller.createRedirect({
						fromPath: `/o-${i}`,
						toPath: `/n-${i}`,
					}),
				);
			}
			for (const r of redirects) await controller.deleteRedirect(r.id);
			expect(mockData.size("redirect")).toBe(0);
		});
	});

	// ── complex lifecycle scenarios ──────────────────────────────────────

	describe("complex lifecycle scenarios", () => {
		it("full meta tag lifecycle: create, update, verify sitemap, delete", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/lifecycle",
				title: "Original",
				noIndex: false,
			});
			expect(await controller.getSitemapEntries()).toHaveLength(1);

			const updated = await controller.upsertMetaTag({
				path: "/lifecycle",
				title: "Updated",
				noIndex: true,
			});
			expect(updated.id).toBe(meta.id);
			expect(await controller.getSitemapEntries()).toHaveLength(0);
			expect(await controller.getMetaTagByPath("/lifecycle")).not.toBeNull();

			expect(await controller.deleteMetaTag(meta.id)).toBe(true);
			expect(await controller.getMetaTag(meta.id)).toBeNull();
			expect(await controller.getMetaTagByPath("/lifecycle")).toBeNull();
		});

		it("full redirect lifecycle: create, update, deactivate, reactivate, delete", async () => {
			const r = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});
			expect(await controller.getRedirectByPath("/old")).not.toBeNull();

			await controller.updateRedirect(r.id, { toPath: "/newer" });
			expect((await controller.getRedirectByPath("/old"))?.toPath).toBe(
				"/newer",
			);

			await controller.updateRedirect(r.id, { active: false });
			expect(await controller.getRedirectByPath("/old")).toBeNull();
			expect((await controller.getRedirect(r.id))?.active).toBe(false);

			await controller.updateRedirect(r.id, { active: true });
			expect(await controller.getRedirectByPath("/old")).not.toBeNull();

			expect(await controller.deleteRedirect(r.id)).toBe(true);
			expect(await controller.getRedirect(r.id)).toBeNull();
		});

		it("interleaved meta tag and redirect operations maintain isolation", async () => {
			const meta1 = await controller.upsertMetaTag({
				path: "/products",
				title: "Prod",
			});
			await controller.createRedirect({
				fromPath: "/old-prod",
				toPath: "/products",
			});
			await controller.upsertMetaTag({ path: "/about", title: "About" });
			const r2 = await controller.createRedirect({
				fromPath: "/old-about",
				toPath: "/about",
			});

			expect(mockData.size("metaTag")).toBe(2);
			expect(mockData.size("redirect")).toBe(2);

			await controller.deleteMetaTag(meta1.id);
			expect(mockData.size("metaTag")).toBe(1);
			expect(mockData.size("redirect")).toBe(2);

			await controller.deleteRedirect(r2.id);
			expect(mockData.size("metaTag")).toBe(1);
			expect(mockData.size("redirect")).toBe(1);
		});

		it("recreating a meta tag after deletion gets new id", async () => {
			const original = await controller.upsertMetaTag({
				path: "/re",
				title: "v1",
			});
			await controller.deleteMetaTag(original.id);
			const recreated = await controller.upsertMetaTag({
				path: "/re",
				title: "v2",
			});
			expect(recreated.id).not.toBe(original.id);
			expect(recreated.title).toBe("v2");
			expect(mockData.size("metaTag")).toBe(1);
		});
	});
});
