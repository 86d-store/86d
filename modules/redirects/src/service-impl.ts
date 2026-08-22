import type { ModuleDataService } from "@86d-app/core/types/module";
import type { Redirect, RedirectController, RedirectStats } from "./service";

function buildFindOptions(opts: {
	where?: Record<string, unknown>;
	orderBy?: Record<string, "asc" | "desc">;
	take?: number | undefined;
	skip?: number | undefined;
}) {
	const result: Record<string, unknown> = {};
	if (opts.where) result.where = opts.where;
	if (opts.orderBy) result.orderBy = opts.orderBy;
	if (opts.take != null) result.take = opts.take;
	if (opts.skip != null) result.skip = opts.skip;
	return result;
}

/**
 * Try to match a path against a regex source pattern.
 * Returns the rewritten target path (with $1, $2 group replacements) or null.
 */
function execNullable(regex: RegExp, input: string): RegExpExecArray | null {
	return regex.exec(input);
}

function tryRegexMatch(
	sourcePath: string,
	targetPath: string,
	requestPath: string,
): string | null {
	try {
		const match = execNullable(new RegExp(`^${sourcePath}$`), requestPath);
		if (!match) return null;
		// Replace $1, $2, etc. with captured groups
		let result = targetPath;
		for (let i = 1; i < match.length; i++) {
			result = result.replaceAll(`$${i}`, match[i] ?? "");
		}
		return result;
	} catch {
		return null;
	}
}

function applySearchFilter(redirects: Redirect[], search: string): Redirect[] {
	const lower = search.toLowerCase();
	return redirects.filter(
		(r) =>
			r.sourcePath.toLowerCase().includes(lower) ||
			r.targetPath.toLowerCase().includes(lower) ||
			r.note?.toLowerCase().includes(lower),
	);
}

export function createRedirectController(
	data: ModuleDataService,
): RedirectController {
	return {
		async createRedirect(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const redirect: Redirect = {
				id,
				sourcePath: params.sourcePath,
				targetPath: params.targetPath,
				statusCode: params.statusCode ?? 301,
				isActive: params.isActive ?? true,
				isRegex: params.isRegex ?? false,
				preserveQueryString: params.preserveQueryString ?? true,
				hitCount: 0,
				createdAt: now,
				updatedAt: now,
				...(params.note != null && { note: params.note }),
			};
			await data.upsert("redirect", id, redirect as Record<string, unknown>);
			return redirect;
		},

		async getRedirect(id) {
			const raw = await data.get("redirect", id);
			return raw as unknown as Redirect;
		},

		async updateRedirect(id, params) {
			const existing = await data.get("redirect", id);
			if (!existing) return null;

			const current = existing as unknown as Redirect;

			const base: Redirect = {
				id: current.id,
				sourcePath: params.sourcePath ?? current.sourcePath,
				targetPath: params.targetPath ?? current.targetPath,
				statusCode: params.statusCode ?? current.statusCode,
				isActive: params.isActive ?? current.isActive,
				isRegex: params.isRegex ?? current.isRegex,
				preserveQueryString:
					params.preserveQueryString ?? current.preserveQueryString,
				hitCount: current.hitCount,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			// Handle nullable note field
			const noteVal =
				params.note === null ? null : (params.note ?? current.note);
			if (noteVal != null) {
				base.note = noteVal;
			}

			// Preserve lastHitAt
			if (current.lastHitAt) {
				base.lastHitAt = current.lastHitAt;
			}

			await data.upsert("redirect", id, base as Record<string, unknown>);
			return base;
		},

		async deleteRedirect(id) {
			const existing = await data.get("redirect", id);
			if (!existing) return false;
			await data.delete("redirect", id);
			return true;
		},

		async listRedirects(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;
			if (params?.statusCode !== undefined)
				where.statusCode = params.statusCode;

			const results = (await data.findMany(
				"redirect",
				buildFindOptions({
					where,
					orderBy: { createdAt: "desc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as Redirect[];

			if (params?.search) {
				return applySearchFilter(results, params.search);
			}

			return results;
		},

		async countRedirects(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;
			if (params?.statusCode !== undefined)
				where.statusCode = params.statusCode;

			let results = (await data.findMany("redirect", {
				where,
			})) as unknown as Redirect[];

			if (params?.search) {
				results = applySearchFilter(results, params.search);
			}

			return results.length;
		},

		async resolve(path) {
			const all = (await data.findMany("redirect", {
				where: { isActive: true },
			})) as unknown as Redirect[];

			// Phase 1: exact match (non-regex)
			const exactMatch = all.find((r) => !r.isRegex && r.sourcePath === path);
			if (exactMatch) {
				return {
					targetPath: exactMatch.targetPath,
					statusCode: exactMatch.statusCode,
					preserveQueryString: exactMatch.preserveQueryString,
				};
			}

			// Phase 2: regex match
			for (const r of all) {
				if (!r.isRegex) continue;
				const target = tryRegexMatch(r.sourcePath, r.targetPath, path);
				if (target != null) {
					return {
						targetPath: target,
						statusCode: r.statusCode,
						preserveQueryString: r.preserveQueryString,
					};
				}
			}

			return null;
		},

		async recordHit(id) {
			const existing = await data.get("redirect", id);
			if (!existing) return;

			const current = existing as unknown as Redirect;
			const updated = {
				...current,
				hitCount: current.hitCount + 1,
				lastHitAt: new Date(),
			};
			await data.upsert("redirect", id, updated as Record<string, unknown>);
		},

		async bulkDelete(ids) {
			let deleted = 0;
			for (const id of ids) {
				const existing = await data.get("redirect", id);
				if (existing) {
					await data.delete("redirect", id);
					deleted++;
				}
			}
			return deleted;
		},

		async testPath(path) {
			const all = (await data.findMany("redirect", {
				where: { isActive: true },
			})) as unknown as Redirect[];

			// Try exact match first
			const exactMatch = all.find((r) => !r.isRegex && r.sourcePath === path);
			if (exactMatch) {
				return { matched: true, redirect: exactMatch };
			}

			// Try regex match
			for (const r of all) {
				if (!r.isRegex) continue;
				const target = tryRegexMatch(r.sourcePath, r.targetPath, path);
				if (target != null) {
					return { matched: true, redirect: r };
				}
			}

			return { matched: false };
		},

		async getStats() {
			const all = (await data.findMany(
				"redirect",
				{},
			)) as unknown as Redirect[];

			const stats: RedirectStats = {
				totalRedirects: all.length,
				activeRedirects: all.filter((r) => r.isActive).length,
				totalHits: all.reduce((sum, r) => sum + r.hitCount, 0),
				topRedirects: [...all]
					.sort((a, b) => b.hitCount - a.hitCount)
					.slice(0, 10)
					.map((r) => ({
						id: r.id,
						sourcePath: r.sourcePath,
						targetPath: r.targetPath,
						hitCount: r.hitCount,
					})),
			};
			return stats;
		},
	};
}
