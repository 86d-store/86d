import { describe, expect, it, vi } from "vitest";
import { bulkDeleteEndpoint } from "../admin/endpoints/bulk-delete";
import { createAssetEndpoint } from "../admin/endpoints/create-asset";
import { createFolderEndpoint } from "../admin/endpoints/create-folder";
import { deleteAssetEndpoint } from "../admin/endpoints/delete-asset";
import { deleteFolderEndpoint } from "../admin/endpoints/delete-folder";
import { adminGetAssetEndpoint } from "../admin/endpoints/get-asset";
import { adminListAssetsEndpoint } from "../admin/endpoints/list-assets";
import { listFoldersEndpoint } from "../admin/endpoints/list-folders";
import { moveAssetsEndpoint } from "../admin/endpoints/move-assets";
import { renameFolderEndpoint } from "../admin/endpoints/rename-folder";
import { statsEndpoint } from "../admin/endpoints/stats";
import { updateAssetEndpoint } from "../admin/endpoints/update-asset";
import type { Asset, Folder, MediaController, MediaStats } from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "photo.jpg",
		url: "https://cdn.example.com/photo.jpg",
		mimeType: "image/jpeg",
		size: 204800,
		tags: [],
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
	return {
		id: crypto.randomUUID(),
		name: "images",
		createdAt: new Date(),
		...overrides,
	};
}

function makeStats(overrides: Partial<MediaStats> = {}): MediaStats {
	return {
		totalAssets: 0,
		totalSize: 0,
		byMimeType: {},
		byFolder: {},
		...overrides,
	};
}

function makeController(
	overrides: Partial<MediaController> = {},
): MediaController {
	return {
		createAsset: vi.fn().mockResolvedValue(makeAsset()),
		getAsset: vi.fn().mockResolvedValue(null),
		updateAsset: vi.fn().mockResolvedValue(null),
		deleteAsset: vi.fn().mockResolvedValue(false),
		listAssets: vi.fn().mockResolvedValue([]),
		bulkDelete: vi.fn().mockResolvedValue(0),
		moveAssets: vi.fn().mockResolvedValue(0),
		getStats: vi.fn().mockResolvedValue(makeStats()),
		createFolder: vi.fn().mockResolvedValue(makeFolder()),
		getFolder: vi.fn().mockResolvedValue(null),
		listFolders: vi.fn().mockResolvedValue([]),
		renameFolder: vi.fn().mockResolvedValue(null),
		deleteFolder: vi.fn().mockResolvedValue(false),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | number | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: MediaController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { media: opts.controller ?? makeController() } },
	});
}

const listAssetsHandler = extractHandler(adminListAssetsEndpoint);
const createAssetHandler = extractHandler(createAssetEndpoint);
const getAssetHandler = extractHandler(adminGetAssetEndpoint);
const updateAssetHandler = extractHandler(updateAssetEndpoint);
const deleteAssetHandler = extractHandler(deleteAssetEndpoint);
const bulkDeleteHandler = extractHandler(bulkDeleteEndpoint);
const moveAssetsHandler = extractHandler(moveAssetsEndpoint);
const listFoldersHandler = extractHandler(listFoldersEndpoint);
const createFolderHandler = extractHandler(createFolderEndpoint);
const renameFolderHandler = extractHandler(renameFolderEndpoint);
const deleteFolderHandler = extractHandler(deleteFolderEndpoint);
const statsHandler = extractHandler(statsEndpoint);

// ---------------------------------------------------------------------------
// adminListAssetsEndpoint
// ---------------------------------------------------------------------------

