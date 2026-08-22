/**
 * Server-side data prefetching for React Query hydration.
 *
 * Uses ModuleDataService over compiled Module tables (same path as Module
 * endpoints) so SSR hydration matches production storage.
 */

import type { ModuleDataService } from "@86d-app/core/types/module";
import { cache } from "react";
import { getModuleDataService } from "./module-data-access";

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
function dateStr(v: unknown, fallback: string): string {
	if (typeof v === "string" || typeof v === "number") {
		return new Date(v).toISOString();
	}
	return fallback;
}

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

function toProduct(d: JsonData): PrefetchedProduct {
	const id = str(d.id);
	const createdAt = dateStr(d.createdAt, new Date().toISOString());
	const updatedAt = dateStr(d.updatedAt, createdAt);
	return {
		id,
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
		createdAt,
		updatedAt,
	};
}

async function productsData(): Promise<ModuleDataService | null> {
	return getModuleDataService("products");
}

export const prefetchProducts = cache(
	async (options?: {
		page?: number;
		limit?: number;
		sort?: string;
		order?: "asc" | "desc";
	}): Promise<{ products: PrefetchedProduct[]; total: number } | null> => {
		const data = await productsData();
		if (!data) return null;

		const page = options?.page ?? 1;
		const limit = options?.limit ?? 12;
		const skip = (page - 1) * limit;

		const rows = await data.findMany("product", {
			where: { status: "active" },
			orderBy: { createdAt: "desc" },
			take: limit,
			skip,
		});
		const countFn = (
			data as ModuleDataService & {
				count?: (
					entityType: string,
					where?: Record<string, unknown>,
				) => Promise<number>;
			}
		).count;
		const total =
			typeof countFn === "function"
				? await countFn.call(data, "product", { status: "active" })
				: rows.length;

		return {
			products: rows.map((r) => toProduct(r as JsonData)),
			total,
		};
	},
);

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
		const data = await productsData();
		if (!data) return null;

		const rows = await data.findMany("category", {
			where: { isVisible: true },
			orderBy: { createdAt: "asc" },
		});

		return {
			categories: rows.map((r) => {
				const d = r as JsonData;
				return {
					id: str(d.id),
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
		const data = await productsData();
		if (!data) return null;

		const rows = await data.findMany("product", {
			where: { slug },
			take: 1,
		});
		const row = rows[0] as JsonData | undefined;
		if (row?.status !== "active") return null;

		const product = toProduct(row);
		const variantRows = await data.findMany("productVariant", {
			where: { productId: product.id },
			orderBy: { createdAt: "asc" },
		});

		const variants = variantRows.map((v) => {
			const vd = v as JsonData;
			return {
				id: str(vd.id),
				productId: product.id,
				name: str(vd.name),
				sku: strOrUndef(vd.sku),
				price: num(vd.price),
				compareAtPrice: numOrUndef(vd.compareAtPrice),
				inventory: num(vd.inventory),
				options: vd.options as Record<string, string>,
				images: Array.isArray(vd.images) ? (vd.images as string[]) : [],
				position: num(vd.position),
				createdAt: dateStr(vd.createdAt, product.createdAt),
				updatedAt: dateStr(vd.updatedAt, product.updatedAt),
			};
		});

		return { product: { ...product, variants }, id: product.id };
	},
);
