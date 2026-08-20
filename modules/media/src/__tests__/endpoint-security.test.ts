import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMediaController } from "../service-impl";

/**
 * Endpoint-security tests for the media module.
 *
 * These tests verify security-relevant invariants:
 *
 * 1. File type validation: mimeType is stored exactly as provided
 * 2. Size limit enforcement: large and zero-byte assets handled correctly
 * 3. Folder isolation: assets scoped to their folder, no cross-folder leakage
 * 4. Duplicate filename handling: multiple assets with same name get unique ids
 * 5. Tag filtering integrity: tag-based queries return only matching assets
 * 6. Storage quota enforcement: stats accurately reflect total size after mutations
 * 7. Metadata injection: metadata cannot bleed between assets
 * 8. Bulk delete safety: only specified ids are removed
 */

describe("media endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createMediaController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createMediaController(mockData);
	});

	// -- File type / mimeType integrity ---------------------------------------

	describe("file type validation", () => {
		it("stores mimeType exactly as provided without normalization", async () => {
			const asset = await controller.createAsset({
				name: "script.js",
				url: "https://cdn.example.com/script.js",
				mimeType: "application/javascript",
				size: 512,
			});
			expect(asset.mimeType).toBe("application/javascript");
		});

		it("accepts unusual mimeType strings without rejection", async () => {
			const asset = await controller.createAsset({
				name: "custom.bin",
				url: "https://cdn.example.com/custom.bin",
				mimeType: "application/x-custom-format",
				size: 100,
			});
			expect(asset.mimeType).toBe("application/x-custom-format");

			const fetched = await controller.getAsset(asset.id);
			expect(fetched?.mimeType).toBe("application/x-custom-format");
		});

		it("mimeType filter returns only exact matches, not partial", async () => {
			await controller.createAsset({
				name: "photo.jpg",
				url: "https://cdn.example.com/photo.jpg",
				mimeType: "image/jpeg",
				size: 1024,
			});
			await controller.createAsset({
				name: "icon.png",
				url: "https://cdn.example.com/icon.png",
				mimeType: "image/png",
				size: 512,
			});

			const filtered = await controller.listAssets({ mimeType: "image/jpeg" });
			expect(filtered).toHaveLength(1);
			expect(filtered[0]?.mimeType).toBe("image/jpeg");
		});
	});

	// -- Size limit enforcement -----------------------------------------------

	describe("size limit enforcement", () => {
		it("accepts zero-byte asset without error", async () => {
			const asset = await controller.createAsset({
				name: "empty.txt",
				url: "https://cdn.example.com/empty.txt",
				mimeType: "text/plain",
				size: 0,
			});
			expect(asset.size).toBe(0);
		});

		it("accepts very large size values without overflow", async () => {
			const asset = await controller.createAsset({
				name: "huge.zip",
				url: "https://cdn.example.com/huge.zip",
				mimeType: "application/zip",
				size: 10_000_000_000,
			});
			expect(asset.size).toBe(10_000_000_000);

			const fetched = await controller.getAsset(asset.id);
			expect(fetched?.size).toBe(10_000_000_000);
		});

		it("stats totalSize correctly sums multiple large assets", async () => {
			await controller.createAsset({
				name: "big-a.bin",
				url: "https://cdn.example.com/big-a.bin",
				mimeType: "application/octet-stream",
				size: 5_000_000_000,
			});
			await controller.createAsset({
				name: "big-b.bin",
				url: "https://cdn.example.com/big-b.bin",
				mimeType: "application/octet-stream",
				size: 5_000_000_000,
			});

			const stats = await controller.getStats();
			expect(stats.totalSize).toBe(10_000_000_000);
		});
	});

	// -- Folder isolation -----------------------------------------------------

	describe("folder isolation", () => {
		it("listing by folder does not return assets from other folders", async () => {
			await controller.createAsset({
				name: "secret.pdf",
				url: "https://cdn.example.com/secret.pdf",
				mimeType: "application/pdf",
				size: 2048,
				folder: "private",
			});
			await controller.createAsset({
				name: "public.jpg",
				url: "https://cdn.example.com/public.jpg",
				mimeType: "image/jpeg",
				size: 1024,
				folder: "public",
			});

			const privateAssets = await controller.listAssets({ folder: "private" });
			expect(privateAssets).toHaveLength(1);
			expect(privateAssets[0]?.name).toBe("secret.pdf");

			const publicAssets = await controller.listAssets({ folder: "public" });
			expect(publicAssets).toHaveLength(1);
			expect(publicAssets[0]?.name).toBe("public.jpg");
		});

		it("moving asset out of folder removes it from old folder listing", async () => {
			const asset = await controller.createAsset({
				name: "migrate.jpg",
				url: "https://cdn.example.com/migrate.jpg",
				mimeType: "image/jpeg",
				size: 512,
				folder: "source",
			});

			await controller.moveAssets([asset.id], "destination");

			const sourceAssets = await controller.listAssets({ folder: "source" });
			expect(sourceAssets).toHaveLength(0);

			const destAssets = await controller.listAssets({ folder: "destination" });
			expect(destAssets).toHaveLength(1);
			expect(destAssets[0]?.id).toBe(asset.id);
		});

		it("moving asset to root removes it from folder listing", async () => {
			const asset = await controller.createAsset({
				name: "rooted.jpg",
				url: "https://cdn.example.com/rooted.jpg",
				mimeType: "image/jpeg",
				size: 256,
				folder: "nested",
			});

			await controller.moveAssets([asset.id], null);

			const nestedAssets = await controller.listAssets({ folder: "nested" });
			expect(nestedAssets).toHaveLength(0);

			const fetched = await controller.getAsset(asset.id);
			expect(fetched?.folder).toBeUndefined();
		});

		it("stats byFolder accurately tracks folder distribution after moves", async () => {
			const a = await controller.createAsset({
				name: "a.jpg",
				url: "https://cdn.example.com/a.jpg",
				mimeType: "image/jpeg",
				size: 100,
				folder: "alpha",
			});
			await controller.createAsset({
				name: "b.jpg",
				url: "https://cdn.example.com/b.jpg",
				mimeType: "image/jpeg",
				size: 100,
				folder: "alpha",
			});

			await controller.moveAssets([a.id], "beta");

			const stats = await controller.getStats();
			expect(stats.byFolder.alpha).toBe(1);
			expect(stats.byFolder.beta).toBe(1);
		});
	});

	// -- Duplicate filename handling ------------------------------------------

	describe("duplicate filename handling", () => {
		it("multiple assets with identical names receive unique ids", async () => {
			const first = await controller.createAsset({
				name: "photo.jpg",
				url: "https://cdn.example.com/photo-1.jpg",
				mimeType: "image/jpeg",
				size: 1024,
			});
			const second = await controller.createAsset({
				name: "photo.jpg",
				url: "https://cdn.example.com/photo-2.jpg",
				mimeType: "image/jpeg",
				size: 2048,
			});

			expect(first.id).not.toBe(second.id);
		});

		it("duplicate-named assets both appear in listing", async () => {
			await controller.createAsset({
				name: "logo.png",
				url: "https://cdn.example.com/logo-v1.png",
				mimeType: "image/png",
				size: 500,
			});
			await controller.createAsset({
				name: "logo.png",
				url: "https://cdn.example.com/logo-v2.png",
				mimeType: "image/png",
				size: 600,
			});

			const all = await controller.listAssets();
			expect(all).toHaveLength(2);
			expect(all.every((a) => a.name === "logo.png")).toBe(true);
		});

		it("deleting one duplicate does not remove the other", async () => {
			const first = await controller.createAsset({
				name: "dup.jpg",
				url: "https://cdn.example.com/dup-1.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			const second = await controller.createAsset({
				name: "dup.jpg",
				url: "https://cdn.example.com/dup-2.jpg",
				mimeType: "image/jpeg",
				size: 200,
			});

			await controller.deleteAsset(first.id);

			const remaining = await controller.listAssets();
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.id).toBe(second.id);
		});
	});

	// -- Tag filtering integrity ----------------------------------------------

	describe("tag filtering integrity", () => {
		it("tag filter matches only assets that contain the exact tag", async () => {
			await controller.createAsset({
				name: "featured.jpg",
				url: "https://cdn.example.com/featured.jpg",
				mimeType: "image/jpeg",
				size: 100,
				tags: ["featured", "hero"],
			});
			await controller.createAsset({
				name: "hero-only.jpg",
				url: "https://cdn.example.com/hero-only.jpg",
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

			const featured = await controller.listAssets({ tag: "featured" });
			expect(featured).toHaveLength(1);
			expect(featured[0]?.name).toBe("featured.jpg");
		});

		it("updating tags replaces the full array, not appending", async () => {
			const asset = await controller.createAsset({
				name: "tagged.jpg",
				url: "https://cdn.example.com/tagged.jpg",
				mimeType: "image/jpeg",
				size: 100,
				tags: ["old-tag-a", "old-tag-b"],
			});

			await controller.updateAsset(asset.id, { tags: ["new-tag"] });

			const fetched = await controller.getAsset(asset.id);
			expect(fetched?.tags).toEqual(["new-tag"]);
			expect(fetched?.tags).not.toContain("old-tag-a");
			expect(fetched?.tags).not.toContain("old-tag-b");
		});

		it("clearing tags removes asset from tag-based queries", async () => {
			const asset = await controller.createAsset({
				name: "clearme.jpg",
				url: "https://cdn.example.com/clearme.jpg",
				mimeType: "image/jpeg",
				size: 100,
				tags: ["promo"],
			});

			const beforeClear = await controller.listAssets({ tag: "promo" });
			expect(beforeClear).toHaveLength(1);

			await controller.updateAsset(asset.id, { tags: [] });

			const afterClear = await controller.listAssets({ tag: "promo" });
			expect(afterClear).toHaveLength(0);
		});
	});

	// -- Storage quota enforcement (stats accuracy) ---------------------------

	describe("storage quota enforcement", () => {
		it("stats totalSize decreases after deleting an asset", async () => {
			const a = await controller.createAsset({
				name: "a.bin",
				url: "https://cdn.example.com/a.bin",
				mimeType: "application/octet-stream",
				size: 3000,
			});
			await controller.createAsset({
				name: "b.bin",
				url: "https://cdn.example.com/b.bin",
				mimeType: "application/octet-stream",
				size: 7000,
			});

			const before = await controller.getStats();
			expect(before.totalSize).toBe(10000);

			await controller.deleteAsset(a.id);

			const after = await controller.getStats();
			expect(after.totalSize).toBe(7000);
			expect(after.totalAssets).toBe(1);
		});

		it("stats totalSize decreases correctly after bulk delete", async () => {
			const ids: string[] = [];
			for (let i = 0; i < 5; i++) {
				const asset = await controller.createAsset({
					name: `file-${i}.bin`,
					url: `https://cdn.example.com/file-${i}.bin`,
					mimeType: "application/octet-stream",
					size: 1000,
				});
				ids.push(asset.id);
			}

			const before = await controller.getStats();
			expect(before.totalSize).toBe(5000);

			await controller.bulkDelete([ids[0], ids[1], ids[2]]);

			const after = await controller.getStats();
			expect(after.totalSize).toBe(2000);
			expect(after.totalAssets).toBe(2);
		});

		it("stats byMimeType counts update after deletions", async () => {
			const jpg = await controller.createAsset({
				name: "img.jpg",
				url: "https://cdn.example.com/img.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			await controller.createAsset({
				name: "doc.pdf",
				url: "https://cdn.example.com/doc.pdf",
				mimeType: "application/pdf",
				size: 200,
			});

			await controller.deleteAsset(jpg.id);

			const stats = await controller.getStats();
			expect(stats.byMimeType["image/jpeg"]).toBeUndefined();
			expect(stats.byMimeType["application/pdf"]).toBe(1);
		});
	});

	// -- Metadata injection safety --------------------------------------------

	describe("metadata injection safety", () => {
		it("metadata from one asset does not bleed into another", async () => {
			const first = await controller.createAsset({
				name: "first.jpg",
				url: "https://cdn.example.com/first.jpg",
				mimeType: "image/jpeg",
				size: 100,
				metadata: { secret: "sensitive-value" },
			});
			const second = await controller.createAsset({
				name: "second.jpg",
				url: "https://cdn.example.com/second.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const fetchedFirst = await controller.getAsset(first.id);
			const fetchedSecond = await controller.getAsset(second.id);

			expect(fetchedFirst?.metadata).toEqual({ secret: "sensitive-value" });
			expect(fetchedSecond?.metadata).toEqual({});
		});

		it("updating metadata replaces it entirely, not merging", async () => {
			const asset = await controller.createAsset({
				name: "meta.jpg",
				url: "https://cdn.example.com/meta.jpg",
				mimeType: "image/jpeg",
				size: 100,
				metadata: { oldKey: "oldValue", keep: "this" },
			});

			await controller.updateAsset(asset.id, {
				metadata: { newKey: "newValue" },
			});

			const fetched = await controller.getAsset(asset.id);
			expect(fetched?.metadata).toEqual({ newKey: "newValue" });
			expect(
				(fetched?.metadata as Record<string, unknown> | undefined)?.oldKey,
			).toBeUndefined();
		});
	});

	// -- Bulk delete safety ---------------------------------------------------

	describe("bulk delete safety", () => {
		it("bulk delete only removes specified ids, leaving others intact", async () => {
			const keep = await controller.createAsset({
				name: "keep.jpg",
				url: "https://cdn.example.com/keep.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});
			const remove1 = await controller.createAsset({
				name: "remove1.jpg",
				url: "https://cdn.example.com/remove1.jpg",
				mimeType: "image/jpeg",
				size: 200,
			});
			const remove2 = await controller.createAsset({
				name: "remove2.jpg",
				url: "https://cdn.example.com/remove2.jpg",
				mimeType: "image/jpeg",
				size: 300,
			});

			const count = await controller.bulkDelete([remove1.id, remove2.id]);
			expect(count).toBe(2);

			const remaining = await controller.listAssets();
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.id).toBe(keep.id);
		});

		it("bulk delete with non-existent ids returns accurate count", async () => {
			const real = await controller.createAsset({
				name: "real.jpg",
				url: "https://cdn.example.com/real.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const count = await controller.bulkDelete([
				real.id,
				"ghost-1",
				"ghost-2",
			]);
			expect(count).toBe(1);
		});

		it("double bulk-delete of same ids returns 0 on second call", async () => {
			const asset = await controller.createAsset({
				name: "once.jpg",
				url: "https://cdn.example.com/once.jpg",
				mimeType: "image/jpeg",
				size: 100,
			});

			const first = await controller.bulkDelete([asset.id]);
			expect(first).toBe(1);

			const second = await controller.bulkDelete([asset.id]);
			expect(second).toBe(0);
		});
	});
});