describe("admin GET /admin/media", () => {
	it("returns empty list by default", async () => {
		const result = (await call(listAssetsHandler)) as {
			assets: Asset[];
			total: number;
		};
		expect(result.assets).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns assets and total when assets exist", async () => {
		const assets = [makeAsset({ id: "a1" }), makeAsset({ id: "a2" })];
		const ctrl = makeController({
			listAssets: vi.fn().mockResolvedValue(assets),
		});
		const result = (await call(listAssetsHandler, {
			controller: ctrl,
		})) as { assets: Asset[]; total: number };
		expect(result.assets).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards folder filter to controller", async () => {
		const ctrl = makeController();
		await call(listAssetsHandler, {
			query: { folder: "images" },
			controller: ctrl,
		});
		expect(ctrl.listAssets).toHaveBeenCalledWith(
			expect.objectContaining({ folder: "images" }),
		);
	});

	it("forwards mimeType filter to controller", async () => {
		const ctrl = makeController();
		await call(listAssetsHandler, {
			query: { mimeType: "image/png" },
			controller: ctrl,
		});
		expect(ctrl.listAssets).toHaveBeenCalledWith(
			expect.objectContaining({ mimeType: "image/png" }),
		);
	});

	it("forwards search filter to controller", async () => {
		const ctrl = makeController();
		await call(listAssetsHandler, {
			query: { search: "banner" },
			controller: ctrl,
		});
		expect(ctrl.listAssets).toHaveBeenCalledWith(
			expect.objectContaining({ search: "banner" }),
		);
	});

	it("slices results to the requested page without passing pagination to controller", async () => {
		const allAssets = Array.from({ length: 25 }, (_, i) =>
			makeAsset({ id: `a${i + 1}` }),
		);
		const ctrl = makeController({
			listAssets: vi.fn().mockResolvedValue(allAssets),
		});
		const result = (await call(listAssetsHandler, {
			query: { page: 3, limit: 10 },
			controller: ctrl,
		})) as { assets: Asset[]; total: number };
		// Controller called without take/skip — pagination is done in-memory
		expect(ctrl.listAssets).toHaveBeenCalledWith(
			expect.not.objectContaining({ skip: expect.anything() }),
		);
		expect(ctrl.listAssets).toHaveBeenCalledWith(
			expect.not.objectContaining({ take: expect.anything() }),
		);
		// Page 3, limit 10 → items 20-24 (5 items), total = 25
		expect(result.assets).toHaveLength(5);
		expect(result.total).toBe(25);
	});
});

// ---------------------------------------------------------------------------
// createAssetEndpoint
// ---------------------------------------------------------------------------

describe("admin POST /admin/media/create", () => {
	it("creates an asset and returns it", async () => {
		const asset = makeAsset({ name: "logo.png", mimeType: "image/png" });
		const ctrl = makeController({
			createAsset: vi.fn().mockResolvedValue(asset),
		});
		const result = (await call(createAssetHandler, {
			body: {
				name: "logo.png",
				url: "https://cdn.example.com/logo.png",
				mimeType: "image/png",
				size: 10240,
			},
			controller: ctrl,
		})) as { asset: Asset };
		expect(result.asset.name).toBe("logo.png");
		expect(result.asset.mimeType).toBe("image/png");
	});

	it("forwards optional fields to controller", async () => {
		const ctrl = makeController();
		await call(createAssetHandler, {
			body: {
				name: "banner.jpg",
				url: "https://cdn.example.com/banner.jpg",
				mimeType: "image/jpeg",
				size: 51200,
				altText: "Site banner",
				width: 1200,
				height: 400,
				folder: "banners",
				tags: ["hero", "marketing"],
				metadata: { source: "upload" },
			},
			controller: ctrl,
		});
		expect(ctrl.createAsset).toHaveBeenCalledWith(
			expect.objectContaining({
				altText: "Site banner",
				width: 1200,
				height: 400,
				folder: "banners",
				tags: ["hero", "marketing"],
				metadata: { source: "upload" },
			}),
		);
	});
});

// ---------------------------------------------------------------------------
// adminGetAssetEndpoint
// ---------------------------------------------------------------------------

describe("admin GET /admin/media/:id", () => {
	it("returns null asset when not found", async () => {
		const result = (await call(getAssetHandler, {
			params: { id: "missing" },
		})) as { asset: Asset | null };
		expect(result.asset).toBeNull();
	});

	it("returns asset when found", async () => {
		const asset = makeAsset({ id: "a1" });
		const ctrl = makeController({
			getAsset: vi.fn().mockResolvedValue(asset),
		});
		const result = (await call(getAssetHandler, {
			params: { id: "a1" },
			controller: ctrl,
		})) as { asset: Asset };
		expect(result.asset.id).toBe("a1");
	});
});

// ---------------------------------------------------------------------------
// updateAssetEndpoint
// ---------------------------------------------------------------------------

