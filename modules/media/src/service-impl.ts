import type { ModuleDataService } from "@86d-app/core/types/module";
import type { Asset, Folder, MediaController, MediaStats } from "./service";

export function createMediaController(
	data: ModuleDataService,
): MediaController {
	return {
		async createAsset(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const asset: Asset = {
				id,
				name: params.name,
				altText: params.altText,
				url: params.url,
				mimeType: params.mimeType,
				size: params.size,
				width: params.width,
				height: params.height,
				folder: params.folder,
				tags: params.tags ?? [],
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("asset", id, asset as Record<string, unknown>);
			return asset;
		},

		async getAsset(id) {
			const raw = await data.get("asset", id);
			if (!raw) return null;
			return raw as unknown as Asset;
		},

		async updateAsset(id, params) {
			const existing = await data.get("asset", id);
			if (!existing) return null;

			const asset = existing as unknown as Asset;
			const now = new Date();

			const updated: Asset = {
				...asset,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.altText !== undefined ? { altText: params.altText } : {}),
				...(params.url !== undefined ? { url: params.url } : {}),
				...(params.folder !== undefined ? { folder: params.folder } : {}),
				...(params.tags !== undefined ? { tags: params.tags } : {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				updatedAt: now,
			};
			await data.upsert("asset", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteAsset(id) {
			const existing = await data.get("asset", id);
			if (!existing) return false;
			await data.delete("asset", id);
			return true;
		},

		async listAssets(params) {
			const where: Record<string, unknown> = {};
			if (params?.folder !== undefined) where.folder = params.folder;
			if (params?.mimeType) where.mimeType = params.mimeType;

			const all = await data.findMany("asset", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			let assets = all as unknown as Asset[];

			if (params?.tag) {
				const tag = params.tag;
				assets = assets.filter((a) => a.tags.includes(tag));
			}

			if (params?.search) {
				const q = params.search.toLowerCase();
				assets = assets.filter(
					(a) =>
						a.name.toLowerCase().includes(q) ||
						a.altText?.toLowerCase().includes(q),
				);
			}

			return assets;
		},

		async bulkDelete(ids) {
			let count = 0;
			for (const id of ids) {
				const existing = await data.get("asset", id);
				if (existing) {
					await data.delete("asset", id);
					count++;
				}
			}
			return count;
		},

		async moveAssets(ids, folder) {
			let count = 0;
			for (const id of ids) {
				const existing = await data.get("asset", id);
				if (existing) {
					const asset = existing as unknown as Asset;
					const updated: Asset = {
						...asset,
						folder: folder ?? undefined,
						updatedAt: new Date(),
					};
					await data.upsert("asset", id, updated as Record<string, unknown>);
					count++;
				}
			}
			return count;
		},

		async getStats() {
			const all = await data.findMany("asset", {});
			const assets = all as unknown as Asset[];

			const stats: MediaStats = {
				totalAssets: assets.length,
				totalSize: 0,
				byMimeType: {},
				byFolder: {},
			};

			for (const a of assets) {
				stats.totalSize += a.size;
				stats.byMimeType[a.mimeType] = (stats.byMimeType[a.mimeType] ?? 0) + 1;
				const folderKey = a.folder ?? "(root)";
				stats.byFolder[folderKey] = (stats.byFolder[folderKey] ?? 0) + 1;
			}

			return stats;
		},

		async createFolder(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const folder: Folder = {
				id,
				name: params.name,
				parentId: params.parentId,
				createdAt: now,
			};
			await data.upsert("folder", id, folder as Record<string, unknown>);
			return folder;
		},

		async getFolder(id) {
			const raw = await data.get("folder", id);
			if (!raw) return null;
			return raw as unknown as Folder;
		},

		async listFolders(parentId) {
			const where: Record<string, unknown> = {};
			if (parentId !== undefined) {
				where.parentId = parentId;
			}

			const all = await data.findMany("folder", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				orderBy: { name: "asc" },
			});
			return all as unknown as Folder[];
		},

		async renameFolder(id, name) {
			const existing = await data.get("folder", id);
			if (!existing) return null;

			const folder = existing as unknown as Folder;
			const updated: Folder = { ...folder, name };
			await data.upsert("folder", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteFolder(id) {
			const existing = await data.get("folder", id);
			if (!existing) return false;
			await data.delete("folder", id);
			return true;
		},
	};
}
