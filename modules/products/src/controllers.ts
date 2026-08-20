import type { ModuleControllers } from "@86d-app/core/types/module";

/**
 * Product data types
 */
export type Product = {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	shortDescription?: string | undefined;
	price: number;
	compareAtPrice?: number | undefined;
	costPrice?: number | undefined;
	sku?: string | undefined;
	barcode?: string | undefined;
	inventory: number;
	trackInventory: boolean;
	allowBackorder: boolean;
	status: "draft" | "active" | "archived";
	categoryId?: string | undefined;
	images: string[];
	tags: string[];
	metadata?: Record<string, unknown> | undefined;
	weight?: number | undefined;
	weightUnit?: "kg" | "lb" | "oz" | "g" | undefined;
	isFeatured: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type ProductVariant = {
	id: string;
	productId: string;
	name: string;
	sku?: string | undefined;
	barcode?: string | undefined;
	price: number;
	compareAtPrice?: number | undefined;
	costPrice?: number | undefined;
	inventory: number;
	options: Record<string, string>;
	images: string[];
	weight?: number | undefined;
	weightUnit?: "kg" | "lb" | "oz" | "g" | undefined;
	position: number;
	createdAt: Date;
	updatedAt: Date;
};

export type Category = {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	parentId?: string | undefined;
	image?: string | undefined;
	position: number;
	isVisible: boolean;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type ProductWithVariants = Product & {
	variants: ProductVariant[];
	category?: Category | undefined;
};

/**
 * Collection data types
 */
export type Collection = {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	image?: string | undefined;
	isFeatured: boolean;
	isVisible: boolean;
	position: number;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type CollectionProduct = {
	id: string;
	collectionId: string;
	productId: string;
	position: number;
	createdAt: Date;
};

export type CollectionWithProducts = Collection & {
	products: Product[];
};

/**
 * CSV Import types
 */
export type ImportProductRow = {
	name: string;
	slug?: string | undefined;
	price: number | string;
	sku?: string | undefined;
	barcode?: string | undefined;
	description?: string | undefined;
	shortDescription?: string | undefined;
	compareAtPrice?: number | string | undefined;
	costPrice?: number | string | undefined;
	inventory?: number | string | undefined;
	status?: string | undefined;
	category?: string | undefined;
	tags?: string[] | undefined;
	weight?: number | string | undefined;
	weightUnit?: string | undefined;
	featured?: boolean | undefined;
	trackInventory?: boolean | undefined;
	allowBackorder?: boolean | undefined;
};

export type ImportError = {
	row: number;
	field: string;
	message: string;
};

export type ImportResult = {
	created: number;
	updated: number;
	errors: ImportError[];
};

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Product controllers
 * Access via: context.controllers.product.getById(ctx)
 */
export const controllers: ModuleControllers = {
	product: {
		async getById(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };

			return (await data.get("product", id)) as Product | null;
		},

		async getBySlug(ctx) {
			const { data } = ctx.context;
			const { slug } = ctx.query as { slug: string };
			const products = (await data.findMany("product", {
				where: { slug },
			})) as Product[];
			return products[0] || null;
		},

		async getWithVariants(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };

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

			return { ...product, variants, category } as ProductWithVariants;
		},

		async list(ctx) {
			const { data } = ctx.context;
			const query = (ctx.query || {}) as {
				page?: string;
				limit?: string;
				category?: string;
				status?: string;
				featured?: string;
				search?: string;
				sort?: string;
				order?: string;
				minPrice?: string;
				maxPrice?: string;
				inStock?: string;
				tag?: string;
			};

			const page = query.page ? parseInt(query.page, 10) : 1;
			const limit = query.limit ? parseInt(query.limit, 10) : 20;

			const where: Record<string, unknown> = {};
			if (query.category) where.categoryId = query.category;
			if (query.status) where.status = query.status;
			if (query.featured === "true") where.isFeatured = true;

			// Fetch all matching products for client-side filters + total count
			let allProducts = (await data.findMany("product", {
				where,
				orderBy: query.sort
					? { [query.sort]: query.order || "desc" }
					: { createdAt: "desc" },
			})) as Product[];

			// Apply price range filter
			const minPrice = query.minPrice
				? parseInt(query.minPrice, 10)
				: undefined;
			const maxPrice = query.maxPrice
				? parseInt(query.maxPrice, 10)
				: undefined;
			if (minPrice !== undefined) {
				allProducts = allProducts.filter((p) => p.price >= minPrice);
			}
			if (maxPrice !== undefined) {
				allProducts = allProducts.filter((p) => p.price <= maxPrice);
			}

			// Apply in-stock filter
			if (query.inStock === "true") {
				allProducts = allProducts.filter((p) => p.inventory > 0);
			}

			// Apply tag filter
			if (query.tag) {
				const tagLower = query.tag.toLowerCase();
				allProducts = allProducts.filter((p) =>
					p.tags.some((t) => t.toLowerCase() === tagLower),
				);
			}

			// Apply search filter (name, description, tags)
			if (query.search) {
				const searchLower = query.search.toLowerCase();
				allProducts = allProducts.filter(
					(p) =>
						p.name.toLowerCase().includes(searchLower) ||
						p.description?.toLowerCase().includes(searchLower) ||
						p.tags.some((t) => t.toLowerCase().includes(searchLower)),
				);
			}

			const total = allProducts.length;

			// Paginate
			const paged = allProducts.slice((page - 1) * limit, page * limit);

			// Get variants and categories for each product on this page
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

			return {
				products: productsWithVariants,
				total,
				page,
				limit,
			};
		},

		async search(ctx) {
			const { data } = ctx.context;
			const { q, limit: limitStr } = ctx.query as { q: string; limit?: string };
			const limit = limitStr ? parseInt(limitStr, 10) : 20;

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

			return results.slice(0, limit);
		},

		async getFeatured(ctx) {
			const { data } = ctx.context;
			const { limit: limitStr } = (ctx.query || {}) as { limit?: string };
			const limit = limitStr ? parseInt(limitStr, 10) : 10;

			return (await data.findMany("product", {
				where: { isFeatured: true, status: "active" },
				take: limit,
			})) as Product[];
		},

		async getByCategory(ctx) {
			const { data } = ctx.context;
			const { categoryId } = ctx.params as { categoryId: string };

			return (await data.findMany("product", {
				where: { categoryId, status: "active" },
			})) as Product[];
		},

		async getRelated(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };
			const { limit: limitStr } = (ctx.query || {}) as { limit?: string };
			const limit = limitStr ? parseInt(limitStr, 10) : 4;

			const product = (await data.get("product", id)) as Product | null;
			if (!product) return { products: [] };

			// Get all active products except the current one
			const all = (
				(await data.findMany("product", {
					where: { status: "active" },
				})) as Product[]
			).filter((p) => p.id !== id);

			// Score by relevance: same category > shared tags > nothing
			const scored = all.map((p) => {
				let score = 0;
				if (product.categoryId && p.categoryId === product.categoryId) {
					score += 10;
				}
				const sharedTags = p.tags.filter((t) => product.tags.includes(t));
				score += sharedTags.length;
				return { product: p, score };
			});

			// Sort by score desc, take top N
			scored.sort((a, b) => b.score - a.score);
			const related = scored.slice(0, limit).map((s) => s.product);

			return { products: related };
		},

		async create(ctx) {
			const { data } = ctx.context;
			const body = ctx.body as Partial<Product> & {
				name: string;
				slug: string;
				price: number;
			};

			const now = new Date();
			const id = `prod_${Date.now()}`;

			const product: Product = {
				id,
				name: body.name,
				slug: body.slug,
				description: body.description,
				shortDescription: body.shortDescription,
				price: body.price,
				compareAtPrice: body.compareAtPrice,
				costPrice: body.costPrice,
				sku: body.sku,
				barcode: body.barcode,
				inventory: body.inventory ?? 0,
				trackInventory: body.trackInventory ?? true,
				allowBackorder: body.allowBackorder ?? false,
				status: body.status ?? "draft",
				categoryId: body.categoryId,
				images: body.images ?? [],
				tags: body.tags ?? [],
				metadata: body.metadata ?? {},
				weight: body.weight,
				weightUnit: body.weightUnit ?? "kg",
				isFeatured: body.isFeatured ?? false,
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

		async update(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };
			const body = ctx.body as Partial<Product>;

			const existing = (await data.get("product", id)) as Product | null;
			if (!existing) throw new Error(`Product ${id} not found`);

			const updated: Product = { ...existing, ...body, updatedAt: new Date() };
			await data.upsert(
				"product",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async delete(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };

			const variants = (await data.findMany("productVariant", {
				where: { productId: id },
			})) as ProductVariant[];

			for (const variant of variants) {
				await data.delete("productVariant", variant.id);
			}

			await data.delete("product", id);
			return { success: true };
		},

		async checkAvailability(ctx) {
			const { data } = ctx.context;
			const {
				productId,
				variantId,
				quantity: qtyStr,
			} = ctx.query as {
				productId: string;
				variantId?: string;
				quantity?: string;
			};
			const quantity = qtyStr ? parseInt(qtyStr, 10) : 1;

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
					available: variant.inventory >= quantity || allowBackorder,
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
				available: product.inventory >= quantity || product.allowBackorder,
				inventory: product.inventory,
				allowBackorder: product.allowBackorder,
			};
		},

		async decrementInventory(ctx) {
			const { data } = ctx.context;
			const { productId, variantId } = ctx.params as {
				productId: string;
				variantId?: string;
			};
			const { quantity } = ctx.body as { quantity: number };

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

		async incrementInventory(ctx) {
			const { data } = ctx.context;
			const { productId, variantId } = ctx.params as {
				productId: string;
				variantId?: string;
			};
			const { quantity } = ctx.body as { quantity: number };

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
	},

	variant: {
		async getById(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };
			return (await data.get("productVariant", id)) as ProductVariant | null;
		},

		async getByProduct(ctx) {
			const { data } = ctx.context;
			const { productId } = ctx.params as { productId: string };

			const variants = (await data.findMany("productVariant", {
				where: { productId },
			})) as ProductVariant[];

			return variants.sort((a, b) => a.position - b.position);
		},

		async create(ctx) {
			const { data } = ctx.context;
			const { productId } = ctx.params as { productId: string };
			const body = ctx.body as Partial<ProductVariant> & {
				name: string;
				price: number;
				options: Record<string, string>;
			};

			const now = new Date();
			const id = `var_${Date.now()}`;

			const variant: ProductVariant = {
				id,
				productId,
				name: body.name,
				sku: body.sku,
				barcode: body.barcode,
				price: body.price,
				compareAtPrice: body.compareAtPrice,
				costPrice: body.costPrice,
				inventory: body.inventory ?? 0,
				options: body.options,
				images: body.images ?? [],
				weight: body.weight,
				weightUnit: body.weightUnit,
				position: body.position ?? 0,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"productVariant",
				id,
				variant as unknown as Record<string, unknown>,
			);

			// Update product timestamp
			const product = (await data.get("product", productId)) as Product | null;
			if (product) {
				await data.upsert("product", productId, {
					...product,
					updatedAt: now,
				} as unknown as Record<string, unknown>);
			}

			return variant;
		},

		async update(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };
			const body = ctx.body as Partial<ProductVariant>;

			const existing = (await data.get(
				"productVariant",
				id,
			)) as ProductVariant | null;
			if (!existing) throw new Error(`Variant ${id} not found`);

			const now = new Date();
			const updated: ProductVariant = { ...existing, ...body, updatedAt: now };
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

		async delete(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };

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
	},

	category: {
		async getById(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };
			return (await data.get("category", id)) as Category | null;
		},

		async getBySlug(ctx) {
			const { data } = ctx.context;
			const { slug } = ctx.query as { slug: string };

			const categories = (await data.findMany("category", {
				where: { slug },
			})) as Category[];

			return categories[0] || null;
		},

		async list(ctx) {
			const { data } = ctx.context;
			const query = (ctx.query || {}) as {
				page?: string;
				limit?: string;
				parentId?: string;
				visible?: string;
			};

			const page = query.page ? parseInt(query.page, 10) : 1;
			const limit = query.limit ? parseInt(query.limit, 10) : 50;

			const where: Record<string, unknown> = {};
			if (query.parentId) where.parentId = query.parentId;
			if (query.visible === "true") where.isVisible = true;

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

		async getTree(ctx) {
			const { data } = ctx.context;

			const allCategories = (await data.findMany("category", {
				where: { isVisible: true },
			})) as Category[];

			const rootCategories: (Category & { children: Category[] })[] = [];
			const categoryMap = new Map<
				string,
				Category & { children: Category[] }
			>();

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

		async create(ctx) {
			const { data } = ctx.context;
			const body = ctx.body as Partial<Category> & {
				name: string;
				slug: string;
			};

			const now = new Date();
			const id = `cat_${Date.now()}`;

			const category: Category = {
				id,
				name: body.name,
				slug: body.slug,
				description: body.description,
				parentId: body.parentId,
				image: body.image,
				position: body.position ?? 0,
				isVisible: body.isVisible ?? true,
				metadata: body.metadata ?? {},
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

		async update(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };
			const body = ctx.body as Partial<Category>;

			const existing = (await data.get("category", id)) as Category | null;
			if (!existing) throw new Error(`Category ${id} not found`);

			const updated: Category = { ...existing, ...body, updatedAt: new Date() };
			await data.upsert(
				"category",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async delete(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };

			// Remove category from products
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

			// Remove from subcategories
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
	},

	bulk: {
		async updateStatus(ctx) {
			const { data } = ctx.context;
			const { ids, status } = ctx.body as {
				ids: string[];
				status: "draft" | "active" | "archived";
			};

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

		async deleteMany(ctx) {
			const { data } = ctx.context;
			const { ids } = ctx.body as { ids: string[] };

			if (!ids.length) return { deleted: 0 };

			let deleted = 0;

			for (const id of ids) {
				const product = (await data.get("product", id)) as Product | null;
				if (!product) continue;

				// Delete associated variants
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
	},

	import: {
		async importProducts(ctx) {
			const { data } = ctx.context;
			const { products: rows } = ctx.body as {
				products: ImportProductRow[];
			};

			const created: string[] = [];
			const updated: string[] = [];
			const errors: ImportError[] = [];

			// Pre-fetch all categories for name→id resolution
			const allCategories = (await data.findMany("category", {
				where: {},
			})) as Category[];
			const categoryByName = new Map<string, string>();
			for (const cat of allCategories) {
				categoryByName.set(cat.name.toLowerCase(), cat.id);
			}

			// Pre-fetch existing SKUs for update-by-SKU matching
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
					// Validate required fields
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

					// Check if updating existing product by SKU
					const existingBySku = row.sku ? productBySku.get(row.sku) : undefined;
					if (existingBySku) {
						// Update existing product
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

						const updatedProduct = {
							...existingBySku,
							...updateFields,
						};
						await data.upsert(
							"product",
							existingBySku.id,
							updatedProduct as unknown as Record<string, unknown>,
						);
						updated.push(existingBySku.id);
						continue;
					}

					// Generate slug if not provided
					let slug = row.slug || generateSlug(row.name);
					// Ensure slug uniqueness
					let slugAttempt = 0;
					const baseSlug = slug;
					while (slugSet.has(slug)) {
						slugAttempt++;
						slug = `${baseSlug}-${slugAttempt}`;
					}
					slugSet.add(slug);

					// Resolve category name to ID
					let categoryId: string | undefined;
					if (row.category) {
						categoryId = categoryByName.get(row.category.toLowerCase());
					}

					const now = new Date();
					const id = `prod_${Date.now()}_${i}`;

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
	},

	collection: {
		async getById(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };
			return (await data.get("collection", id)) as Collection | null;
		},

		async getBySlug(ctx) {
			const { data } = ctx.context;
			const { slug } = ctx.query as { slug: string };
			const collections = (await data.findMany("collection", {
				where: { slug },
			})) as Collection[];
			return collections[0] || null;
		},

		async list(ctx) {
			const { data } = ctx.context;
			const query = (ctx.query || {}) as {
				page?: string;
				limit?: string;
				featured?: string;
				visible?: string;
			};

			const page = query.page ? parseInt(query.page, 10) : 1;
			const limit = query.limit ? parseInt(query.limit, 10) : 50;

			const where: Record<string, unknown> = {};
			if (query.featured === "true") where.isFeatured = true;
			if (query.visible === "true") where.isVisible = true;

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

		async search(ctx) {
			const { data } = ctx.context;
			const { q, limit: limitStr } = ctx.query as { q: string; limit?: string };
			const limit = limitStr ? parseInt(limitStr, 10) : 10;

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

			return results.sort((a, b) => a.position - b.position).slice(0, limit);
		},

		async getWithProducts(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };

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

			return { ...collection, products } as CollectionWithProducts;
		},

		async create(ctx) {
			const { data } = ctx.context;
			const body = ctx.body as Partial<Collection> & {
				name: string;
				slug: string;
			};

			const now = new Date();
			const id = `col_${Date.now()}`;

			const collection: Collection = {
				id,
				name: body.name,
				slug: body.slug,
				description: body.description,
				image: body.image,
				isFeatured: body.isFeatured ?? false,
				isVisible: body.isVisible ?? true,
				position: body.position ?? 0,
				metadata: body.metadata ?? {},
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

		async update(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };
			const body = ctx.body as Partial<Collection>;

			const existing = (await data.get("collection", id)) as Collection | null;
			if (!existing) throw new Error(`Collection ${id} not found`);

			const updated: Collection = {
				...existing,
				...body,
				updatedAt: new Date(),
			};
			await data.upsert(
				"collection",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async delete(ctx) {
			const { data } = ctx.context;
			const { id } = ctx.params as { id: string };

			// Remove all collection-product links
			const links = (await data.findMany("collectionProduct", {
				where: { collectionId: id },
			})) as CollectionProduct[];

			for (const link of links) {
				await data.delete("collectionProduct", link.id);
			}

			await data.delete("collection", id);
			return { success: true };
		},

		async addProduct(ctx) {
			const { data } = ctx.context;
			const { id: collectionId } = ctx.params as { id: string };
			const { productId, position } = ctx.body as {
				productId: string;
				position?: number | undefined;
			};

			// Check collection exists
			const collection = (await data.get(
				"collection",
				collectionId,
			)) as Collection | null;
			if (!collection) throw new Error(`Collection ${collectionId} not found`);

			// Check if product already in collection
			const existing = (await data.findMany("collectionProduct", {
				where: { collectionId, productId },
			})) as CollectionProduct[];
			if (existing.length > 0) {
				return existing[0];
			}

			const linkId = `cp_${Date.now()}`;
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

		async removeProduct(ctx) {
			const { data } = ctx.context;
			const { id: collectionId, productId } = ctx.params as {
				id: string;
				productId: string;
			};

			const links = (await data.findMany("collectionProduct", {
				where: { collectionId, productId },
			})) as CollectionProduct[];

			for (const link of links) {
				await data.delete("collectionProduct", link.id);
			}

			// Update collection timestamp
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

		async listProducts(ctx) {
			const { data } = ctx.context;
			const { id: collectionId } = ctx.params as { id: string };

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
	},
};

export type ProductsControllers = typeof controllers;
