/**
 * Server-side data prefetching for React Query hydration.
 *
 * Queries the database directly from server components and populates
 * the React Query cache so that client components get instant data
 * (no flash-of-empty-content on hydration).
 *
 * Query keys must match exactly what the module client produces:
 *   [moduleId, namespace, path, input?]
 */

import { db } from "db";
import env from "env";
import { cache } from "react";

type JsonData = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
	return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
	return typeof v === "number" ? v : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
	return typeof v === "boolean" ? v : fallback;
}
function strOrUndef(v: unknown): string | undefined {
	return typeof v === "string" ? v : undefined;
}
function numOrUndef(v: unknown): number | undefined {
	return typeof v === "number" ? v : undefined;
}
function dateStr(v: unknown, fallback: Date): string {
	if (typeof v === "string" || typeof v === "number") {
		return new Date(v).toISOString();
	}
	return fallback.toISOString();
}

// ── Module ID resolution ─────────────────────────────────────────────────────

const getModuleDbId = cache(
	async (moduleName: string): Promise<string | null> => {
		const storeId = env.STORE_ID;
		if (!storeId) return null;

		try {
			const mod = await db.module.findFirst({
				where: { storeId, name: moduleName },
				select: { id: true },
			});
			return mod?.id ?? null;
		} catch {
			// DB unavailable (e.g. build time without DATABASE_URL)
			return null;
		}
	},
);

// ── Products ─────────────────────────────────────────────────────────────────

export interface PrefetchedProduct {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	shortDescription?: string | undefined;
	price: number;
	compareAtPrice?: number | undefined;
	sku?: string | undefined;
	inventory: number;
	trackInventory: boolean;
	allowBackorder: boolean;
	status: string;
	categoryId?: string | undefined;
	images: string[];
	tags: string[];
	isFeatured: boolean;
	weight?: number | undefined;
	weightUnit?: string | undefined;
	createdAt: string;
	updatedAt: string;
}

function toProduct(row: {
	id: string;
	data: JsonData;
	createdAt: Date;
	updatedAt: Date;
}): PrefetchedProduct {
	const d = row.data;
	return {
		id: row.id,
		name: str(d.name),
		slug: str(d.slug),
		description: strOrUndef(d.description),
		shortDescription: strOrUndef(d.shortDescription),
		price: num(d.price),
		compareAtPrice: numOrUndef(d.compareAtPrice),
		sku: strOrUndef(d.sku),
		inventory: num(d.inventory),
		trackInventory: bool(d.trackInventory, true),
		allowBackorder: bool(d.allowBackorder, false),
		status: str(d.status, "draft"),
		categoryId: strOrUndef(d.categoryId),
		images: Array.isArray(d.images) ? (d.images as string[]) : [],
		tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
		isFeatured: bool(d.isFeatured, false),
		weight: numOrUndef(d.weight),
		weightUnit: strOrUndef(d.weightUnit),
		createdAt: dateStr(d.createdAt, row.createdAt),
		updatedAt: dateStr(d.updatedAt, row.updatedAt),
	};
}

/**
 * Prefetch the default products listing (page 1, 12 items, sorted by createdAt desc).
 * Returns data in the shape that the /products endpoint returns.
 */
export const prefetchProducts = cache(
	async (options?: {
		page?: number;
		limit?: number;
		sort?: string;
		order?: "asc" | "desc";
	}): Promise<{ products: PrefetchedProduct[]; total: number } | null> => {
		const moduleId = await getModuleDbId("products");
		if (!moduleId) return null;

		const page = options?.page ?? 1;
		const limit = options?.limit ?? 12;
		const skip = (page - 1) * limit;

		const [rows, totalCount] = await Promise.all([
			db.moduleData.findMany({
				where: {
					moduleId,
					entityType: "product",
					data: { path: ["status"], equals: "active" },
				},
				orderBy: { createdAt: "desc" },
				take: limit,
				skip,
				select: { id: true, data: true, createdAt: true, updatedAt: true },
			}),
			db.moduleData.count({
				where: {
					moduleId,
					entityType: "product",
					data: { path: ["status"], equals: "active" },
				},
			}),
		]);

		return {
			products: rows.map((r) =>
				toProduct(
					r as { id: string; data: JsonData; createdAt: Date; updatedAt: Date },
				),
			),
			total: totalCount,
		};
	},
);

/**
 * Prefetch categories list.
 */
export const prefetchCategories = cache(
	async (): Promise<{
		categories: Array<{
			id: string;
			name: string;
			slug: string;
			description?: string | undefined;
			parentId?: string | undefined;
			image?: string | undefined;
			position: number;
			isVisible: boolean;
		}>;
	} | null> => {
		const moduleId = await getModuleDbId("products");
		if (!moduleId) return null;

		const rows = await db.moduleData.findMany({
			where: {
				moduleId,
				entityType: "category",
				data: { path: ["isVisible"], equals: true },
			},
			orderBy: { createdAt: "asc" },
			select: { id: true, data: true },
		});

		return {
			categories: rows.map((r) => {
				const d = r.data as JsonData;
				return {
					id: r.id,
					name: str(d.name),
					slug: str(d.slug),
					description: strOrUndef(d.description),
					parentId: strOrUndef(d.parentId),
					image: strOrUndef(d.image),
					position: num(d.position),
					isVisible: bool(d.isVisible, true),
				};
			}),
		};
	},
);

/**
 * Prefetch a single product by slug (for product detail page).
 * Returns data in the shape that the /products/:id endpoint returns.
 */
export const prefetchProductBySlug = cache(
	async (
		slug: string,
	): Promise<{
		product: PrefetchedProduct & {
			variants: Array<{
				id: string;
				productId: string;
				name: string;
				sku?: string | undefined;
				price: number;
				compareAtPrice?: number | undefined;
				inventory: number;
				options: Record<string, string>;
				images: string[];
				position: number;
				createdAt: string;
				updatedAt: string;
			}>;
		};
		id: string;
	} | null> => {
		const moduleId = await getModuleDbId("products");
		if (!moduleId) return null;

		const row = await db.moduleData.findFirst({
			where: {
				moduleId,
				entityType: "product",
				data: { path: ["slug"], equals: slug },
			},
			select: { id: true, data: true, createdAt: true, updatedAt: true },
		});

		if (!row?.data) return null;
		const d = row.data as JsonData;
		if (d.status !== "active") return null;

		const product = toProduct(
			row as { id: string; data: JsonData; createdAt: Date; updatedAt: Date },
		);

		// Fetch variants
		const variantRows = await db.moduleData.findMany({
			where: {
				moduleId,
				entityType: "productVariant",
				data: { path: ["productId"], equals: row.id },
			},
			orderBy: { createdAt: "asc" },
			select: { id: true, data: true, createdAt: true, updatedAt: true },
		});

		const variants = variantRows.map((v) => {
			const vd = v.data as JsonData;
			return {
				id: v.id,
				productId: row.id,
				name: str(vd.name),
				sku: strOrUndef(vd.sku),
				price: num(vd.price),
				compareAtPrice: numOrUndef(vd.compareAtPrice),
				inventory: num(vd.inventory),
				options: (vd.options as Record<string, string>) ?? {},
				images: Array.isArray(vd.images) ? (vd.images as string[]) : [],
				position: num(vd.position),
				createdAt: dateStr(vd.createdAt, v.createdAt),
				updatedAt: dateStr(vd.updatedAt, v.updatedAt),
			};
		});

		return { product: { ...product, variants }, id: row.id };
	},
);
