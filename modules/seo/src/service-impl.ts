import type { ModuleDataService } from "@86d-app/core/types/module";
import type { MetaTag, Redirect, SeoController } from "./service";

function normalizePath(path: string): string {
	const trimmed = path.trim().replace(/\/+$/, "");
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function toMetaTag(raw: Record<string, unknown>): MetaTag {
	return {
		id: raw.id as string,
		path: raw.path as string,
		title: (raw.title as string) || undefined,
		description: (raw.description as string) || undefined,
		canonicalUrl: (raw.canonicalUrl as string) || undefined,
		ogTitle: (raw.ogTitle as string) || undefined,
		ogDescription: (raw.ogDescription as string) || undefined,
		ogImage: (raw.ogImage as string) || undefined,
		ogType: (raw.ogType as string) || undefined,
		twitterCard: (raw.twitterCard as string) || undefined,
		twitterTitle: (raw.twitterTitle as string) || undefined,
		twitterDescription: (raw.twitterDescription as string) || undefined,
		twitterImage: (raw.twitterImage as string) || undefined,
		noIndex: raw.noIndex === "true" || raw.noIndex === true,
		noFollow: raw.noFollow === "true" || raw.noFollow === true,
		jsonLd: (raw.jsonLd as Record<string, unknown>) || undefined,
		createdAt: raw.createdAt as Date,
		updatedAt: raw.updatedAt as Date,
	};
}

function toRedirect(raw: Record<string, unknown>): Redirect {
	return {
		id: raw.id as string,
		fromPath: raw.fromPath as string,
		toPath: raw.toPath as string,
		statusCode: Number(raw.statusCode) as Redirect["statusCode"],
		active: raw.active === "true" || raw.active === true,
		createdAt: raw.createdAt as Date,
		updatedAt: raw.updatedAt as Date,
	};
}

export function createSeoController(data: ModuleDataService): SeoController {
	return {
		// ── Meta Tags ─────────────────────────────────────────────────────────

		async upsertMetaTag(params) {
			const path = normalizePath(params.path);
			const now = new Date();

			// Check if a meta tag already exists for this path
			const existing = await data.findMany("metaTag", {
				where: { path },
				take: 1,
			});

			const existingTag = existing[0] as Record<string, unknown> | undefined;
			const id = (existingTag?.id as string) ?? crypto.randomUUID();
			const createdAt = (existingTag?.createdAt as Date) ?? now;

			const record: MetaTag = {
				id,
				path,
				title: params.title,
				description: params.description,
				canonicalUrl: params.canonicalUrl,
				ogTitle: params.ogTitle,
				ogDescription: params.ogDescription,
				ogImage: params.ogImage,
				ogType: params.ogType,
				twitterCard: params.twitterCard,
				twitterTitle: params.twitterTitle,
				twitterDescription: params.twitterDescription,
				twitterImage: params.twitterImage,
				noIndex: params.noIndex ?? false,
				noFollow: params.noFollow ?? false,
				jsonLd: params.jsonLd,
				createdAt,
				updatedAt: now,
			};

			await data.upsert("metaTag", id, record as Record<string, unknown>);
			return record;
		},

		async getMetaTagByPath(path) {
			const normalized = normalizePath(path);
			const matches = await data.findMany("metaTag", {
				where: { path: normalized },
				take: 1,
			});
			if (!matches[0]) return null;
			return toMetaTag(matches[0] as Record<string, unknown>);
		},

		async getMetaTag(id) {
			const raw = await data.get("metaTag", id);
			if (!raw) return null;
			return toMetaTag(raw as Record<string, unknown>);
		},

		async deleteMetaTag(id) {
			const existing = await data.get("metaTag", id);
			if (!existing) return false;
			await data.delete("metaTag", id);
			return true;
		},

		async listMetaTags(params) {
			const all = await data.findMany("metaTag", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { path: "asc" },
			});
			return (all as unknown as Record<string, unknown>[]).map(toMetaTag);
		},

		// ── Redirects ─────────────────────────────────────────────────────────

		async createRedirect(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const record: Redirect = {
				id,
				fromPath: normalizePath(params.fromPath),
				toPath: normalizePath(params.toPath),
				statusCode: params.statusCode ?? 301,
				active: true,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("redirect", id, record as Record<string, unknown>);
			return record;
		},

		async updateRedirect(id, params) {
			const existing = await data.get("redirect", id);
			if (!existing) return null;

			const redirect = toRedirect(existing as Record<string, unknown>);
			const now = new Date();

			const updated: Redirect = {
				...redirect,
				...(params.fromPath !== undefined
					? { fromPath: normalizePath(params.fromPath) }
					: {}),
				...(params.toPath !== undefined
					? { toPath: normalizePath(params.toPath) }
					: {}),
				...(params.statusCode !== undefined
					? { statusCode: params.statusCode }
					: {}),
				...(params.active !== undefined ? { active: params.active } : {}),
				updatedAt: now,
			};

			await data.upsert("redirect", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteRedirect(id) {
			const existing = await data.get("redirect", id);
			if (!existing) return false;
			await data.delete("redirect", id);
			return true;
		},

		async getRedirect(id) {
			const raw = await data.get("redirect", id);
			if (!raw) return null;
			return toRedirect(raw as Record<string, unknown>);
		},

		async getRedirectByPath(fromPath) {
			const normalized = normalizePath(fromPath);
			const matches = await data.findMany("redirect", {
				where: { fromPath: normalized, active: true },
				take: 1,
			});
			if (!matches[0]) return null;
			return toRedirect(matches[0] as Record<string, unknown>);
		},

		async listRedirects(params) {
			const where: Record<string, unknown> = {};
			if (params?.active !== undefined) where.active = params.active;

			const all = await data.findMany("redirect", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { fromPath: "asc" },
			});
			return (all as unknown as Record<string, unknown>[]).map(toRedirect);
		},

		// ── Sitemap ───────────────────────────────────────────────────────────

		async getSitemapEntries() {
			const metaTags = await data.findMany("metaTag", {
				orderBy: { path: "asc" },
			});

			return (metaTags as unknown as Record<string, unknown>[])
				.filter((m) => m.noIndex !== "true" && m.noIndex !== true)
				.map((m) => ({
					path: m.path as string,
					lastModified: m.updatedAt as Date,
				}));
		},
	};
}
