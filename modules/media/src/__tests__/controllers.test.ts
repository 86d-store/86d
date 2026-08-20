import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMediaController } from "../service-impl";

describe("media controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createMediaController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createMediaController(mockData);
	});

	// ── Asset creation edge cases ─────────────────────────────────────

	describe("createAsset — edge cases", () => {
		it("assigns unique ids to each asset", async () => {
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
				size: 100,
			});
			expect(a.id).not.toBe(b.id);
		});

		it("defaults tags to empty array when not provided", async () => {
			const asset = await controller.createAsset({
				name: "no-tags.jpg",
				url: "https://cdn.example.com/no-tags.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			expect(asset.tags).toEqual([]);
			expect(Array.isArray(asset.tags)).toBe(true);
		});

		it("defaults metadata to empty object when not provided", async () => {
			const asset = await controller.createAsset({
				name: "no-meta.jpg",
				url: "https://cdn.example.com/no-meta.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			expect(asset.metadata).toEqual({});
		});

		it("creates asset with zero size", async () => {
			const asset = await controller.createAsset({
				name: "empty.txt",
				url: "https://cdn.example.com/empty.txt",
				mimeType: "text/plain",
				size: 0,
			});
			expect(asset.size).toBe(0);
		});

		it("creates asset with complex metadata", async () => {
			const metadata = {
				source: "api",
				dimensions: { width: 1920, height: 1080 },
				colors: ["#fff", "#000"],
			};
			const asset = await controller.createAsset({
				name: "complex.jpg",
				url: "https://cdn.example.com/complex.jpg",
				mimeType: "image/jpeg",
				size: 5000,
				metadata,
			});
			expect(asset.metadata).toEqual(metadata);
		});
	});

	// ── Update edge cases ─────────────────────────────────────────────

	describe("updateAsset — edge cases", () => {
		it("updates multiple fields at once", async () => {
			const created = await controller.createAsset({
				name: "original.jpg",
				url: "https://cdn.example.com/original.jpg",
				mimeType: "image/jpeg",
				size: 1024,
			});

			const updated = await controller.updateAsset(created.id, {
				name: "renamed.jpg",
				altText: "New description",
				tags: ["featured"],
				metadata: { edited: true },
			});

			expect(updated?.name).toBe("renamed.jpg");
			expect(updated?.altText).toBe("New description");
			expect(updated?.tags).toEqual(["featured"]);
			expect(updated?.metadata).toEqual({ edited: true });
		});

		it("updates url field", async () => {
			const created = await controller.createAsset({
				name: "file.jpg",
				url: "https://cdn.example.com/old.jpg",
				mimeType: "image/jpeg",
				size: 512,
			});

			const updated = await controller.updateAsset(created.id, {
				url: "https://cdn.example.com/new.jpg",
			});
			expect(updated?.url).toBe("https://cdn.example.com/new.jpg");
			expect(updated?.name).toBe("file.jpg");
		});

		it("updates folder field", async () => {
			const created = await controller.createAsset({
				name: "file.jpg",
				url: "https://cdn.example.com/file.jpg",
				mimeType: "image/jpeg",
				size: 512,
			});

			const updated = await controller.updateAsset(created.id, {
				folder: "new-folder",
			});
			expect(updated?.folder).toBe("new-folder");
		});

		it("clears tags by setting empty array", async () => {
			const created = await controller.createAsset({
				name: "tagged.jpg",
				url: "https://cdn.example.com/tagged.jpg",
				mimeType: "image/jpeg",
				size: 100,
				tags: ["old", "tags"],
			});

			const updated = await controller.updateAsset(created.id, {
				tags: [],
			});
			expect(updated?.tags).toEqual([]);
		});

		it("preserves unchanged fields when updating one field", async () => {
			const created = await controller.createAsset({
				name: "preserve.jpg",
				url: "https://cdn.example.com/preserve.jpg",
				mimeType: "image/jpeg",
				size: 2048,
				altText: "Keep this",
				tags: ["keep"],
				folder: "originals",
			});

			const updated = await controller.updateAsset(created.id, {
				name: "new-name.jpg",
			});
			expect(updated?.altText).toBe("Keep this");
			expect(updated?.tags).toEqual(["keep"]);
			expect(updated?.folder).toBe("originals");
			expect(updated?.mimeType).toBe("image/jpeg");
			expect(updated?.size).toBe(2048);
		});

		it("persists updates so subsequent get returns new values", async () => {
			const created = await controller.createAsset({
				name: "persist.jpg",
				url: "https://cdn.example.com/persist.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			await controller.updateAsset(created.id, {
				name: "persisted.jpg",
				altText: "Updated alt",
			});

			const fetched = await controller.getAsset(created.id);
			expect(fetched?.name).toBe("persisted.jpg");
			expect(fetched?.altText).toBe("Updated alt");
		});
	});

	// ── listAssets — filtering edge cases ──────────────────────────────

	describe("listAssets — filtering edge cases", () => {
		it("filters by folder", async () => {
			await controller.createAsset({
				name: "in-folder.jpg",
				url: "https://cdn.example.com/in-folder.jpg",
				mimeType: "image/jpeg",
				size: 100,
				folder: "products",
			});
			await controller.createAsset({
				name: "root.jpg",
				url: "https://cdn.example.com/root.jpg",
				mimeType: "image/jpeg",
				size: 200,
			});

			const filtered = await controller.listAssets({ folder: "products" });
			expect(filtered).toHaveLength(1);
			expect(filtered[0].name).toBe("in-folder.jpg");
		});

		it("filters by mimeType", async () => {
			await controller.createAsset({
				name: "photo.jpg",
				url: "https://cdn.example.com/photo.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			await controller.createAsset({
				name: "doc.pdf",
				url: "https://cdn.example.com/doc.pdf",
				mimeType: "application/pdf",
				size: 500,
			});

			const filtered = await controller.listAssets({
				mimeType: "application/pdf",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].name).toBe("doc.pdf");
		});

		it("combines folder and tag filters", async () => {
			await controller.createAsset({
				name: "match.jpg",
				url: "https://cdn.example.com/match.jpg",
				mimeType: "image/jpeg",
				size: 100,
				folder: "products",
				tags: ["featured"],
			});
			await controller.createAsset({
				name: "wrong-folder.jpg",
				url: "https://cdn.example.com/wrong-folder.jpg",
				mimeType: "image/jpeg",
				size: 100,
				folder: "banners",
				tags: ["featured"],
			});
			await controller.createAsset({
				name: "wrong-tag.jpg",
				url: "https://cdn.example.com/wrong-tag.jpg",
				mimeType: "image/jpeg",
				size: 100,
				folder: "products",
				tags: ["archived"],
			});

			const filtered = await controller.listAssets({
				folder: "products",
				tag: "featured",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].name).toBe("match.jpg");
		});

		it("search is case-insensitive", async () => {
			await controller.createAsset({
				name: "UPPERCASE-HERO.jpg",
				url: "https://cdn.example.com/upper.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const filtered = await controller.listAssets({
				search: "uppercase-hero",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].name).toBe("UPPERCASE-HERO.jpg");
		});

		it("search with special characters matches literally", async () => {
			await controller.createAsset({
				name: "file (1).jpg",
				url: "https://cdn.example.com/file1.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			await controller.createAsset({
				name: "file-2.jpg",
				url: "https://cdn.example.com/file2.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const filtered = await controller.listAssets({ search: "(1)" });
			expect(filtered).toHaveLength(1);
			expect(filtered[0].name).toBe("file (1).jpg");
		});

		it("search returns empty when no match", async () => {
			await controller.createAsset({
				name: "exists.jpg",
				url: "https://cdn.example.com/exists.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const filtered = await controller.listAssets({
				search: "nonexistent",
			});
			expect(filtered).toHaveLength(0);
		});

		it("applies take for pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createAsset({
					name: `item-${i}.jpg`,
					url: `https://cdn.example.com/item-${i}.jpg`,
					mimeType: "image/jpeg",
					size: 100,
				});
			}

			const page = await controller.listAssets({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("applies skip for pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createAsset({
					name: `item-${i}.jpg`,
					url: `https://cdn.example.com/item-${i}.jpg`,
					mimeType: "image/jpeg",
					size: 100,
				});
			}

			const skipped = await controller.listAssets({ skip: 3 });
			expect(skipped).toHaveLength(2);
		});

		it("applies take and skip together", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.createAsset({
					name: `p-${i}.jpg`,
					url: `https://cdn.example.com/p-${i}.jpg`,
					mimeType: "image/jpeg",
					size: 100,
				});
			}

			const page = await controller.listAssets({ skip: 2, take: 3 });
			expect(page).toHaveLength(3);
		});

		it("tag filter that matches no assets returns empty array", async () => {
			await controller.createAsset({
				name: "img.jpg",
				url: "https://cdn.example.com/img.jpg",
				mimeType: "image/jpeg",
				size: 100,
				tags: ["landscape"],
			});

			const filtered = await controller.listAssets({ tag: "portrait" });
			expect(filtered).toHaveLength(0);
		});
	});

	// ── bulkDelete — edge cases ───────────────────────────────────────

	describe("bulkDelete — edge cases", () => {
		it("returns 0 for empty id array", async () => {
			const count = await controller.bulkDelete([]);
			expect(count).toBe(0);
		});

		it("returns 0 when all ids are non-existent", async () => {
			const count = await controller.bulkDelete([
				"ghost-1",
				"ghost-2",
				"ghost-3",
			]);
			expect(count).toBe(0);
		});

		it("deletes all assets when given all ids", async () => {
			const ids: string[] = [];
			for (let i = 0; i < 5; i++) {
				const asset = await controller.createAsset({
					name: `d-${i}.jpg`,
					url: `https://cdn.example.com/d-${i}.jpg`,
					mimeType: "image/jpeg",
					size: 100,
				});
				ids.push(asset.id);
			}

			const count = await controller.bulkDelete(ids);
			expect(count).toBe(5);

			const remaining = await controller.listAssets();
			expect(remaining).toHaveLength(0);
		});

		it("handles duplicate ids gracefully", async () => {
			const asset = await controller.createAsset({
				name: "dup.jpg",
				url: "https://cdn.example.com/dup.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const count = await controller.bulkDelete([asset.id, asset.id]);
			// First delete succeeds, second finds nothing
			expect(count).toBe(1);
		});
	});

	// ── moveAssets — edge cases ───────────────────────────────────────

	describe("moveAssets — edge cases", () => {
		it("moves multiple assets to same folder", async () => {
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

			const moved = await controller.moveAssets([a.id, b.id], "gallery");
			expect(moved).toBe(2);

			const fa = await controller.getAsset(a.id);
			const fb = await controller.getAsset(b.id);
			expect(fa?.folder).toBe("gallery");
			expect(fb?.folder).toBe("gallery");
		});

		it("returns 0 for empty ids array", async () => {
			const moved = await controller.moveAssets([], "anywhere");
			expect(moved).toBe(0);
		});

		it("skips non-existent ids in mixed array", async () => {
			const real = await controller.createAsset({
				name: "real.jpg",
				url: "https://cdn.example.com/real.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const moved = await controller.moveAssets(
				[real.id, "ghost-1", "ghost-2"],
				"target",
			);
			expect(moved).toBe(1);

			const fetched = await controller.getAsset(real.id);
			expect(fetched?.folder).toBe("target");
		});

		it("moves assets to a non-existent folder name (allowed)", async () => {
			const asset = await controller.createAsset({
				name: "orphan.jpg",
				url: "https://cdn.example.com/orphan.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const moved = await controller.moveAssets(
				[asset.id],
				"does-not-exist-yet",
			);
			expect(moved).toBe(1);

			const fetched = await controller.getAsset(asset.id);
			expect(fetched?.folder).toBe("does-not-exist-yet");
		});

		it("preserves other asset fields after move", async () => {
			const asset = await controller.createAsset({
				name: "keep-fields.jpg",
				url: "https://cdn.example.com/keep-fields.jpg",
				mimeType: "image/jpeg",
				size: 999,
				altText: "Do not lose me",
				tags: ["important"],
				metadata: { key: "value" },
			});

			await controller.moveAssets([asset.id], "new-home");

			const fetched = await controller.getAsset(asset.id);
			expect(fetched?.name).toBe("keep-fields.jpg");
			expect(fetched?.altText).toBe("Do not lose me");
			expect(fetched?.tags).toEqual(["important"]);
			expect(fetched?.metadata).toEqual({ key: "value" });
			expect(fetched?.size).toBe(999);
		});
	});

	// ── getStats — edge cases ─────────────────────────────────────────

	describe("getStats — edge cases", () => {
		it("counts many distinct mime types", async () => {
			const types = [
				"image/jpeg",
				"image/png",
				"image/gif",
				"image/webp",
				"application/pdf",
				"video/mp4",
				"audio/mpeg",
			];
			for (let i = 0; i < types.length; i++) {
				await controller.createAsset({
					name: `file-${i}.bin`,
					url: `https://cdn.example.com/file-${i}`,
					mimeType: types[i],
					size: 100 * (i + 1),
				});
			}

			const stats = await controller.getStats();
			expect(stats.totalAssets).toBe(7);
			expect(Object.keys(stats.byMimeType)).toHaveLength(7);
			for (const t of types) {
				expect(stats.byMimeType[t]).toBe(1);
			}
		});

		it("counts multiple assets per mime type", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.createAsset({
					name: `jpeg-${i}.jpg`,
					url: `https://cdn.example.com/jpeg-${i}.jpg`,
					mimeType: "image/jpeg",
					size: 100,
				});
			}
			await controller.createAsset({
				name: "single.png",
				url: "https://cdn.example.com/single.png",
				mimeType: "image/png",
				size: 200,
			});

			const stats = await controller.getStats();
			expect(stats.byMimeType["image/jpeg"]).toBe(3);
			expect(stats.byMimeType["image/png"]).toBe(1);
		});

		it("counts assets across many folders", async () => {
			const folders = ["alpha", "beta", "gamma", "delta"];
			for (const f of folders) {
				await controller.createAsset({
					name: `${f}.jpg`,
					url: `https://cdn.example.com/${f}.jpg`,
					mimeType: "image/jpeg",
					size: 100,
					folder: f,
				});
			}

			const stats = await controller.getStats();
			expect(Object.keys(stats.byFolder)).toHaveLength(4);
			for (const f of folders) {
				expect(stats.byFolder[f]).toBe(1);
			}
		});

		it("sums totalSize correctly with large sizes", async () => {
			await controller.createAsset({
				name: "big-a.bin",
				url: "https://cdn.example.com/big-a.bin",
				mimeType: "application/octet-stream",
				size: 1_000_000_000,
			});
			await controller.createAsset({
				name: "big-b.bin",
				url: "https://cdn.example.com/big-b.bin",
				mimeType: "application/octet-stream",
				size: 2_000_000_000,
			});

			const stats = await controller.getStats();
			expect(stats.totalSize).toBe(3_000_000_000);
		});

		it("reflects stats after bulk delete", async () => {
			const ids: string[] = [];
			for (let i = 0; i < 4; i++) {
				const asset = await controller.createAsset({
					name: `s-${i}.jpg`,
					url: `https://cdn.example.com/s-${i}.jpg`,
					mimeType: "image/jpeg",
					size: 500,
				});
				ids.push(asset.id);
			}

			await controller.bulkDelete([ids[0], ids[1]]);

			const stats = await controller.getStats();
			expect(stats.totalAssets).toBe(2);
			expect(stats.totalSize).toBe(1000);
		});
	});

	// ── Folder edge cases ─────────────────────────────────────────────

	describe("folders — edge cases", () => {
		it("creates deeply nested folders (3 levels)", async () => {
			const level1 = await controller.createFolder({ name: "Root" });
			const level2 = await controller.createFolder({
				name: "Child",
				parentId: level1.id,
			});
			const level3 = await controller.createFolder({
				name: "Grandchild",
				parentId: level2.id,
			});

			expect(level3.parentId).toBe(level2.id);

			const fetched = await controller.getFolder(level3.id);
			expect(fetched?.name).toBe("Grandchild");
			expect(fetched?.parentId).toBe(level2.id);
		});

		it("creates folder with non-existent parentId (no referential check)", async () => {
			const folder = await controller.createFolder({
				name: "Orphan",
				parentId: "does-not-exist",
			});
			expect(folder.parentId).toBe("does-not-exist");
		});

		it("listFolders with parentId filters to children only", async () => {
			const parent = await controller.createFolder({ name: "Parent" });
			await controller.createFolder({
				name: "Child A",
				parentId: parent.id,
			});
			await controller.createFolder({
				name: "Child B",
				parentId: parent.id,
			});
			await controller.createFolder({ name: "Unrelated" });

			const children = await controller.listFolders(parent.id);
			expect(children).toHaveLength(2);
			const names = children.map((f) => f.name);
			expect(names).toContain("Child A");
			expect(names).toContain("Child B");
		});

		it("renameFolder preserves parentId", async () => {
			const parent = await controller.createFolder({ name: "Parent" });
			const child = await controller.createFolder({
				name: "Old Name",
				parentId: parent.id,
			});

			const renamed = await controller.renameFolder(child.id, "New Name");
			expect(renamed?.name).toBe("New Name");
			expect(renamed?.parentId).toBe(parent.id);
		});

		it("deleteFolder does not cascade to children", async () => {
			const parent = await controller.createFolder({ name: "Parent" });
			const child = await controller.createFolder({
				name: "Child",
				parentId: parent.id,
			});

			await controller.deleteFolder(parent.id);

			// Child still exists with stale parentId
			const fetched = await controller.getFolder(child.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.parentId).toBe(parent.id);
		});
	});

	// ── Combined operations ───────────────────────────────────────────

	describe("combined operations", () => {
		it("create assets in folder, list by folder, then bulk delete", async () => {
			const ids: string[] = [];
			for (let i = 0; i < 3; i++) {
				const asset = await controller.createAsset({
					name: `prod-${i}.jpg`,
					url: `https://cdn.example.com/prod-${i}.jpg`,
					mimeType: "image/jpeg",
					size: 1000,
					folder: "products",
				});
				ids.push(asset.id);
			}

			const inFolder = await controller.listAssets({ folder: "products" });
			expect(inFolder).toHaveLength(3);

			const deleted = await controller.bulkDelete(ids);
			expect(deleted).toBe(3);

			const afterDelete = await controller.listAssets({ folder: "products" });
			expect(afterDelete).toHaveLength(0);
		});

		it("move assets then verify list by new folder", async () => {
			const a = await controller.createAsset({
				name: "a.jpg",
				url: "https://cdn.example.com/a.jpg",
				mimeType: "image/jpeg",
				size: 100,
				folder: "old",
			});
			const b = await controller.createAsset({
				name: "b.jpg",
				url: "https://cdn.example.com/b.jpg",
				mimeType: "image/jpeg",
				size: 200,
				folder: "old",
			});

			await controller.moveAssets([a.id, b.id], "new");

			const oldFolder = await controller.listAssets({ folder: "old" });
			expect(oldFolder).toHaveLength(0);

			const newFolder = await controller.listAssets({ folder: "new" });
			expect(newFolder).toHaveLength(2);
		});

		it("create folder, create assets with folder name, verify stats", async () => {
			await controller.createFolder({ name: "media" });

			await controller.createAsset({
				name: "vid.mp4",
				url: "https://cdn.example.com/vid.mp4",
				mimeType: "video/mp4",
				size: 10_000,
				folder: "media",
			});
			await controller.createAsset({
				name: "audio.mp3",
				url: "https://cdn.example.com/audio.mp3",
				mimeType: "audio/mpeg",
				size: 5_000,
				folder: "media",
			});
			await controller.createAsset({
				name: "root.jpg",
				url: "https://cdn.example.com/root.jpg",
				mimeType: "image/jpeg",
				size: 1_000,
			});

			const stats = await controller.getStats();
			expect(stats.totalAssets).toBe(3);
			expect(stats.totalSize).toBe(16_000);
			expect(stats.byFolder).toEqual({
				media: 2,
				"(root)": 1,
			});
			expect(stats.byMimeType).toEqual({
				"video/mp4": 1,
				"audio/mpeg": 1,
				"image/jpeg": 1,
			});
		});

		it("delete single asset then verify it is gone from list and stats", async () => {
			const keep = await controller.createAsset({
				name: "keep.jpg",
				url: "https://cdn.example.com/keep.jpg",
				mimeType: "image/jpeg",
				size: 1000,
			});
			const remove = await controller.createAsset({
				name: "remove.jpg",
				url: "https://cdn.example.com/remove.jpg",
				mimeType: "image/jpeg",
				size: 2000,
			});

			await controller.deleteAsset(remove.id);

			const list = await controller.listAssets();
			expect(list).toHaveLength(1);
			expect(list[0].id).toBe(keep.id);

			const stats = await controller.getStats();
			expect(stats.totalAssets).toBe(1);
			expect(stats.totalSize).toBe(1000);
		});

		it("update asset folder then verify stats reflect new folder", async () => {
			await controller.createAsset({
				name: "moveme.jpg",
				url: "https://cdn.example.com/moveme.jpg",
				mimeType: "image/jpeg",
				size: 500,
				folder: "alpha",
			});
			const asset = await controller.createAsset({
				name: "stay.jpg",
				url: "https://cdn.example.com/stay.jpg",
				mimeType: "image/jpeg",
				size: 500,
				folder: "alpha",
			});

			await controller.updateAsset(asset.id, { folder: "beta" });

			const stats = await controller.getStats();
			expect(stats.byFolder.alpha).toBe(1);
			expect(stats.byFolder.beta).toBe(1);
		});
	});
});
