import type { ModuleDataService } from "@86d-app/core/types/module";
import type { AuditEntry, AuditLogController, AuditSummary } from "./service";

export function createAuditLogController(
	data: ModuleDataService,
): AuditLogController {
	return {
		async log(params) {
			const id = crypto.randomUUID();
			const entry: AuditEntry = {
				id,
				action: params.action,
				resource: params.resource,
				resourceId: params.resourceId,
				actorId: params.actorId,
				actorEmail: params.actorEmail,
				actorType: params.actorType ?? "admin",
				description: params.description,
				changes: params.changes,
				metadata: params.metadata,
				ipAddress: params.ipAddress,
				userAgent: params.userAgent,
				createdAt: new Date(),
			};
			await data.upsert("auditEntry", id, entry as Record<string, unknown>);
			return entry;
		},

		async getById(id) {
			const raw = await data.get("auditEntry", id);
			if (!raw) return null;
			return raw as unknown as AuditEntry;
		},

		async list(params) {
			const where: Record<string, unknown> = {};
			if (params?.action) where.action = params.action;
			if (params?.resource) where.resource = params.resource;
			if (params?.actorId) where.actorId = params.actorId;
			if (params?.actorType) where.actorType = params.actorType;

			const all = await data.findMany("auditEntry", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			const entries = all as unknown as AuditEntry[];

			// Apply date filtering in-memory (ModuleDataService doesn't support range queries)
			const filtered = entries.filter((e) => {
				if (params?.dateFrom && new Date(e.createdAt) < params.dateFrom)
					return false;
				if (params?.dateTo && new Date(e.createdAt) > params.dateTo)
					return false;
				return true;
			});

			return { entries: filtered, total: filtered.length };
		},

		async listForResource(resource, resourceId, params) {
			const all = await data.findMany("auditEntry", {
				where: { resource, resourceId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as AuditEntry[];
		},

		async listForActor(actorId, params) {
			const all = await data.findMany("auditEntry", {
				where: { actorId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as AuditEntry[];
		},

		async getSummary(params) {
			const all = await data.findMany("auditEntry", {
				orderBy: { createdAt: "desc" },
			});
			let entries = all as unknown as AuditEntry[];

			if (params?.dateFrom || params?.dateTo) {
				entries = entries.filter((e) => {
					if (params?.dateFrom && new Date(e.createdAt) < params.dateFrom)
						return false;
					if (params?.dateTo && new Date(e.createdAt) > params.dateTo)
						return false;
					return true;
				});
			}

			const entriesByAction: Record<string, number> = {};
			const entriesByResource: Record<string, number> = {};
			const actorCounts = new Map<
				string,
				{ actorEmail?: string | undefined; count: number }
			>();

			for (const entry of entries) {
				entriesByAction[entry.action] =
					(entriesByAction[entry.action] ?? 0) + 1;
				entriesByResource[entry.resource] =
					(entriesByResource[entry.resource] ?? 0) + 1;

				if (entry.actorId) {
					const existing = actorCounts.get(entry.actorId);
					if (existing) {
						existing.count++;
					} else {
						actorCounts.set(entry.actorId, {
							actorEmail: entry.actorEmail,
							count: 1,
						});
					}
				}
			}

			const recentActors = [...actorCounts.entries()]
				.map(([actorId, info]) => ({
					actorId,
					actorEmail: info.actorEmail,
					count: info.count,
				}))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10);

			const summary: AuditSummary = {
				totalEntries: entries.length,
				entriesByAction,
				entriesByResource,
				recentActors,
			};
			return summary;
		},

		async purge(olderThan) {
			const all = await data.findMany("auditEntry", {
				orderBy: { createdAt: "asc" },
			});
			const entries = all as unknown as AuditEntry[];

			let deleted = 0;
			for (const entry of entries) {
				if (new Date(entry.createdAt) < olderThan) {
					await data.delete("auditEntry", entry.id);
					deleted++;
				}
			}
			return deleted;
		},
	};
}
