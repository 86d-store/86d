import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMediaController } from "../service-impl";

describe("createMediaController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createMediaController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createMediaController(mockData);
	});

	// ── createAsset ───────────────────────────────────────────────────────────

	describe("createAsset", () => {
		it("creates an asset with required fields", async () => {
			const asset = await controller.createAsset({
				name: "hero.jpg",
				url: "https://cdn.example.com/hero.jpg",
				mimeType: "image/jpeg",
				size: 102400,
			});

			expect(asset.id).toBeDefined();
			expect(asset.name).toBe("hero.jpg");
			expect(asset.url).toBe("https://cdn.example.com/hero.jpg");
			expect(asset.mimeType).toBe("image/jpeg");
			expect(asset.size).toBe(102400);
			expect(asset.tags).toEqual([]);
			expect(asset.metadata).toEqual({});
			expect(asset.createdAt).toBeInstanceOf(Date);
			expect(asset.updatedAt).toBeInstanceOf(Date);
		});

		it("creates an asset with all optional fields", async () => {
			const asset = await controller.createAsset({
				name: "product-shot.png",
				url: "https://cdn.example.com/product-shot.png",
				mimeType: "image/png",
				size: 204800,
				altText: "Product front view",
				width: 1920,
				height: 1080,
				folder: "products",
				tags: ["product", "hero"],
				metadata: { source: "upload" },
			});

			expect(asset.altText).toBe("Product front view");
			expect(asset.width).toBe(1920);
			expect(asset.height).toBe(1080);
			expect(asset.folder).toBe("products");
			expect(asset.tags).toEqual(["product", "hero"]);
			expect(asset.metadata).toEqual({ source: "upload" });
		});

		it("stores the asset in the data service", async () => {
			const asset = await controller.createAsset({
				name: "test.jpg",
				url: "https://cdn.example.com/test.jpg",
				mimeType: "image/jpeg",
				size: 1024,
			});

			const fetched = await controller.getAsset(asset.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.name).toBe("test.jpg");
		});
	});

	// ── getAsset ──────────────────────────────────────────────────────────────

	describe("getAsset", () => {
		it("returns null for non-existent asset", async () => {
			const result = await controller.getAsset("non-existent");
			expect(result).toBeNull();
		});

		it("returns the asset by id", async () => {
			const created = await controller.createAsset({
				name: "logo.svg",
				url: "https://cdn.example.com/logo.svg",
				mimeType: "image/svg+xml",
				size: 512,
			});

			const fetched = await controller.getAsset(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.name).toBe("logo.svg");
			expect(fetched?.mimeType).toBe("image/svg+xml");
		});
	});

	// ── updateAsset ───────────────────────────────────────────────────────────

	describe("updateAsset", () => {
		it("returns null for non-existent asset", async () => {
			const result = await controller.updateAsset("non-existent", {
				name: "new-name",
			});
			expect(result).toBeNull();
		});

		it("updates asset name", async () => {
			const created = await controller.createAsset({
				name: "old-name.jpg",
				url: "https://cdn.example.com/old.jpg",
				mimeType: "image/jpeg",
				size: 1024,
			});

			const updated = await controller.updateAsset(created.id, {
				name: "new-name.jpg",
			});
			expect(updated?.name).toBe("new-name.jpg");
			expect(updated?.url).toBe("https://cdn.example.com/old.jpg");
		});

		it("updates alt text", async () => {
			const created = await controller.createAsset({
				name: "banner.jpg",
				url: "https://cdn.example.com/banner.jpg",
				mimeType: "image/jpeg",
				size: 2048,
			});

			const updated = await controller.updateAsset(created.id, {
				altText: "Sale banner for summer",
			});
			expect(updated?.altText).toBe("Sale banner for summer");
		});

		it("updates tags", async () => {
			const created = await controller.createAsset({
				name: "photo.jpg",
				url: "https://cdn.example.com/photo.jpg",
				mimeType: "image/jpeg",
				size: 5000,
				tags: ["old"],
			});

			const updated = await controller.updateAsset(created.id, {
				tags: ["new", "updated"],
			});
			expect(updated?.tags).toEqual(["new", "updated"]);
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await controller.createAsset({
				name: "test.jpg",
				url: "https://cdn.example.com/test.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const updated = await controller.updateAsset(created.id, {
				name: "renamed.jpg",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});
	});

	// ── deleteAsset ───────────────────────────────────────────────────────────

	describe("deleteAsset", () => {
		it("returns false for non-existent asset", async () => {
			const result = await controller.deleteAsset("non-existent");
			expect(result).toBe(false);
		});

		it("deletes an existing asset", async () => {
			const created = await controller.createAsset({
				name: "delete-me.jpg",
				url: "https://cdn.example.com/delete-me.jpg",
				mimeType: "image/jpeg",
				size: 1024,
			});

			const deleted = await controller.deleteAsset(created.id);
			expect(deleted).toBe(true);

			const fetched = await controller.getAsset(created.id);
			expect(fetched).toBeNull();
		});
	});

	// ── listAssets ─────────────────────────────────────────────────────────────

	describe("listAssets", () => {
		it("returns empty array when no assets exist", async () => {
			const assets = await controller.listAssets();
			expect(assets).toEqual([]);
		});

		it("returns all assets", async () => {
			await controller.createAsset({
				name: "a.jpg",
				url: "https://cdn.example.com/a.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			await controller.createAsset({
				name: "b.png",
				url: "https://cdn.example.com/b.png",
				mimeType: "image/png",
				size: 200,
			});

			const assets = await controller.listAssets();
			expect(assets).toHaveLength(2);
		});

		it("filters by tag", async () => {
			await controller.createAsset({
				name: "tagged.jpg",
				url: "https://cdn.example.com/tagged.jpg",
				mimeType: "image/jpeg",
				size: 100,
				tags: ["hero"],
			});
			await controller.createAsset({
				name: "untagged.jpg",
				url: "https://cdn.example.com/untagged.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const filtered = await controller.listAssets({ tag: "hero" });
			expect(filtered).toHaveLength(1);
			expect(filtered[0].name).toBe("tagged.jpg");
		});

		it("filters by search query on name", async () => {
			await controller.createAsset({
				name: "hero-banner.jpg",
				url: "https://cdn.example.com/hero.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			await controller.createAsset({
				name: "logo.svg",
				url: "https://cdn.example.com/logo.svg",
				mimeType: "image/svg+xml",
				size: 50,
			});

			const filtered = await controller.listAssets({ search: "hero" });
			expect(filtered).toHaveLength(1);
			expect(filtered[0].name).toBe("hero-banner.jpg");
		});

		it("filters by search query on altText", async () => {
			await controller.createAsset({
				name: "img1.jpg",
				url: "https://cdn.example.com/img1.jpg",
				mimeType: "image/jpeg",
				size: 100,
				altText: "A beautiful sunset",
			});
			await controller.createAsset({
				name: "img2.jpg",
				url: "https://cdn.example.com/img2.jpg",
				mimeType: "image/jpeg",
				size: 100,
				altText: "Mountain landscape",
			});

			const filtered = await controller.listAssets({ search: "sunset" });
			expect(filtered).toHaveLength(1);
			expect(filtered[0].altText).toBe("A beautiful sunset");
		});
	});

	// ── bulkDelete ────────────────────────────────────────────────────────────

	describe("bulkDelete", () => {
		it("deletes multiple assets and returns count", async () => {
			const a = await controller.createAsset({
				name: "a.jpg",
				url: "https://cdn.example.com/a.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			const b = await controller.createAsset({
				name: "b.jpg",
				url: "https://cdn.example.com/b.jpg",
				mimeType: "image/jpeg",
				size: 200,
			});

			const count = await controller.bulkDelete([a.id, b.id]);
			expect(count).toBe(2);

			const remaining = await controller.listAssets();
			expect(remaining).toHaveLength(0);
		});

		it("skips non-existent ids", async () => {
			const a = await controller.createAsset({
				name: "a.jpg",
				url: "https://cdn.example.com/a.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const count = await controller.bulkDelete([a.id, "non-existent"]);
			expect(count).toBe(1);
		});
	});

	// ── moveAssets ─────────────────────────────────────────────────────────────

	describe("moveAssets", () => {
		it("moves assets to a folder", async () => {
			const a = await controller.createAsset({
				name: "movable.jpg",
				url: "https://cdn.example.com/movable.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const moved = await controller.moveAssets([a.id], "products");
			expect(moved).toBe(1);

			const fetched = await controller.getAsset(a.id);
			expect(fetched?.folder).toBe("products");
		});

		it("moves assets to root (null folder)", async () => {
			const a = await controller.createAsset({
				name: "in-folder.jpg",
				url: "https://cdn.example.com/in-folder.jpg",
				mimeType: "image/jpeg",
				size: 100,
				folder: "old-folder",
			});

			const moved = await controller.moveAssets([a.id], null);
			expect(moved).toBe(1);

			const fetched = await controller.getAsset(a.id);
			expect(fetched?.folder).toBeUndefined();
		});
	});

	// ── getStats ──────────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns zeroed stats when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalAssets).toBe(0);
			expect(stats.totalSize).toBe(0);
			expect(stats.byMimeType).toEqual({});
			expect(stats.byFolder).toEqual({});
		});

		it("computes correct stats", async () => {
			await controller.createAsset({
				name: "a.jpg",
				url: "https://cdn.example.com/a.jpg",
				mimeType: "image/jpeg",
				size: 1000,
				folder: "photos",
			});
			await controller.createAsset({
				name: "b.png",
				url: "https://cdn.example.com/b.png",
				mimeType: "image/png",
				size: 2000,
				folder: "photos",
			});
			await controller.createAsset({
				name: "c.pdf",
				url: "https://cdn.example.com/c.pdf",
				mimeType: "application/pdf",
				size: 5000,
			});

			const stats = await controller.getStats();
			expect(stats.totalAssets).toBe(3);
			expect(stats.totalSize).toBe(8000);
			expect(stats.byMimeType).toEqual({
				"image/jpeg": 1,
				"image/png": 1,
				"application/pdf": 1,
			});
			expect(stats.byFolder).toEqual({
				photos: 2,
				"(root)": 1,
			});
		});
	});

	// ── Folders ───────────────────────────────────────────────────────────────

	describe("createFolder", () => {
		it("creates a folder", async () => {
			const folder = await controller.createFolder({ name: "Products" });
			expect(folder.id).toBeDefined();
			expect(folder.name).toBe("Products");
			expect(folder.parentId).toBeUndefined();
			expect(folder.createdAt).toBeInstanceOf(Date);
		});

		it("creates a nested folder", async () => {
			const parent = await controller.createFolder({ name: "Images" });
			const child = await controller.createFolder({
				name: "Thumbnails",
				parentId: parent.id,
			});

			expect(child.parentId).toBe(parent.id);
		});
	});

	describe("getFolder", () => {
		it("returns null for non-existent folder", async () => {
			const result = await controller.getFolder("non-existent");
			expect(result).toBeNull();
		});

		it("returns the folder by id", async () => {
			const created = await controller.createFolder({ name: "Media" });
			const fetched = await controller.getFolder(created.id);
			expect(fetched?.name).toBe("Media");
		});
	});

	describe("listFolders", () => {
		it("returns empty array when no folders exist", async () => {
			const folders = await controller.listFolders();
			expect(folders).toEqual([]);
		});

		it("returns all folders", async () => {
			await controller.createFolder({ name: "A" });
			await controller.createFolder({ name: "B" });

			const folders = await controller.listFolders();
			expect(folders).toHaveLength(2);
		});
	});

	describe("renameFolder", () => {
		it("returns null for non-existent folder", async () => {
			const result = await controller.renameFolder("non-existent", "New Name");
			expect(result).toBeNull();
		});

		it("renames an existing folder", async () => {
			const created = await controller.createFolder({ name: "Old Name" });
			const renamed = await controller.renameFolder(created.id, "New Name");
			expect(renamed?.name).toBe("New Name");

			const fetched = await controller.getFolder(created.id);
			expect(fetched?.name).toBe("New Name");
		});
	});

	describe("deleteFolder", () => {
		it("returns false for non-existent folder", async () => {
			const result = await controller.deleteFolder("non-existent");
			expect(result).toBe(false);
		});

		it("deletes an existing folder", async () => {
			const created = await controller.createFolder({ name: "To Delete" });
			const deleted = await controller.deleteFolder(created.id);
			expect(deleted).toBe(true);

			const fetched = await controller.getFolder(created.id);
			expect(fetched).toBeNull();
		});
	});
});
