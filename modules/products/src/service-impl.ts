import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Category,
	CategoryWithChildren,
	Collection,
	CollectionProduct,
	CollectionWithProducts,
	CreateCategoryParams,
	CreateCollectionParams,
	CreateProductParams,
	CreateVariantParams,
	ImportError,
	ImportProductRow,
	ImportResult,
	ListProductsParams,
	Product,
	ProductController,
	ProductVariant,
	ProductWithVariants,
} from "./service";

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function createProductController(
	data: ModuleDataService,
): ProductController {
	return {
		// ── Products ──────────────────────────────────────────────────────

		async createProduct(params: CreateProductParams): Promise<Product> {
			const now = new Date();
			const id = `prod_${crypto.randomUUID()}`;

			const product: Product = {
				id,
				name: params.name,
				slug: params.slug,
				description: params.description,
				shortDescription: params.shortDescription,
				price: params.price,
				compareAtPrice: params.compareAtPrice,
				costPrice: params.costPrice,
				sku: params.sku,
				barcode: params.barcode,
				inventory: params.inventory ?? 0,
				trackInventory: params.trackInventory ?? true,
				allowBackorder: params.allowBackorder ?? false,
				status: params.status ?? "draft",
				categoryId: params.categoryId,
				images: params.images ?? [],
				tags: params.tags ?? [],
				metadata: params.metadata ?? {},
				weight: params.weight,
				weightUnit: params.weightUnit ?? "kg",
				isFeatured: params.isFeatured ?? false,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"product",
				id,
				product as unknown as Record<string, unknown>,
			);
			return product;
		},

		async getProduct(id: string): Promise<Product | null> {
			return (await data.get("product", id)) as Product | null;
		},

		async getProductBySlug(slug: string): Promise<Product | null> {
			const products = (await data.findMany("product", {
				where: { slug },
			})) as Product[];
			return products[0] ?? null;
		},

		async getProductWithVariants(
			id: string,
		): Promise<ProductWithVariants | null> {
			const product = (await data.get("product", id)) as Product | null;
			if (!product) return null;

			const variants = (await data.findMany("productVariant", {
				where: { productId: id },
			})) as ProductVariant[];

			let category: Category | undefined;
			if (product.categoryId) {
				category = (await data.get("category", product.categoryId)) as
					| Category
					| undefined;
			}

			return { ...product, variants, category };
		},

		async listProducts(params?: ListProductsParams) {
			const page = params?.page ?? 1;
			const limit = params?.limit ?? 20;

			const where: Record<string, unknown> = {};
			if (params?.category) where.categoryId = params.category;
			if (params?.status) where.status = params.status;
			if (params?.featured) where.isFeatured = true;

			let allProducts = (await data.findMany("product", {
				where,
				orderBy: params?.sort
					? { [params.sort]: (params.order ?? "desc") as "asc" | "desc" }
					: { createdAt: "desc" as const },
			})) as Product[];

			if (params?.minPrice !== undefined) {
				const min = params.minPrice;
				allProducts = allProducts.filter((p) => p.price >= min);
			}
			if (params?.maxPrice !== undefined) {
				const max = params.maxPrice;
				allProducts = allProducts.filter((p) => p.price <= max);
			}
			if (params?.inStock) {
				allProducts = allProducts.filter((p) => p.inventory > 0);
			}
			if (params?.tag) {
				const tagLower = params.tag.toLowerCase();
				allProducts = allProducts.filter((p) =>
					p.tags.some((t) => t.toLowerCase() === tagLower),
				);
			}
			if (params?.search) {
				const searchLower = params.search.toLowerCase();
				allProducts = allProducts.filter(
					(p) =>
						p.name.toLowerCase().includes(searchLower) ||
						p.description?.toLowerCase().includes(searchLower) ||
						p.tags.some((t) => t.toLowerCase().includes(searchLower)),
				);
			}

			const total = allProducts.length;
			const paged = allProducts.slice((page - 1) * limit, page * limit);

			const productsWithVariants: ProductWithVariants[] = await Promise.all(
				paged.map(async (product) => {
					const variants = (await data.findMany("productVariant", {
						where: { productId: product.id },
					})) as ProductVariant[];

					let category: Category | undefined;
					if (product.categoryId) {
						category = (await data.get("category", product.categoryId)) as
							| Category
							| undefined;
					}

					return { ...product, variants, category };
				}),
			);

			return { products: productsWithVariants, total, page, limit };
		},

		async searchProducts(q: string, limit?: number): Promise<Product[]> {
			const products = (await data.findMany("product", {
				where: { status: "active" },
			})) as Product[];

			const queryLower = q.toLowerCase();
			const results = products.filter(
				(p) =>
					p.name.toLowerCase().includes(queryLower) ||
					p.description?.toLowerCase().includes(queryLower) ||
					p.tags.some((t) => t.toLowerCase().includes(queryLower)),
			);

			return results.slice(0, limit ?? 20);
		},

		async getFeaturedProducts(limit?: number): Promise<Product[]> {
			return (await data.findMany("product", {
				where: { isFeatured: true, status: "active" },
				take: limit ?? 10,
			})) as Product[];
		},

		async getProductsByCategory(categoryId: string): Promise<Product[]> {
			return (await data.findMany("product", {
				where: { categoryId, status: "active" },
			})) as Product[];
		},

		async getRelatedProducts(
			id: string,
			limit?: number,
		): Promise<{ products: Product[] }> {
			const maxResults = limit ?? 4;
			const product = (await data.get("product", id)) as Product | null;
			if (!product) return { products: [] };

			const all = (
				(await data.findMany("product", {
					where: { status: "active" },
				})) as Product[]
			).filter((p) => p.id !== id);

			const scored = all.map((p) => {
				let score = 0;
				if (product.categoryId && p.categoryId === product.categoryId) {
					score += 10;
				}
				const sharedTags = p.tags.filter((t) => product.tags.includes(t));
				score += sharedTags.length;
				return { product: p, score };
			});

			scored.sort((a, b) => b.score - a.score);
			return { products: scored.slice(0, maxResults).map((s) => s.product) };
		},

		async updateProduct(
			id: string,
			params: Partial<Product>,
		): Promise<Product> {
			const existing = (await data.get("product", id)) as Product | null;
			if (!existing) throw new Error(`Product ${id} not found`);

			const updated: Product = {
				...existing,
				...params,
				updatedAt: new Date(),
			};
			await data.upsert(
				"product",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteProduct(id: string): Promise<{ success: boolean }> {
			const variants = (await data.findMany("productVariant", {
				where: { productId: id },
			})) as ProductVariant[];

			for (const variant of variants) {
				await data.delete("productVariant", variant.id);
			}

			await data.delete("product", id);
			return { success: true };
		},

		// ── Inventory ─────────────────────────────────────────────────────

		async checkAvailability(
			productId: string,
			variantId?: string,
			quantity?: number,
		) {
			const qty = quantity ?? 1;

			if (variantId) {
				const variant = (await data.get(
					"productVariant",
					variantId,
				)) as ProductVariant | null;
				if (!variant)
					return { available: false, inventory: 0, allowBackorder: false };

				const product = (await data.get(
					"product",
					productId,
				)) as Product | null;
				const allowBackorder = product?.allowBackorder ?? false;

				return {
					available: variant.inventory >= qty || allowBackorder,
					inventory: variant.inventory,
					allowBackorder,
				};
			}

			const product = (await data.get("product", productId)) as Product | null;
			if (!product)
				return { available: false, inventory: 0, allowBackorder: false };

			if (!product.trackInventory) {
				return {
					available: true,
					inventory: product.inventory,
					allowBackorder: product.allowBackorder,
				};
			}

			return {
				available: product.inventory >= qty || product.allowBackorder,
				inventory: product.inventory,
				allowBackorder: product.allowBackorder,
			};
		},

		async decrementInventory(
			productId: string,
			quantity: number,
			variantId?: string,
		) {
			if (variantId) {
				const variant = (await data.get(
					"productVariant",
					variantId,
				)) as ProductVariant | null;
				if (variant) {
					await data.upsert("productVariant", variantId, {
						...variant,
						inventory: variant.inventory - quantity,
						updatedAt: new Date(),
					} as Record<string, unknown>);
				}
			} else {
				const product = (await data.get(
					"product",
					productId,
				)) as Product | null;
				if (product?.trackInventory) {
					await data.upsert("product", productId, {
						...product,
						inventory: product.inventory - quantity,
						updatedAt: new Date(),
					} as Record<string, unknown>);
				}
			}
			return { success: true };
		},

		async incrementInventory(
			productId: string,
			quantity: number,
			variantId?: string,
		) {
			if (variantId) {
				const variant = (await data.get(
					"productVariant",
					variantId,
				)) as ProductVariant | null;
				if (variant) {
					await data.upsert("productVariant", variantId, {
						...variant,
						inventory: variant.inventory + quantity,
						updatedAt: new Date(),
					} as Record<string, unknown>);
				}
			} else {
				const product = (await data.get(
					"product",
					productId,
				)) as Product | null;
				if (product?.trackInventory) {
					await data.upsert("product", productId, {
						...product,
						inventory: product.inventory + quantity,
						updatedAt: new Date(),
					} as Record<string, unknown>);
				}
			}
			return { success: true };
		},

		// ── Variants ──────────────────────────────────────────────────────

		async getVariant(id: string): Promise<ProductVariant | null> {
			return (await data.get("productVariant", id)) as ProductVariant | null;
		},

		async getVariantsByProduct(productId: string): Promise<ProductVariant[]> {
			const variants = (await data.findMany("productVariant", {
				where: { productId },
			})) as ProductVariant[];
			return variants.sort((a, b) => a.position - b.position);
		},

		async createVariant(params: CreateVariantParams): Promise<ProductVariant> {
			const now = new Date();
			const id = `var_${crypto.randomUUID()}`;

			const variant: ProductVariant = {
				id,
				productId: params.productId,
				name: params.name,
				sku: params.sku,
				barcode: params.barcode,
				price: params.price,
				compareAtPrice: params.compareAtPrice,
				costPrice: params.costPrice,
				inventory: params.inventory ?? 0,
				options: params.options,
				images: params.images ?? [],
				weight: params.weight,
				weightUnit: params.weightUnit,
				position: params.position ?? 0,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"productVariant",
				id,
				variant as unknown as Record<string, unknown>,
			);

			// Update product timestamp
			const product = (await data.get(
				"product",
				params.productId,
			)) as Product | null;
			if (product) {
				await data.upsert("product", params.productId, {
					...product,
					updatedAt: now,
				} as unknown as Record<string, unknown>);
			}

			return variant;
		},

		async updateVariant(
			id: string,
			params: Partial<ProductVariant>,
		): Promise<ProductVariant> {
			const existing = (await data.get(
				"productVariant",
				id,
			)) as ProductVariant | null;
			if (!existing) throw new Error(`Variant ${id} not found`);

			const now = new Date();
			const updated: ProductVariant = {
				...existing,
				...params,
				updatedAt: now,
			};
			await data.upsert(
				"productVariant",
				id,
				updated as unknown as Record<string, unknown>,
			);

			// Update product timestamp
			const product = (await data.get(
				"product",
				existing.productId,
			)) as Product | null;
			if (product) {
				await data.upsert("product", existing.productId, {
					...product,
					updatedAt: now,
				} as unknown as Record<string, unknown>);
			}

			return updated;
		},

		async deleteVariant(id: string): Promise<{ success: boolean }> {
			const variant = (await data.get(
				"productVariant",
				id,
			)) as ProductVariant | null;
			if (variant) {
				await data.delete("productVariant", id);

				const product = (await data.get(
					"product",
					variant.productId,
				)) as Product | null;
				if (product) {
					await data.upsert("product", variant.productId, {
						...product,
						updatedAt: new Date(),
					} as unknown as Record<string, unknown>);
				}
			}

			return { success: true };
		},

		// ── Categories ────────────────────────────────────────────────────

		async getCategory(id: string): Promise<Category | null> {
			return (await data.get("category", id)) as Category | null;
		},

		async getCategoryBySlug(slug: string): Promise<Category | null> {
			const categories = (await data.findMany("category", {
				where: { slug },
			})) as Category[];
			return categories[0] ?? null;
		},

		async listCategories(params?: {
			page?: number;
			limit?: number;
			parentId?: string;
			visible?: boolean;
		}) {
			const page = params?.page ?? 1;
			const limit = params?.limit ?? 50;

			const where: Record<string, unknown> = {};
			if (params?.parentId) where.parentId = params.parentId;
			if (params?.visible) where.isVisible = true;

			const categories = (await data.findMany("category", {
				where,
				take: limit,
				skip: (page - 1) * limit,
			})) as Category[];

			return {
				categories: categories.sort((a, b) => a.position - b.position),
				page,
				limit,
			};
		},

		async getCategoryTree(): Promise<CategoryWithChildren[]> {
			const allCategories = (await data.findMany("category", {
				where: { isVisible: true },
			})) as Category[];

			const rootCategories: CategoryWithChildren[] = [];
			const categoryMap = new Map<string, CategoryWithChildren>();

			for (const cat of allCategories) {
				categoryMap.set(cat.id, { ...cat, children: [] });
			}

			for (const cat of allCategories) {
				const catWithChildren = categoryMap.get(cat.id);
				if (!catWithChildren) continue;
				if (cat.parentId) {
					const parent = categoryMap.get(cat.parentId);
					if (parent) {
						parent.children.push(catWithChildren);
					} else {
						rootCategories.push(catWithChildren);
					}
				} else {
					rootCategories.push(catWithChildren);
				}
			}

			rootCategories.sort((a, b) => a.position - b.position);
			for (const cat of categoryMap.values()) {
				cat.children.sort((a, b) => a.position - b.position);
			}

			return rootCategories;
		},

		async createCategory(params: CreateCategoryParams): Promise<Category> {
			const now = new Date();
			const id = `cat_${crypto.randomUUID()}`;

			const category: Category = {
				id,
				name: params.name,
				slug: params.slug,
				description: params.description,
				parentId: params.parentId,
				image: params.image,
				position: params.position ?? 0,
				isVisible: params.isVisible ?? true,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"category",
				id,
				category as unknown as Record<string, unknown>,
			);
			return category;
		},

		async updateCategory(
			id: string,
			params: Partial<Category>,
		): Promise<Category> {
			const existing = (await data.get("category", id)) as Category | null;
			if (!existing) throw new Error(`Category ${id} not found`);

			const updated: Category = {
				...existing,
				...params,
				updatedAt: new Date(),
			};
			await data.upsert(
				"category",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteCategory(id: string): Promise<{ success: boolean }> {
			// Orphan products
			const products = (await data.findMany("product", {
				where: { categoryId: id },
			})) as Product[];

			for (const product of products) {
				await data.upsert("product", product.id, {
					...product,
					categoryId: undefined,
					updatedAt: new Date(),
				} as unknown as Record<string, unknown>);
			}

			// Orphan subcategories
			const subcategories = (await data.findMany("category", {
				where: { parentId: id },
			})) as Category[];

			for (const subcat of subcategories) {
				await data.upsert("category", subcat.id, {
					...subcat,
					parentId: undefined,
					updatedAt: new Date(),
				} as unknown as Record<string, unknown>);
			}

			await data.delete("category", id);
			return { success: true };
		},

		// ── Bulk ──────────────────────────────────────────────────────────

		async bulkUpdateStatus(
			ids: string[],
			status: "draft" | "active" | "archived",
		) {
			if (!ids.length) return { updated: 0 };

			const now = new Date();
			let updated = 0;

			for (const id of ids) {
				const product = (await data.get("product", id)) as Product | null;
				if (product) {
					await data.upsert("product", id, {
						...product,
						status,
						updatedAt: now,
					} as unknown as Record<string, unknown>);
					updated++;
				}
			}

			return { updated };
		},

		async bulkDelete(ids: string[]) {
			if (!ids.length) return { deleted: 0 };

			let deleted = 0;

			for (const id of ids) {
				const product = (await data.get("product", id)) as Product | null;
				if (!product) continue;

				const variants = (await data.findMany("productVariant", {
					where: { productId: id },
				})) as ProductVariant[];

				for (const variant of variants) {
					await data.delete("productVariant", variant.id);
				}

				await data.delete("product", id);
				deleted++;
			}

			return { deleted };
		},

		// ── Import ────────────────────────────────────────────────────────

		async importProducts(rows: ImportProductRow[]): Promise<ImportResult> {
			const created: string[] = [];
			const updated: string[] = [];
			const errors: ImportError[] = [];

			// Pre-fetch categories for name→id resolution
			const allCategories = (await data.findMany("category", {
				where: {},
			})) as Category[];
			const categoryByName = new Map<string, string>();
			for (const cat of allCategories) {
				categoryByName.set(cat.name.toLowerCase(), cat.id);
			}

			// Pre-fetch SKUs for update-by-SKU matching
			const allProducts = (await data.findMany("product", {
				where: {},
			})) as Product[];
			const productBySku = new Map<string, Product>();
			const slugSet = new Set<string>();
			for (const p of allProducts) {
				if (p.sku) productBySku.set(p.sku, p);
				slugSet.add(p.slug);
			}

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				try {
					if (!row.name || row.name.trim() === "") {
						errors.push({
							row: i + 1,
							field: "name",
							message: "Name is required",
						});
						continue;
					}
					if (row.price === undefined || row.price === null) {
						errors.push({
							row: i + 1,
							field: "price",
							message: "Price is required",
						});
						continue;
					}
					const price = Math.round(Number(row.price) * 100);
					if (Number.isNaN(price) || price <= 0) {
						errors.push({
							row: i + 1,
							field: "price",
							message: "Price must be a positive number",
						});
						continue;
					}

					const existingBySku = row.sku ? productBySku.get(row.sku) : undefined;
					if (existingBySku) {
						const updateFields: Partial<Product> = {
							name: row.name,
							price,
							updatedAt: new Date(),
						};
						if (row.description !== undefined)
							updateFields.description = row.description;
						if (row.shortDescription !== undefined)
							updateFields.shortDescription = row.shortDescription;
						if (row.compareAtPrice !== undefined)
							updateFields.compareAtPrice = Math.round(
								Number(row.compareAtPrice) * 100,
							);
						if (row.costPrice !== undefined)
							updateFields.costPrice = Math.round(Number(row.costPrice) * 100);
						if (row.inventory !== undefined)
							updateFields.inventory = Number(row.inventory);
						if (row.status !== undefined)
							updateFields.status = row.status as
								| "draft"
								| "active"
								| "archived";
						if (row.category) {
							const catId = categoryByName.get(row.category.toLowerCase());
							if (catId) updateFields.categoryId = catId;
						}
						if (row.tags !== undefined) updateFields.tags = row.tags;
						if (row.weight !== undefined)
							updateFields.weight = Number(row.weight);
						if (row.weightUnit !== undefined)
							updateFields.weightUnit = row.weightUnit as
								| "kg"
								| "lb"
								| "oz"
								| "g";
						if (row.featured !== undefined)
							updateFields.isFeatured = row.featured;
						if (row.trackInventory !== undefined)
							updateFields.trackInventory = row.trackInventory;
						if (row.allowBackorder !== undefined)
							updateFields.allowBackorder = row.allowBackorder;

						const updatedProduct = { ...existingBySku, ...updateFields };
						await data.upsert(
							"product",
							existingBySku.id,
							updatedProduct as unknown as Record<string, unknown>,
						);
						updated.push(existingBySku.id);
						continue;
					}

					let slug = row.slug || generateSlug(row.name);
					let slugAttempt = 0;
					const baseSlug = slug;
					while (slugSet.has(slug)) {
						slugAttempt++;
						slug = `${baseSlug}-${slugAttempt}`;
					}
					slugSet.add(slug);

					let categoryId: string | undefined;
					if (row.category) {
						categoryId = categoryByName.get(row.category.toLowerCase());
					}

					const now = new Date();
					const id = `prod_${crypto.randomUUID()}`;

					const product: Product = {
						id,
						name: row.name.trim(),
						slug,
						description: row.description,
						shortDescription: row.shortDescription,
						price,
						compareAtPrice: row.compareAtPrice
							? Math.round(Number(row.compareAtPrice) * 100)
							: undefined,
						costPrice: row.costPrice
							? Math.round(Number(row.costPrice) * 100)
							: undefined,
						sku: row.sku,
						barcode: row.barcode,
						inventory: row.inventory !== undefined ? Number(row.inventory) : 0,
						trackInventory: row.trackInventory ?? true,
						allowBackorder: row.allowBackorder ?? false,
						status: (row.status as "draft" | "active" | "archived") || "draft",
						categoryId,
						images: [],
						tags: row.tags ?? [],
						metadata: {},
						weight: row.weight !== undefined ? Number(row.weight) : undefined,
						weightUnit: (row.weightUnit as "kg" | "lb" | "oz" | "g") || "kg",
						isFeatured: row.featured ?? false,
						createdAt: now,
						updatedAt: now,
					};

					await data.upsert(
						"product",
						id,
						product as unknown as Record<string, unknown>,
					);
					created.push(id);
				} catch (err) {
					errors.push({
						row: i + 1,
						field: "unknown",
						message: err instanceof Error ? err.message : "Unknown error",
					});
				}
			}

			return { created: created.length, updated: updated.length, errors };
		},

		// ── Collections ───────────────────────────────────────────────────

		async getCollection(id: string): Promise<Collection | null> {
			return (await data.get("collection", id)) as Collection | null;
		},

		async getCollectionBySlug(slug: string): Promise<Collection | null> {
			const collections = (await data.findMany("collection", {
				where: { slug },
			})) as Collection[];
			return collections[0] ?? null;
		},

		async listCollections(params?: {
			page?: number;
			limit?: number;
			featured?: boolean;
			visible?: boolean;
		}) {
			const page = params?.page ?? 1;
			const limit = params?.limit ?? 50;

			const where: Record<string, unknown> = {};
			if (params?.featured) where.isFeatured = true;
			if (params?.visible) where.isVisible = true;

			const collections = (await data.findMany("collection", {
				where,
				take: limit,
				skip: (page - 1) * limit,
			})) as Collection[];

			return {
				collections: collections.sort((a, b) => a.position - b.position),
				page,
				limit,
			};
		},

		async searchCollections(q: string, limit?: number): Promise<Collection[]> {
			const collections = (await data.findMany("collection", {
				where: { isVisible: true },
			})) as Collection[];

			const queryLower = q.toLowerCase();
			const results = collections.filter(
				(c) =>
					c.name.toLowerCase().includes(queryLower) ||
					c.slug.toLowerCase().includes(queryLower) ||
					c.description?.toLowerCase().includes(queryLower),
			);

			return results
				.sort((a, b) => a.position - b.position)
				.slice(0, limit ?? 10);
		},

		async getCollectionWithProducts(
			id: string,
		): Promise<CollectionWithProducts | null> {
			const collection = (await data.get(
				"collection",
				id,
			)) as Collection | null;
			if (!collection) return null;

			const links = (await data.findMany("collectionProduct", {
				where: { collectionId: id },
			})) as CollectionProduct[];

			links.sort((a, b) => a.position - b.position);

			const products: Product[] = [];
			for (const link of links) {
				const product = (await data.get(
					"product",
					link.productId,
				)) as Product | null;
				if (product && product.status === "active") {
					products.push(product);
				}
			}

			return { ...collection, products };
		},

		async createCollection(
			params: CreateCollectionParams,
		): Promise<Collection> {
			const now = new Date();
			const id = `col_${crypto.randomUUID()}`;

			const collection: Collection = {
				id,
				name: params.name,
				slug: params.slug,
				description: params.description,
				image: params.image,
				isFeatured: params.isFeatured ?? false,
				isVisible: params.isVisible ?? true,
				position: params.position ?? 0,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"collection",
				id,
				collection as unknown as Record<string, unknown>,
			);
			return collection;
		},

		async updateCollection(
			id: string,
			params: Partial<Collection>,
		): Promise<Collection> {
			const existing = (await data.get("collection", id)) as Collection | null;
			if (!existing) throw new Error(`Collection ${id} not found`);

			const updated: Collection = {
				...existing,
				...params,
				updatedAt: new Date(),
			};
			await data.upsert(
				"collection",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteCollection(id: string): Promise<{ success: boolean }> {
			const links = (await data.findMany("collectionProduct", {
				where: { collectionId: id },
			})) as CollectionProduct[];

			for (const link of links) {
				await data.delete("collectionProduct", link.id);
			}

			await data.delete("collection", id);
			return { success: true };
		},

		async addProductToCollection(
			collectionId: string,
			productId: string,
			position?: number,
		): Promise<CollectionProduct> {
			const collection = (await data.get(
				"collection",
				collectionId,
			)) as Collection | null;
			if (!collection) throw new Error(`Collection ${collectionId} not found`);

			// Check duplicate
			const existing = (await data.findMany("collectionProduct", {
				where: { collectionId, productId },
			})) as CollectionProduct[];
			if (existing.length > 0) {
				return existing[0];
			}

			const linkId = `cp_${crypto.randomUUID()}`;
			const link: CollectionProduct = {
				id: linkId,
				collectionId,
				productId,
				position: position ?? 0,
				createdAt: new Date(),
			};

			await data.upsert(
				"collectionProduct",
				linkId,
				link as unknown as Record<string, unknown>,
			);

			// Update collection timestamp
			await data.upsert("collection", collectionId, {
				...collection,
				updatedAt: new Date(),
			} as unknown as Record<string, unknown>);

			return link;
		},

		async removeProductFromCollection(
			collectionId: string,
			productId: string,
		): Promise<{ success: boolean }> {
			const links = (await data.findMany("collectionProduct", {
				where: { collectionId, productId },
			})) as CollectionProduct[];

			for (const link of links) {
				await data.delete("collectionProduct", link.id);
			}

			const collection = (await data.get(
				"collection",
				collectionId,
			)) as Collection | null;
			if (collection) {
				await data.upsert("collection", collectionId, {
					...collection,
					updatedAt: new Date(),
				} as unknown as Record<string, unknown>);
			}

			return { success: true };
		},

		async listCollectionProducts(
			collectionId: string,
		): Promise<{ products: Product[] }> {
			const collection = (await data.get(
				"collection",
				collectionId,
			)) as Collection | null;
			if (!collection) return { products: [] };

			const links = (await data.findMany("collectionProduct", {
				where: { collectionId },
			})) as CollectionProduct[];

			links.sort((a, b) => a.position - b.position);

			const products: Product[] = [];
			for (const link of links) {
				const product = (await data.get(
					"product",
					link.productId,
				)) as Product | null;
				if (product) {
					products.push(product);
				}
			}

			return { products };
		},
	};
}