describe("admin PUT /admin/media/:id/update", () => {
	it("returns null asset when not found", async () => {
		const result = (await call(updateAssetHandler, {
			params: { id: "missing" },
			body: { name: "updated.jpg" },
		})) as { asset: Asset | null };
		expect(result.asset).toBeNull();
	});

	it("updates asset and returns it", async () => {
		const asset = makeAsset({ id: "a1", name: "renamed.jpg" });
		const ctrl = makeController({
			updateAsset: vi.fn().mockResolvedValue(asset),
		});
		const result = (await call(updateAssetHandler, {
			params: { id: "a1" },
			body: { name: "renamed.jpg" },
			controller: ctrl,
		})) as { asset: Asset };
		expect(result.asset.name).toBe("renamed.jpg");
	});

	it("forwards all optional update fields to controller", async () => {
		const ctrl = makeController({
			updateAsset: vi.fn().mockResolvedValue(makeAsset()),
		});
		await call(updateAssetHandler, {
			params: { id: "a1" },
			body: {
				name: "new.jpg",
				altText: "New alt",
				url: "https://cdn.example.com/new.jpg",
				folder: "new-folder",
				tags: ["updated"],
				metadata: { revised: true },
			},
			controller: ctrl,
		});
		expect(ctrl.updateAsset).toHaveBeenCalledWith(
			"a1",
			expect.objectContaining({
				name: "new.jpg",
				tags: ["updated"],
				metadata: { revised: true },
			}),
		);
	});
});

// ---------------------------------------------------------------------------
// deleteAssetEndpoint
// ---------------------------------------------------------------------------

