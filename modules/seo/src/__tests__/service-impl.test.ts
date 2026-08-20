import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSeoController } from "../service-impl";

describe("createSeoController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSeoController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSeoController(mockData);
	});

	// ── upsertMetaTag ─────────────────────────────────────────────────────────

	describe("upsertMetaTag", () => {
		it("creates a meta tag with minimal fields", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});

			expect(meta.id).toBeDefined();
			expect(meta.path).toBe("/products");
			expect(meta.title).toBe("Products");
			expect(meta.noIndex).toBe(false);
			expect(meta.noFollow).toBe(false);
			expect(meta.createdAt).toBeInstanceOf(Date);
			expect(meta.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a meta tag with all fields", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/about",
				title: "About Us",
				description: "Learn about our company",
				canonicalUrl: "https://example.com/about",
				ogTitle: "About Our Company",
				ogDescription: "Company info",
				ogImage: "https://example.com/og.jpg",
				ogType: "website",
				twitterCard: "summary_large_image",
				twitterTitle: "About",
				twitterDescription: "Company info",
				twitterImage: "https://example.com/twitter.jpg",
				noIndex: true,
				noFollow: true,
				jsonLd: { "@type": "Organization", name: "Example" },
			});

			expect(meta.title).toBe("About Us");
			expect(meta.description).toBe("Learn about our company");
			expect(meta.canonicalUrl).toBe("https://example.com/about");
			expect(meta.ogTitle).toBe("About Our Company");
			expect(meta.ogImage).toBe("https://example.com/og.jpg");
			expect(meta.ogType).toBe("website");
			expect(meta.twitterCard).toBe("summary_large_image");
			expect(meta.noIndex).toBe(true);
			expect(meta.noFollow).toBe(true);
			expect(meta.jsonLd).toEqual({
				"@type": "Organization",
				name: "Example",
			});
		});

		it("normalizes paths (trims trailing slashes)", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/products/",
				title: "Products",
			});

			expect(meta.path).toBe("/products");
		});

		it("adds leading slash if missing", async () => {
			const meta = await controller.upsertMetaTag({
				path: "products",
				title: "Products",
			});

			expect(meta.path).toBe("/products");
		});

		it("updates existing meta tag for the same path", async () => {
			await controller.upsertMetaTag({
				path: "/products",
				title: "Products v1",
			});

			const updated = await controller.upsertMetaTag({
				path: "/products",
				title: "Products v2",
			});

			expect(updated.title).toBe("Products v2");
			expect(mockData.size("metaTag")).toBe(1);
		});

		it("preserves createdAt on update", async () => {
			const original = await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});

			const updated = await controller.upsertMetaTag({
				path: "/products",
				title: "Updated",
			});

			expect(updated.createdAt).toEqual(original.createdAt);
		});

		it("stores the meta tag in the data service", async () => {
			await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});

			expect(mockData.size("metaTag")).toBe(1);
		});
	});

	// ── getMetaTagByPath ──────────────────────────────────────────────────────

	describe("getMetaTagByPath", () => {
		it("returns a meta tag by path", async () => {
			await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});

			const found = await controller.getMetaTagByPath("/products");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Products");
		});

		it("normalizes the lookup path", async () => {
			await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});

			const found = await controller.getMetaTagByPath("/products/");
			expect(found).not.toBeNull();
		});

		it("returns null for non-existent path", async () => {
			const found = await controller.getMetaTagByPath("/nothing");
			expect(found).toBeNull();
		});
	});

	// ── getMetaTag ────────────────────────────────────────────────────────────

	describe("getMetaTag", () => {
		it("returns a meta tag by id", async () => {
			const created = await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});

			const found = await controller.getMetaTag(created.id);
			expect(found).not.toBeNull();
			expect(found?.path).toBe("/products");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getMetaTag("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── deleteMetaTag ─────────────────────────────────────────────────────────

	describe("deleteMetaTag", () => {
		it("deletes an existing meta tag", async () => {
			const created = await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});

			const deleted = await controller.deleteMetaTag(created.id);
			expect(deleted).toBe(true);
			expect(mockData.size("metaTag")).toBe(0);
		});

		it("returns false for non-existent meta tag", async () => {
			const deleted = await controller.deleteMetaTag("non-existent");
			expect(deleted).toBe(false);
		});
	});

	// ── listMetaTags ──────────────────────────────────────────────────────────

	describe("listMetaTags", () => {
		it("returns all meta tags", async () => {
			await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});
			await controller.upsertMetaTag({
				path: "/about",
				title: "About",
			});

			const tags = await controller.listMetaTags();
			expect(tags).toHaveLength(2);
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.upsertMetaTag({
					path: `/page-${i}`,
					title: `Page ${i}`,
				});
			}

			const tags = await controller.listMetaTags({ take: 3 });
			expect(tags).toHaveLength(3);
		});

		it("respects skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.upsertMetaTag({
					path: `/page-${i}`,
					title: `Page ${i}`,
				});
			}

			const tags = await controller.listMetaTags({ skip: 3 });
			expect(tags).toHaveLength(2);
		});

		it("returns empty array when no meta tags exist", async () => {
			const tags = await controller.listMetaTags();
			expect(tags).toEqual([]);
		});
	});

	// ── createRedirect ────────────────────────────────────────────────────────

	describe("createRedirect", () => {
		it("creates a redirect with defaults", async () => {
			const redirect = await controller.createRedirect({
				fromPath: "/old-page",
				toPath: "/new-page",
			});

			expect(redirect.id).toBeDefined();
			expect(redirect.fromPath).toBe("/old-page");
			expect(redirect.toPath).toBe("/new-page");
			expect(redirect.statusCode).toBe(301);
			expect(redirect.active).toBe(true);
			expect(redirect.createdAt).toBeInstanceOf(Date);
		});

		it("creates a redirect with custom status code", async () => {
			const redirect = await controller.createRedirect({
				fromPath: "/temp",
				toPath: "/other",
				statusCode: 302,
			});

			expect(redirect.statusCode).toBe(302);
		});

		it("normalizes paths", async () => {
			const redirect = await controller.createRedirect({
				fromPath: "old-page/",
				toPath: "new-page/",
			});

			expect(redirect.fromPath).toBe("/old-page");
			expect(redirect.toPath).toBe("/new-page");
		});

		it("stores the redirect in the data service", async () => {
			await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			expect(mockData.size("redirect")).toBe(1);
		});
	});

	// ── updateRedirect ────────────────────────────────────────────────────────

	describe("updateRedirect", () => {
		it("updates the toPath", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			const updated = await controller.updateRedirect(created.id, {
				toPath: "/newer",
			});

			expect(updated).not.toBeNull();
			expect(updated?.toPath).toBe("/newer");
			expect(updated?.fromPath).toBe("/old");
		});

		it("updates the status code", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			const updated = await controller.updateRedirect(created.id, {
				statusCode: 307,
			});

			expect(updated?.statusCode).toBe(307);
		});

		it("deactivates a redirect", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			const updated = await controller.updateRedirect(created.id, {
				active: false,
			});

			expect(updated?.active).toBe(false);
		});

		it("returns null for non-existent redirect", async () => {
			const updated = await controller.updateRedirect("non-existent", {
				toPath: "/new",
			});

			expect(updated).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			const updated = await controller.updateRedirect(created.id, {
				toPath: "/newer",
			});

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});
	});

	// ── deleteRedirect ────────────────────────────────────────────────────────

	describe("deleteRedirect", () => {
		it("deletes an existing redirect", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			const deleted = await controller.deleteRedirect(created.id);
			expect(deleted).toBe(true);
			expect(mockData.size("redirect")).toBe(0);
		});

		it("returns false for non-existent redirect", async () => {
			const deleted = await controller.deleteRedirect("non-existent");
			expect(deleted).toBe(false);
		});
	});

	// ── getRedirect ───────────────────────────────────────────────────────────

	describe("getRedirect", () => {
		it("returns a redirect by id", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			const found = await controller.getRedirect(created.id);
			expect(found).not.toBeNull();
			expect(found?.fromPath).toBe("/old");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getRedirect("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── getRedirectByPath ─────────────────────────────────────────────────────

	describe("getRedirectByPath", () => {
		it("returns an active redirect by fromPath", async () => {
			await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			const found = await controller.getRedirectByPath("/old");
			expect(found).not.toBeNull();
			expect(found?.toPath).toBe("/new");
		});

		it("does not return inactive redirects", async () => {
			const created = await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			await controller.updateRedirect(created.id, { active: false });

			const found = await controller.getRedirectByPath("/old");
			expect(found).toBeNull();
		});

		it("normalizes the lookup path", async () => {
			await controller.createRedirect({
				fromPath: "/old",
				toPath: "/new",
			});

			const found = await controller.getRedirectByPath("/old/");
			expect(found).not.toBeNull();
		});

		it("returns null for non-existent path", async () => {
			const found = await controller.getRedirectByPath("/nothing");
			expect(found).toBeNull();
		});
	});

	// ── listRedirects ─────────────────────────────────────────────────────────

	describe("listRedirects", () => {
		it("returns all redirects", async () => {
			await controller.createRedirect({
				fromPath: "/a",
				toPath: "/b",
			});
			await controller.createRedirect({
				fromPath: "/c",
				toPath: "/d",
			});

			const redirects = await controller.listRedirects();
			expect(redirects).toHaveLength(2);
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createRedirect({
					fromPath: `/old-${i}`,
					toPath: `/new-${i}`,
				});
			}

			const redirects = await controller.listRedirects({ take: 3 });
			expect(redirects).toHaveLength(3);
		});

		it("returns empty array when no redirects exist", async () => {
			const redirects = await controller.listRedirects();
			expect(redirects).toEqual([]);
		});
	});

	// ── getSitemapEntries ──────────────────────────────────────────────────────

	describe("getSitemapEntries", () => {
		it("returns meta tags as sitemap entries", async () => {
			await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});
			await controller.upsertMetaTag({
				path: "/about",
				title: "About",
			});

			const entries = await controller.getSitemapEntries();
			expect(entries).toHaveLength(2);
			expect(entries[0]?.path).toBeDefined();
			expect(entries[0]?.lastModified).toBeInstanceOf(Date);
		});

		it("excludes noIndex pages from sitemap", async () => {
			await controller.upsertMetaTag({
				path: "/products",
				title: "Products",
			});
			await controller.upsertMetaTag({
				path: "/secret",
				title: "Secret",
				noIndex: true,
			});

			const entries = await controller.getSitemapEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0]?.path).toBe("/products");
		});

		it("returns empty array when no meta tags exist", async () => {
			const entries = await controller.getSitemapEntries();
			expect(entries).toEqual([]);
		});
	});

	// ── Edge cases ────────────────────────────────────────────────────────────

	describe("edge cases", () => {
		it("handles concurrent creates", async () => {
			const [a, b] = await Promise.all([
				controller.createRedirect({
					fromPath: "/a",
					toPath: "/b",
				}),
				controller.createRedirect({
					fromPath: "/c",
					toPath: "/d",
				}),
			]);

			expect(a.id).not.toBe(b.id);
			expect(mockData.size("redirect")).toBe(2);
		});

		it("handles meta tag with no optional fields", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/minimal",
			});

			expect(meta.title).toBeUndefined();
			expect(meta.description).toBeUndefined();
			expect(meta.ogTitle).toBeUndefined();
		});

		it("handles root path", async () => {
			const meta = await controller.upsertMetaTag({
				path: "/",
				title: "Home",
			});

			expect(meta.path).toBe("/");

			const found = await controller.getMetaTagByPath("/");
			expect(found?.title).toBe("Home");
		});
	});
});
