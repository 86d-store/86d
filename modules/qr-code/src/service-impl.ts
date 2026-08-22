import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type { QrCode, QrCodeController, QrScan } from "./service";

export function createQrCodeController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): QrCodeController {
	return {
		async create(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const qrCode: QrCode = {
				id,
				label: params.label,
				targetUrl: params.targetUrl,
				targetType: params.targetType ?? "custom",
				targetId: params.targetId,
				format: params.format ?? "svg",
				size: params.size ?? 256,
				errorCorrection: params.errorCorrection ?? "M",
				scanCount: 0,
				isActive: true,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("qrCode", id, qrCode as Record<string, unknown>);
			void events?.emit("qr.created", {
				qrCodeId: qrCode.id,
				label: qrCode.label,
				targetUrl: qrCode.targetUrl,
				targetType: qrCode.targetType,
			});
			return qrCode;
		},

		async get(id) {
			const raw = await data.get("qrCode", id);
			if (!raw) return null;
			return raw as unknown as QrCode;
		},

		async getByTarget(targetType, targetId) {
			const matches = await data.findMany("qrCode", {
				where: { targetType, targetId },
				take: 1,
			});
			return matches[0] as QrCode;
		},

		async update(id, params) {
			const existing = await data.get("qrCode", id);
			if (!existing) return null;

			const qrCode = existing as unknown as QrCode;
			const updated: QrCode = {
				...qrCode,
				...(params.label !== undefined ? { label: params.label } : {}),
				...(params.targetUrl !== undefined
					? { targetUrl: params.targetUrl }
					: {}),
				...(params.targetType !== undefined
					? { targetType: params.targetType }
					: {}),
				...(params.targetId !== undefined ? { targetId: params.targetId } : {}),
				...(params.format !== undefined ? { format: params.format } : {}),
				...(params.size !== undefined ? { size: params.size } : {}),
				...(params.errorCorrection !== undefined
					? { errorCorrection: params.errorCorrection }
					: {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				updatedAt: new Date(),
			};
			await data.upsert("qrCode", id, updated as Record<string, unknown>);
			return updated;
		},

		async delete(id) {
			const existing = await data.get("qrCode", id);
			if (!existing) return false;
			await data.delete("qrCode", id);
			void events?.emit("qr.deleted", { qrCodeId: id });
			return true;
		},

		async list(params) {
			const where: Record<string, unknown> = {};
			if (params?.targetType) where.targetType = params.targetType;
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const all = await data.findMany("qrCode", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as QrCode[];
		},

		async recordScan(id, params) {
			const existing = await data.get("qrCode", id);
			if (!existing) return null;

			const qrCode = existing as unknown as QrCode;

			// Increment scan count
			const updatedQr: QrCode = {
				...qrCode,
				scanCount: qrCode.scanCount + 1,
				updatedAt: new Date(),
			};
			await data.upsert("qrCode", id, updatedQr as Record<string, unknown>);

			// Create scan record
			const scanId = crypto.randomUUID();
			const scan: QrScan = {
				id: scanId,
				qrCodeId: id,
				scannedAt: new Date(),
				userAgent: params?.userAgent,
				ipAddress: params?.ipAddress,
				referrer: params?.referrer,
			};
			await data.upsert("qrScan", scanId, scan as Record<string, unknown>);

			void events?.emit("qr.scanned", {
				qrCodeId: id,
				scanId,
				targetUrl: qrCode.targetUrl,
			});
			return scan;
		},

		async getScanCount(id) {
			const existing = await data.get("qrCode", id);
			if (!existing) return 0;
			return (existing as unknown as QrCode).scanCount;
		},

		async listScans(qrCodeId, params) {
			const all = await data.findMany("qrScan", {
				where: { qrCodeId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as QrScan[];
		},

		async createBatch(items) {
			const results: QrCode[] = [];
			const now = new Date();

			for (const item of items) {
				const id = crypto.randomUUID();
				const qrCode: QrCode = {
					id,
					label: item.label,
					targetUrl: item.targetUrl,
					targetType: item.targetType ?? "custom",
					targetId: item.targetId,
					format: item.format ?? "svg",
					size: item.size ?? 256,
					errorCorrection: item.errorCorrection ?? "M",
					scanCount: 0,
					isActive: true,
					metadata: item.metadata ?? {},
					createdAt: now,
					updatedAt: now,
				};
				await data.upsert("qrCode", id, qrCode as Record<string, unknown>);
				void events?.emit("qr.created", {
					qrCodeId: qrCode.id,
					label: qrCode.label,
					targetUrl: qrCode.targetUrl,
					targetType: qrCode.targetType,
				});
				results.push(qrCode);
			}

			void events?.emit("qr.batch.created", {
				count: results.length,
				ids: results.map((r) => r.id),
			});
			return results;
		},
	};
}