describe("admin DELETE /admin/media/:id/delete", () => {
	it("returns deleted=false when asset not found", async () => {
		const result = (await call(deleteAssetHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted=true when asset is deleted", async () => {
		const ctrl = makeController({
			deleteAsset: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteAssetHandler, {
			params: { id: "a1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// bulkDeleteEndpoint
// ---------------------------------------------------------------------------

describe("admin POST /admin/media/bulk-delete", () => {
	it("returns deleted=0 when no assets match", async () => {
		const result = (await call(bulkDeleteHandler, {
			body: { ids: ["x1", "x2"] },
		})) as { deleted: number };
		expect(result.deleted).toBe(0);
	});

	it("returns count of deleted assets", async () => {
		const ctrl = makeController({
			bulkDelete: vi.fn().mockResolvedValue(3),
		});
		const result = (await call(bulkDeleteHandler, {
			body: { ids: ["a1", "a2", "a3"] },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(3);
	});

	it("passes ids to controller", async () => {
		const ctrl = makeController();
		await call(bulkDeleteHandler, {
			body: { ids: ["a1", "a2"] },
			controller: ctrl,
		});
		expect(ctrl.bulkDelete).toHaveBeenCalledWith(["a1", "a2"]);
	});
});

// ---------------------------------------------------------------------------
// moveAssetsEndpoint
// ---------------------------------------------------------------------------

describe("admin POST /admin/media/move", () => {
	it("returns moved=0 when no assets match", async () => {
		const result = (await call(moveAssetsHandler, {
			body: { ids: ["x1"], folder: "target" },
		})) as { moved: number };
		expect(result.moved).toBe(0);
	});

	it("returns count of moved assets", async () => {
		const ctrl = makeController({
			moveAssets: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(moveAssetsHandler, {
			body: { ids: ["a1", "a2"], folder: "archive" },
			controller: ctrl,
		})) as { moved: number };
		expect(result.moved).toBe(2);
	});

	it("accepts null folder to move assets to root", async () => {
		const ctrl = makeController({
			moveAssets: vi.fn().mockResolvedValue(1),
		});
		await call(moveAssetsHandler, {
			body: { ids: ["a1"], folder: null },
			controller: ctrl,
		});
		expect(ctrl.moveAssets).toHaveBeenCalledWith(["a1"], null);
	});
});

// ---------------------------------------------------------------------------
// listFoldersEndpoint
// ---------------------------------------------------------------------------

describe("admin GET /admin/media/folders", () => {
	it("returns empty list by default", async () => {
		const result = (await call(listFoldersHandler)) as { folders: Folder[] };
		expect(result.folders).toHaveLength(0);
	});

	it("returns folders when they exist", async () => {
		const folders = [makeFolder({ id: "f1" }), makeFolder({ id: "f2" })];
		const ctrl = makeController({
			listFolders: vi.fn().mockResolvedValue(folders),
		});
		const result = (await call(listFoldersHandler, {
			controller: ctrl,
		})) as { folders: Folder[] };
		expect(result.folders).toHaveLength(2);
	});

	it("forwards parentId filter to controller", async () => {
		const ctrl = makeController();
		await call(listFoldersHandler, {
			query: { parentId: "f1" },
			controller: ctrl,
		});
		expect(ctrl.listFolders).toHaveBeenCalledWith("f1");
	});

	it("passes undefined when parentId is absent", async () => {
		const ctrl = makeController();
		await call(listFoldersHandler, { controller: ctrl });
		expect(ctrl.listFolders).toHaveBeenCalledWith(undefined);
	});
});

// ---------------------------------------------------------------------------
// createFolderEndpoint
// ---------------------------------------------------------------------------

describe("admin POST /admin/media/folders/create", () => {
	it("creates a folder and returns it", async () => {
		const folder = makeFolder({ name: "videos" });
		const ctrl = makeController({
			createFolder: vi.fn().mockResolvedValue(folder),
		});
		const result = (await call(createFolderHandler, {
			body: { name: "videos" },
			controller: ctrl,
		})) as { folder: Folder };
		expect(result.folder.name).toBe("videos");
	});

	it("forwards parentId when provided", async () => {
		const ctrl = makeController();
		await call(createFolderHandler, {
			body: { name: "sub", parentId: "f1" },
			controller: ctrl,
		});
		expect(ctrl.createFolder).toHaveBeenCalledWith(
			expect.objectContaining({ parentId: "f1" }),
		);
	});
});

// ---------------------------------------------------------------------------
// renameFolderEndpoint
// ---------------------------------------------------------------------------

describe("admin PUT /admin/media/folders/:id", () => {
	it("returns null folder when not found", async () => {
		const result = (await call(renameFolderHandler, {
			params: { id: "missing" },
			body: { name: "new-name" },
		})) as { folder: Folder | null };
		expect(result.folder).toBeNull();
	});

	it("renames folder and returns it", async () => {
		const folder = makeFolder({ id: "f1", name: "renamed" });
		const ctrl = makeController({
			renameFolder: vi.fn().mockResolvedValue(folder),
		});
		const result = (await call(renameFolderHandler, {
			params: { id: "f1" },
			body: { name: "renamed" },
			controller: ctrl,
		})) as { folder: Folder };
		expect(result.folder.name).toBe("renamed");
	});

	it("passes id and name to controller", async () => {
		const ctrl = makeController({
			renameFolder: vi.fn().mockResolvedValue(makeFolder()),
		});
		await call(renameFolderHandler, {
			params: { id: "f1" },
			body: { name: "docs" },
			controller: ctrl,
		});
		expect(ctrl.renameFolder).toHaveBeenCalledWith("f1", "docs");
	});
});

// ---------------------------------------------------------------------------
// deleteFolderEndpoint
// ---------------------------------------------------------------------------

describe("admin DELETE /admin/media/folders/:id/delete", () => {
	it("returns deleted=false when folder not found", async () => {
		const result = (await call(deleteFolderHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted=true when folder is deleted", async () => {
		const ctrl = makeController({
			deleteFolder: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteFolderHandler, {
			params: { id: "f1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// statsEndpoint
// ---------------------------------------------------------------------------

describe("admin GET /admin/media/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as { stats: MediaStats };
		expect(result.stats.totalAssets).toBe(0);
		expect(result.stats.totalSize).toBe(0);
		expect(result.stats.byMimeType).toEqual({});
		expect(result.stats.byFolder).toEqual({});
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue(
				makeStats({
					totalAssets: 150,
					totalSize: 1073741824,
					byMimeType: { "image/jpeg": 80, "image/png": 40, "video/mp4": 30 },
					byFolder: { images: 100, videos: 30, docs: 20 },
				}),
			),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: MediaStats };
		expect(result.stats.totalAssets).toBe(150);
		expect(result.stats.totalSize).toBe(1073741824);
		expect(result.stats.byMimeType["image/jpeg"]).toBe(80);
		expect(result.stats.byFolder.images).toBe(100);
	});
});
