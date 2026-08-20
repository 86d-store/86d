import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPagesController } from "../service-impl";

describe("pages controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPagesController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPagesController(mockData);
	});

	// ── createPage edge cases ──────────────────────────────────────────

	describe("createPage edge cases", () => {
		it("generates unique ids for every page", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const page = await controller.createPage({
					title: `Page ${i}`,
					content: `Content ${i}`,
				});
				ids.add(page.id);
			}
			expect(ids.size).toBe(20);
		});

		it("createdAt and updatedAt are set to approximately current time", async () => {
			const before = new Date();
			const page = await controller.createPage({
				title: "Timing Test",
				content: "Content.",
			});
			const after = new Date();
			expect(page.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(page.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
			expect(page.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(page.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("slugifies title with special characters", async () => {
			const page = await controller.createPage({
				title: "Hello, World! @#$% & More",
				content: "Content.",
			});
			expect(page.slug).toBe("hello-world-more");
		});

		it("slugifies title with leading/trailing special characters", async () => {
			const page = await controller.createPage({
				title: "---Leading and Trailing---",
				content: "Content.",
			});
			expect(page.slug).toBe("leading-and-trailing");
		});

		it("slugifies title with consecutive spaces", async () => {
			const page = await controller.createPage({
				title: "Multiple   Spaces   Here",
				content: "Content.",
			});
			expect(page.slug).toBe("multiple-spaces-here");
		});

		it("slugifies title that is entirely non-alphanumeric", async () => {
			const page = await controller.createPage({
				title: "!@#$%^&*()",
				content: "Content.",
			});
			expect(page.slug).toBe("");
		});

		it("slugifies title that is purely numeric", async () => {
			const page = await controller.createPage({
				title: "12345",
				content: "Content.",
			});
			expect(page.slug).toBe("12345");
		});

		it("preserves custom slug with whitespace by trimming", async () => {
			const page = await controller.createPage({
				title: "My Page",
				slug: "  custom-slug  ",
				content: "Content.",
			});
			expect(page.slug).toBe("custom-slug");
		});

		it("falls back to generated slug when slug is only whitespace", async () => {
			const page = await controller.createPage({
				title: "Fallback Title",
				slug: "   ",
				content: "Content.",
			});
			expect(page.slug).toBe("fallback-title");
		});

		it("handles empty content string", async () => {
			const page = await controller.createPage({
				title: "Empty Content",
				content: "",
			});
			expect(page.content).toBe("");
		});

		it("handles very long title and content", async () => {
			const longTitle = "A".repeat(10000);
			const longContent = "B".repeat(50000);
			const page = await controller.createPage({
				title: longTitle,
				content: longContent,
			});
			expect(page.title).toBe(longTitle);
			expect(page.content).toBe(longContent);
			expect(page.slug).toBe("a".repeat(10000));
		});

		it("handles special characters in content and excerpt", async () => {
			const page = await controller.createPage({
				title: "Special Content",
				content: '<script>alert("xss")</script> & "quotes" <br/>',
				excerpt: "Gift for mom! \n\t Special: @#$%^&*()",
			});
			expect(page.content).toBe(
				'<script>alert("xss")</script> & "quotes" <br/>',
			);
			expect(page.excerpt).toBe("Gift for mom! \n\t Special: @#$%^&*()");
		});

		it("does not set publishedAt for archived status", async () => {
			const page = await controller.createPage({
				title: "Archived Page",
				content: "Content.",
				status: "archived",
			});
			expect(page.status).toBe("archived");
			expect(page.publishedAt).toBeUndefined();
		});

		it("creates page with negative position", async () => {
			const page = await controller.createPage({
				title: "Negative Position",
				content: "Content.",
				position: -5,
			});
			expect(page.position).toBe(-5);
		});

		it("creates page with very large position", async () => {
			const page = await controller.createPage({
				title: "Large Position",
				content: "Content.",
				position: Number.MAX_SAFE_INTEGER,
			});
			expect(page.position).toBe(Number.MAX_SAFE_INTEGER);
		});
	});

	// ── getPage edge cases ─────────────────────────────────────────────

	describe("getPage edge cases", () => {
		it("returns null for empty string id", async () => {
			const found = await controller.getPage("");
			expect(found).toBeNull();
		});

		it("returns correct page when many pages exist", async () => {
			const pages: Awaited<ReturnType<typeof controller.createPage>>[] = [];
			for (let i = 0; i < 20; i++) {
				const page = await controller.createPage({
					title: `Page ${i}`,
					content: `Content ${i}`,
				});
				pages.push(page);
			}
			const fetched = await controller.getPage(pages[10].id);
			expect(fetched).not.toBeNull();
			expect(fetched?.title).toBe("Page 10");
		});

		it("returns null after page is deleted", async () => {
			const page = await controller.createPage({
				title: "To Delete",
				content: "Content.",
			});
			await controller.deletePage(page.id);
			const found = await controller.getPage(page.id);
			expect(found).toBeNull();
		});

		it("returns updated data after updatePage", async () => {
			const page = await controller.createPage({
				title: "Original",
				content: "Content.",
			});
			await controller.updatePage(page.id, { title: "Updated" });
			const found = await controller.getPage(page.id);
			expect(found?.title).toBe("Updated");
		});
	});

	// ── getPageBySlug edge cases ───────────────────────────────────────

	describe("getPageBySlug edge cases", () => {
		it("returns null for empty string slug", async () => {
			const found = await controller.getPageBySlug("");
			expect(found).toBeNull();
		});

		it("is case-sensitive for slug lookup", async () => {
			await controller.createPage({
				title: "My Page",
				content: "Content.",
			});
			const found = await controller.getPageBySlug("My-Page");
			expect(found).toBeNull();
		});

		it("finds page after slug is updated", async () => {
			const page = await controller.createPage({
				title: "Original",
				content: "Content.",
			});
			await controller.updatePage(page.id, { slug: "new-slug" });
			const foundOld = await controller.getPageBySlug("original");
			const foundNew = await controller.getPageBySlug("new-slug");
			expect(foundOld).toBeNull();
			expect(foundNew).not.toBeNull();
			expect(foundNew?.title).toBe("Original");
		});

		it("returns null after page with that slug is deleted", async () => {
			const page = await controller.createPage({
				title: "Will Be Deleted",
				content: "Content.",
			});
			await controller.deletePage(page.id);
			const found = await controller.getPageBySlug("will-be-deleted");
			expect(found).toBeNull();
		});
	});

	// ── updatePage edge cases ──────────────────────────────────────────

	describe("updatePage edge cases", () => {
		it("updating with empty params object still updates updatedAt", async () => {
			const page = await controller.createPage({
				title: "Page",
				content: "Content.",
			});
			const originalUpdatedAt = page.updatedAt;
			const updated = await controller.updatePage(page.id, {});
			expect(updated).not.toBeNull();
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
			expect(updated?.title).toBe("Page");
		});

		it("updates slug without affecting title", async () => {
			const page = await controller.createPage({
				title: "My Title",
				content: "Content.",
			});
			const updated = await controller.updatePage(page.id, {
				slug: "custom-slug",
			});
			expect(updated?.slug).toBe("custom-slug");
			expect(updated?.title).toBe("My Title");
		});

		it("sets publishedAt when transitioning from archived to published", async () => {
			const page = await controller.createPage({
				title: "Archived",
				content: "Content.",
				status: "archived",
			});
			expect(page.publishedAt).toBeUndefined();
			const updated = await controller.updatePage(page.id, {
				status: "published",
			});
			expect(updated?.status).toBe("published");
			expect(updated?.publishedAt).toBeInstanceOf(Date);
		});

		it("does not overwrite publishedAt when re-publishing via updatePage", async () => {
			const page = await controller.createPage({
				title: "Page",
				content: "Content.",
				status: "published",
			});
			const originalPublishedAt = page.publishedAt;
			await controller.updatePage(page.id, { status: "draft" });
			const republished = await controller.updatePage(page.id, {
				status: "published",
			});
			expect(republished?.publishedAt).toEqual(originalPublishedAt);
		});

		it("updates position to zero", async () => {
			const page = await controller.createPage({
				title: "Page",
				content: "Content.",
				position: 10,
			});
			const updated = await controller.updatePage(page.id, { position: 0 });
			expect(updated?.position).toBe(0);
		});

		it("updates showInNavigation from true to false", async () => {
			const page = await controller.createPage({
				title: "Nav Page",
				content: "Content.",
				showInNavigation: true,
			});
			const updated = await controller.updatePage(page.id, {
				showInNavigation: false,
			});
			expect(updated?.showInNavigation).toBe(false);
		});

		it("updates parentId to link to another page", async () => {
			const parent = await controller.createPage({
				title: "Parent",
				content: "Parent content.",
			});
			const child = await controller.createPage({
				title: "Child",
				content: "Child content.",
			});
			const updated = await controller.updatePage(child.id, {
				parentId: parent.id,
			});
			expect(updated?.parentId).toBe(parent.id);
		});

		it("consecutive updates accumulate correctly", async () => {
			const page = await controller.createPage({
				title: "Page",
				content: "Content.",
			});
			await controller.updatePage(page.id, { title: "Title 2" });
			await controller.updatePage(page.id, { content: "Content 2." });
			await controller.updatePage(page.id, { position: 5 });
			const final = await controller.getPage(page.id);
			expect(final?.title).toBe("Title 2");
			expect(final?.content).toBe("Content 2.");
			expect(final?.position).toBe(5);
		});

		it("returns null for update after delete", async () => {
			const page = await controller.createPage({
				title: "Page",
				content: "Content.",
			});
			await controller.deletePage(page.id);
			const result = await controller.updatePage(page.id, {
				title: "Should Fail",
			});
			expect(result).toBeNull();
		});
	});

	// ── deletePage edge cases ──────────────────────────────────────────

	describe("deletePage edge cases", () => {
		it("double deletion returns false on second attempt", async () => {
			const page = await controller.createPage({
				title: "Page",
				content: "Content.",
			});
			expect(await controller.deletePage(page.id)).toBe(true);
			expect(await controller.deletePage(page.id)).toBe(false);
		});

		it("returns false for empty string id", async () => {
			const result = await controller.deletePage("");
			expect(result).toBe(false);
		});

		it("deleting one page does not affect others", async () => {
			const page1 = await controller.createPage({
				title: "Page 1",
				content: "Content 1.",
			});
			const page2 = await controller.createPage({
				title: "Page 2",
				content: "Content 2.",
			});
			await controller.deletePage(page1.id);
			const remaining = await controller.getPage(page2.id);
			expect(remaining).not.toBeNull();
			expect(remaining?.title).toBe("Page 2");
			expect(mockData.size("page")).toBe(1);
		});
	});

	// ── publishPage edge cases ─────────────────────────────────────────

	describe("publishPage edge cases", () => {
		it("publishing an already published page preserves publishedAt", async () => {
			const page = await controller.createPage({
				title: "Published",
				content: "Content.",
				status: "published",
			});
			const original = page.publishedAt;
			const repub = await controller.publishPage(page.id);
			expect(repub?.publishedAt).toEqual(original);
		});

		it("publishing an archived page sets publishedAt if not previously set", async () => {
			const page = await controller.createPage({
				title: "Archived",
				content: "Content.",
				status: "archived",
			});
			expect(page.publishedAt).toBeUndefined();
			const published = await controller.publishPage(page.id);
			expect(published?.status).toBe("published");
			expect(published?.publishedAt).toBeInstanceOf(Date);
		});

		it("returns null for empty string id", async () => {
			const result = await controller.publishPage("");
			expect(result).toBeNull();
		});
	});

	// ── unpublishPage edge cases ───────────────────────────────────────

	describe("unpublishPage edge cases", () => {
		it("unpublishing a draft page keeps it as draft", async () => {
			const page = await controller.createPage({
				title: "Draft",
				content: "Content.",
			});
			const unpublished = await controller.unpublishPage(page.id);
			expect(unpublished?.status).toBe("draft");
		});

		it("unpublishing an archived page sets status to draft", async () => {
			const page = await controller.createPage({
				title: "Archived",
				content: "Content.",
				status: "archived",
			});
			const unpublished = await controller.unpublishPage(page.id);
			expect(unpublished?.status).toBe("draft");
		});

		it("unpublishing preserves publishedAt from original publication", async () => {
			const page = await controller.createPage({
				title: "Published",
				content: "Content.",
				status: "published",
			});
			const originalPublishedAt = page.publishedAt;
			const unpublished = await controller.unpublishPage(page.id);
			expect(unpublished?.publishedAt).toEqual(originalPublishedAt);
		});
	});

	// ── archivePage edge cases ─────────────────────────────────────────

	describe("archivePage edge cases", () => {
		it("archiving a draft page sets status to archived", async () => {
			const page = await controller.createPage({
				title: "Draft",
				content: "Content.",
			});
			const archived = await controller.archivePage(page.id);
			expect(archived?.status).toBe("archived");
		});

		it("archiving an already archived page is idempotent", async () => {
			const page = await controller.createPage({
				title: "Archived",
				content: "Content.",
				status: "archived",
			});
			const archived = await controller.archivePage(page.id);
			expect(archived?.status).toBe("archived");
		});

		it("archiving preserves publishedAt from original publication", async () => {
			const page = await controller.createPage({
				title: "Published",
				content: "Content.",
				status: "published",
			});
			const originalPublishedAt = page.publishedAt;
			const archived = await controller.archivePage(page.id);
			expect(archived?.publishedAt).toEqual(originalPublishedAt);
		});
	});

	// ── listPages edge cases ───────────────────────────────────────────

	describe("listPages edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.createPage({
				title: "Page",
				content: "Content.",
			});
			const pages = await controller.listPages({ take: 0 });
			expect(pages).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total pages", async () => {
			await controller.createPage({
				title: "Page",
				content: "Content.",
			});
			const pages = await controller.listPages({ skip: 100 });
			expect(pages).toHaveLength(0);
		});

		it("handles take larger than total pages", async () => {
			await controller.createPage({
				title: "Only Page",
				content: "Content.",
			});
			const pages = await controller.listPages({ take: 100 });
			expect(pages).toHaveLength(1);
		});

		it("paginates correctly through all pages", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.createPage({
					title: `Page ${i}`,
					content: `Content ${i}`,
				});
			}
			const page1 = await controller.listPages({ take: 3, skip: 0 });
			const page2 = await controller.listPages({ take: 3, skip: 3 });
			const page3 = await controller.listPages({ take: 3, skip: 6 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			expect(page3).toHaveLength(1);
			const allIds = [
				...page1.map((p) => p.id),
				...page2.map((p) => p.id),
				...page3.map((p) => p.id),
			];
			expect(new Set(allIds).size).toBe(7);
		});

		it("filters by parentId", async () => {
			const parent = await controller.createPage({
				title: "Parent",
				content: "Parent content.",
			});
			await controller.createPage({
				title: "Child 1",
				content: "Child 1 content.",
				parentId: parent.id,
			});
			await controller.createPage({
				title: "Child 2",
				content: "Child 2 content.",
				parentId: parent.id,
			});
			await controller.createPage({
				title: "Orphan",
				content: "Orphan content.",
			});
			const children = await controller.listPages({
				parentId: parent.id,
			});
			expect(children).toHaveLength(2);
			for (const child of children) {
				expect(child.parentId).toBe(parent.id);
			}
		});

		it("combines status and showInNavigation filters", async () => {
			await controller.createPage({
				title: "Published Nav",
				content: "Content.",
				status: "published",
				showInNavigation: true,
			});
			await controller.createPage({
				title: "Published Hidden",
				content: "Content.",
				status: "published",
				showInNavigation: false,
			});
			await controller.createPage({
				title: "Draft Nav",
				content: "Content.",
				status: "draft",
				showInNavigation: true,
			});
			const pages = await controller.listPages({
				status: "published",
				showInNavigation: true,
			});
			expect(pages).toHaveLength(1);
			expect(pages[0].title).toBe("Published Nav");
		});

		it("combines filters with pagination", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.createPage({
					title: `Published Page ${i}`,
					content: `Content ${i}`,
					status: "published",
				});
			}
			await controller.createPage({
				title: "Draft Page",
				content: "Draft content.",
			});
			const pages = await controller.listPages({
				status: "published",
				take: 3,
				skip: 2,
			});
			expect(pages).toHaveLength(3);
			for (const page of pages) {
				expect(page.status).toBe("published");
			}
		});

		it("reflects status changes from archivePage", async () => {
			await controller.createPage({
				title: "Active",
				content: "Content.",
				status: "published",
			});
			const page = await controller.createPage({
				title: "Old",
				content: "Content.",
			});
			await controller.archivePage(page.id);
			const archived = await controller.listPages({ status: "archived" });
			expect(archived).toHaveLength(1);
			expect(archived[0].title).toBe("Old");
		});

		it("reflects deletions in subsequent list calls", async () => {
			const page1 = await controller.createPage({
				title: "Page 1",
				content: "Content 1.",
			});
			await controller.createPage({
				title: "Page 2",
				content: "Content 2.",
			});
			expect(await controller.listPages()).toHaveLength(2);
			await controller.deletePage(page1.id);
			const after = await controller.listPages();
			expect(after).toHaveLength(1);
			expect(after[0].title).toBe("Page 2");
		});

		it("showInNavigation=false filter returns non-navigation pages", async () => {
			await controller.createPage({
				title: "Nav Page",
				content: "Content.",
				showInNavigation: true,
			});
			await controller.createPage({
				title: "Hidden Page",
				content: "Content.",
				showInNavigation: false,
			});
			await controller.createPage({
				title: "Default Page",
				content: "Content.",
			});
			const hidden = await controller.listPages({
				showInNavigation: false,
			});
			expect(hidden).toHaveLength(2);
		});
	});

	// ── getNavigationPages edge cases ──────────────────────────────────

	describe("getNavigationPages edge cases", () => {
		it("excludes archived pages even if showInNavigation is true", async () => {
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

		it("reflects publish/unpublish transitions", async () => {
			const page = await controller.createPage({
				title: "Toggle Page",
				content: "Content.",
				status: "published",
				showInNavigation: true,
			});
			expect(await controller.getNavigationPages()).toHaveLength(1);
			await controller.unpublishPage(page.id);
			expect(await controller.getNavigationPages()).toHaveLength(0);
			await controller.publishPage(page.id);
			expect(await controller.getNavigationPages()).toHaveLength(1);
		});

		it("reflects showInNavigation update", async () => {
			const page = await controller.createPage({
				title: "Toggle Nav",
				content: "Content.",
				status: "published",
				showInNavigation: true,
			});
			expect(await controller.getNavigationPages()).toHaveLength(1);
			await controller.updatePage(page.id, { showInNavigation: false });
			expect(await controller.getNavigationPages()).toHaveLength(0);
		});
	});

	// ── lifecycle transitions edge cases ───────────────────────────────

	describe("lifecycle transitions edge cases", () => {
		it("draft -> archived -> published -> draft", async () => {
			const page = await controller.createPage({
				title: "Full Lifecycle",
				content: "Content.",
			});
			expect(page.status).toBe("draft");
			const archived = await controller.archivePage(page.id);
			expect(archived?.status).toBe("archived");
			const published = await controller.publishPage(page.id);
			expect(published?.status).toBe("published");
			expect(published?.publishedAt).toBeInstanceOf(Date);
			const unpublished = await controller.unpublishPage(page.id);
			expect(unpublished?.status).toBe("draft");
		});

		it("published -> archived -> published preserves publishedAt", async () => {
			const page = await controller.createPage({
				title: "Lifecycle",
				content: "Content.",
				status: "published",
			});
			const originalPublishedAt = page.publishedAt;
			await controller.archivePage(page.id);
			const republished = await controller.publishPage(page.id);
			expect(republished?.publishedAt).toEqual(originalPublishedAt);
		});

		it("multiple publish/unpublish cycles preserve original publishedAt", async () => {
			const page = await controller.createPage({
				title: "Cycling",
				content: "Content.",
			});
			const pub1 = await controller.publishPage(page.id);
			const firstPublishedAt = pub1?.publishedAt;
			await controller.unpublishPage(page.id);
			const pub2 = await controller.publishPage(page.id);
			expect(pub2?.publishedAt).toEqual(firstPublishedAt);
			await controller.unpublishPage(page.id);
			const pub3 = await controller.publishPage(page.id);
			expect(pub3?.publishedAt).toEqual(firstPublishedAt);
		});
	});

	// ── concurrent operations ──────────────────────────────────────────

	describe("concurrent operations", () => {
		it("handles concurrent creates", async () => {
			const creates = Array.from({ length: 10 }, (_, i) =>
				controller.createPage({
					title: `Concurrent ${i}`,
					content: `Content ${i}`,
				}),
			);
			const pages = await Promise.all(creates);
			expect(pages).toHaveLength(10);
			const ids = new Set(pages.map((p) => p.id));
			expect(ids.size).toBe(10);
		});

		it("handles concurrent publish operations on different pages", async () => {
			const pages: Awaited<ReturnType<typeof controller.createPage>>[] = [];
			for (let i = 0; i < 5; i++) {
				const page = await controller.createPage({
					title: `Page ${i}`,
					content: `Content ${i}`,
				});
				pages.push(page);
			}
			const results = await Promise.all(
				pages.map((p) => controller.publishPage(p.id)),
			);
			for (const result of results) {
				expect(result?.status).toBe("published");
				expect(result?.publishedAt).toBeInstanceOf(Date);
			}
		});

		it("handles concurrent deletes on different pages", async () => {
			const pages: Awaited<ReturnType<typeof controller.createPage>>[] = [];
			for (let i = 0; i < 5; i++) {
				const page = await controller.createPage({
					title: `Page ${i}`,
					content: `Content ${i}`,
				});
				pages.push(page);
			}
			const results = await Promise.all(
				pages.map((p) => controller.deletePage(p.id)),
			);
			for (const result of results) {
				expect(result).toBe(true);
			}
			expect(mockData.size("page")).toBe(0);
		});
	});

	// ── data store consistency ──────────────────────────────────────────

	describe("data store consistency", () => {
		it("store count matches expected after create/delete cycle", async () => {
			const pages: Awaited<ReturnType<typeof controller.createPage>>[] = [];
			for (let i = 0; i < 5; i++) {
				const page = await controller.createPage({
					title: `Page ${i}`,
					content: `Content ${i}`,
				});
				pages.push(page);
			}
			expect(mockData.size("page")).toBe(5);
			await controller.deletePage(pages[0].id);
			await controller.deletePage(pages[2].id);
			expect(mockData.size("page")).toBe(3);
		});

		it("publish/unpublish/archive do not change store count", async () => {
			const page = await controller.createPage({
				title: "Page",
				content: "Content.",
			});
			expect(mockData.size("page")).toBe(1);
			await controller.publishPage(page.id);
			expect(mockData.size("page")).toBe(1);
			await controller.unpublishPage(page.id);
			expect(mockData.size("page")).toBe(1);
			await controller.archivePage(page.id);
			expect(mockData.size("page")).toBe(1);
		});

		it("repeated updates do not create duplicate entries", async () => {
			const page = await controller.createPage({
				title: "Page",
				content: "Content.",
			});
			for (let i = 0; i < 10; i++) {
				await controller.updatePage(page.id, { title: `Title ${i}` });
			}
			expect(mockData.size("page")).toBe(1);
		});
	});

	// ── complex lifecycle scenarios ────────────────────────────────────

	describe("complex lifecycle scenarios", () => {
		it("full create-update-publish-unpublish-archive-delete lifecycle", async () => {
			const page = await controller.createPage({
				title: "Full Lifecycle Page",
				content: "Original content.",
			});
			expect(page.status).toBe("draft");

			const updated = await controller.updatePage(page.id, {
				title: "Updated Title",
				content: "Updated content.",
				metaTitle: "SEO Title",
			});
			expect(updated?.title).toBe("Updated Title");

			const published = await controller.publishPage(page.id);
			expect(published?.status).toBe("published");

			const unpublished = await controller.unpublishPage(page.id);
			expect(unpublished?.status).toBe("draft");

			const archived = await controller.archivePage(page.id);
			expect(archived?.status).toBe("archived");

			const deleted = await controller.deletePage(page.id);
			expect(deleted).toBe(true);
			expect(mockData.size("page")).toBe(0);
		});

		it("parent-child hierarchy with orphaned children", async () => {
			const home = await controller.createPage({
				title: "Home",
				content: "Home content.",
				status: "published",
				showInNavigation: true,
				position: 0,
			});
			const about = await controller.createPage({
				title: "About",
				content: "About content.",
				status: "published",
				showInNavigation: true,
				position: 1,
				parentId: home.id,
			});
			const team = await controller.createPage({
				title: "Team",
				content: "Team content.",
				status: "published",
				showInNavigation: true,
				position: 2,
				parentId: about.id,
			});

			expect(home.parentId).toBeUndefined();
			expect(about.parentId).toBe(home.id);
			expect(team.parentId).toBe(about.id);

			await controller.deletePage(about.id);
			const orphanedTeam = await controller.getPage(team.id);
			expect(orphanedTeam?.parentId).toBe(about.id);
		});

		it("bulk create, filter, paginate, then clean up", async () => {
			for (let i = 0; i < 20; i++) {
				await controller.createPage({
					title: `Published ${i}`,
					content: `Content ${i}`,
					status: "published",
					position: i,
				});
			}
			for (let i = 0; i < 10; i++) {
				await controller.createPage({
					title: `Draft ${i}`,
					content: `Content ${i}`,
					status: "draft",
					position: 20 + i,
				});
			}

			expect(mockData.size("page")).toBe(30);

			const published = await controller.listPages({ status: "published" });
			expect(published).toHaveLength(20);

			const drafts = await controller.listPages({ status: "draft" });
			expect(drafts).toHaveLength(10);

			const firstFive = await controller.listPages({
				status: "published",
				take: 5,
				skip: 0,
			});
			expect(firstFive).toHaveLength(5);

			for (const draft of drafts) {
				await controller.deletePage(draft.id);
			}
			expect(mockData.size("page")).toBe(20);
		});

		it("all operations return null/false for non-existent pages", async () => {
			const fakeId = "non-existent-id-12345";
			expect(await controller.getPage(fakeId)).toBeNull();
			expect(await controller.updatePage(fakeId, { title: "X" })).toBeNull();
			expect(await controller.deletePage(fakeId)).toBe(false);
			expect(await controller.publishPage(fakeId)).toBeNull();
			expect(await controller.unpublishPage(fakeId)).toBeNull();
			expect(await controller.archivePage(fakeId)).toBeNull();
		});
	});
});
