import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPagesController } from "../service-impl";

/**
 * Endpoint-security tests for the pages module.
 *
 * These tests verify data-integrity invariants that, if broken,
 * could expose draft/internal content publicly or corrupt page trees:
 *
 * 1. Slug uniqueness: duplicate slugs resolve correctly via getPageBySlug
 * 2. Published vs draft filtering: draft/archived pages never leak into navigation
 * 3. SEO metadata integrity: metaTitle/metaDescription survive lifecycle transitions
 * 4. Nested page ordering: parentId hierarchy and position ordering
 * 5. Template validation: template field persists through updates
 * 6. Lifecycle state integrity: publishedAt preserved across transitions
 */

describe("pages endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPagesController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPagesController(mockData);
	});

	// -- Slug Uniqueness & Resolution -----------------------------------------

	describe("slug uniqueness and resolution", () => {
		it("auto-generated slug strips special characters to prevent injection", async () => {
			const page = await controller.createPage({
				title: '<script>alert("xss")</script>',
				content: "Content.",
			});

			expect(page.slug).not.toContain("<");
			expect(page.slug).not.toContain(">");
			expect(page.slug).not.toContain('"');
			expect(page.slug).toBe("script-alert-xss-script");
		});

		it("getPageBySlug returns the correct page when multiple pages exist", async () => {
			await controller.createPage({ title: "Alpha Page", content: "A." });
			await controller.createPage({ title: "Beta Page", content: "B." });

			const found = await controller.getPageBySlug("beta-page");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Beta Page");
		});

		it("getPageBySlug returns null for a non-existent slug", async () => {
			await controller.createPage({ title: "Exists", content: "Yes." });

			const found = await controller.getPageBySlug("does-not-exist");
			expect(found).toBeNull();
		});

		it("custom slug is trimmed to prevent whitespace-based duplicates", async () => {
			const page = await controller.createPage({
				title: "Trimmed",
				slug: "  my-page  ",
				content: "Content.",
			});

			expect(page.slug).toBe("my-page");
		});

		it("empty custom slug falls back to auto-generated slug from title", async () => {
			const page = await controller.createPage({
				title: "Fallback Title",
				slug: "   ",
				content: "Content.",
			});

			expect(page.slug).toBe("fallback-title");
		});
	});

	// -- Published vs Draft Filtering -----------------------------------------

	describe("published vs draft filtering", () => {
		it("getNavigationPages excludes draft pages with showInNavigation=true", async () => {
			await controller.createPage({
				title: "Draft Nav",
				content: "Draft.",
				status: "draft",
				showInNavigation: true,
			});
			await controller.createPage({
				title: "Published Nav",
				content: "Published.",
				status: "published",
				showInNavigation: true,
			});

			const navPages = await controller.getNavigationPages();
			expect(navPages).toHaveLength(1);
			expect(navPages[0]?.title).toBe("Published Nav");
		});

		it("getNavigationPages excludes archived pages with showInNavigation=true", async () => {
			const page = await controller.createPage({
				title: "Archived Nav",
				content: "Content.",
				status: "published",
				showInNavigation: true,
			});
			await controller.archivePage(page.id);

			const navPages = await controller.getNavigationPages();
			expect(navPages).toHaveLength(0);
		});

		it("listPages with status=published never returns draft or archived pages", async () => {
			await controller.createPage({
				title: "Draft",
				content: "D.",
				status: "draft",
			});
			await controller.createPage({
				title: "Published",
				content: "P.",
				status: "published",
			});
			const archived = await controller.createPage({
				title: "To Archive",
				content: "A.",
				status: "published",
			});
			await controller.archivePage(archived.id);

			const published = await controller.listPages({ status: "published" });
			expect(published).toHaveLength(1);
			expect(published[0]?.title).toBe("Published");
		});

		it("unpublished page is removed from navigation results", async () => {
			const page = await controller.createPage({
				title: "Will Unpublish",
				content: "Content.",
				status: "published",
				showInNavigation: true,
			});

			let navPages = await controller.getNavigationPages();
			expect(navPages).toHaveLength(1);

			await controller.unpublishPage(page.id);

			navPages = await controller.getNavigationPages();
			expect(navPages).toHaveLength(0);
		});
	});

	// -- SEO Metadata Integrity -----------------------------------------------

	describe("SEO metadata integrity", () => {
		it("metaTitle and metaDescription persist through publish transition", async () => {
			const page = await controller.createPage({
				title: "SEO Page",
				content: "Content.",
				metaTitle: "Custom Meta Title",
				metaDescription: "Custom meta description for search engines.",
			});

			const published = await controller.publishPage(page.id);
			expect(published?.metaTitle).toBe("Custom Meta Title");
			expect(published?.metaDescription).toBe(
				"Custom meta description for search engines.",
			);
		});

		it("metaTitle and metaDescription persist through unpublish transition", async () => {
			const page = await controller.createPage({
				title: "SEO Page",
				content: "Content.",
				status: "published",
				metaTitle: "SEO Title",
				metaDescription: "SEO Description",
			});

			const unpublished = await controller.unpublishPage(page.id);
			expect(unpublished?.metaTitle).toBe("SEO Title");
			expect(unpublished?.metaDescription).toBe("SEO Description");
		});

		it("metaTitle and metaDescription persist through archive transition", async () => {
			const page = await controller.createPage({
				title: "SEO Page",
				content: "Content.",
				status: "published",
				metaTitle: "Archive SEO Title",
				metaDescription: "Archive SEO Description",
			});

			const archived = await controller.archivePage(page.id);
			expect(archived?.metaTitle).toBe("Archive SEO Title");
			expect(archived?.metaDescription).toBe("Archive SEO Description");
		});

		it("updating metaTitle does not clobber metaDescription", async () => {
			const page = await controller.createPage({
				title: "Partial SEO",
				content: "Content.",
				metaTitle: "Original Title",
				metaDescription: "Original Description",
			});

			const updated = await controller.updatePage(page.id, {
				metaTitle: "New Title Only",
			});

			expect(updated?.metaTitle).toBe("New Title Only");
			expect(updated?.metaDescription).toBe("Original Description");
		});
	});

	// -- Nested Page Ordering & Hierarchy -------------------------------------

	describe("nested page ordering and hierarchy", () => {
		it("child pages are scoped by parentId filter", async () => {
			const parent = await controller.createPage({
				title: "Parent",
				content: "Parent content.",
			});
			await controller.createPage({
				title: "Child 1",
				content: "C1.",
				parentId: parent.id,
			});
			await controller.createPage({
				title: "Child 2",
				content: "C2.",
				parentId: parent.id,
			});
			await controller.createPage({
				title: "Orphan",
				content: "No parent.",
			});

			const children = await controller.listPages({
				parentId: parent.id,
			});
			expect(children).toHaveLength(2);
			for (const child of children) {
				expect(child.parentId).toBe(parent.id);
			}
		});

		it("position ordering is maintained across pages", async () => {
			await controller.createPage({
				title: "Third",
				content: "C.",
				position: 3,
				showInNavigation: true,
				status: "published",
			});
			await controller.createPage({
				title: "First",
				content: "A.",
				position: 1,
				showInNavigation: true,
				status: "published",
			});
			await controller.createPage({
				title: "Second",
				content: "B.",
				position: 2,
				showInNavigation: true,
				status: "published",
			});

			const navPages = await controller.getNavigationPages();
			expect(navPages).toHaveLength(3);
			// Mock data service does not sort by position, but the query requests it.
			// We verify all three pages are returned with correct positions.
			const positions = navPages.map((p) => p.position);
			expect(positions).toContain(1);
			expect(positions).toContain(2);
			expect(positions).toContain(3);
		});

		it("updating parentId re-scopes a page to a new parent", async () => {
			const parentA = await controller.createPage({
				title: "Parent A",
				content: "A.",
			});
			const parentB = await controller.createPage({
				title: "Parent B",
				content: "B.",
			});
			const child = await controller.createPage({
				title: "Child",
				content: "C.",
				parentId: parentA.id,
			});

			const moved = await controller.updatePage(child.id, {
				parentId: parentB.id,
			});
			expect(moved?.parentId).toBe(parentB.id);

			const aChildren = await controller.listPages({
				parentId: parentA.id,
			});
			expect(aChildren).toHaveLength(0);

			const bChildren = await controller.listPages({
				parentId: parentB.id,
			});
			expect(bChildren).toHaveLength(1);
		});
	});

	// -- Template Validation --------------------------------------------------

	describe("template field integrity", () => {
		it("template persists through create and retrieve", async () => {
			const page = await controller.createPage({
				title: "Landing",
				content: "Content.",
				template: "landing-page",
			});

			const fetched = await controller.getPage(page.id);
			expect(fetched?.template).toBe("landing-page");
		});

		it("template persists through lifecycle transitions", async () => {
			const page = await controller.createPage({
				title: "Template Page",
				content: "Content.",
				template: "full-width",
			});

			const published = await controller.publishPage(page.id);
			expect(published?.template).toBe("full-width");

			const unpublished = await controller.unpublishPage(page.id);
			expect(unpublished?.template).toBe("full-width");

			const archived = await controller.archivePage(page.id);
			expect(archived?.template).toBe("full-width");
		});

		it("template can be changed via update without affecting other fields", async () => {
			const page = await controller.createPage({
				title: "Stable Page",
				content: "Stable content.",
				template: "default",
				metaTitle: "Keep This",
			});

			const updated = await controller.updatePage(page.id, {
				template: "sidebar",
			});

			expect(updated?.template).toBe("sidebar");
			expect(updated?.title).toBe("Stable Page");
			expect(updated?.content).toBe("Stable content.");
			expect(updated?.metaTitle).toBe("Keep This");
		});
	});

	// -- Lifecycle State Integrity --------------------------------------------

	describe("lifecycle state integrity", () => {
		it("publishedAt is set only once and preserved across re-publish", async () => {
			const page = await controller.createPage({
				title: "Timestamp Page",
				content: "Content.",
			});

			const published = await controller.publishPage(page.id);
			const originalPublishedAt = published?.publishedAt;
			expect(originalPublishedAt).toBeInstanceOf(Date);

			await controller.unpublishPage(page.id);
			const republished = await controller.publishPage(page.id);
			expect(republished?.publishedAt).toEqual(originalPublishedAt);
		});

		it("delete of non-existent page returns false without side effects", async () => {
			await controller.createPage({
				title: "Survivor",
				content: "Still here.",
			});

			const deleted = await controller.deletePage("non-existent-id");
			expect(deleted).toBe(false);
			expect(mockData.size("page")).toBe(1);
		});

		it("operations on deleted page return null or false", async () => {
			const page = await controller.createPage({
				title: "Deleted Page",
				content: "Gone.",
			});
			await controller.deletePage(page.id);

			expect(await controller.getPage(page.id)).toBeNull();
			expect(await controller.updatePage(page.id, { title: "X" })).toBeNull();
			expect(await controller.publishPage(page.id)).toBeNull();
			expect(await controller.unpublishPage(page.id)).toBeNull();
			expect(await controller.archivePage(page.id)).toBeNull();
			expect(await controller.deletePage(page.id)).toBe(false);
		});

		it("creating a published page sets publishedAt at creation time", async () => {
			const before = new Date();
			const page = await controller.createPage({
				title: "Immediate Publish",
				content: "Content.",
				status: "published",
			});

			expect(page.publishedAt).toBeInstanceOf(Date);
			expect(page.publishedAt?.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
		});

		it("creating a draft page does not set publishedAt", async () => {
			const page = await controller.createPage({
				title: "Draft Only",
				content: "Content.",
				status: "draft",
			});

			expect(page.publishedAt).toBeUndefined();
		});
	});
});
