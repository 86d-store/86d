import type { ModuleController } from "@86d-app/core/types/module";

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

export type CategoryWithChildren = Category & {
	children: CategoryWithChildren[];
};

export type ProductWithVariants = Product & {
	variants: ProductVariant[];
	category?: Category | undefined;
};

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

export type CreateProductParams = {
	name: string;
	slug: string;
	price: number;
	description?: string | undefined;
	shortDescription?: string | undefined;
	compareAtPrice?: number | undefined;
	costPrice?: number | undefined;
	sku?: string | undefined;
	barcode?: string | undefined;
	inventory?: number | undefined;
	trackInventory?: boolean | undefined;
	allowBackorder?: boolean | undefined;
	status?: "draft" | "active" | "archived" | undefined;
	categoryId?: string | undefined;
	images?: string[] | undefined;
	tags?: string[] | undefined;
	metadata?: Record<string, unknown> | undefined;
	weight?: number | undefined;
	weightUnit?: "kg" | "lb" | "oz" | "g" | undefined;
	isFeatured?: boolean | undefined;
};

export type CreateVariantParams = {
	productId: string;
	name: string;
	price: number;
	options: Record<string, string>;
	sku?: string | undefined;
	barcode?: string | undefined;
	compareAtPrice?: number | undefined;
	costPrice?: number | undefined;
	inventory?: number | undefined;
	images?: string[] | undefined;
	weight?: number | undefined;
	weightUnit?: "kg" | "lb" | "oz" | "g" | undefined;
	position?: number | undefined;
};

export type CreateCategoryParams = {
	name: string;
	slug: string;
	description?: string | undefined;
	parentId?: string | undefined;
	image?: string | undefined;
	position?: number | undefined;
	isVisible?: boolean | undefined;
	metadata?: Record<string, unknown> | undefined;
};

export type CreateCollectionParams = {
	name: string;
	slug: string;
	description?: string | undefined;
	image?: string | undefined;
	isFeatured?: boolean | undefined;
	isVisible?: boolean | undefined;
	position?: number | undefined;
	metadata?: Record<string, unknown> | undefined;
};

export type ListProductsParams = {
	page?: number | undefined;
	limit?: number | undefined;
	category?: string | undefined;
	status?: string | undefined;
	featured?: boolean | undefined;
	search?: string | undefined;
	sort?: string | undefined;
	order?: string | undefined;
	minPrice?: number | undefined;
	maxPrice?: number | undefined;
	inStock?: boolean | undefined;
	tag?: string | undefined;
};

export type ProductController = ModuleController & {
	// ── Products ──
	createProduct(params: CreateProductParams): Promise<Product>;
	getProduct(id: string): Promise<Product | null>;
	getProductBySlug(slug: string): Promise<Product | null>;
	getProductWithVariants(id: string): Promise<ProductWithVariants | null>;
	listProducts(params?: ListProductsParams): Promise<{
		products: ProductWithVariants[];
		total: number;
		page: number;
		limit: number;
	}>;
	searchProducts(q: string, limit?: number): Promise<Product[]>;
	getFeaturedProducts(limit?: number): Promise<Product[]>;
	getProductsByCategory(categoryId: string): Promise<Product[]>;
	getRelatedProducts(
		id: string,
		limit?: number,
	): Promise<{ products: Product[] }>;
	updateProduct(id: string, params: Partial<Product>): Promise<Product>;
	deleteProduct(id: string): Promise<{ success: boolean }>;

	// ── Inventory ──
	checkAvailability(
		productId: string,
		variantId?: string,
		quantity?: number,
	): Promise<{
		available: boolean;
		inventory: number;
		allowBackorder: boolean;
	}>;
	decrementInventory(
		productId: string,
		quantity: number,
		variantId?: string,
	): Promise<{ success: boolean }>;
	incrementInventory(
		productId: string,
		quantity: number,
		variantId?: string,
	): Promise<{ success: boolean }>;

	// ── Variants ──
	getVariant(id: string): Promise<ProductVariant | null>;
	getVariantsByProduct(productId: string): Promise<ProductVariant[]>;
	createVariant(params: CreateVariantParams): Promise<ProductVariant>;
	updateVariant(
		id: string,
		params: Partial<ProductVariant>,
	): Promise<ProductVariant>;
	deleteVariant(id: string): Promise<{ success: boolean }>;

	// ── Categories ──
	getCategory(id: string): Promise<Category | null>;
	getCategoryBySlug(slug: string): Promise<Category | null>;
	listCategories(params?: {
		page?: number;
		limit?: number;
		parentId?: string;
		visible?: boolean;
	}): Promise<{ categories: Category[]; page: number; limit: number }>;
	getCategoryTree(): Promise<CategoryWithChildren[]>;
	createCategory(params: CreateCategoryParams): Promise<Category>;
	updateCategory(id: string, params: Partial<Category>): Promise<Category>;
	deleteCategory(id: string): Promise<{ success: boolean }>;

	// ── Bulk ──
	bulkUpdateStatus(
		ids: string[],
		status: "draft" | "active" | "archived",
	): Promise<{ updated: number }>;
	bulkDelete(ids: string[]): Promise<{ deleted: number }>;

	// ── Import ──
	importProducts(rows: ImportProductRow[]): Promise<ImportResult>;

	// ── Collections ──
	getCollection(id: string): Promise<Collection | null>;
	getCollectionBySlug(slug: string): Promise<Collection | null>;
	listCollections(params?: {
		page?: number;
		limit?: number;
		featured?: boolean;
		visible?: boolean;
	}): Promise<{ collections: Collection[]; page: number; limit: number }>;
	searchCollections(q: string, limit?: number): Promise<Collection[]>;
	getCollectionWithProducts(id: string): Promise<CollectionWithProducts | null>;
	createCollection(params: CreateCollectionParams): Promise<Collection>;
	updateCollection(
		id: string,
		params: Partial<Collection>,
	): Promise<Collection>;
	deleteCollection(id: string): Promise<{ success: boolean }>;
	addProductToCollection(
		collectionId: string,
		productId: string,
		position?: number,
	): Promise<CollectionProduct>;
	removeProductFromCollection(
		collectionId: string,
		productId: string,
	): Promise<{ success: boolean }>;
	listCollectionProducts(
		collectionId: string,
	): Promise<{ products: Product[] }>;
};
