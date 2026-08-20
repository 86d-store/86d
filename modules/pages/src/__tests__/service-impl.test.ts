import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPagesController } from "../service-impl";

describe("createPagesController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPagesController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPagesController(mockData);
	});

	// ── createPage ──────────────────────────────────────────────────────────────

	describe("createPage", () => {
		it("creates a draft page with minimal fields", async () => {
			const page = await controller.createPage({
				title: "About Us",
				content: "We are a small team.",
			});

			expect(page.id).toBeDefined();
			expect(page.title).toBe("About Us");
			expect(page.slug).toBe("about-us");
			expect(page.content).toBe("We are a small team.");
			expect(page.status).toBe("draft");
			expect(page.position).toBe(0);
			expect(page.showInNavigation).toBe(false);
			expect(page.publishedAt).toBeUndefined();
			expect(page.createdAt).toBeInstanceOf(Date);
			expect(page.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a published page with publishedAt set", async () => {
			const page = await controller.createPage({
				title: "Contact",
				content: "Reach out to us.",
				status: "published",
			});

			expect(page.status).toBe("published");
			expect(page.publishedAt).toBeInstanceOf(Date);
		});

		it("creates a page with all optional fields", async () => {
			const page = await controller.createPage({
				title: "Terms of Service",
				slug: "terms",
				content: "These are our terms.",
				excerpt: "Legal terms for using our store.",
				template: "legal",
				metaTitle: "Terms | Our Store",
				metaDescription: "Read our terms of service.",
				featuredImage: "https://example.com/terms.jpg",
				position: 5,
				showInNavigation: true,
				parentId: "parent-123",
			});

			expect(page.slug).toBe("terms");
			expect(page.excerpt).toBe("Legal terms for using our store.");
			expect(page.template).toBe("legal");
			expect(page.metaTitle).toBe("Terms | Our Store");
			expect(page.metaDescription).toBe("Read our terms of service.");
			expect(page.featuredImage).toBe("https://example.com/terms.jpg");
			expect(page.position).toBe(5);
			expect(page.showInNavigation).toBe(true);
			expect(page.parentId).toBe("parent-123");
		});

		it("auto-generates slug from title when slug is empty", async () => {
			const page = await controller.createPage({
				title: "Frequently Asked Questions!",
				slug: "",
				content: "FAQ content.",
			});

			expect(page.slug).toBe("frequently-asked-questions");
		});

		it("auto-generates slug from title when slug is omitted", async () => {
			const page = await controller.createPage({
				title: "Privacy Policy",
				content: "Your privacy matters.",
			});

			expect(page.slug).toBe("privacy-policy");
		});

		it("stores the page in the data service", async () => {
			await controller.createPage({
				title: "Test Page",
				content: "Test content.",
			});

			expect(mockData.size("page")).toBe(1);
		});
	});

	// ── getPage ─────────────────────────────────────────────────────────────────

	describe("getPage", () => {
		it("returns a page by id", async () => {
			const created = await controller.createPage({
				title: "About",
				content: "About us content.",
			});

			const found = await controller.getPage(created.id);
			expect(found).not.toBeNull();
			expect(found?.title).toBe("About");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getPage("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── getPageBySlug ───────────────────────────────────────────────────────────

	describe("getPageBySlug", () => {
		it("returns a page by slug", async () => {
			await controller.createPage({
				title: "Contact Us",
				content: "Contact info.",
			});

			const found = await controller.getPageBySlug("contact-us");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Contact Us");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getPageBySlug("no-such-page");
			expect(found).toBeNull();
		});
	});

	// ── updatePage ──────────────────────────────────────────────────────────────

	describe("updatePage", () => {
		it("updates the title", async () => {
			const created = await controller.createPage({
				title: "Original",
				content: "Content.",
			});

			const updated = await controller.updatePage(created.id, {
				title: "Updated Title",
			});

			expect(updated).not.toBeNull();
			expect(updated?.title).toBe("Updated Title");
			expect(updated?.slug).toBe("original");
		});

		it("updates content", async () => {
			const created = await controller.createPage({
				title: "Page",
				content: "Old content.",
			});

			const updated = await controller.updatePage(created.id, {
				content: "New content.",
			});

			expect(updated?.content).toBe("New content.");
		});

		it("updates position and navigation flag", async () => {
			const created = await controller.createPage({
				title: "Page",
				content: "Content.",
			});

			const updated = await controller.updatePage(created.id, {
				position: 10,
				showInNavigation: true,
			});

			expect(updated?.position).toBe(10);
			expect(updated?.showInNavigation).toBe(true);
		});

		it("updates SEO metadata", async () => {
			const created = await controller.createPage({
				title: "Page",
				content: "Content.",
			});

			const updated = await controller.updatePage(created.id, {
				metaTitle: "SEO Title",
				metaDescription: "SEO Description",
			});

			expect(updated?.metaTitle).toBe("SEO Title");
			expect(updated?.metaDescription).toBe("SEO Description");
		});

		it("sets publishedAt when transitioning to published", async () => {
			const created = await controller.createPage({
				title: "Draft",
				content: "Content.",
			});

			expect(created.publishedAt).toBeUndefined();

			const updated = await controller.updatePage(created.id, {
				status: "published",
			});

			expect(updated?.status).toBe("published");
			expect(updated?.publishedAt).toBeInstanceOf(Date);
		});

		it("preserves publishedAt when already published", async () => {
			const created = await controller.createPage({
				title: "Published",
				content: "Content.",
				status: "published",
			});

			const originalPublishedAt = created.publishedAt;

			const updated = await controller.updatePage(created.id, {
				title: "Updated Published",
			});

			expect(updated?.publishedAt).toEqual(originalPublishedAt);
		});

		it("returns null for non-existent page", async () => {
			const updated = await controller.updatePage("non-existent", {
				title: "Nope",
			});

			expect(updated).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await controller.createPage({
				title: "Page",
				content: "Content.",
			});

			const updated = await controller.updatePage(created.id, {
				title: "New Title",
			});

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});
	});

	// ── deletePage ──────────────────────────────────────────────────────────────

	describe("deletePage", () => {
		it("deletes an existing page", async () => {
			const created = await controller.createPage({
				title: "To Delete",
				content: "Content.",
			});

			const deleted = await controller.deletePage(created.id);
			expect(deleted).toBe(true);
			expect(mockData.size("page")).toBe(0);
		});

		it("returns false for non-existent page", async () => {
			const deleted = await controller.deletePage("non-existent");
			expect(deleted).toBe(false);
		});
	});

	// ── publishPage ─────────────────────────────────────────────────────────────

	describe("publishPage", () => {
		it("publishes a draft page", async () => {
			const created = await controller.createPage({
				title: "Draft",
				content: "Content.",
			});

			const published = await controller.publishPage(created.id);
			expect(published?.status).toBe("published");
			expect(published?.publishedAt).toBeInstanceOf(Date);
		});

		it("preserves existing publishedAt on re-publish", async () => {
			const created = await controller.createPage({
				title: "Page",
				content: "Content.",
				status: "published",
			});

			const originalDate = created.publishedAt;

			await controller.unpublishPage(created.id);
			const republished = await controller.publishPage(created.id);

			expect(republished?.publishedAt).toEqual(originalDate);
		});

		it("returns null for non-existent page", async () => {
			const result = await controller.publishPage("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── unpublishPage ───────────────────────────────────────────────────────────

	describe("unpublishPage", () => {
		it("unpublishes a published page", async () => {
			const created = await controller.createPage({
				title: "Published",
				content: "Content.",
				status: "published",
			});

			const unpublished = await controller.unpublishPage(created.id);
			expect(unpublished?.status).toBe("draft");
		});

		it("returns null for non-existent page", async () => {
			const result = await controller.unpublishPage("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── archivePage ─────────────────────────────────────────────────────────────

	describe("archivePage", () => {
		it("archives a page", async () => {
			const created = await controller.createPage({
				title: "To Archive",
				content: "Content.",
				status: "published",
			});

			const archived = await controller.archivePage(created.id);
			expect(archived?.status).toBe("archived");
		});

		it("returns null for non-existent page", async () => {
			const result = await controller.archivePage("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── listPages ───────────────────────────────────────────────────────────────

	describe("listPages", () => {
		it("returns all pages when no filters", async () => {
			await controller.createPage({
				title: "Page 1",
				content: "Content 1.",
			});
			await controller.createPage({
				title: "Page 2",
				content: "Content 2.",
			});

			const pages = await controller.listPages();
			expect(pages).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.createPage({
				title: "Draft",
				content: "Content.",
			});
			await controller.createPage({
				title: "Published",
				content: "Content.",
				status: "published",
			});

			const drafts = await controller.listPages({ status: "draft" });
			expect(drafts).toHaveLength(1);
			expect(drafts[0]?.title).toBe("Draft");

			const published = await controller.listPages({ status: "published" });
			expect(published).toHaveLength(1);
			expect(published[0]?.title).toBe("Published");
		});

		it("filters by showInNavigation", async () => {
			await controller.createPage({
				title: "Nav Page",
				content: "Content.",
				showInNavigation: true,
			});
			await controller.createPage({
				title: "Hidden Page",
				content: "Content.",
			});

			const navPages = await controller.listPages({
				showInNavigation: true,
			});
			expect(navPages).toHaveLength(1);
			expect(navPages[0]?.title).toBe("Nav Page");
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createPage({
					title: `Page ${i}`,
					content: `Content ${i}.`,
				});
			}

			const pages = await controller.listPages({ take: 3 });
			expect(pages).toHaveLength(3);
		});

		it("respects skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createPage({
					title: `Page ${i}`,
					content: `Content ${i}.`,
				});
			}

			const pages = await controller.listPages({ skip: 3 });
			expect(pages).toHaveLength(2);
		});

		it("returns empty array when no matches", async () => {
			const pages = await controller.listPages({ status: "published" });
			expect(pages).toEqual([]);
		});
	});

	// ── getNavigationPages ──────────────────────────────────────────────────────

	describe("getNavigationPages", () => {
		it("returns only published pages with showInNavigation", async () => {
			await controller.createPage({
				title: "About",
				content: "About content.",
				status: "published",
				showInNavigation: true,
			});
			await controller.createPage({
				title: "Hidden",
				content: "Hidden content.",
				status: "published",
				showInNavigation: false,
			});
			await controller.createPage({
				title: "Draft Nav",
				content: "Draft content.",
				status: "draft",
				showInNavigation: true,
			});

			const navPages = await controller.getNavigationPages();
			expect(navPages).toHaveLength(1);
			expect(navPages[0]?.title).toBe("About");
		});

		it("returns empty array when no navigation pages exist", async () => {
			const navPages = await controller.getNavigationPages();
			expect(navPages).toEqual([]);
		});
	});

	// ── Lifecycle transitions ──────────────────────────────────────────────────

	describe("lifecycle transitions", () => {
		it("draft -> published -> archived", async () => {
			const page = await controller.createPage({
				title: "Lifecycle",
				content: "Content.",
			});

			expect(page.status).toBe("draft");

			const published = await controller.publishPage(page.id);
			expect(published?.status).toBe("published");

			const archived = await controller.archivePage(page.id);
			expect(archived?.status).toBe("archived");
		});

		it("draft -> published -> draft (unpublish)", async () => {
			const page = await controller.createPage({
				title: "Lifecycle 2",
				content: "Content.",
			});

			await controller.publishPage(page.id);
			const unpublished = await controller.unpublishPage(page.id);
			expect(unpublished?.status).toBe("draft");
		});
	});

	// ── Edge cases ──────────────────────────────────────────────────────────────

	describe("edge cases", () => {
		it("handles pages with no optional fields", async () => {
			const page = await controller.createPage({
				title: "Minimal",
				content: "Content.",
			});

			expect(page.excerpt).toBeUndefined();
			expect(page.template).toBeUndefined();
			expect(page.metaTitle).toBeUndefined();
			expect(page.metaDescription).toBeUndefined();
			expect(page.featuredImage).toBeUndefined();
			expect(page.parentId).toBeUndefined();
		});

		it("handles updating multiple fields at once", async () => {
			const page = await controller.createPage({
				title: "Multi Update",
				content: "Original content.",
			});

			const updated = await controller.updatePage(page.id, {
				title: "New Title",
				content: "New content.",
				excerpt: "New excerpt.",
				metaTitle: "New Meta",
				position: 42,
				showInNavigation: true,
			});

			expect(updated?.title).toBe("New Title");
			expect(updated?.content).toBe("New content.");
			expect(updated?.excerpt).toBe("New excerpt.");
			expect(updated?.metaTitle).toBe("New Meta");
			expect(updated?.position).toBe(42);
			expect(updated?.showInNavigation).toBe(true);
		});

		it("handles concurrent creates", async () => {
			const [a, b, c] = await Promise.all([
				controller.createPage({
					title: "Page A",
					content: "A.",
				}),
				controller.createPage({
					title: "Page B",
					content: "B.",
				}),
				controller.createPage({
					title: "Page C",
					content: "C.",
				}),
			]);

			expect(a.id).not.toBe(b.id);
			expect(b.id).not.toBe(c.id);
			expect(mockData.size("page")).toBe(3);
		});
	});
});
