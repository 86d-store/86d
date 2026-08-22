import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	DigitalDownloadsController,
	DownloadableFile,
	DownloadToken,
} from "./service";

export function createDigitalDownloadsController(
	data: ModuleDataService,
): DigitalDownloadsController {
	return {
		async createFile(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const file: DownloadableFile = {
				id,
				productId: params.productId,
				name: params.name,
				url: params.url,
				...(params.fileSize !== undefined ? { fileSize: params.fileSize } : {}),
				...(params.mimeType !== undefined ? { mimeType: params.mimeType } : {}),
				isActive: params.isActive ?? true,
				createdAt: now,
				updatedAt: now,
			};
			const fileRecord = file as Record<string, unknown>;
			await data.upsert("downloadableFile", id, fileRecord);
			return file;
		},

		async getFile(id) {
			const raw = await data.get("downloadableFile", id);
			if (!raw) return null;
			return raw as unknown as DownloadableFile;
		},

		async listFiles(params) {
			const where: Record<string, unknown> = {};
			if (params?.productId) where.productId = params.productId;

			const all = await data.findMany("downloadableFile", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as DownloadableFile[];
		},

		async updateFile(id, params) {
			const existing = await data.get("downloadableFile", id);
			if (!existing) return null;
			const file = existing as unknown as DownloadableFile;
			const now = new Date();
			const updated: DownloadableFile = {
				...file,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.url !== undefined ? { url: params.url } : {}),
				...(params.fileSize !== undefined ? { fileSize: params.fileSize } : {}),
				...(params.mimeType !== undefined ? { mimeType: params.mimeType } : {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				updatedAt: now,
			};
			const updatedRecord = updated as Record<string, unknown>;
			await data.upsert("downloadableFile", id, updatedRecord);
			return updated;
		},

		async deleteFile(id) {
			await data.delete("downloadableFile", id);
			return true;
		},

		async createToken(params) {
			const id = crypto.randomUUID();
			const token = crypto.randomUUID();
			const now = new Date();
			const downloadToken: DownloadToken = {
				id,
				token,
				fileId: params.fileId,
				email: params.email,
				...(params.orderId !== undefined ? { orderId: params.orderId } : {}),
				...(params.maxDownloads !== undefined
					? { maxDownloads: params.maxDownloads }
					: {}),
				downloadCount: 0,
				...(params.expiresAt !== undefined
					? { expiresAt: params.expiresAt }
					: {}),
				createdAt: now,
				updatedAt: now,
			};
			const tokenRecord = downloadToken as Record<string, unknown>;
			await data.upsert("downloadToken", id, tokenRecord);
			return downloadToken;
		},

		async getToken(id) {
			const raw = await data.get("downloadToken", id);
			if (!raw) return null;
			return raw as unknown as DownloadToken;
		},

		async getTokenByValue(tokenValue) {
			const matches = await data.findMany("downloadToken", {
				where: { token: tokenValue },
				take: 1,
			});
			return matches[0] as DownloadToken;
		},

		async redeemToken(tokenValue) {
			const matches = await data.findMany("downloadToken", {
				where: { token: tokenValue },
				take: 1,
			});
			const tokenRecord = matches[0] as DownloadToken | undefined;
			if (!tokenRecord) return { ok: false, reason: "Token not found" };

			if (tokenRecord.revokedAt) return { ok: false, reason: "Token revoked" };
			const now = new Date();
			if (tokenRecord.expiresAt && tokenRecord.expiresAt < now)
				return { ok: false, reason: "Token expired" };
			if (
				tokenRecord.maxDownloads !== undefined &&
				tokenRecord.downloadCount >= tokenRecord.maxDownloads
			)
				return { ok: false, reason: "Download limit reached" };

			const updated: DownloadToken = {
				...tokenRecord,
				downloadCount: tokenRecord.downloadCount + 1,
				updatedAt: now,
			};
			const updatedRecord = updated as Record<string, unknown>;
			await data.upsert("downloadToken", tokenRecord.id, updatedRecord);

			const fileRaw = await data.get("downloadableFile", tokenRecord.fileId);
			const file = fileRaw
				? (fileRaw as unknown as DownloadableFile)
				: undefined;
			return { ok: true, file, token: updated };
		},

		async revokeToken(tokenValue) {
			const matches = await data.findMany("downloadToken", {
				where: { token: tokenValue },
				take: 1,
			});
			const tokenRecord = matches[0] as DownloadToken | undefined;
			if (!tokenRecord) return false;
			const updated: DownloadToken = {
				...tokenRecord,
				revokedAt: new Date(),
				updatedAt: new Date(),
			};
			const updatedRecord = updated as Record<string, unknown>;
			await data.upsert("downloadToken", tokenRecord.id, updatedRecord);
			return true;
		},

		async revokeTokenById(id) {
			const raw = await data.get("downloadToken", id);
			if (!raw) return false;
			const tokenRecord = raw as unknown as DownloadToken;
			const updated: DownloadToken = {
				...tokenRecord,
				revokedAt: new Date(),
				updatedAt: new Date(),
			};
			const updatedRecord = updated as Record<string, unknown>;
			await data.upsert("downloadToken", id, updatedRecord);
			return true;
		},

		async listTokensByEmail(params) {
			const all = await data.findMany("downloadToken", {
				where: { email: params.email },
				...(params.take !== undefined ? { take: params.take } : {}),
				...(params.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as DownloadToken[];
		},

		async listTokens(params) {
			const where: Record<string, unknown> = {};
			if (params?.fileId) where.fileId = params.fileId;
			if (params?.orderId) where.orderId = params.orderId;
			if (params?.email) where.email = params.email;

			const all = await data.findMany("downloadToken", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as DownloadToken[];
		},

		async createTokenBatch(params) {
			const tokens: DownloadToken[] = [];
			for (const fileId of params.fileIds) {
				const id = crypto.randomUUID();
				const token = crypto.randomUUID();
				const now = new Date();
				const downloadToken: DownloadToken = {
					id,
					token,
					fileId,
					email: params.email,
					...(params.orderId !== undefined ? { orderId: params.orderId } : {}),
					...(params.maxDownloads !== undefined
						? { maxDownloads: params.maxDownloads }
						: {}),
					downloadCount: 0,
					...(params.expiresAt !== undefined
						? { expiresAt: params.expiresAt }
						: {}),
					createdAt: now,
					updatedAt: now,
				};
				const tokenRecord = downloadToken as Record<string, unknown>;
				await data.upsert("downloadToken", id, tokenRecord);
				tokens.push(downloadToken);
			}
			return tokens;
		},
	};
}
